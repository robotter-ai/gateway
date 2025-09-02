import { FastifyPluginAsync, FastifyInstance } from 'fastify';

import { Hydration } from '../hydration';
import {
  HydrationPollRequest,
  HydrationPollResponse,
  HydrationPollRequestSchema,
  HydrationPollResponseSchema,
} from '../hydration.types';

/**
 * Polls transaction status on the Hydration network
 *
 * @param fastify Fastify instance
 * @param network Network identifier (e.g., 'mainnet', 'westend')
 * @param txHash Transaction hash to poll
 * @returns Transaction status information
 */
export async function pollHydrationTransaction(
  _fastify: FastifyInstance,
  network: string,
  txHash: string,
): Promise<HydrationPollResponse> {
  if (!network) {
    throw new Error('Network parameter is required');
  }

  if (!txHash) {
    throw new Error('Transaction hash parameter is required');
  }

  const hydration = await Hydration.getInstance(network);
  return await hydration.pollTransaction(txHash);
}

/**
 * Route plugin that registers the transaction polling endpoint
 */
export const pollRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: HydrationPollRequest;
    Reply: HydrationPollResponse;
  }>(
    '/poll',
    {
      schema: {
        description: 'Poll transaction status on Hydration network',
        tags: ['hydration'],
        body: HydrationPollRequestSchema,
        response: {
          200: HydrationPollResponseSchema,
        },
      },
    },
    async (request) => {
      return await pollHydrationTransaction(
        fastify,
        request.body.network,
        request.body.txHash,
      );
    },
  );
};

export default pollRoute;
