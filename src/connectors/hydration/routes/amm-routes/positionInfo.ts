import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Hydration } from '../../hydration';
import { logger } from '../../../../services/logger';
import { validatePolkadotAddress } from '../../../../chains/polkadot/polkadot.validators';
import {
  HydrationPositionInfo,
  HydrationPositionInfoSchema,
  HydrationGetPositionInfoRequest,
  HydrationGetPositionInfoRequestSchema,
} from '../../hydration.types';

/**
 * Get share token ID based on pool type
 */
async function getShareTokenId(
  hydration: Hydration,
  poolInfo: any,
  poolAddress: string,
): Promise<string> {
  const apiPromise = await hydration.getApiPromise();
  const poolType = poolInfo.poolType?.toLowerCase() || 'xyk';

  switch (poolType) {
    case 'xyk':
      return (await apiPromise.query.xyk.shareToken(poolAddress)).toString();
    case 'stableswap': {
      // Para stableswap, usamos o endereço do pool como ID
      const poolId = await apiPromise.query.stableswap.pools(poolAddress);
      if (!poolId || !poolId.toString()) {
        throw new Error(`Invalid pool ID for stableswap: ${poolAddress}`);
      }
      return poolId.toString();
    }
    case 'omnipool': {
      // Para omnipool, usamos o token H2O como LP token
      const hubAsset = await hydration.polkadot.getToken('H2O');
      if (!hubAsset) {
        throw new Error('Hub asset (H2O) not found');
      }
      return hubAsset.address;
    }
    default:
      throw new Error(`Unsupported pool type: ${poolType}`);
  }
}

/**
 * Calculate LP token amounts
 */
async function calculateLpAmounts(
  hydration: Hydration,
  walletAddress: string,
  poolInfo: any,
  poolAddress: string,
): Promise<{
  lpTokenAmount: number;
  baseTokenAmount: number;
  quoteTokenAmount: number;
}> {
  const apiPromise = await hydration.getApiPromise();
  const shareTokenId = await getShareTokenId(hydration, poolInfo, poolAddress);
  const poolType = poolInfo.poolType?.toLowerCase() || 'xyk';

  // Get LP token balance
  let lpTokenBalance: string;
  if (poolType === 'stableswap') {
    // Para stableswap, usamos o ID do pool
    const balance = await apiPromise.query.tokens.accounts(
      walletAddress,
      shareTokenId,
    );
    lpTokenBalance = balance.free.toString();
  } else {
    // Para XYK e Omnipool, usamos o endereço
    const balance = await apiPromise.query.tokens.accounts(
      walletAddress,
      shareTokenId,
    );
    lpTokenBalance = balance.free.toString();
  }

  if (!lpTokenBalance || lpTokenBalance === '0') {
    return { lpTokenAmount: 0, baseTokenAmount: 0, quoteTokenAmount: 0 };
  }

  // Get total supply
  const totalSupply = await apiPromise.query.tokens.totalIssuance(shareTokenId);
  const totalLpSupply = totalSupply.toString();

  if (totalLpSupply === '0') {
    return { lpTokenAmount: 0, baseTokenAmount: 0, quoteTokenAmount: 0 };
  }

  // Calculate amounts
  const userShare = Number(lpTokenBalance) / Number(totalLpSupply);
  return {
    lpTokenAmount: Number(lpTokenBalance),
    baseTokenAmount: poolInfo.baseTokenAmount * userShare,
    quoteTokenAmount: poolInfo.quoteTokenAmount * userShare,
  };
}

/**
 * Gets information about a user's position in a Hydration pool.
 * @param fastify - Fastify instance
 * @param network - The blockchain network (e.g., 'mainnet')
 * @param walletAddress - The user's wallet address
 * @param poolAddress - Optional pool address for specific pool
 * @param baseToken - Optional base token symbol
 * @param quoteToken - Optional quote token symbol
 * @returns Position information including LP token amount and token amounts
 */
export async function getHydrationPositionInfo(
  _fastify: FastifyInstance,
  network: string,
  walletAddress: string,
  poolAddress?: string,
  baseToken?: string,
  quoteToken?: string,
): Promise<HydrationPositionInfo> {
  if (!network) {
    throw new Error('Network parameter is required');
  }

  if (!walletAddress) {
    throw new Error('Wallet address parameter is required');
  }

  validatePolkadotAddress(walletAddress);

  if (!poolAddress && (!baseToken || !quoteToken)) {
    throw new Error(
      'Either poolAddress or both baseToken and quoteToken must be provided',
    );
  }

  const hydration = await Hydration.getInstance(network);
  if (!hydration) {
    throw new Error('Hydration service unavailable');
  }

  let poolAddressToUse = poolAddress;
  if (!poolAddressToUse) {
    const pools = await hydration.listPools([], [baseToken, quoteToken]);
    if (pools.length === 0) {
      throw new Error(`No AMM pool found for pair ${baseToken}-${quoteToken}`);
    }
    poolAddressToUse = pools[0].address;
  }

  const poolInfo = await hydration.getPoolDetails(poolAddressToUse);
  if (!poolInfo) {
    throw new Error(`Pool not found: ${poolAddressToUse}`);
  }

  const positionInfo = await calculateLpAmounts(
    hydration,
    walletAddress,
    poolInfo,
    poolAddressToUse,
  );

  return {
    poolAddress: poolAddressToUse,
    walletAddress,
    baseTokenAddress: poolInfo.baseTokenAddress,
    quoteTokenAddress: poolInfo.quoteTokenAddress,
    lpTokenAmount: positionInfo.lpTokenAmount,
    baseTokenAmount: positionInfo.baseTokenAmount,
    quoteTokenAmount: positionInfo.quoteTokenAmount,
    price: poolInfo.price,
  };
}

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

        const result = await getHydrationPositionInfo(
          fastify,
          network,
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
        } else if (error.message?.includes('Invalid Polkadot address')) {
          return reply.status(400).send({ error: error.message });
        } else if (
          error.message?.includes('must be provided') ||
          error.message?.includes('must be provided')
        ) {
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
