import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { Hydration } from '../hydration';
import {
  HydrationEstimateGasRequest,
  HydrationEstimateGasResponse,
  HydrationEstimateGasRequestSchema,
  HydrationEstimateGasResponseSchema,
} from '../hydration.types';

/**
 * Estimates gas (fees) for a Hydration transaction
 *
 * For Hydration networks, this provides fee estimation information including:
 * - Gas price (usually 0 as Hydration uses weight-based fees)
 * - Gas price token (native currency symbol)
 * - Gas limit (if specified)
 * - Gas cost estimate
 *
 * @param fastify Fastify instance
 * @param network Network identifier (e.g., 'mainnet', 'westend')
 * @param gasLimit Optional gas limit for the transaction
 * @returns Gas estimation information
 */
export async function estimateGasHydration(
  _fastify: FastifyInstance,
  network: string,
  gasLimit?: number,
): Promise<HydrationEstimateGasResponse> {
  if (!network) {
    throw new Error('Network parameter is required');
  }

  const hydration = await Hydration.getInstance(network);
  return await hydration.estimateTransactionGas(gasLimit);
}

/**
 * Route plugin that registers the gas estimation endpoint
 */
export const estimateGasRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: HydrationEstimateGasRequest;
    Reply: HydrationEstimateGasResponse;
  }>(
    '/estimate-gas',
    {
      schema: {
        description: 'Estimate gas for a Hydration transaction',
        tags: ['hydration'],
        body: {
          ...HydrationEstimateGasRequestSchema,
          properties: {
            ...HydrationEstimateGasRequestSchema.properties,
            chain: {
              type: 'string',
              enum: ['hydration'],
              examples: ['hydration'],
            },
            network: { type: 'string', examples: ['mainnet', 'westend'] },
            gasLimit: { type: 'number', examples: [100000] },
          },
        },
        response: {
          200: HydrationEstimateGasResponseSchema,
        },
      },
    },
    async (request) => {
      const { network, gasLimit } = request.body;

      return await estimateGasHydration(fastify, network, gasLimit);
    },
  );
};

export default estimateGasRoute;
