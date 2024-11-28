import { KeyringPair } from '@polkadot/keyring/types';

export interface Account {
  address: string;
  keyPair: KeyringPair;
}

export interface TradeResponse {
  transactionHash: string;
  blockNumber?: number;
}
export interface EstimateGasRequest {
    tokenIn: string, tokenOut: string
}

export type GasEstimate = {
  gasLimit: number;
  gasPrice: number;
  totalCost: number;
};
