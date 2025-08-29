import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { HydrationChain } from '../hydration';
import {
  HydrationChainEstimateGasRequest,
  HydrationChainEstimateGasResponse,
  HydrationChainEstimateGasRequestSchema,
  HydrationChainEstimateGasResponseSchema,
} from '../hydration.types';

/**
 * Estimates gas (fees) for a HydrationChain transaction
 *
 * For HydrationChain networks, this provides fee estimation information including:
 * - Gas price (usually 0 as HydrationChain uses weight-based fees)
 * - Gas price token (native currency symbol)
 * - Gas limit (if specified)
 * - Gas cost estimate
 *
 * @param fastify Fastify instance
 * @param network Network identifier (e.g., 'mainnet', 'westend')
 * @param gasLimit Optional gas limit for the transaction
 * @returns Gas estimation information
 */
export async function estimateGasHydrationChain(
  _fastify: FastifyInstance,
  network: string,
  gasLimit?: number,
): Promise<HydrationChainEstimateGasResponse> {
  if (!network) {
    throw new Error('Network parameter is required');
  }

  const hydrationChain = await HydrationChain.getInstance(network);
  return await hydrationChain.estimateTransactionGas(gasLimit);
}

/**
 * Route plugin that registers the gas estimation endpoint
 */
export const estimateGasRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: HydrationChainEstimateGasRequest;
    Reply: HydrationChainEstimateGasResponse;
  }>(
    '/estimate-gas',
    {
      schema: {
        description: 'Estimate gas for a HydrationChain transaction',
        tags: ['HydrationChain'],
        body: {
          ...HydrationChainEstimateGasRequestSchema,
          properties: {
            ...HydrationChainEstimateGasRequestSchema.properties,
            chain: {
              type: 'string',
              enum: ['HydrationChain'],
              examples: ['HydrationChain'],
            },
            network: { type: 'string', examples: ['mainnet', 'westend'] },
            gasLimit: { type: 'number', examples: [100000] },
          },
        },
        response: {
          200: HydrationChainEstimateGasResponseSchema,
        },
      },
    },
    async (request) => {
      const { network, gasLimit } = request.body;

      return await estimateGasHydrationChain(fastify, network, gasLimit);
    },
  );
};

export default estimateGasRoute;
