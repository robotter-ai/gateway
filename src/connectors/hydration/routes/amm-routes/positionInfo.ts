import { FastifyPluginAsync } from 'fastify';

import { logger } from '../../../../services/logger';
import { Hydration } from '../../hydration';
import {
  HydrationPositionInfo,
  HydrationPositionInfoSchema,
  HydrationGetPositionInfoRequest,
  HydrationGetPositionInfoRequestSchema,
} from '../../hydration.types';

/**
 * Route plugin that registers the position-info endpoint.
 * Exposes an endpoint for getting information about a user's position in a pool.
 */
export const positionInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: HydrationGetPositionInfoRequest;
    Reply: HydrationPositionInfo | ErrorResponse;
  }>(
    '/position-info',
    {
      schema: {
        description:
          "Get information about a user's position in a Hydration pool",
        tags: ['hydration'],
        querystring: HydrationGetPositionInfoRequestSchema,
        response: {
          200: HydrationPositionInfoSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const {
          network = 'mainnet',
          walletAddress,
          poolAddress,
          baseToken,
          quoteToken,
        } = request.query;

        const hydration = await Hydration.getInstance(network);
        if (!hydration) {
          return reply
            .status(503)
            .send({ error: 'Hydration service unavailable' });
        }

        const result = await hydration.getPositionInfo(
          walletAddress,
          poolAddress,
          baseToken,
          quoteToken,
        );

        return result;
      } catch (error) {
        logger.error('Error in position-info endpoint:', error);

        if (error.statusCode) {
          return reply.status(error.statusCode).send({ error: error.message });
        }

        if (error.message?.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        } else if (error.message?.includes('Invalid Hydration address')) {
          return reply.status(400).send({ error: error.message });
        } else if (error.message?.includes('must be provided')) {
          return reply.status(400).send({ error: error.message });
        }

        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );
};

// Define error response interface
interface ErrorResponse {
  error: string;
}

export default positionInfoRoute;
