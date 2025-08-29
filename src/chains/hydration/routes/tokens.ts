import { FastifyPluginAsync, FastifyInstance } from 'fastify';

import { HydrationChain } from '../hydration';
import {
  HydrationChainTokensRequest,
  HydrationChainTokensResponse,
  HydrationChainTokensRequestSchema,
  HydrationChainTokensResponseSchema,
} from '../hydration.types';

/**
 * Retrieves token information from the HydrationChain network
 *
 * @param fastify Fastify instance
 * @param network Network identifier (e.g., 'mainnet', 'westend')
 * @param tokenSymbols Optional array or string of token symbols to filter by
 * @returns Token information for the requested tokens
 */
export async function getHydrationChainTokens(
  _fastify: FastifyInstance,
  network: string,
  tokenSymbols?: string[] | string,
): Promise<HydrationChainTokensResponse> {
  if (!network) {
    throw new Error('Network parameter is required');
  }

  const hydrationChain = await HydrationChain.getInstance(network);
  const tokens = await hydrationChain.getTokensWithSymbols(tokenSymbols);

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
    Querystring: HydrationChainTokensRequest;
    Reply: HydrationChainTokensResponse;
  }>(
    '/tokens',
    {
      schema: {
        description: 'Get token information for HydrationChain network',
        tags: ['HydrationChain'],
        querystring: HydrationChainTokensRequestSchema,
        response: {
          200: HydrationChainTokensResponseSchema,
        },
      },
    },
    async (request) => {
      return await getHydrationChainTokens(
        fastify,
        request.query.network,
        request.query.tokenSymbols,
      );
    },
  );
};

export default tokensRoute;
