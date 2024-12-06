

export default interface Account {
  /**
   * Polkadot address
   */
  addr: string;
  /**
   * Secret key belonging to the Polkadot address
   */
  sk: Uint8Array;
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
