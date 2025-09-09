import { Type } from '@sinclair/typebox';
import { FastifyPluginAsync } from 'fastify';

import { logger } from '../../../../services/logger';
import { Hydration } from '../../hydration';

// Define request schema
const PositionsOwnedRequest = Type.Object({
  network: Type.Optional(Type.String({ default: 'mainnet' })),
  walletAddress: Type.Optional(
    Type.String({
      description: 'The wallet address to check positions for',
      examples: [],
    }),
  ),
  poolAddress: Type.Optional(
    Type.String({
      description: 'The pool address to filter positions by (XYK/Stableswap only)',
      examples: [],
    }),
  ),
});

// Define response schema
const PositionsOwnedResponse = Type.Union([
  Type.Array(
    Type.Object({
      id: Type.String(),
      poolAddress: Type.String(),
      walletAddress: Type.String(),
      baseTokenAddress: Type.String(),
      quoteTokenAddress: Type.String(),
      shares: Type.Optional(Type.String()),
      amount: Type.Optional(Type.String()),
      price: Type.Optional(Type.String()),
    }),
  ),
  Type.Object({
    debug: Type.Boolean(),
    message: Type.String(),
    example: Type.Object({
      xyk: Type.String(),
      stableswap: Type.String(),
    }),
  }),
]);

export const positionsOwnedRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: typeof PositionsOwnedRequest.static;
    Reply: typeof PositionsOwnedResponse.static;
  }>(
    '/positions-owned',
    {
      schema: {
        description:
          'Get all positions owned by a wallet address for a specific pool (XYK/Stableswap only). Call without parameters to get debug info.',
        tags: ['hydration'],
        querystring: PositionsOwnedRequest,
        response: {
          200: {
            oneOf: [
              {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    poolAddress: { type: 'string' },
                    walletAddress: { type: 'string' },
                    baseTokenAddress: { type: 'string' },
                    quoteTokenAddress: { type: 'string' },
                    shares: { type: 'string' },
                    amount: { type: 'string' },
                    price: { type: 'string' },
                  },
                },
              },
              {
                type: 'object',
                properties: {
                  debug: { type: 'boolean' },
                  message: { type: 'string' },
                  availableTokenIds: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  example: {
                    type: 'object',
                    properties: {
                      omnipool: { type: 'string' },
                      pool: { type: 'string' },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
    async (request) => {
      try {
        const { walletAddress, poolAddress } = request.query;
        const network = request.query.network || 'mainnet';

        // Get Hydration instance
        const hydration = await Hydration.getInstance(network);

        // If no parameters provided, return debug info
        if (!walletAddress && !poolAddress) {
          logger.info('No parameters provided, returning debug info');
          return {
            debug: true,
            message: 'No parameters provided. Use walletAddress + poolAddress for XYK/Stableswap pools',
            example: {
              xyk: '?walletAddress=YOUR_WALLET&poolAddress=POOL_ADDRESS',
              stableswap: '?walletAddress=YOUR_WALLET&poolAddress=POOL_ADDRESS'
            }
          };
        }

        if (!walletAddress) {
          throw fastify.httpErrors.badRequest('walletAddress is required');
        }

        if (!poolAddress) {
          throw fastify.httpErrors.badRequest('poolAddress is required for XYK/Stableswap pools');
        }

        // Get positions owned by the wallet
        const rawPositions = await hydration.getPositionsOwned(
          walletAddress,
          poolAddress,
        );

        // Fetch pool info for base/quote token addresses if poolAddress is provided
        let poolInfo = null;
        if (poolAddress) {
          try {
            poolInfo = await hydration.getPoolInfo(poolAddress);
          } catch (error) {
            logger.warn(`Could not fetch pool info for ${poolAddress}: ${error.message}`);
          }
        }

        const positions = rawPositions.map((pos) => ({
          id: pos.positionId,
          walletAddress,
          poolAddress: poolAddress || '',
          baseTokenAddress: poolInfo?.baseTokenAddress || '',
          quoteTokenAddress: poolInfo?.quoteTokenAddress || '',
          shares: pos.shares,
          amount: pos.amount,
          price: pos.price?.toString(),
        }));

        logger.info(`Found ${positions.length} positions for wallet ${walletAddress} with pool ${poolAddress}`);
        return positions;
      } catch (e) {
        logger.error(`Error in positionsOwned route: ${e.message}`);
        throw fastify.httpErrors.internalServerError(
          'Failed to fetch positions',
        );
      }
    },
  );
};

export default positionsOwnedRoute;
