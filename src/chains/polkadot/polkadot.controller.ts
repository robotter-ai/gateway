import {
  validatePolkadotPollRequest,
  // validatePolkadotAssetsRequest,
} from './polkadot.validators';
import {
  AssetsRequest,
  AssetsResponse,
  BalanceRequest,
  // PolkadotAsset,
  PollRequest,
  PollResponse,
} from './polkadot.requests';
import { Polkadot } from './polkadot';
import { Asset } from '@galacticcouncil/sdk';


// async function getInitializedPolkadot(network: string): Promise<Polkadot> {
//   const polkadot = Polkadot.getInstance(network);

//   if (!polkadot.ready()) {
//     await polkadot.init();
//   }

//   return polkadot;
// }

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

    // const account = chain.getAccountFromAddress(request.address);

    if (request.tokenSymbols.includes(chain.nativeTokenSymbol)) {
      balances[chain.nativeTokenSymbol] = await chain.getNativeBalance(
        request.address,
      );
    }

    for (const token of request.tokenSymbols) {
      if (token === chain.nativeTokenSymbol) continue;
      balances[token] = await chain.getAssetBalance(
        request.address,
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

  // static async approve(request: OptInRequest) {
  //   validatePolkadotOptInRequest(request);

  //   const polkadot = await getInitializedPolkadot(request.network);
  //   const asset = polkadot.getAssetForSymbol(request.assetSymbol);

  //   if (!asset) {
  //     throw new HttpException(
  //       500,
  //       `${TOKEN_NOT_SUPPORTED_ERROR_MESSAGE}${request.assetSymbol}`,
  //       TOKEN_NOT_SUPPORTED_ERROR_CODE,
  //     );
  //   }

  //   const transactionResponse = await polkadot.transfer(
  //     request.mnemonic,
  //     request.address,
  //     0, // Opt-in typically involves sending a minimal transfer to enable the asset
  //   );

  //   return {
  //     assetId: asset.id,
  //     transactionResponse,
  //   };
  // }
}
