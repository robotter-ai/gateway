import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import {
  BigNumber,
  PoolService,
  Trade,
  TradeRouter,
} from '@galacticcouncil/sdk';

const tokens = {
  hdx: {
    id: '0',
    name: 'Hydration',
    symbol: 'HDX',
    decimals: 12,
    icon: 'HDX',
    type: 'Token',
    isSufficient: true,
    existentialDeposit: '1000000000000',
    meta: 'undefined',
    location: 'undefined',
    isWhiteListed: 'undefined',
  },
  dot: {
    id: '5',
    name: 'Polkadot',
    symbol: 'DOT',
    decimals: 10,
    icon: 'DOT',
    type: 'Token',
    isSufficient: true,
    existentialDeposit: '17540000',
    meta: 'undefined',
    location: {
      parents: 1,
    },
    isWhiteListed: 'undefined',
  },
  usdt: {
    id: '10',
    name: 'USDT (Polkadot Asset Hub)',
    symbol: 'USDT',
    decimals: 6,
    icon: 'USDT',
    type: 'Token',
    isSufficient: true,
    existentialDeposit: '10000',
    meta: 'undefined',
    location: {
      parents: 1,
    },
    isWhiteListed: 'undefined',
  },
};

const USDTAmountToReceive = BigNumber('0.02');
const USDTAmountToTrade = BigNumber('0.02');
const HDXAmountToReceive = BigNumber('3');
const HDXAmountToTrade = BigNumber('3');
const maxSlippage = BigNumber('1'); // 1%

let api: ApiPromise;
let keyPair: any;
let tradeRouter: TradeRouter;

function calculateTradeLimit(
  trade: Trade,
  slippagePercentage: BigNumber,
  side: 'buy' | 'sell',
): BigNumber {
  const ONE_HUNDRED = BigNumber('100');

  let amount: BigNumber;
  let slippage: BigNumber;
  let tradeLimit: BigNumber;
  if (side === 'buy') {
    // maxAmountIn

    amount = trade.amountIn;

    slippage = amount
      .div(ONE_HUNDRED)
      .multipliedBy(slippagePercentage)
      .decimalPlaces(0, 1);

    tradeLimit = amount.plus(slippage);
  } else if (side === 'sell') {
    // minAmountOut

    amount = trade.amountOut;

    slippage = amount
      .div(ONE_HUNDRED)
      .multipliedBy(slippagePercentage)
      .decimalPlaces(0, 1);

    tradeLimit = amount.minus(slippage);
  } else {
    throw new Error('Invalid side');
  }

  // console.log(`Trade: ${JSON.stringify(trade, null, 2)}`);
  console.log(`trade -> amountOut: ${trade.amountOut}`);
  console.log(`trade -> amountIn: ${trade.amountIn}`);
  console.log(`trade -> spotPrice: ${trade.spotPrice}`);
  console.log(`Side: ${side}`);
  console.log(`Amount: ${amount.toString()}`);
  console.log(`Slippage percentage: ${slippagePercentage.toString()}%`);
  console.log(`Slippage: ${slippage.toString()}`);
  console.log(
    `Trade limit (${side === 'buy' ? 'maxAmountIn' : 'minAmountOut'}): ${tradeLimit.toString()}`,
  );

  return tradeLimit;
}

async function initializeAPI() {
  await cryptoWaitReady();
  const wsProvider = new WsProvider('wss://rpc.hydradx.cloud');
  api = await ApiPromise.create({ provider: wsProvider });

  const keyring = new Keyring({ type: 'sr25519' });
  keyPair = keyring.addFromUri(process.env.MNEMONIC);

  const poolService = new PoolService(api);
  await poolService.syncRegistry();
  tradeRouter = new TradeRouter(poolService);
}

async function getBalances(
  accountAddress: string,
  tokenSymbols: string[],
): Promise<Record<string, string>> {
  const { data: nativeBalanceData } = (await api.query.system.account(
    accountAddress,
  )) as any;

  const tokenBalances: Record<string, string> = {};

  const nativeDecimals = tokens.hdx.decimals || 12;
  const nativeBalance = new BigNumber(nativeBalanceData.free?.toString() ?? '0')
    .div(BigNumber(Math.pow(10, nativeDecimals)))
    .toFixed(nativeDecimals);
  tokenBalances[tokens.hdx.symbol] = nativeBalance;

  for (const tokenSymbol of tokenSymbols) {
    if (tokenSymbol === tokens.hdx.symbol) continue;

    const token = tokens[tokenSymbol.toLowerCase()];
    if (!token) {
      throw new Error(`Token ${tokenSymbol} not found`);
    }

    const assetBalance = (await api.query.tokens.accounts(
      accountAddress,
      token.id,
    )) as any;

    tokenBalances[tokenSymbol] = new BigNumber(String(assetBalance?.free || 0))
      .div(new BigNumber(Math.pow(10, token.decimals)))
      .toFixed(token.decimals);
  }

  return tokenBalances;
}

