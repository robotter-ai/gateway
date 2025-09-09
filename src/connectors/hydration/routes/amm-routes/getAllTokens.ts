import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { logger } from '../../../../services/logger';
import { Hydration } from '../../hydration';
import {
  HydrationGetAllTokensRequest,
  HydrationGetAllTokensResponse,
} from '../../hydration.types';

/**
 * Get all tokens available in the Hydration ecosystem using Galactic Council SDK
 *
 * @param fastify - Fastify instance
 * @param network - The blockchain network (e.g., 'mainnet')
 * @param includeInvalid - Whether to include invalid assets
 * @returns List of all tokens with complete metadata
 */
export async function getAllHydrationTokens(
  fastify: FastifyInstance,
  network: string,
  includeInvalid: boolean = false,
): Promise<HydrationGetAllTokensResponse> {
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
  logger.info(`Getting all tokens on ${network}`);
  logger.info(`Include invalid: ${includeInvalid}`);

  try {
    const tokens = await hydration.getAllTokensFromSDK(includeInvalid);

    // Log successful execution
    logger.info(`Successfully retrieved ${tokens.length} tokens`);

    return { tokens };
  } catch (error) {
    // Log error details
    logger.error(`Error getting all tokens: ${error.message}`);
    throw fastify.httpErrors.internalServerError('Failed to get all tokens');
  }
}

/**
 * Route plugin that registers the get-all-tokens endpoint.
 * Exposes an endpoint for getting all tokens available in the Hydration ecosystem.
 */
export const getAllTokensRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: HydrationGetAllTokensRequest;
    Reply: HydrationGetAllTokensResponse;
  }>(
    '/get-all-tokens',
    {
      schema: {
        description: 'Get all tokens available in the Hydration ecosystem',
        tags: ['hydration/tokens'],
        querystring: {
          type: 'object',
          properties: {
            network: { 
              type: 'string', 
              default: 'mainnet',
              description: 'The blockchain network'
            },
            includeInvalid: { 
              type: 'boolean', 
              default: false,
              description: 'Whether to include invalid assets'
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
      const { network = 'mainnet', includeInvalid = false } = request.query;

      logger.debug(
        `Request params: network=${network}, includeInvalid=${includeInvalid}`,
      );

      try {
        const result = await getAllHydrationTokens(
          fastify,
          network,
          includeInvalid,
        );

        return result;
      } catch (error) {
        // Error handling is done in getAllHydrationTokens
        throw error;
      }
    },
  );
};

export default getAllTokensRoute;
