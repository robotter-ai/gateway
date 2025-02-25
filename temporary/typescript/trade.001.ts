import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import {
  BigNumber,
  PoolService,
  Trade,
  TradeRouter,
} from '@galacticcouncil/sdk';

async function test001() {
  await cryptoWaitReady();

  const tokenIn = '1000010'; // 'HDX'
  const tokenOut = '23'; // 'USDT'
  const amountOut = new BigNumber('1'); // Output amount

  const wsProvider = new WsProvider('wss://rpc.hydradx.cloud');
  const api = await ApiPromise.create({ provider: wsProvider });

  const keyring = new Keyring({ type: 'sr25519' });
  const keyPair = keyring.addFromUri(process.env.MNEMONIC);

  const poolService = new PoolService(api);
  await poolService.syncRegistry();
  const tradeRouter = new TradeRouter(poolService);

  const trade: Trade = await tradeRouter.getBestBuy(
    tokenIn,
    tokenOut,
    amountOut,
  );

  if (trade) {
    console.log(
      `Route found: ${trade.swaps
        .map((pool) => pool.poolAddress)
        .join(' -> ')}`,
    );
    console.log(`Estimated output amount: ${trade.amountOut}`);

    // 1% slippage
    const tradeLimit = new BigNumber('1');

    const transaction = trade.toTx(tradeLimit).get<any>();

    let txHash = '';
    let error = '';

    await transaction.signAndSend(keyPair, (result) => {
      if (result.dispatchError) {
        if (result.dispatchError.isModule) {
          // Decodes error using API registry
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

test001().catch((error) => console.error('Error in the main process:', error));
