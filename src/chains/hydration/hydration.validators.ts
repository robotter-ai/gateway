import { decodeAddress } from '@polkadot/util-crypto';

import { logger } from '../../services/logger';

/**
 * Validates a HydrationChain address format
 *
 * Checks if the provided address conforms to the HydrationChain address format.
 * If the address is invalid, an HttpException with a 400 status code is thrown.
 *
 * @param address The HydrationChain address to validate
 * @param ss58Format The SS58 format to use for validation (optional)
 * @returns true if the address is valid
 * @throws HttpException if the address is invalid
 */
export function validateHydrationAddress(
  address: string,
  ss58Format?: number,
): boolean {
  if (!address) {
    logger.error('Empty HydrationChain address provided');
    throw new Error('Invalid HydrationChain address: Address cannot be empty');
  }

  try {
    // Try to decode the address with the specified format
    decodeAddress(address, false, ss58Format);
    return true;
  } catch (error) {
    throw new Error(`Invalid HydrationChain address: ${address}`);
  }
}
