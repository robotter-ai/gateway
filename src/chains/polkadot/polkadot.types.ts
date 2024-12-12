export default interface Account {
  /**
   * Polkadot address
   */
  address: string;
  /**
   * Secret key belonging to the Polkadot address
   */
  secretKey: Uint8Array;
}

export interface TradeResponse {
  /**
   * Hash of the transaction
   */
  transactionHash: string;
  /**
   * Number of the block where the transaction was included (optional)
   */
  blockNumber?: number;
}

export interface EstimateGasRequest {
  /**
   * Token being exchanged
   */
  tokenIn: string;
  /**
   * Token being received in exchange
   */
  tokenOut: string;
}

export type GasEstimate = {
  /**
   * Maximum amount of gas units allowed for the transaction
   */
  gasLimit: number;
  /**
   * Price of gas per unit
   */
  gasPrice: number;
  /**
   * Total estimated gas cost
   */
  totalCost: number;
};

export interface Asset {
  /**
   * Identifier for the asset
   */
  assetId: number;
  /**
   * Symbol of the asset (e.g., DOT)
   */
  symbol: string;
  /**
   * Decimals for asset precision
   */
  decimals: number;
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

export interface TokenApprovalResponse {
  /**
   * Identifier for the approved asset
   */
  assetId: number;
  /**
   * Transaction hash for the approval operation
   */
  transactionHash: string;
}
