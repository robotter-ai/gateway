import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { Hydration as HydrationChain } from '../hydration';
import {
  HydrationBalanceRequest,
  HydrationBalanceResponse,
  HydrationBalanceRequestSchema,
  HydrationBalanceResponseSchema,
} from '../hydration.types';

/**
 * Retrieves token balances for a Hydration address
 *
 * @param fastify Fastify instance
 * @param network Network identifier (e.g., 'mainnet', 'westend')
 * @param address Polkadot address to check balances for
 * @param tokenSymbols Optional list of specific token symbols to check
 * @returns Balance response object with token balances
 */
export async function getHydrationBalances(
  _fastify: FastifyInstance,
  network: string,
  address: string,
  tokenSymbols?: string[],
): Promise<HydrationBalanceResponse> {
  if (!network) {
    throw new Error('Network parameter is required');
  }

  if (!address) {
    throw new Error('Address parameter is required');
  }

  const hydration = await HydrationChain.getInstance(network);

  return await hydration.getAddressBalances(address, tokenSymbols);
}

/**
 * Route plugin that registers the balances endpoint
 */
export const balancesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: HydrationBalanceRequest;
    Reply: HydrationBalanceResponse;
  }>(
    '/balances',
    {
      schema: {
        description: 'Get token balances for a Hydration address',
        tags: ['hydration'],
        body: HydrationBalanceRequestSchema,
        response: {
          200: HydrationBalanceResponseSchema,
        },
      },
    },
    async (request) => {
      const response = await getHydrationBalances(
        fastify,
        request.body.network,
        request.body.address,
        request.body.tokens,
      );
      return response;
    },
  );
};

export default balancesRoute;
