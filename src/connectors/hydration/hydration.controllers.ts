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

// export async function trade(
//   algorand: Algorand,
//   tinyman: Tinyman,
//   req: TradeRequest
// ): Promise<TradeResponse> {
//   const startTimestamp: number = Date.now();

//   const limitPrice = req.limitPrice;
//   const account: Account = await algorand.getAccountFromAddress(req.address);

//   let trade;
//   try {
//     trade = await tinyman.estimateTrade(<PriceRequest>req);
//   } catch (e) {
//     throw new HttpException(
//       500,
//       TRADE_FAILED_ERROR_MESSAGE,
//       TRADE_FAILED_ERROR_CODE
//     );
//   }

//   const estimatedPrice = trade.expectedPrice;
//   logger.info(
//     `Expected execution price is ${estimatedPrice}, ` +
//     `limit price is ${limitPrice}.`
//   );

//   if (req.side === 'BUY') {
//     if (limitPrice && new Decimal(estimatedPrice).gt(new Decimal(limitPrice))) {
//       logger.error('Swap price exceeded limit price.')
//       throw new HttpException(
//         500,
//         SWAP_PRICE_EXCEEDS_LIMIT_PRICE_ERROR_MESSAGE(
//           estimatedPrice,
//           limitPrice
//         ),
//         SWAP_PRICE_EXCEEDS_LIMIT_PRICE_ERROR_CODE
//       );
//     }
//   } else {
//     if (limitPrice && new Decimal(estimatedPrice).lt(new Decimal(limitPrice))) {
//       logger.error('Swap price lower than limit price.');
//       throw new HttpException(
//         500,
//         SWAP_PRICE_LOWER_THAN_LIMIT_PRICE_ERROR_MESSAGE(
//           estimatedPrice,
//           limitPrice
//         ),
//         SWAP_PRICE_LOWER_THAN_LIMIT_PRICE_ERROR_CODE
//       );
//     }
//   }
//   const tx = await tinyman.executeTrade(
//     account,
//     trade.trade,
//     req.side === 'BUY'
//   );

//   logger.info(`${req.side} swap has been executed.`);

//   return {
//     network: algorand.network,
//     timestamp: startTimestamp,
//     latency: latency(startTimestamp, Date.now()),
//     base: req.base,
//     quote: req.quote,
//     amount: req.amount,
//     rawAmount: req.amount,
//     expectedIn: String(trade.expectedAmount),
//     price: String(estimatedPrice),
//     gasPrice: algorand.gasPrice,
//     gasPriceToken: algorand.nativeTokenSymbol,
//     gasLimit: algorand.gasLimit,
//     gasCost: String(algorand.gasCost),
//     txHash: tx.txnID,
//   };
// }







