import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { Hydration } from '../../hydration';
import {
  PositionInfo,
  PositionInfoSchema,
} from '../../../../schemas/trading-types/clmm-schema';
import { validatePolkadotAddress } from '../../../../chains/polkadot/polkadot.validators';
import { HydrationCLMMPositionInfo } from '../../hydration.types';

const GetPositionsOwnedRequest = Type.Object({
  network: Type.Optional(Type.String({ default: 'mainnet' })),
  poolAddress: Type.String(),
  walletAddress: Type.String(),
});

const GetPositionsOwnedResponse = Type.Array(PositionInfoSchema);
const ErrorResponse = Type.Object({
  error: Type.String(),
});

type GetPositionsOwnedRequestType = Static<typeof GetPositionsOwnedRequest>;
type GetPositionsOwnedResponseType = Static<typeof GetPositionsOwnedResponse>;
type ErrorResponseType = Static<typeof ErrorResponse>;

/**
 * Validates if the position info contains all required CLMM fields.
 * CLMM positions require specific fields for proper operation.
 * @throws Error if required fields are missing
 */
const validateClmmPositionInfo = (
  positionInfo: HydrationCLMMPositionInfo,
): void => {
  const requiredFields = [
    'fee',
    'tickLower',
    'tickUpper',
    'lowerPrice',
    'upperPrice',
  ] as const;

  const missingFields = requiredFields.filter(
    (field) =>
      positionInfo[field] === undefined || positionInfo[field] === null,
  );

  if (missingFields.length > 0) {
    throw new Error(
      `This pool does not support CLMM positions. Please use a CLMM-compatible pool.`,
    );
  }
};

const createClmmPosition = (
  positionInfo: HydrationCLMMPositionInfo,
  poolInfo: any,
  walletAddress: string,
  poolAddress: string,
): PositionInfo => {
  // Validate required CLMM fields before creating position
  validateClmmPositionInfo(positionInfo);

  return {
    address: walletAddress,
    poolAddress,
    baseTokenAddress: poolInfo.baseTokenAddress,
    quoteTokenAddress: poolInfo.quoteTokenAddress,
    baseTokenAmount: positionInfo.baseTokenAmount,
    quoteTokenAmount: positionInfo.quoteTokenAmount,
    baseFeeAmount: positionInfo.fee,
    quoteFeeAmount: positionInfo.fee,
    lowerBinId: positionInfo.tickLower,
    upperBinId: positionInfo.tickUpper,
    lowerPrice: positionInfo.lowerPrice,
    upperPrice: positionInfo.upperPrice,
    price: positionInfo.price,
  };
};

export const positionsOwnedRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: GetPositionsOwnedRequestType;
    Reply: GetPositionsOwnedResponseType | ErrorResponseType;
  }>(
    '/positions-owned',
    {
      schema: {
        description:
          "Retrieve a list of CLMM positions owned by a user's wallet in a specific Hydration pool",
        tags: ['hydration/clmm'],
        querystring: GetPositionsOwnedRequest,
        response: {
          200: GetPositionsOwnedResponse,
          400: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse,
        },
      },
      onRequest: async (request, reply) => {
        const { poolAddress, walletAddress } = request.query;

        try {
          // Validate addresses synchronously before any async operations
          if (!validatePolkadotAddress(poolAddress)) {
            return reply.status(400).send({ error: 'Invalid pool address' });
          }
          if (!validatePolkadotAddress(walletAddress)) {
            return reply.status(400).send({ error: 'Invalid wallet address' });
          }
        } catch (error) {
          return reply.status(400).send({ error: error.message });
        }
      },
    },
    async (request, reply) => {
      const { poolAddress, walletAddress, network = 'mainnet' } = request.query;

      try {
        // Get Hydration instance
        const hydration = await Hydration.getInstance(network);
        const poolInfo = await hydration.getPoolInfo(poolAddress);

        if (!poolInfo) {
          return reply.status(404).send({ error: 'Pool not found' });
        }

        const positionInfo = await hydration.getPositionInfo(
          walletAddress,
          poolAddress,
        );

        if (positionInfo.lpTokenAmount <= 0) {
          return reply.status(200).send([]);
        }

        const clmmPosition = createClmmPosition(
          positionInfo as HydrationCLMMPositionInfo,
          poolInfo,
          walletAddress,
          poolAddress,
        );

        return reply.status(200).send([clmmPosition]);
      } catch (error) {
        // Handle specific error cases
        if (error.message?.includes('does not support CLMM positions')) {
          return reply.status(400).send({ error: error.message });
        }

        return reply.status(500).send({
          error:
            'Unable to retrieve position information. Please try again later.',
        });
      }
    },
  );
};

export default positionsOwnedRoute;
