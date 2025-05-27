import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Hydration } from '../../hydration';
import { logger } from '../../../../services/logger';
import {
  HydrationGetSwapQuoteRequest,
  HydrationGetSwapQuoteRequestSchema,
  HydrationGetSwapQuoteResponse,
  HydrationGetSwapQuoteResponseSchema
} from '../../hydration.types';

/**
 * Gets a swap quote for a potential token exchange on Hydration.
 * 
 * @param fastify - Fastify instance
 * @param network - The blockchain network (e.g., 'mainnet')
 * @param baseToken - Base token symbol or address
 * @param quoteToken - Quote token symbol or address
 * @param amount - Amount to swap
 * @param side - 'BUY' or 'SELL'
 * @param poolAddress - Optional pool address for specific pool
 * @param slippagePct - Optional slippage percentage (default from config)
 * @returns Swap quote with estimated amounts and price information
 */
export async function getHydrationSwapQuote(
  fastify: FastifyInstance,
  network: string,
  baseToken: string,
  quoteToken: string,
  amount: number,
  side: 'BUY' | 'SELL',
  poolAddress?: string,
  slippagePct?: number
): Promise<HydrationGetSwapQuoteResponse> {
  // Validate required parameters
  if (!network) {
    throw fastify.httpErrors.badRequest('Network parameter is required');
  }
  
  if (!baseToken) {
    throw fastify.httpErrors.badRequest('Base token parameter is required');
  }
  
  if (!quoteToken) {
    throw fastify.httpErrors.badRequest('Quote token parameter is required');
  }
  
  if (!amount || amount <= 0) {
    throw fastify.httpErrors.badRequest('Amount must be a positive number');
  }
  
  if (side !== 'BUY' && side !== 'SELL') {
    throw fastify.httpErrors.badRequest('Side must be "BUY" or "SELL"');
  }

  // Get Hydration instance
  const hydration = await Hydration.getInstance(network);
  if (!hydration) {
    throw fastify.httpErrors.serviceUnavailable('Hydration service unavailable');
  }

  // Log request parameters
  logger.info(`Getting swap quote for ${baseToken}-${quoteToken} on ${network}`);
  logger.info(`Amount: ${amount}, Side: ${side}, Pool: ${poolAddress || 'default'}`);

  try {
    const quote = await hydration.getSwapQuote(
      baseToken,
      quoteToken,
      amount,
      side,
      poolAddress,
      slippagePct
    );
    
    // Log successful quote
    logger.info(`Successfully generated quote for ${baseToken}-${quoteToken}`);
    logger.info(`Estimated amounts - In: ${quote.estimatedAmountIn}, Out: ${quote.estimatedAmountOut}`);
    
    return {
      estimatedAmountIn: quote.estimatedAmountIn,
      estimatedAmountOut: quote.estimatedAmountOut,
      minAmountOut: quote.minAmountOut,
      maxAmountIn: quote.maxAmountIn,
      baseTokenBalanceChange: quote.baseTokenBalanceChange,
      quoteTokenBalanceChange: quote.quoteTokenBalanceChange,
      price: quote.price,
      gasPrice: quote.gasPrice,
      gasLimit: quote.gasLimit,
      gasCost: quote.gasCost
    };
  } catch (error) {
    // Log error details
    logger.error(`Error getting swap quote: ${error.message}`);
    
    if (error.message?.includes('not found') || error.message?.includes('not supported')) {
      throw fastify.httpErrors.notFound(error.message);
    }
    
    throw fastify.httpErrors.internalServerError('Failed to get swap quote');
  }
}

/**
 * Route plugin that registers the quote-swap endpoint.
 * Exposes an endpoint for getting swap quotes for potential token exchanges.
 */
export const quoteSwapRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: HydrationGetSwapQuoteRequest;
    Reply: HydrationGetSwapQuoteResponse;
  }>(
    '/quote-swap',
    {
      schema: {
        description: 'Get a swap quote for Hydration',
        tags: ['hydration/amm'],
        querystring: HydrationGetSwapQuoteRequestSchema,
        response: {
          200: HydrationGetSwapQuoteResponseSchema,
          400: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        }
      }
    },
    async (request, _reply) => {
      try {
        const { 
          network = 'mainnet', 
          baseToken, 
          quoteToken, 
          amount, 
          side, 
          poolAddress, 
          slippagePct 
        } = request.query;

        const result = await getHydrationSwapQuote(
          fastify,
          network,
          baseToken,
          quoteToken,
          amount,
          side as 'BUY' | 'SELL',
          poolAddress,
          slippagePct
        );

        return result;
      } catch (error) {
        // Error handling is done in getHydrationSwapQuote
        throw error;
      }
    }
  );
};

export default quoteSwapRoute;