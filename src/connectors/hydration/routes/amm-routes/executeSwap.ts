import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { validateHydrationAddress } from '../../../../chains/hydration/hydration.validators';
import { logger } from '../../../../services/logger';
import { Hydration } from '../../hydration';
import {
  HydrationExecuteSwapRequest,
  HydrationExecuteSwapRequestSchema,
  HydrationExecuteSwapResponse,
  HydrationExecuteSwapResponseSchema,
} from '../../hydration.types';

/**
 * Executes a token swap on the Hydration protocol.
 *
 * @param fastify - Fastify instance
 * @param network - The blockchain network (e.g., 'mainnet')
 * @param walletAddress - The user's wallet address
 * @param baseToken - Base token symbol or address
 * @param quoteToken - Quote token symbol or address
 * @param amount - Amount to swap
 * @param side - 'BUY' or 'SELL'
 * @param poolAddress - Pool address
 * @param slippagePct - Optional slippage percentage (default from config)
 * @returns Details of the swap execution
 */
export async function executeSwapOnHydration(
  fastify: FastifyInstance,
  network: string,
  walletAddress: string,
  baseToken: string,
  quoteToken: string,
  amount: number,
  side: 'BUY' | 'SELL',
  poolAddress?: string,
  slippagePct?: number,
): Promise<HydrationExecuteSwapResponse> {
  // Validate required parameters
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

  // Validate wallet address
  try {
    validateHydrationAddress(walletAddress);
  } catch (error) {
    throw fastify.httpErrors.badRequest('Invalid Polkadot address');
  }

  // Get Hydration instance
  const hydration = await Hydration.getInstance(network);
  if (!hydration) {
    throw fastify.httpErrors.serviceUnavailable(
      'Hydration service unavailable',
    );
  }

  // Log request parameters
  logger.info(`Executing swap for ${baseToken}-${quoteToken} on ${network}`);
  logger.info(
    `Amount: ${amount}, Side: ${side}, Pool: ${poolAddress || 'default'}`,
  );

  try {
    const result = await hydration.executeSwapWithWalletAddress(
      network,
      walletAddress,
      baseToken,
      quoteToken,
      amount,
      side,
      poolAddress,
      slippagePct,
    );

    // Log successful execution
    logger.info(`Successfully executed swap for ${baseToken}-${quoteToken}`);
    logger.info(`Transaction signature: ${result.signature}`);

    return result;
  } catch (error) {
    // Log error details
    logger.error(`Error executing swap: ${error.message}`);

    if (
      error.message?.includes('not found') ||
      error.message?.includes('Pool not found')
    ) {
      throw fastify.httpErrors.notFound(error.message);
    }

    if (error.message?.includes('Insufficient')) {
      throw fastify.httpErrors.badRequest(error.message);
    }

    throw fastify.httpErrors.internalServerError('Failed to execute swap');
  }
}

/**
 * Route plugin that registers the execute-swap endpoint.
 * Exposes an endpoint for executing token swaps on Hydration protocol.
 */
export const executeSwapRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: HydrationExecuteSwapRequest;
    Reply: HydrationExecuteSwapResponse;
  }>(
    '/execute-swap',
    {
      schema: {
        description: 'Execute a token swap in a Hydration pool',
        tags: ['hydration/amm'],
        body: HydrationExecuteSwapRequestSchema,
        response: {
          200: HydrationExecuteSwapResponseSchema,
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
          baseToken,
          quoteToken,
          amount,
          side,
          poolAddress,
          slippagePct,
        } = request.body;
        const network = request.body.network || 'mainnet';

        const result = await executeSwapOnHydration(
          fastify,
          network,
          walletAddress,
          baseToken,
          quoteToken,
          amount,
          side as 'BUY' | 'SELL',
          poolAddress,
          slippagePct,
        );

        return result;
      } catch (error) {
        // Error handling is done in executeSwapOnHydration
        throw error;
      }
    },
  );
};

export default executeSwapRoute;
