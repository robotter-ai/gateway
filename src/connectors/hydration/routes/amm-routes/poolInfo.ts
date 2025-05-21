import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Hydration } from '../../hydration';
import { logger } from '../../../../services/logger';
import {
  HydrationPoolInfo,
  HydrationPoolInfoSchema,
  HydrationGetPoolInfoRequest,
  HydrationGetPoolInfoRequestSchema
} from '../../hydration.types';

/**
 * Retrieves detailed information about a specific Hydration pool.
 * 
 * @param fastify - Fastify instance
 * @param network - The blockchain network (e.g., 'mainnet')
 * @param poolAddress - Address of the pool to retrieve information for
 * @returns Detailed pool information
 */
export async function getHydrationPoolInfo(
  fastify: FastifyInstance,
  network: string,
  poolAddress: string
): Promise<HydrationPoolInfo> {
  // Validate required parameters
  if (!network) {
    throw fastify.httpErrors.badRequest('Network parameter is required');
  }
  
  if (!poolAddress) {
    throw fastify.httpErrors.badRequest('Pool address parameter is required');
  }

  // Get Hydration instance
  const hydration = await Hydration.getInstance(network);
  if (!hydration) {
    throw fastify.httpErrors.serviceUnavailable('Hydration service unavailable');
  }

  // Log request parameters
  logger.info(`Getting pool info for ${poolAddress} on ${network}`);

  try {
    // Get pool information with proper typing
    const poolInfo = await hydration.getPoolDetails(poolAddress);
    if (!poolInfo) {
      throw fastify.httpErrors.notFound(`Pool not found: ${poolAddress}`);
    }

    // Log successful execution
    logger.info(`Successfully retrieved pool info for ${poolAddress}`);

    return poolInfo;
  } catch (error) {
    // Log error details
    logger.error(`Error getting pool info: ${error.message}`);
    
    if (error.message?.includes('not found')) {
      throw fastify.httpErrors.notFound(error.message);
    }
    
    throw fastify.httpErrors.internalServerError('Failed to get pool info');
  }
}

/**
 * Route plugin that registers the pool-info endpoint.
 * Exposes an endpoint for retrieving detailed information about a specific pool.
 */
export const poolInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: HydrationGetPoolInfoRequest;
    Reply: HydrationPoolInfo;
  }>(
    '/pool-info',
    {
      schema: {
        description: 'Get pool information for a Hydration pool',
        tags: ['hydration/amm'],
        querystring: HydrationGetPoolInfoRequestSchema,
        response: {
          200: HydrationPoolInfoSchema,
          400: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (request, _reply) => {
      try {
        const { poolAddress } = request.query;
        const network = request.query.network || 'mainnet';

        const result = await getHydrationPoolInfo(
          fastify,
          network,
          poolAddress
        );

        return result;
      } catch (error) {
        // Error handling is done in getHydrationPoolInfo
        throw error;
      }
    }
  );
};

export default poolInfoRoute;

