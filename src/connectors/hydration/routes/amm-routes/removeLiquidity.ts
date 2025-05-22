import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { Hydration } from '../../hydration';
import { Polkadot } from '../../../../chains/polkadot/polkadot';
import { logger } from '../../../../services/logger';
import { 
  HydrationRemoveLiquidityRequest, 
  HydrationRemoveLiquidityRequestSchema, 
  HydrationRemoveLiquidityResponse, 
  HydrationRemoveLiquidityResponseSchema 
} from '../../hydration.types';
import { validatePolkadotAddress } from '../../../../chains/polkadot/polkadot.validators';
import { RemoveLiquidityRequest } from '../../../../schemas/trading-types/amm-schema';

/**
 * Removes liquidity from a pool.
 * 
 * @param fastify - Fastify instance
 * @param network - The blockchain network (e.g., 'mainnet')
 * @param walletAddress - The user's wallet address
 * @param poolAddress - The pool address to remove liquidity from
 * @param percentageToRemove - Percentage to remove (1-100)
 * @param tokenId - The token ID to remove liquidity from
 * @returns Details of the liquidity removal operation
 */
export async function removeLiquidity(
  fastify: FastifyInstance,
  network: string,
  walletAddress: string,
  poolAddress: string,
  percentageToRemove: number,
  tokenId?: string | number
): Promise<HydrationRemoveLiquidityResponse> {
  // Validate inputs
  if (percentageToRemove <= 0 || percentageToRemove > 100) {
    throw fastify.httpErrors.badRequest('Percentage to remove must be between 0 and 100');
  }

  // Validate address
  try {
    validatePolkadotAddress(walletAddress);
  } catch (error) {
    throw fastify.httpErrors.badRequest('Invalid Polkadot address');
  }

  // Get Hydration instance
  const hydration = await Hydration.getInstance(network);
  if (!hydration) {
    throw fastify.httpErrors.serviceUnavailable('Hydration service unavailable');
  }

  // Log request parameters
  logger.info(`Removing liquidity from pool ${poolAddress} on ${network}`);
  logger.info(`Percentage to remove: ${percentageToRemove}%, Token ID: ${tokenId || 'default'}`);
  
  try {
    const result = await hydration.removeLiquidity(
      walletAddress,
      poolAddress,
      percentageToRemove,
      tokenId
    );
    
    // Log successful execution
    logger.info(`Successfully removed liquidity from pool ${poolAddress}`);
    logger.info(`Transaction signature: ${result.signature}`);

    return {
      signature: result.signature,
      fee: result.fee,
      baseTokenAmountRemoved: result.baseTokenAmountRemoved,
      quoteTokenAmountRemoved: result.quoteTokenAmountRemoved,
      sharesPercentageRemoved: result.sharesPercentageRemoved,
      sharesAmountRemoved: result.sharesAmountRemoved
    };
  } catch (error) {
    // Log error details
    logger.error(`Error removing liquidity: ${error.message}`);
    
    if (error.message?.includes('not found')) {
      throw fastify.httpErrors.notFound(error.message);
    } else if (error.message?.includes('must be between')) {
      throw fastify.httpErrors.badRequest(error.message);
    }
    
    throw fastify.httpErrors.internalServerError('Failed to remove liquidity');
  }
}

/**
 * Route handler for removing liquidity
 */
export const removeLiquidityRoute: FastifyPluginAsync = async (fastify) => {
  // Get first wallet address for example
  const polkadot = await Polkadot.getInstance('mainnet');
  let firstWalletAddress = '<polkadot-wallet-address>';
  
  const foundWallet = await polkadot.getFirstWalletAddress();
  if (foundWallet) {
    firstWalletAddress = foundWallet;
  } else {
    logger.debug('No wallets found for examples in schema');
  }
  
  // Update schema example
  RemoveLiquidityRequest.properties.walletAddress.examples = [firstWalletAddress];

  fastify.post<{
    Body: HydrationRemoveLiquidityRequest;
    Reply: HydrationRemoveLiquidityResponse;
  }>(
    '/remove-liquidity',
    {
      schema: {
        description: 'Remove liquidity from a Hydration pool',
        tags: ['hydration/amm'],
        body: {
          ...HydrationRemoveLiquidityRequestSchema,
          properties: {
            ...HydrationRemoveLiquidityRequestSchema.properties,
            network: { type: 'string', default: 'mainnet' },
            poolAddress: { type: 'string', examples: ['hydration-pool-0'] },
            percentageToRemove: { type: 'number', examples: [50] },
            tokenId: { type: ['string', 'number'], examples: ['31'] }
          }
        },
        response: {
          200: HydrationRemoveLiquidityResponseSchema,
          400: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } }
        },
      }
    },
    async (request, _reply) => {
      try {
        const { network, walletAddress, poolAddress, percentageToRemove, tokenId } = request.body as HydrationRemoveLiquidityRequest;
        const networkToUse = network || 'mainnet';
        
        const result = await removeLiquidity(
          fastify,
          networkToUse,
          walletAddress,
          poolAddress,
          percentageToRemove,
          tokenId
        );
        
        return result;
      } catch (error) {
        // Error handling is done in removeLiquidity
        throw error;
      }
    }
  );
};

export default removeLiquidityRoute;

