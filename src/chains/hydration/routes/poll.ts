import { FastifyPluginAsync, FastifyInstance } from 'fastify';

import { HydrationChain } from '../hydration';
import {
  HydrationChainPollRequest,
  HydrationChainPollResponse,
  HydrationChainPollRequestSchema,
  HydrationChainPollResponseSchema,
} from '../hydration.types';

/**
 * Polls transaction status on the Polkadot network
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
): Promise<HydrationChainPollResponse> {
  if (!network) {
    throw new Error('Network parameter is required');
  }

  if (!txHash) {
    throw new Error('Transaction hash parameter is required');
  }

  const polkadot = await HydrationChain.getInstance(network);
  return await polkadot.pollTransaction(txHash);
}

/**
 * Route plugin that registers the transaction polling endpoint
 */
export const pollRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: HydrationChainPollRequest;
    Reply: HydrationChainPollResponse;
  }>(
    '/poll',
    {
      schema: {
        description: 'Poll transaction status on Polkadot network',
        tags: ['polkadot'],
        body: HydrationChainPollRequestSchema,
        response: {
          200: HydrationChainPollResponseSchema,
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
