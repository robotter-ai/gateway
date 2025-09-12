import { FastifyPluginAsync, FastifyInstance } from 'fastify';

import { HydrationChain } from '../hydration';
import {
  HydrationTokensRequest,
  HydrationTokensResponse,
  HydrationTokensRequestSchema,
  HydrationTokensResponseSchema,
} from '../hydration.types';

/**
 * Retrieves token information from the Hydration network
 *
 * @param fastify Fastify instance
 * @param network Network identifier (e.g., 'mainnet', 'westend')
 * @param tokenSymbols Optional array or string of token symbols to filter by
 * @returns Token information for the requested tokens
 */
export async function getHydrationTokens(
  _fastify: FastifyInstance,
  network: string,
  tokenSymbols?: string[] | string,
): Promise<HydrationTokensResponse> {
  if (!network) {
    throw new Error('Network parameter is required');
  }

  const hydration = await HydrationChain.getInstance(network);
  const tokens = await hydration.getTokensWithSymbols(tokenSymbols);

  return {
    tokens: tokens.map((token) => ({
      symbol: token.symbol,
      address: token.address,
      decimals: token.decimals,
      name: token.name,
    })),
  };
}

/**
 * Route plugin that registers the tokens endpoint
 */
export const tokensRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: HydrationTokensRequest;
    Reply: HydrationTokensResponse;
  }>(
    '/tokens',
    {
      schema: {
        description: 'Get token information for Hydration network',
        tags: ['hydration'],
        querystring: HydrationTokensRequestSchema,
        response: {
          200: HydrationTokensResponseSchema,
        },
      },
    },
    async (request) => {
      return await getHydrationTokens(
        fastify,
        request.query.network,
        request.query.tokenSymbols,
      );
    },
  );
};

export default tokensRoute;
