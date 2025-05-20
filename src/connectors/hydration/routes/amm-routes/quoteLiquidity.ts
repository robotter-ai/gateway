import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Hydration } from '../../hydration';
import { logger } from '../../../../services/logger';
import {
  HydrationQuoteLiquidityRequest,
  HydrationQuoteLiquidityRequestSchema,
  HydrationQuoteLiquidityResponse,
  HydrationQuoteLiquidityResponseSchema
} from '../../hydration.types';

/**
 * Gets a liquidity quote for adding liquidity to a Hydration pool.
 * 
 * @param fastify - Fastify instance
 * @param network - The blockchain network (e.g., 'mainnet')
 * @param poolAddress - Address of the pool to get quote for
 * @param baseTokenAmount - Optional amount of base token to add
 * @param quoteTokenAmount - Optional amount of quote token to add
 * @param slippagePct - Slippage percentage to account for (default: 1%)
 * @returns Liquidity quote with token amounts and price limits
 */
export async function getHydrationLiquidityQuote(
  fastify: FastifyInstance,
  network: string,
  poolAddress: string,
  baseTokenAmount?: number,
  quoteTokenAmount?: number,
  slippagePct: number = 1
): Promise<HydrationQuoteLiquidityResponse> {
  // Validate required parameters
  if (!network) {
    throw fastify.httpErrors.badRequest('Network parameter is required');
  }
  
  if (!poolAddress) {
    throw fastify.httpErrors.badRequest('Pool address parameter is required');
  }
  
  if (!baseTokenAmount && !quoteTokenAmount) {
    throw fastify.httpErrors.badRequest('Either baseTokenAmount or quoteTokenAmount must be provided');
  }

  // Get Hydration instance
  const hydration = await Hydration.getInstance(network);
  if (!hydration) {
    throw fastify.httpErrors.serviceUnavailable('Hydration service unavailable');
  }

  // Log request parameters
  logger.info(`Getting liquidity quote for pool ${poolAddress} on ${network}`);
  logger.info(`Base amount: ${baseTokenAmount || 'not set'}, Quote amount: ${quoteTokenAmount || 'not set'}, Slippage: ${slippagePct}%`);

  try {
    const quote = await hydration.quoteLiquidity(
      poolAddress,
      baseTokenAmount,
      quoteTokenAmount,
      slippagePct
    );
    
    // Log successful execution
    logger.info(`Successfully got liquidity quote for pool ${poolAddress}`);

    return quote;
  } catch (error) {
    // Log error details
    logger.error(`Error getting liquidity quote: ${error.message}`);
    
    if (error.message?.includes('not found')) {
      throw fastify.httpErrors.notFound(error.message);
    }
    
    throw fastify.httpErrors.internalServerError('Failed to get liquidity quote');
  }
}

/**
 * Route plugin that registers the quote-liquidity endpoint.
 * Exposes an endpoint for getting liquidity quotes for adding liquidity to pools.
 */
export const quoteLiquidityRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: HydrationQuoteLiquidityRequest;
    Reply: HydrationQuoteLiquidityResponse;
  }>(
    '/quote-liquidity',
    {
      schema: {
        description: 'Get a quote for adding liquidity to a Hydration pool',
        tags: ['hydration/amm'],
        querystring: HydrationQuoteLiquidityRequestSchema,
        response: {
          200: HydrationQuoteLiquidityResponseSchema,
          400: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (request, reply) => {
      try {
        const { 
          network = 'mainnet',
          poolAddress,
          baseTokenAmount,
          quoteTokenAmount,
          slippagePct = 1
        } = request.query;

        const result = await getHydrationLiquidityQuote(
          fastify,
          network,
          poolAddress,
          baseTokenAmount,
          quoteTokenAmount,
          slippagePct
        );

        return result;
      } catch (error) {
        // Error handling is done in getHydrationLiquidityQuote
        throw error;
      }
    }
  );
};

export default quoteLiquidityRoute;

