import { Type } from '@sinclair/typebox';
import { FastifyPluginAsync } from 'fastify';

import { logger } from '../../../../services/logger';
import { Hydration } from '../../hydration';

// Define request schema
const PositionsOwnedRequest = Type.Object({
  network: Type.Optional(Type.String({ default: 'mainnet' })),
  walletAddress: Type.String({
    description: 'The wallet address to check positions for',
    examples: [],
  }),
  tokenId: Type.Optional(
    Type.String({
      description: 'The token ID to filter positions by',
      examples: [],
    }),
  ),
  poolAddress: Type.Optional(
    Type.String({
      description: 'The pool address to filter positions by',
      examples: [],
    }),
  ),
});

// Define response schema
const PositionsOwnedResponse = Type.Array(
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
);

export const positionsOwnedRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: typeof PositionsOwnedRequest.static;
    Reply: typeof PositionsOwnedResponse.static;
  }>(
    '/positions-owned',
    {
      schema: {
        description:
          'Get all positions owned by a wallet address for a specific token or pool',
        tags: ['hydration'],
        querystring: PositionsOwnedRequest,
        response: {
          200: PositionsOwnedResponse,
        },
      },
    },
    async (request) => {
      try {
        const { walletAddress, tokenId, poolAddress } = request.query;
        const network = request.query.network || 'mainnet';

        if (!tokenId && !poolAddress) {
          throw fastify.httpErrors.badRequest(
            'Either tokenId or poolAddress must be provided',
          );
        }

        // Get Hydration instance
        const hydration = await Hydration.getInstance(network);

        // Use poolAddress if provided, otherwise use tokenId
        const identifier = poolAddress || tokenId;

        // Get positions owned by the wallet
        const rawPositions = await hydration.getPositionsOwned(
          walletAddress,
          identifier,
        );

        // Fetch pool info for base/quote token addresses
        let poolInfo = null;
        if (poolAddress) {
          poolInfo = await hydration.getPoolInfo(poolAddress);
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

        return positions;
      } catch (e) {
        logger.error(e);
        throw fastify.httpErrors.internalServerError(
          'Failed to fetch positions',
        );
      }
    },
  );
};

export default positionsOwnedRoute;
