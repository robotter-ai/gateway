import { EstimateGasResponse } from '../../amm/amm.requests';
import { validateEstimateGasRequest, validatePolkadotBalanceRequest, } from './polkadot.validators';
import {
  BalanceRequest,

  PollRequest,
  PollResponse,
} from '../../network/network.requests';
import { Polkadot } from './polkadot';
import { EstimateGasRequest } from './polkadot.types';


async function getInitializedPolkadot(network: string): Promise<Polkadot> {
  const polkadot = await Polkadot.getInstance(network);

  if (!polkadot.ready()) {
    await polkadot.init();
  }

  return polkadot;
}

export class PolkadotController {


  static async balances(chain: Polkadot, request: BalanceRequest) {
    validatePolkadotBalanceRequest(request);

    const balances: Record<string, string> = {};

    // const account = chain.getAccountFromPrivateKey(request.address);

    // if (request.tokenSymbols.includes(chain.nativeTokenSymbol)) {
    //   balances[chain.nativeTokenSymbol] = await chain.getNativeBalance(account);
    // }

    for (const token of request.tokenSymbols) {
      if (token === chain.nativeTokenSymbol) continue;
      balances[token] = await chain.getAssetBalance(token);
    }

    return {
      balances: balances,
    };
  }




}