async function executeTrade(
  tokenIn: string,
  tokenOut: string,
  amount: BigNumber,
  side: 'buy' | 'sell',
) {
  const trade: Trade =
    side === 'buy'
      ? await tradeRouter.getBestBuy(tokenIn, tokenOut, amount)
      : await tradeRouter.getBestSell(tokenIn, tokenOut, amount);

  if (trade) {
    console.log(
      `Route found: ${trade.swaps
        .map((pool) => pool.poolAddress)
        .join(' -> ')}`,
    );
    console.log(
      `Estimated ${side === 'buy' ? 'output' : 'input'} amount: ${side === 'buy' ? trade.amountOut : trade.amountIn}`,
    );

    const tradeLimit = calculateTradeLimit(trade, maxSlippage, side);

    const transaction = trade.toTx(tradeLimit).get<any>();

    try {
      const txHash = await new Promise<string>((resolve, reject) => {
        transaction.signAndSend(keyPair, (result) => {
          if (result.dispatchError) {
            if (result.dispatchError.isModule) {
              const decoded = api.registry.findMetaError(
                result.dispatchError.asModule,
              );
              const { name } = decoded;
              console.error(`Error: ${name}`);
              reject(name);
            } else {
              console.error('Unknown error:', result.dispatchError.toString());
              reject(result.dispatchError.toString());
            }
          } else if (result.status.isInBlock) {
            const hash = result.status.asInBlock.toString();
            console.log('Swap done! TX HASH:', hash);
            resolve(hash);
          }
        });
      });

      return {
        txHash,
        error: '',
      };
    } catch (err) {
      return {
        txHash: '',
        error: err as string,
      };
    }
  } else {
    console.log('No route found for the swap.');
    return {
      txHash: '',
      error: 'No route found',
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function test01() {
  try {
    console.log('\n\nStarting test01...');
    console.log(
      'Balances before: ',
      await getBalances(keyPair.address, ['HDX', 'DOT', 'USDT']),
    );

    const tokenIn = tokens.usdt.id;
    const tokenOut = tokens.hdx.id;
    const amount = HDXAmountToReceive;
    console.log(`Buying ${amount} HDX with USDT`);
    return await executeTrade(tokenIn, tokenOut, amount, 'buy');
  } catch (error) {
    console.error('Error in test01:', error);
    throw error;
  } finally {
    console.log(
      'Balances after: ',
      await getBalances(keyPair.address, ['HDX', 'DOT', 'USDT']),
    );
    console.log('Finished test01.\n\n');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function test02() {
  try {
    console.log('\n\nStarting test02...');
    console.log(
      'Balances before: ',
      await getBalances(keyPair.address, ['HDX', 'DOT', 'USDT']),
    );

    const tokenIn = tokens.hdx.id;
    const tokenOut = tokens.usdt.id;
    const amount = USDTAmountToReceive;
    console.log(`Buying ${amount} USDT with HDX`);
    return await executeTrade(tokenIn, tokenOut, amount, 'buy');
  } catch (error) {
    console.error('Error in test02:', error);
    throw error;
  } finally {
    console.log(
      'Balances after: ',
      await getBalances(keyPair.address, ['HDX', 'DOT', 'USDT']),
    );
    console.log('Finished test02.\n\n');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function test03() {
  try {
    console.log('\n\nStarting test03...');
    console.log(
      'Balances before: ',
      await getBalances(keyPair.address, ['HDX', 'DOT', 'USDT']),
    );

    const tokenIn = tokens.hdx.id;
    const tokenOut = tokens.usdt.id;
    const amount = HDXAmountToTrade;
    console.log(`Selling ${amount} HDX for USDT`);
    return await executeTrade(tokenIn, tokenOut, amount, 'sell');
  } catch (error) {
    console.error('Error in test03:', error);
    throw error;
  } finally {
    console.log(
      'Balances after: ',
      await getBalances(keyPair.address, ['HDX', 'DOT', 'USDT']),
    );
    console.log('Finished test03.\n\n');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function test04() {
  try {
    console.log('\n\nStarting test04...');
    console.log(
      'Balances before: ',
      await getBalances(keyPair.address, ['HDX', 'DOT', 'USDT']),
    );

    const tokenIn = tokens.usdt.id;
    const tokenOut = tokens.hdx.id;
    const amount = USDTAmountToTrade;
    console.log(`Selling ${amount} USDT for HDX`);
    return await executeTrade(tokenIn, tokenOut, amount, 'sell');
  } catch (error) {
    console.error('Error in test04:', error);
    throw error;
  } finally {
    console.log(
      'Balances after: ',
      await getBalances(keyPair.address, ['HDX', 'DOT', 'USDT']),
    );
    console.log('Finished test04.\n\n');
  }
}

(async () => {
  await initializeAPI();

  // console.log(await getBalances(keyPair.address, ['HDX', 'DOT', 'USDT']));

  console.log(await test01());
  console.log(await test02());
  console.log(await test03());
  console.log(await test04());
})();
