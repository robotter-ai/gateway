import { Asset } from "@galacticcouncil/sdk";

export type PollResponse = {
    currentBlock: number;
    txBlock: number | null;
    txHash: string;
    fee: number;
};

export interface AssetsRequest {
    network?: string; // the target network of the chain (e.g. mainnet)
    assetSymbols?: string[];
}


export type AssetsResponse = {
    assets: Asset[] // using galacticcouncil sdk type
};

export interface OptInRequest {
    network: string;
    address: string;
    mnemonic: string
    assetSymbol: string;
}

export interface OptInResponse {
    network: string;
    timestamp: number;
    latency: number;
    assetId: number;
    transactionResponse: any;
}
