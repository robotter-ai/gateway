import {
  validatePolkadotPollRequest,
  // validatePolkadotAssetsRequest,
} from './hydration.validators';
import {
  AssetsRequest,
  AssetsResponse,
  BalanceRequest,
  PollRequest,
  PollResponse,
} from './hydration.requests';
import { Hydration } from './hydration';
import { Asset } from '@galacticcouncil/sdk';

export class hydrationController {
  static async poll(
    polkadot: Hydration,
    req: PollRequest,
  ): Promise<PollResponse> {
    validatePolkadotPollRequest(req);
    return polkadot.getTransaction(req.txHash);
  }

  static async balances(chain: Hydration, request: BalanceRequest) {
    // validatePolkadotBalanceRequest(request);

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
    polkadot: Hydration,
    request: AssetsRequest,
  ): Promise<AssetsResponse> {
    // validateAssetsRequest(request);

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
