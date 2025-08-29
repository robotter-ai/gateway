import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { HydrationChain } from '../hydration';
import {
  HydrationChainBalanceRequest,
  HydrationChainBalanceResponse,
  HydrationChainBalanceRequestSchema,
  HydrationChainBalanceResponseSchema,
} from '../hydration.types';

/**
 * Retrieves token balances for a HydrationChain address
 *
 * @param fastify Fastify instance
 * @param network Network identifier (e.g., 'mainnet', 'westend')
 * @param address HydrationChain address to check balances for
 * @param tokenSymbols Optional list of specific token symbols to check
 * @returns Balance response object with token balances
 */
export async function getHydrationChainBalances(
  _fastify: FastifyInstance,
  network: string,
  address: string,
  tokenSymbols?: string[],
): Promise<HydrationChainBalanceResponse> {
  if (!network) {
    throw new Error('Network parameter is required');
  }

  if (!address) {
    throw new Error('Address parameter is required');
  }

  const hydrationChain = await HydrationChain.getInstance(network);

  return await hydrationChain.getAddressBalances(address, tokenSymbols);
}

/**
 * Route plugin that registers the balances endpoint
 */
export const balancesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: HydrationChainBalanceRequest;
    Reply: HydrationChainBalanceResponse;
  }>(
    '/balances',
    {
      schema: {
        description: 'Get token balances for a HydrationChain address',
        tags: ['hydrationChain'],
        body: HydrationChainBalanceRequestSchema,
        response: {
          200: HydrationChainBalanceResponseSchema,
        },
      },
    },
    async (request) => {
      const response = await getHydrationChainBalances(
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
