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
      description: 'The pool address to filter positions by. Works for XYK, Stableswap, and Omnipool (for the Omnipool, leave empty))',
      examples: [],
    }),
  ),
  omnipoolToken: Type.Optional(
    Type.String({
      description: 'Omnipool token symbol to filter by. Only for Omnipool; leave empty to get all Omnipool positions.',
      examples: [],
    }),
  ),
  omnipoolTokenAddress: Type.Optional(
    Type.String({
      description: 'Omnipool token address (asset id) to filter by. Only for Omnipool; leave empty to get all Omnipool positions.',
      examples: [],
    }),
  ),
});

// Define response schema
const PositionsOwnedResponse = Type.Union([
  Type.Array(
    Type.Object({
      id: Type.Optional(Type.Number()),
      ownerAddress: Type.String(),
      poolAddress: Type.String(),
      poolType: Type.String(),
      baseTokenAddress: Type.Optional(Type.String()),
      quoteTokenAddress: Type.Optional(Type.String()),
      omnipoolTokenAddress: Type.Optional(Type.String()),
      shares: Type.Number(),
      baseTokenAmount: Type.Optional(Type.Number()),
      quoteTokenAmount: Type.Optional(Type.Number()),
      omnipoolTokenAmount: Type.Optional(Type.Number()),
      price: Type.Optional(Type.Number()),
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
                    id: Type.Optional(Type.Number()),
                    ownerAddress: Type.String(),
                    poolAddress: Type.String(),
                    poolType: Type.String(),
                    baseTokenAddress: Type.Optional(Type.String()),
                    quoteTokenAddress: Type.Optional(Type.String()),
                    omnipoolTokenAddress: Type.Optional(Type.String()),
                    shares: Type.Number(),
                    baseTokenAmount: Type.Optional(Type.Number()),
                    quoteTokenAmount: Type.Optional(Type.Number()),
                    omnipoolTokenAmount: Type.Optional(Type.Number()),
                    price: Type.Optional(Type.Number()),
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
        let { walletAddress, poolAddress, omnipoolTokenAddress, omnipoolToken } = request.query;
        const network = request.query.network || 'mainnet';

        // Get Hydration instance
        const hydration = await Hydration.getInstance(network);

        if (!walletAddress) {
          throw fastify.httpErrors.badRequest('walletAddress is required');
        }

        // Get positions owned by the wallet
        const positions = await hydration.getPositionsOwned(
          walletAddress,
          poolAddress,
          omnipoolTokenAddress,
          omnipoolToken,
        );

        logger.info(`Found ${positions.length} positions for wallet ${walletAddress} with pool ${poolAddress}`);

        return positions;
      } catch (e) {
        logger.error(`Error in positionsOwned route: ${e.message}\n${e.stack}`);

        throw fastify.httpErrors.internalServerError(
          'Failed to fetch positions',
        );
      }
    },
  );
};

export default positionsOwnedRoute;
