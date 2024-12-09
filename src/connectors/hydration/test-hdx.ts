import { PoolService, TradeRouter } from "@galacticcouncil/sdk";
import { ApiPromise, WsProvider } from "@polkadot/api";


async function main() {
    const wsProvider = new WsProvider('wss://rpc.hydradx.cloud');
    const api = await ApiPromise.create({ provider: wsProvider });
    const poolService = new PoolService(api);
    const trade = new TradeRouter(poolService);

    const getValue = await trade.getBestSpotPrice("10", "22")
    console.log("Valores", getValue)
}
main()