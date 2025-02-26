import { Asset } from "@galacticcouncil/sdk";

export interface AssetsRequest {
  network?: string; // the target network of the chain (e.g. mainnet)
  assetSymbols?: string[];
}


export type AssetsResponse = {
  assets: Asset[]; // using galacticcouncil sdk type
};

export interface OptInRequest {
  network: string;
  address: string;
  mnemonic: string;
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

/**
 * internal_server_http.J
 */
export interface HydrationTransaction {
  code?: number;
  data?: SubscanInternalModelExtrinsicDetail;
  generated_at?: number;
  message?: string;
  [property: string]: any;
}

/**
 * subscan_internal_model.ExtrinsicDetail
 */
export interface SubscanInternalModelExtrinsicDetail {
  account_display?: SubscanInternalModelAccountDisplay;
  account_id?: string;
  additional_meta?: { [key: string]: any };
  block_hash?: string;
  block_num?: number;
  block_timestamp?: number;
  call_module?: string;
  call_module_function?: string;
  error?: SubscanInternalModelExtrinsicError;
  event?: SubscanInternalModelChainEventJson[];
  event_count?: number;
  extrinsic_hash?: string;
  extrinsic_index?: string;
  fee?: number;
  fee_used?: number;
  finalized?: boolean;
  lifetime?: SubscanInternalModelLifetime;
  multisig?: SubscanInternalModelMultisigJson[];
  nonce?: number;
  params?: SubscanInternalModelExtrinsicParam[];
  pending?: boolean;
  signature?: string;
  sub_calls?: SubscanInternalModelExtrinsicSubCallJson[];
  success?: boolean;
  tip?: number;
  transfer?: SubscanInternalModelTransferJson;
  [property: string]: any;
}

/**
 * subscan_internal_model.AccountDisplay
 */
export interface SubscanInternalModelAccountDisplay {
  account_index?: string;
  /**
   * Current network account
   */
  address?: string;
  display?: string;
  evm_address?: string;
  evm_contract?: SubscanInternalModelEvmAccountDisplay;
  identity?: boolean;
  judgements?: SubscanInternalModelRegistrationJudgementJson[];
  merkle?: SubscanInternalModelMerkleTag;
  /**
   * Parent account
   */
  parent?: Parent;
  people?: SubscanInternalModelSampleIdentity;
  [property: string]: any;
}

/**
 * subscan_internal_model.EvmAccountDisplay
 */
export interface SubscanInternalModelEvmAccountDisplay {
  contract_name?: string;
  verify_source?: string;
  [property: string]: any;
}

/**
 * subscan_internal_model.RegistrationJudgementJson
 */
export interface SubscanInternalModelRegistrationJudgementJson {
  index?: number;
  judgement?: string;
  [property: string]: any;
}

/**
 * subscan_internal_model.MerkleTag
 */
export interface SubscanInternalModelMerkleTag {
  address_type?: string;
  tag_name?: string;
  tag_subtype?: string;
  tag_type?: string;
  [property: string]: any;
}

/**
 * Parent account
 *
 * subscan_internal_model.AccountParentJson
 */
export interface Parent {
  address?: string;
  display?: string;
  identity?: boolean;
  sub_symbol?: string;
  [property: string]: any;
}

/**
 * subscan_internal_model.SampleIdentity
 */
export interface SubscanInternalModelSampleIdentity {
  display?: string;
  identity?: boolean;
  judgements?: SubscanInternalModelRegistrationJudgementJson[];
  parent?: Parent;
  [property: string]: any;
}

/**
 * subscan_internal_model.ExtrinsicError
 */
export interface SubscanInternalModelExtrinsicError {
  batch_index?: number;
  doc?: string;
  module?: string;
  name?: string;
  value?: string;
  [property: string]: any;
}

/**
 * subscan_internal_model.ChainEventJson
 */
export interface SubscanInternalModelChainEventJson {
  block_num?: number;
  block_timestamp?: number;
  event_id?: string;
  event_idx?: number;
  event_index?: string;
  extrinsic_hash?: string;
  extrinsic_idx?: number;
  finalized?: boolean;
  module_id?: string;
  params?: string;
  phase?: number;
  [property: string]: any;
}

/**
 * subscan_internal_model.Lifetime
 */
export interface SubscanInternalModelLifetime {
  birth?: number;
  death?: number;
  [property: string]: any;
}

/**
 * subscan_internal_model.MultisigJson
 */
export interface SubscanInternalModelMultisigJson {
  call_hash?: string;
  call_module?: string;
  call_module_function?: string;
  multi_id?: string;
  multisig_account_display?: SubscanInternalModelAccountDisplay;
  multisig_status?: SubscanInternalModelMultiAction;
  processing?: number;
  threshold?: number;
  [property: string]: any;
}

/**
 * subscan_internal_model.MultiAction
 */
export enum SubscanInternalModelMultiAction {
  Approval = 'Approval',
  Cancelled = 'Cancelled',
  Executed = 'Executed',
  Failed = 'Failed',
}

/**
 * subscan_internal_model.ExtrinsicParam
 */
export interface SubscanInternalModelExtrinsicParam {
  name?: string;
  type?: string;
  type_name?: string;
  value?: any;
  [property: string]: any;
}

/**
 * subscan_internal_model.ExtrinsicSubCallJson
 */
export interface SubscanInternalModelExtrinsicSubCallJson {
  account?: SubscanInternalModelAccountDisplay;
  exec_result?: SubscanLibsSubstrateMetadataModuleError;
  exec_status?: string;
  module?: string;
  multisig?: SubscanInternalModelMultisigJson;
  name?: string;
  param?: any;
  sub_calls?: SubscanInternalModelExtrinsicSubCallJson[];
  [property: string]: any;
}

/**
 * subscan_libs_substrate.MetadataModuleError
 */
export interface SubscanLibsSubstrateMetadataModuleError {
  doc?: string[];
  module?: string;
  name?: string;
  value?: string;
  [property: string]: any;
}

/**
 * subscan_internal_model.TransferJson
 */
export interface SubscanInternalModelTransferJson {
  amount?: number;
  asset_symbol?: string;
  from?: string;
  hash?: string;
  module?: string;
  success?: boolean;
  to?: string;
  to_account_display?: SubscanInternalModelAccountDisplay;
  [property: string]: any;
}
