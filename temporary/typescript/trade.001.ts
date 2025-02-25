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

const buyHDXWithUSDTAmount = BigNumber('1');
const sellHDXForUSDTAmount = BigNumber('1');
const buyUSDTWithHDXAmount = BigNumber('0.1');
const sellUSDTForHDXAmount = BigNumber('0.1');
const ONE = BigNumber('1');
const maxSlippage = BigNumber('0.01'); // 1%

let api: ApiPromise;
let keyPair: any;
let tradeRouter: TradeRouter;

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

    let tradeLimit: BigNumber;
    if (side === 'buy') {
      tradeLimit = new BigNumber(trade.amountIn)
        .times(ONE.plus(maxSlippage))
        .integerValue(BigNumber.ROUND_CEIL); // maxAmountIn
    } else if (side === 'sell') {
      tradeLimit = new BigNumber(trade.amountOut)
        .times(ONE.minus(maxSlippage))
        .integerValue(BigNumber.ROUND_CEIL); // maxAmountIn
    } else {
      throw new Error('Invalid side');
    }

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
    const tokenIn = tokens.hdx.id;
    const tokenOut = tokens.usdt.id;
    const amount = buyHDXWithUSDTAmount; // Low amount
    return await executeTrade(tokenIn, tokenOut, amount, 'buy'); // Buy HDX with USDT
  } catch (error) {
    console.error('Error in test01:', error);
    throw error;
  } finally {
    console.log('Finished test01.');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function test02() {
  try {
    const tokenIn = tokens.usdt.id;
    const tokenOut = tokens.hdx.id;
    const amount = buyUSDTWithHDXAmount; // Low amount
    return await executeTrade(tokenIn, tokenOut, amount, 'buy'); // Buy USDT with HDX
  } catch (error) {
    console.error('Error in test02:', error);
    throw error;
  } finally {
    console.log('Finished test02.');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function test03() {
  try {
    const tokenIn = tokens.hdx.id;
    const tokenOut = tokens.usdt.id;
    const amount = sellHDXForUSDTAmount; // Low amount
    return await executeTrade(tokenIn, tokenOut, amount, 'sell'); // Sell HDX for USDT
  } catch (error) {
    console.error('Error in test03:', error);
    throw error;
  } finally {
    console.log('Finished test03.');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function test04() {
  try {
    const tokenIn = tokens.usdt.id;
    const tokenOut = tokens.hdx.id;
    const amount = sellUSDTForHDXAmount; // Low amount
    return await executeTrade(tokenIn, tokenOut, amount, 'sell'); // Sell USDT for HDX
  } catch (error) {
    console.error('Error in test04:', error);
    throw error;
  } finally {
    console.log('Finished test04.');
  }
}

(async () => {
  try {
    await initializeAPI();

    console.log(await getBalances(keyPair.address, ['HDX', 'DOT', 'USDT']));

    // console.log(await test01());
    // console.log(await test02());
    // console.log(await test03());
    // console.log(await test04());
  } catch (error) {
    console.error('Error in the main process:', error);
  } finally {
    console.log('Finished swap operations.');
  }
})();
