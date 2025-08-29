import { KeyringPair } from '@polkadot/keyring/types';
import { Type, Static } from '@sinclair/typebox';

import {
  BalanceRequestSchema,
  BalanceResponseSchema,
  EstimateGasRequestSchema,
  EstimateGasResponseSchema,
  PollRequestSchema,
  PollResponseSchema,
  StatusRequestSchema,
  StatusResponseSchema,
  TokensRequestSchema,
  TokensResponseSchema,
} from '../../schemas/chain-schema';

/**
 * Represents a Hydration account with its address and keys
 */
export interface HydrationChainAccount {
  /** The public address of the account */
  address: string;
  /** The public key in hex format */
  publicKey: string;
  /** Optional keyring pair for signing transactions */
  keyringPair?: KeyringPair;
}

/**
 * HydrationChain balance request schema
 */
export const HydrationChainBalanceRequestSchema = Type.Composite(
  [BalanceRequestSchema],
  { $id: 'HydrationChainBalanceRequest' },
);
export type HydrationChainBalanceRequest = Static<
  typeof HydrationChainBalanceRequestSchema
>;

/**
 * HydrationChain balance response schema
 */
export const HydrationChainBalanceResponseSchema = Type.Composite(
  [BalanceResponseSchema],
  { $id: 'HydrationChainBalanceResponse' },
);
export type HydrationChainBalanceResponse = Static<
  typeof HydrationChainBalanceResponseSchema
>;

/**
 * HydrationChain estimate gas request schema
 */
export const HydrationChainEstimateGasRequestSchema = Type.Composite(
  [EstimateGasRequestSchema],
  { $id: 'HydrationChainEstimateGasRequest' },
);
export type HydrationChainEstimateGasRequest = Static<
  typeof HydrationChainEstimateGasRequestSchema
>;

/**
 * HydrationChain estimate gas response schema
 */
export const HydrationChainEstimateGasResponseSchema = Type.Composite(
  [EstimateGasResponseSchema],
  { $id: 'HydrationChainEstimateGasResponse' },
);
export type HydrationChainEstimateGasResponse = Static<
  typeof HydrationChainEstimateGasResponseSchema
>;

/**
 * HydrationChain poll request schema
 */
export const HydrationChainPollRequestSchema = Type.Composite(
  [PollRequestSchema],
  {
    $id: 'HydrationChainPollRequest',
  },
);
export type HydrationChainPollRequest = Static<
  typeof HydrationChainPollRequestSchema
>;

/**
 * HydrationChain poll response schema
 */
export const HydrationChainPollResponseSchema = Type.Composite(
  [PollResponseSchema],
  {
    $id: 'HydrationChainPollResponse',
  },
);
export type HydrationChainPollResponse = Static<
  typeof HydrationChainPollResponseSchema
>;

/**
 * HydrationChain status request schema
 */
export const HydrationChainStatusRequestSchema = Type.Composite(
  [StatusRequestSchema],
  { $id: 'HydrationChainStatusRequest' },
);
export type HydrationChainStatusRequest = Static<
  typeof HydrationChainStatusRequestSchema
>;

/**
 * HydrationChain status response schema
 */
export const HydrationChainStatusResponseSchema = Type.Composite(
  [StatusResponseSchema],
  { $id: 'HydrationChainStatusResponse' },
);
export type HydrationChainStatusResponse = Static<
  typeof HydrationChainStatusResponseSchema
>;

/**
 * HydrationChain tokens request schema
 */
export const HydrationChainTokensRequestSchema = Type.Composite(
  [TokensRequestSchema],
  { $id: 'HydrationChainTokensRequest' },
);
export type HydrationChainTokensRequest = Static<
  typeof HydrationChainTokensRequestSchema
>;

/**
 * HydrationChain tokens response schema
 */
export const HydrationChainTokensResponseSchema = Type.Composite(
  [TokensResponseSchema],
  { $id: 'HydrationChainTokensResponse' },
);
export type HydrationChainTokensResponse = Static<
  typeof HydrationChainTokensResponseSchema
>;
