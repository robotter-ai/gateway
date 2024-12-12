import {
  validatePolkadotBalanceRequest,
  validatePolkadotPollRequest,
  validatePolkadotAssetsRequest,
  validatePolkadotOptInRequest,
} from './polkadot.validators';
import {

  AssetsRequest,
  AssetsResponse,
  BalanceRequest,
  OptInRequest,
  PollRequest,
  PollResponse,
} from './polkadot.requests';
import { Polkadot } from './polkadot';
import {
  HttpException,
  TOKEN_NOT_SUPPORTED_ERROR_CODE,
  TOKEN_NOT_SUPPORTED_ERROR_MESSAGE,
} from '../../services/error-handler';

async function getInitializedPolkadot(network: string): Promise<Polkadot> {
  const polkadot = Polkadot.getInstance(network);

  if (!polkadot.ready()) {
    await polkadot.init();
  }

  return polkadot;
}

export class PolkadotController {
  static async poll(polkadot: Polkadot, req: PollRequest): Promise<PollResponse> {
    validatePolkadotPollRequest(req);
    return polkadot.getTransaction(req.txHash);
  }

  static async balances(chain: Polkadot, request: BalanceRequest) {
    validatePolkadotBalanceRequest(request);

    const balances: Record<string, string> = {};

    const account = await chain.getAccountFromAddress(request.address);

    if (request.tokenSymbols.includes(chain.nativeTokenSymbol)) {
      balances[chain.nativeTokenSymbol] = await chain.getNativeBalance(account.address);
    }

    for (const token of request.tokenSymbols) {
      if (token === chain.nativeTokenSymbol) continue;
      balances[token] = await chain.getAssetBalance(account.address, Number(token));
    }

    return {
      balances,
    };
  }

  static async getTokens(polkadot: Polkadot, request: AssetsRequest): Promise<AssetsResponse> {
    validatePolkadotAssetsRequest(request);

    const assets: any[] = [];

    if (!request.assetSymbols) {
      assets.push(...polkadot.storedAssetList);
    } else {
      const assetSymbols = Array.isArray(request.assetSymbols)
        ? request.assetSymbols
        : [request.assetSymbols];
      for (const symbol of assetSymbols) {
        const asset = polkadot.getAssetForSymbol(symbol);
        if (asset) assets.push(asset);
      }
    }

    return {
      assets,
    };
  }

  static async approve(request: OptInRequest) {
    validatePolkadotOptInRequest(request);

    const polkadot = await getInitializedPolkadot(request.network);
    const asset = polkadot.getAssetForSymbol(request.assetSymbol);

    if (!asset) {
      throw new HttpException(
        500,
        `${TOKEN_NOT_SUPPORTED_ERROR_MESSAGE}${request.assetSymbol}`,
        TOKEN_NOT_SUPPORTED_ERROR_CODE
      );
    }

    const transactionResponse = await polkadot.transfer(
      request.mnemonic,
      request.address,
      0 // Opt-in typically involves sending a minimal transfer to enable the asset
    );

    return {
      assetId: asset.assetId,
      transactionResponse,
    };
  }
}
