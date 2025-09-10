import { FastifyInstance, FastifyRequest } from 'fastify';
import { HydrationAllPositionsRequestSchema, HydrationAllPositionsResponseSchema } from '../../hydration.types';
import { Hydration } from '../../hydration';

export async function getAllPositionsRoute(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: { network?: string; walletAddress: string };
  }>(
    '/get-all-positions',
    {
      schema: {
        ...HydrationAllPositionsRequestSchema,
        response: HydrationAllPositionsResponseSchema,
      },
    },
    async (request: FastifyRequest<{ Querystring: { network?: string; walletAddress: string } }>, reply) => {
      try {
        const { network = 'mainnet', walletAddress } = request.query;

        if (!walletAddress) {
          return reply.status(400).send({
            error: 'walletAddress is required',
            message: 'Wallet address parameter is required to get all positions',
          });
        }

        // Get Hydration instance
        const hydration = await Hydration.getInstance(network);

        // Get all positions for the wallet
        const allPositions = await hydration.getAllPositions(walletAddress);

        return reply.send(allPositions);
      } catch (error) {
        fastify.log.error(`Error in getAllPositions route: ${error.message}`);
        return reply.status(500).send({
          error: 'Internal server error',
          message: 'Failed to get all positions',
          details: error.message,
        });
      }
    }
  );
}
