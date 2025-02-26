import { PoolService, TradeRouter } from "@galacticcouncil/sdk";
import { ApiPromise, WsProvider } from "@polkadot/api";


async function main() {
    const wsProvider = new WsProvider('wss://rpc.hydradx.cloud');
    const api = await ApiPromise.create({ provider: wsProvider });
    const poolService = new PoolService(api);
    const trade = new TradeRouter(poolService);

    // console.log("Valores", getValue)
    const assets = await trade.getAllAssets()
    const tokenBase = assets.find(a => a.symbol === "HDX")?.id ?? "0" //HDX default 
    const tokenQuote = assets.find(a => a.symbol === "USDT")?.id ?? "10" // USDT default
    const getBuy = await trade.getBestBuy(tokenBase, tokenBase, 123154)
    const getValue = await trade.getBestSpotPrice(tokenBase, tokenQuote)

    const expectedPrice = 1 / Number(getValue?.amount);
    const expectedAmount = Number(142)


    console.log("AMOUNT", expectedAmount)
    console.log("PRICE", expectedPrice)
    console.log("BUY", getBuy)
}
main()