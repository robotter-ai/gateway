import { Hydration } from './hydration';
import {
  PriceRequest,
  PriceResponse,
} from '../../amm/amm.requests';
import { Polkadot } from '../../chains/polkadot/polkadot';
import { HttpException, PRICE_FAILED_ERROR_CODE, PRICE_FAILED_ERROR_MESSAGE, UNKNOWN_ERROR_ERROR_CODE, UNKNOWN_ERROR_MESSAGE } from '../../services/error-handler';
import { latency } from '../../services/base';




export async function price(
  polkadot: Polkadot,
  hydration: Hydration,
  req: PriceRequest
): Promise<PriceResponse> {
  // const trade = await hydration.estimateTrade(req);
  const startTimestamp: number = Date.now();
  let trade;
  try {
    trade = await hydration.estimateTrade(req)
  } catch (e) {
    if (e instanceof Error) {
      throw new HttpException(
        500,
        PRICE_FAILED_ERROR_MESSAGE + e.message,
        PRICE_FAILED_ERROR_CODE
      );
    } else {
      throw new HttpException(
        500,
        UNKNOWN_ERROR_MESSAGE,
        UNKNOWN_ERROR_ERROR_CODE
      );
    }
  }
  return {
    network: polkadot.network,
    timestamp: startTimestamp,
    latency: latency(startTimestamp, Date.now()),
    base: req.base,
    quote: req.quote,
    amount: req.amount,
    rawAmount: req.amount,
    expectedAmount: String(trade.expectedAmount), // TODO implement blalblab!!!
    price: String(trade.expectedPrice),
    gasPrice: polkadot.gasPrice,
    gasPriceToken: polkadot.nativeTokenSymbol,
    gasLimit: polkadot.gasLimit,
    gasCost: String(polkadot.gasCost),
  } as PriceResponse;
}







