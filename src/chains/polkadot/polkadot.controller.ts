import {
  validatePolkadotPollRequest,
  // validatePolkadotAssetsRequest,
} from './polkadot.validators';
import {
  AssetsRequest,
  AssetsResponse,
  BalanceRequest,
  PollRequest,
  PollResponse,
} from './polkadot.requests';
import { Polkadot } from './polkadot';
import { Asset } from '@galacticcouncil/sdk';


export class PolkadotController {
  static async poll(
    polkadot: Polkadot,
    req: PollRequest,
  ): Promise<PollResponse> {
    validatePolkadotPollRequest(req);
    return polkadot.getTransaction(req.txHash);
  }

  static async balances(chain: Polkadot, request: BalanceRequest) {
    // validatePolkadotBalanceRequest(request);

    const balances: Record<string, string> = {};
    if (request.tokenSymbols.includes(chain.nativeTokenSymbol)) {
      balances[chain.nativeTokenSymbol] = await chain.getNativeBalance(
        request.address,
      );
    }

    for (const tokenSymbol of request.tokenSymbols) {
      if (tokenSymbol === chain.nativeTokenSymbol) continue;
      balances[tokenSymbol] = await chain.getAssetBalance(
        request.address,
        tokenSymbol,
      );
    }

    return {
      balances: balances,
    };
  }

  static async getTokens(
    polkadot: Polkadot,
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
