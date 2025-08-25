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
export interface HydrationAccount {
  /** The public address of the account */
  address: string;
  /** The public key in hex format */
  publicKey: string;
  /** Optional keyring pair for signing transactions */
  keyringPair?: KeyringPair;
}

/**
 * Hydration balance request schema
 */
export const HydrationBalanceRequestSchema = Type.Composite(
  [BalanceRequestSchema],
  { $id: 'HydrationBalanceRequest' },
);
export type HydrationBalanceRequest = Static<
  typeof HydrationBalanceRequestSchema
>;

/**
 * Hydration balance response schema
 */
export const HydrationBalanceResponseSchema = Type.Composite(
  [BalanceResponseSchema],
  { $id: 'HydrationBalanceResponse' },
);
export type HydrationBalanceResponse = Static<
  typeof HydrationBalanceResponseSchema
>;

/**
 * Hydration estimate gas request schema
 */
export const HydrationEstimateGasRequestSchema = Type.Composite(
  [EstimateGasRequestSchema],
  { $id: 'HydrationEstimateGasRequest' },
);
export type HydrationEstimateGasRequest = Static<
  typeof HydrationEstimateGasRequestSchema
>;

/**
 * Hydration estimate gas response schema
 */
export const HydrationEstimateGasResponseSchema = Type.Composite(
  [EstimateGasResponseSchema],
  { $id: 'HydrationEstimateGasResponse' },
);
export type HydrationEstimateGasResponse = Static<
  typeof HydrationEstimateGasResponseSchema
>;

/**
 * Hydration poll request schema
 */
export const HydrationPollRequestSchema = Type.Composite([PollRequestSchema], {
  $id: 'HydrationPollRequest',
});
export type HydrationPollRequest = Static<typeof HydrationPollRequestSchema>;

/**
 * Hydration poll response schema
 */
export const HydrationPollResponseSchema = Type.Composite([PollResponseSchema], {
  $id: 'HydrationPollResponse',
});
export type HydrationPollResponse = Static<typeof HydrationPollResponseSchema>;

/**
 * Hydration status request schema
 */
export const HydrationStatusRequestSchema = Type.Composite(
  [StatusRequestSchema],
  { $id: 'HydrationStatusRequest' },
);
export type HydrationStatusRequest = Static<typeof HydrationStatusRequestSchema>;

/**
 * Hydration status response schema
 */
export const HydrationStatusResponseSchema = Type.Composite(
  [StatusResponseSchema],
  { $id: 'HydrationStatusResponse' },
);
export type HydrationStatusResponse = Static<
  typeof HydrationStatusResponseSchema
>;

/**
 * Hydration tokens request schema
 */
export const HydrationTokensRequestSchema = Type.Composite(
  [TokensRequestSchema],
  { $id: 'HydrationTokensRequest' },
);
export type HydrationTokensRequest = Static<typeof HydrationTokensRequestSchema>;

/**
 * Hydration tokens response schema
 */
export const HydrationTokensResponseSchema = Type.Composite(
  [TokensResponseSchema],
  { $id: 'HydrationTokensResponse' },
);
export type HydrationTokensResponse = Static<
  typeof HydrationTokensResponseSchema
>;
