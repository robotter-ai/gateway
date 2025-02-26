import {
  validatePolkadotPollRequest,
} from './polkadot.validators';
import {
  BalanceRequest,
  PollRequest,
  PollResponse,
} from '../../network/network.requests';
import { Polkadot } from './polkadot';
import { Asset } from '@galacticcouncil/sdk';
import { AssetsRequest, AssetsResponse } from "./polkadot.requests";

export class PolkadotController {
  static async poll(
    polkadot: Polkadot,
    req: PollRequest,
  ): Promise<PollResponse> {
    validatePolkadotPollRequest(req);
    return polkadot.getTransaction(req.txHash);
  }

  static async balances(chain: Polkadot, request: BalanceRequest) {
    const balances: Record<string, string> = {};

    if (request.tokenSymbols.includes('HDX')) {
      balances['HDX'] = await chain.getNativeBalance(request.address);
    }

    for (const tokenSymbol of request.tokenSymbols) {
      if (tokenSymbol === 'HDX') continue;
      try {
        balances[tokenSymbol] = await chain.getAssetBalance(
          request.address,
          tokenSymbol,
        );
      } catch (error) {
        console.error(`Erro ao buscar balanço do token ${tokenSymbol}:`, error);
        balances[tokenSymbol] = '0';
      }
    }

    return { balances };
  }

  static async getTokens(
    polkadot: Polkadot,
    request: AssetsRequest,
  ): Promise<AssetsResponse> {

    let assets: Asset[] = [];

    if (!request.assetSymbols) {
      assets = polkadot.storedAssetList;
    } else {
      let assetSymbols;
      if (typeof request.assetSymbols === 'string') {
        assetSymbols = [request.assetSymbols];
      } else {
        assetSymbols = request.assetSymbols;
      }
      for (const a of assetSymbols as []) {
        const asset = polkadot.getAssetForSymbol(a);
        if (!asset) {
          throw new Error(`Unsupported symbol: ${a}`);
        }
        assets.push(asset as Asset);
      }
    }

    return {
      assets: assets,
    };
  }
}
