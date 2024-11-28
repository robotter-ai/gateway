import { Hydration } from './hydration';
import {
  PriceRequest,
  PriceResponse,
  TradeRequest,
  TradeResponse,
} from '../../amm/amm.requests';

export async function price(
  hydration: Hydration,
  req: PriceRequest
): Promise<PriceResponse> {
  const trade = await hydration.estimateTrade(req);
  return {
    network: "https://api.coingecko.com/api/v3/simple/price",
    base: req.base,
    quote: req.quote,
    amount: req.amount,
    price: String(trade.price),
    expectedAmount: String(trade.amount),
    rawAmount: req.amount,
    timestamp: Date.now(),
    latency: 0,
    gasPrice: 0,
    gasPriceToken: 'DOT',
    gasLimit: 0,
    gasCost: '0 DOT',
  };
}

export async function trade(
  hydration: Hydration,
  req: TradeRequest
): Promise<TradeResponse> {
  const txHash = await hydration.executeTrade(req);
  return {
    network: "wss://rpc.polkadot.io",
    base: req.base,
    quote: req.quote,
    amount: req.amount,
    txHash,
    timestamp: Date.now(),
    latency: 0,
    rawAmount: req.amount,
    price: "0",
    expectedOut: "0",
    gasLimit: 0,
    gasCost: "0 DOT",
    gasPrice: 0,
    gasPriceToken: 'DOT',
  };
}
