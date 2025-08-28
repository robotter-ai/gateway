// Importações necessárias
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import {
  TradeRouter,
  PoolService,
  ZERO,
  BigNumber,
} from '@galacticcouncil/sdk';
import BN, { BN } from 'bn.js';

async function main() {
  // Aguarda a inicialização da interface WASM
  await cryptoWaitReady();

  // Parâmetros para o swap
  const tokenIn = '5'; // Ex: 'DOT'
  const tokenOut = '0'; // Ex: 'HDX'
  const amountOut = '1.39'; // Quantidade de saída

  // Inicializa o provedor e a API da Polkadot
  const wsProvider = new WsProvider('wss://rpc.hydradx.cloud');
  const api = await ApiPromise.create({ provider: wsProvider });

  // Configura o Keyring e a conta (sender)
  const keyring = new Keyring({ type: 'sr25519' });
  const keyPair = keyring.addFromUri(
    'notice test child onion peanut crystal filter clinic buffalo lunar chaos time',
  );

  // Inicializa o PoolService e o TradeRouter
  const poolService = new PoolService(api);
  await poolService.syncRegistry();
  const tradeRouter = new TradeRouter(poolService);

  // Obtém a melhor rota de swap (compra) para os tokens
  const trade = await tradeRouter.getBestBuy(tokenIn, tokenOut, amountOut);

  if (trade) {
    console.log(
      `Rota encontrada: ${trade.swaps.map((pool) => pool.poolAddress).join(' -> ')}`,
    );
    console.log(`Quantidade de saída estimada: ${trade.amountOut}`);

    // 1% de tolerância
    const slippage = new BigNumber('10000000000000000');

    const transaction = trade.toTx(slippage).get() as any;

    let txHash = '';
    let error = ''

    await transaction.signAndSend(keyPair, (result) => {
      if (result.dispatchError) {
        if (result.dispatchError.isModule) {
          // Decodifica o erro utilizando o registry da API
          const decoded = api.registry.findMetaError(
            result.dispatchError.asModule,
          );
          const { name } = decoded;
          console.error(`Erro: ${name}`);
          error = name;
        } else {
          console.error('Erro desconhecido:', result.dispatchError.toString());
          error = result.dispatchError.toString();
        }
      } else {
        if (result.status.type === 'InBlock') {
          txHash = result.status.toString();
          console.log('Swap done! TX HASH:', result.status.toString());
        }
      }
    });

    return { txHash, error };
  } else {
    console.log('Nenhuma rota encontrada para o swap.');
  }
}

main().catch(console.error);
