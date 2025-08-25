export default interface Account {
  /**
   * Hydration address
   */
  address: string;
  /**
   * Secret key belonging to the Hydration address
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
  id: string;
  name: string;
  icon: string;
  type: string;
  existentialDeposit: string;
  isSufficient: boolean;
  location?: any;
  meta?: Record<string, string>;
  isWhiteListed?: boolean;
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
