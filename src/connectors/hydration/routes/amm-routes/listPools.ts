import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { logger } from '../../../../services/logger';
import { Hydration } from '../../hydration';
import {
  HydrationListPoolsRequest,
  HydrationListPoolsRequestSchema,
  HydrationListPoolsResponse,
  HydrationListPoolsResponseSchema,
} from '../../hydration.types';

/**
 * Extended request parameters for listPools endpoint with filtering options.
 */
interface ExtendedListPoolsRequest extends HydrationListPoolsRequest {
  types?: string[];
  tokenSymbols?: string[];
  tokenAddresses?: string[];
}

/**
 * Lists available pools on the Hydration protocol with filtering options.
 *
 * @param fastify - Fastify instance
 * @param network - The blockchain network (e.g., 'mainnet')
 * @param types - Array of pool types to filter by (e.g., ['xyk', 'stableswap'])
 * @param tokenSymbols - Array of token symbols to filter by
 * @param tokenAddresses - Array of token addresses to filter by
 * @returns List of filtered pools
 */
export async function listHydrationPools(
  fastify: FastifyInstance,
  network: string,
  types: string[] = [],
  tokenSymbols: string[] = [],
  tokenAddresses: string[] = [],
): Promise<HydrationListPoolsResponse> {
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
  logger.info(`Listing pools on ${network}`);
  logger.info(
    `Filters: types=${types.join(',')}, symbols=${tokenSymbols.join(',')}, addresses=${tokenAddresses.join(',')}`,
  );

  try {
    const pools = await hydration.listPools(
      types,
      tokenSymbols,
      tokenAddresses,
    );

    // Log successful execution
    logger.info(`Successfully listed ${pools.length} pools`);

    return { pools };
  } catch (error) {
    // Log error details
    logger.error(`Error listing pools: ${error.message}`);
    throw fastify.httpErrors.internalServerError('Failed to list pools');
  }
}

/**
 * Route plugin that registers the list-pools endpoint.
 * Exposes an endpoint for listing all available pools with filtering options.
 */
export const listPoolsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: ExtendedListPoolsRequest;
    Reply: HydrationListPoolsResponse;
  }>(
    '/list-pools',
    {
      schema: {
        description: 'List all Hydration pools',
        tags: ['hydration/amm'],
        querystring: {
          ...HydrationListPoolsRequestSchema,
          properties: {
            network: { type: 'string', default: 'mainnet' },
            types: {
              type: 'array',
              items: { type: 'string' },
              description: 'Pool types to filter by',
            },
            tokenSymbols: {
              type: 'array',
              items: { type: 'string' },
              description: 'Token symbols to filter by',
            },
            tokenAddresses: {
              type: 'array',
              items: { type: 'string' },
              description: 'Token addresses to filter by',
            },
          },
        },
        response: {
          200: HydrationListPoolsResponseSchema,
          400: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, _reply) => {
      // Extract parameters with defaults
      const { network = 'mainnet', types = [] } = request.query;

      // Handle tokenSymbols and tokenAddresses specially to ensure they're properly formatted as arrays
      let tokenSymbols = request.query.tokenSymbols || [];
      let tokenAddresses = request.query.tokenAddresses || [];

      // Ensure tokenSymbols is always an array
      if (!Array.isArray(tokenSymbols)) {
        tokenSymbols = [tokenSymbols];
      }

      // Ensure tokenAddresses is always an array
      if (!Array.isArray(tokenAddresses)) {
        tokenAddresses = [tokenAddresses];
      }

      // Filter out empty strings
      tokenSymbols = tokenSymbols.filter(Boolean);
      tokenAddresses = tokenAddresses.filter(Boolean);

      logger.debug(
        `Request params: network=${network}, tokenSymbols=${JSON.stringify(tokenSymbols)}, tokenAddresses=${JSON.stringify(tokenAddresses)}`,
      );

      try {
        const result = await listHydrationPools(
          fastify,
          network,
          types,
          tokenSymbols,
          tokenAddresses,
        );

        return result;
      } catch (error) {
        // Error handling is done in listHydrationPools
        throw error;
      }
    },
  );
};

export default listPoolsRoute;
