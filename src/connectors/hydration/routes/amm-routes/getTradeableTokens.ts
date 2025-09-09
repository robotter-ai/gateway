import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { logger } from '../../../../services/logger';
import { Hydration } from '../../hydration';
import {
  HydrationGetTradeableTokensRequest,
  HydrationGetTradeableTokensResponse,
} from '../../hydration.types';

/**
 * Get all tradeable tokens using Galactic Council SDK TradeRouter
 *
 * @param fastify - Fastify instance
 * @param network - The blockchain network (e.g., 'mainnet')
 * @returns List of tradeable tokens
 */
export async function getTradeableHydrationTokens(
  fastify: FastifyInstance,
  network: string,
): Promise<HydrationGetTradeableTokensResponse> {
  // Validate required parameters
  if (!network) {
    throw fastify.httpErrors.badRequest('Network parameter is required');
  }

  // Get Hydration instance
  const hydration = await Hydration.getInstance(network);
  if (!hydration) {
    throw fastify.httpErrors.serviceUnavailable(
      'Hydration service unavailable',
    );
  }

  // Log request parameters
  logger.info(`Getting tradeable tokens on ${network}`);

  try {
    const tokens = await hydration.getTradeableTokensFromSDK();

    // Log successful execution
    logger.info(`Successfully retrieved ${tokens.length} tradeable tokens`);

    return { tokens };
  } catch (error) {
    // Log error details
    logger.error(`Error getting tradeable tokens: ${error.message}`);
    throw fastify.httpErrors.internalServerError('Failed to get tradeable tokens');
  }
}

/**
 * Route plugin that registers the get-tradeable-tokens endpoint.
 * Exposes an endpoint for getting all tradeable tokens in the Hydration ecosystem.
 */
export const getTradeableTokensRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: HydrationGetTradeableTokensRequest;
    Reply: HydrationGetTradeableTokensResponse;
  }>(
    '/get-tradeable-tokens',
    {
      schema: {
        description: 'Get all tradeable tokens in the Hydration ecosystem',
        tags: ['hydration/tokens'],
        querystring: {
          type: 'object',
          properties: {
            network: { 
              type: 'string', 
              default: 'mainnet',
              description: 'The blockchain network'
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tokens: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    symbol: { type: 'string' },
                    decimals: { type: 'number' },
                    icon: { type: 'string' },
                    type: { type: 'string' },
                    existentialDeposit: { type: 'string' },
                    isSufficient: { type: 'boolean' },
                    location: { type: 'object' },
                    meta: { type: 'object' },
                    isWhiteListed: { type: 'boolean' },
                  },
                },
              },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, _reply) => {
      // Extract parameters with defaults
      const { network = 'mainnet' } = request.query;

      logger.debug(`Request params: network=${network}`);

      try {
        const result = await getTradeableHydrationTokens(fastify, network);

        return result;
      } catch (error) {
        // Error handling is done in getTradeableHydrationTokens
        throw error;
      }
    },
  );
};

export default getTradeableTokensRoute;
