import { Asset } from "@galacticcouncil/sdk";

export interface PollRequest {
    network: string;
    txHash: string;
}

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

export interface HydrationAsset {
    symbol: string;
    assetId: number;
    decimals: number;
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
export interface BalanceResponse {
    /**
     * Address of the account
     */
    address: string;
    /**
     * Balances mapped by token symbol
     */
    balances: Record<string, string>;
}
export interface BalanceRequest {
    /**
     * Address of the account
     */
    address: string;
    /**
     * Token symbols to retrieve balances for
     */
    tokenSymbols: string[];
    /**
     * Network identifier
     */
    network: string;
}