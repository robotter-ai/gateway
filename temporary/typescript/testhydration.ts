// Import
import { ApiPromise, WsProvider } from '@polkadot/api';
import { TradeRouter, PoolService, PoolType } from '@galacticcouncil/sdk';
async function main() {

    const wsProvider = new WsProvider('wss://rpc.hydradx.cloud');
const api = await ApiPromise.create({ provider: wsProvider });

// Initialize Trade Router
const poolService = new PoolService(api);
await poolService.syncRegistry(); // Wait until pools initialized (optional), fallback to lazy init
const tradeRouter = new TradeRouter(poolService);

const tokens = tradeRouter.getAllAssets()
console.log(tokens)
}
// Initialize Polkadot API


main()
  .then(() => console.log('Done'))
  .catch((err) => console.error('Error:', err));

