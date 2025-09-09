import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { validateHydrationAddress } from '../../../../chains/hydration/hydration.validators';
import { logger } from '../../../../services/logger';
import { Hydration } from '../../hydration';
import {
  HydrationAddLiquidityRequest,
  HydrationAddLiquidityRequestSchema,
  HydrationAddLiquidityResponse,
  HydrationAddLiquidityResponseSchema,
} from '../../hydration.types';

/**
 * Adds liquidity to a Hydration position.
 *
 * @param fastify - Fastify instance
 * @param network - The blockchain network (e.g., 'mainnet')
 * @param walletAddress - The user's wallet address
 * @param poolId - The pool ID to add liquidity to
 * @param baseTokenAmount - Amount of base token to add
 * @param quoteTokenAmount - Amount of quote token to add
 * @param slippagePct - Optional slippage percentage (default from config)
 * @param baseToken - Optional base token symbol (only used for omnipool)
 * @param quoteToken - Optional quote token symbol (only used for omnipool)
 * @returns Details of the liquidity addition operation
 */
export async function addLiquidityToHydration(
  fastify: FastifyInstance,
  network: string,
  walletAddress: string,
  poolId: string,
  baseTokenAmount: number,
  quoteTokenAmount: number,
  slippagePct?: number,
  baseToken?: string,
  quoteToken?: string,
): Promise<HydrationAddLiquidityResponse> {
  // Validate required parameters
  if (!network) {
    throw fastify.httpErrors.badRequest('Network parameter is required');
  }

  if (!poolId) {
    throw fastify.httpErrors.badRequest('Pool ID parameter is required');
  }

  // Validate wallet address
  try {
    validateHydrationAddress(walletAddress);
  } catch (error) {
    throw fastify.httpErrors.badRequest('Invalid hydration address');
  }

  // Get Hydration instance
  const hydration = await Hydration.getInstance(network);
  if (!hydration) {
    throw fastify.httpErrors.serviceUnavailable(
      'Hydration service unavailable',
    );
  }

  // Log request parameters
  logger.info(`Adding liquidity to pool ${poolId} on ${network}`);
  logger.info(
    `Base amount: ${baseTokenAmount}, Quote amount: ${quoteTokenAmount}`,
  );

  try {
    const result = await hydration.addLiquidity(
      walletAddress,
      poolId,
      baseTokenAmount,
      quoteTokenAmount,
      slippagePct,
      baseToken,
      quoteToken,
    );

    // Log successful execution
    logger.info(`Successfully added liquidity to pool ${poolId}`);
    logger.info(`Transaction signature: ${result.signature}`);

    return result;
  } catch (error) {
    // Log error details
    logger.error(`Error adding liquidity: ${error.message}`);

    if (
      error.message?.includes('not found') ||
      error.message?.includes('Pool not found')
    ) {
      throw fastify.httpErrors.notFound(error.message);
    }

    if (
      error.message?.includes('Insufficient') ||
      error.message?.includes('Invalid') ||
      error.message?.includes('You must provide')
    ) {
      throw fastify.httpErrors.badRequest(error.message);
    }

    throw fastify.httpErrors.internalServerError('Failed to add liquidity');
  }
}

/**
 * Route plugin that registers the add-liquidity endpoint.
 * Exposes an endpoint for adding liquidity to specified pools.
 */
export const addLiquidityRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: HydrationAddLiquidityRequest;
    Reply: HydrationAddLiquidityResponse;
  }>(
    '/add-liquidity',
    {
      schema: {
        description: 'Add liquidity to a Hydration pool',
        tags: ['hydration/amm'],
        body: HydrationAddLiquidityRequestSchema,
        response: {
          200: HydrationAddLiquidityResponseSchema,
          400: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, _reply) => {
      try {
        const {
          walletAddress,
          poolAddress,
          baseTokenAmount,
          quoteTokenAmount,
          slippagePct,
          baseToken,
          quoteToken,
        } = request.body;
        const network = request.body.network || 'mainnet';

        const result = await addLiquidityToHydration(
          fastify,
          network,
          walletAddress,
          poolAddress,
          baseTokenAmount,
          quoteTokenAmount,
          slippagePct,
          baseToken,
          quoteToken,
        );

        return result;
      } catch (error) {
        // Error handling is done in addLiquidityToHydration
        throw error;
      }
    },
  );
};

export default addLiquidityRoute;
