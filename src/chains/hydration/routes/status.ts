import { FastifyPluginAsync, FastifyInstance } from 'fastify';

import { Hydration } from '../hydration';
import {
  HydrationStatusRequest,
  HydrationStatusResponse,
  HydrationStatusRequestSchema,
  HydrationStatusResponseSchema,
} from '../hydration.types';

/**
 * Gets network status information from the Hydration blockchain
 *
 * @param fastify Fastify instance
 * @param network Network identifier (e.g., 'mainnet', 'westend')
 * @returns Network status information
 */
export async function getHydrationStatus(
  _fastify: FastifyInstance,
  network: string,
): Promise<HydrationStatusResponse> {
  if (!network) {
    throw new Error('Network parameter is required');
  }

  const hydration = await Hydration.getInstance(network);
  return await hydration.getNetworkStatus();
}

/**
 * Route plugin that registers the status endpoint
 */
export const statusRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: HydrationStatusRequest;
    Reply: HydrationStatusResponse;
  }>(
    '/status',
    {
      schema: {
        description: 'Get Hydration network status',
        tags: ['hydration'],
        querystring: HydrationStatusRequestSchema,
        response: {
          200: HydrationStatusResponseSchema,
        },
      },
    },
    async (request) => {
      return await getHydrationStatus(fastify, request.query.network);
    },
  );
};

export default statusRoute;
