import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { BigNumber, PoolService, Trade, TradeRouter, } from '@galacticcouncil/sdk';

const hdxId = '0';
const usdtId = '10';
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
      // tradeLimit = new BigNumber(trade.amountIn).times(ONE.minus(maxSlippage)); // minAmountIn
      tradeLimit = new BigNumber(trade.amountIn)
        .times(ONE.plus(maxSlippage))
        .integerValue(BigNumber.ROUND_CEIL); // maxAmountIn
      // tradeLimit = new BigNumber(trade.amountOut).times(ONE.minus(maxSlippage)); // minAmountOut
      // tradeLimit = new BigNumber(trade.amountOut).times(ONE.plus(maxSlippage)); // maxAmountOut
    } else if (side === 'sell') {
      // tradeLimit = new BigNumber(trade.amountIn).times(ONE.minus(maxSlippage)); // minAmountIn
      // tradeLimit = new BigNumber(trade.amountIn).times(ONE.plus(maxSlippage)); // maxAmountIn
      tradeLimit = new BigNumber(trade.amountOut).times(ONE.minus(maxSlippage)); // minAmountOut
      // tradeLimit = new BigNumber(trade.amountOut).times(ONE.plus(maxSlippage)); // maxAmountOut
    } else {
      throw new Error('Invalid side');
    }

    const transaction = trade.toTx(tradeLimit).get<any>();

    let txHash = '';
    let error = '';

    await transaction.signAndSend(keyPair, (result) => {
      if (result.dispatchError) {
        if (result.dispatchError.isModule) {
          const decoded = api.registry.findMetaError(
            result.dispatchError.asModule,
          );
          const { name } = decoded;
          console.error(`Error: ${name}`);
          error = name;
        } else {
          console.error('Unknown error:', result.dispatchError.toString());
          error = result.dispatchError.toString();
        }
      } else if (result.status.isInBlock) {
        txHash = result.status.toString();
        console.log('Swap done! TX HASH:', txHash);
      }
    });

    return {
      txHash,
      error,
    };
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
  const tokenIn = hdxId;
  const tokenOut = usdtId;
  const amount = buyHDXWithUSDTAmount; // Low amount
  return executeTrade(tokenIn, tokenOut, amount, 'buy'); // Buy HDX with USDT
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function test02() {
  const tokenIn = usdtId;
  const tokenOut = hdxId;
  const amount = buyUSDTWithHDXAmount; // Low amount
  return executeTrade(tokenIn, tokenOut, amount, 'buy'); // Buy USDT with HDX
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function test03() {
  const tokenIn = ''; // 'HDX'
  const tokenOut = usdtId;
  const amount = sellHDXForUSDTAmount; // Low amount
  return executeTrade(tokenIn, tokenOut, amount, 'sell'); // Sell HDX for USDT
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function test04() {
  const tokenIn = ''; // 'USDT'
  const tokenOut = hdxId;
  const amount = sellUSDTForHDXAmount; // Low amount
  return executeTrade(tokenIn, tokenOut, amount, 'sell'); // Sell USDT for HDX
}

(async () => {
  try {
    await initializeAPI();
    console.log('Starting swap operations...');
    try {
      console.log('\n\nStarting test01...');
      console.log(await test01());
    } catch (error) {
      console.error(error);
    } finally {
      console.log('Finished test01.\n\n');
    }
    try {
      console.log('\n\nStarting test02...');
      console.log(await test02());
    } catch (error) {
      console.error(error);
    } finally {
      console.log('Finished test02.\n\n');
    }
    try {
      console.log('\n\nStarting test03...');
      console.log(await test03());
    } catch (error) {
      console.error(error);
    } finally {
      console.log('Finished test03.\n\n');
    }
    try {
      console.log('\n\nStarting test04...');
      console.log(await test04());
    } catch (error) {
      console.error(error);
    } finally {
      console.log('Finished test04.\n\n');
    }
  } catch (error) {
    console.error('Error in the main process:', error);
  } finally {
    console.log('Finished swap operations.');
  }
})();
