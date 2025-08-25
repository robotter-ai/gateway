import {
  validateHydrationPollRequest,
  // validateHydrationAssetsRequest,
} from './hydration.validators';
import {
  AssetsRequest,
  AssetsResponse,
  BalanceRequest,
  PollRequest,
  PollResponse,
} from './hydration.requests';
import { Hydration as HydrationChain } from './hydration';
import { Asset } from '@galacticcouncil/sdk';

export class hydrationController {
  static async poll(
    hydration: HydrationChain,
    req: PollRequest,
  ): Promise<PollResponse> {
    validateHydrationPollRequest(req);
    return hydration.getTransaction(req.txHash);
  }

  static async balances(chain: HydrationChain, request: BalanceRequest) {
    // validateHydrationBalanceRequest(request);

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
    hydration: HydrationChain,
    request: AssetsRequest,
  ): Promise<AssetsResponse> {
    // validateHydration AssetsRequest(request);

    let assets: Asset[] = [];

    if (!request.assetSymbols) {
      assets = hydration.storedAssetList;
    } else {
      let assetSymbols;
      if (typeof request.assetSymbols === 'string') {
        assetSymbols = [request.assetSymbols];
      } else {
        assetSymbols = request.assetSymbols;
      }
      for (const a of assetSymbols as []) {
        const asset = hydration.getAssetForSymbol(a);
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
