import { FastifyPluginAsync, FastifyInstance } from 'fastify';

import { HydrationChain } from '../hydration';
import {
  HydrationChainStatusRequest,
  HydrationChainStatusResponse,
  HydrationChainStatusRequestSchema,
  HydrationChainPollResponseSchema,
} from '../hydration.types';

/**
 * Gets network status information from the HydrationChain blockchain
 *
 * @param fastify Fastify instance
 * @param network Network identifier (e.g., 'mainnet', 'westend')
 * @returns Network status information
 */
export async function getHydrationStatus(
  _fastify: FastifyInstance,
  network: string,
): Promise<HydrationChainStatusResponse> {
  if (!network) {
    throw new Error('Network parameter is required');
  }

  const hydrationChain = await HydrationChain.getInstance(network);
  return await hydrationChain.getNetworkStatus();
}

/**
 * Route plugin that registers the status endpoint
 */
export const statusRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: HydrationChainStatusRequest;
    Reply: HydrationChainStatusResponse;
  }>(
    '/status',
    {
      schema: {
        description: 'Get HydrationChain network status',
        tags: ['hydrationChain'],
        querystring: HydrationChainStatusRequestSchema,
        response: {
          200: HydrationChainPollResponseSchema,
        },
      },
    },
    async (request) => {
      return await getHydrationStatus(fastify, request.query.network);
    },
  );
};

export default statusRoute;
