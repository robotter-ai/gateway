import sensible from '@fastify/sensible';
import type { FastifyPluginAsync } from 'fastify';

// import { fetchPoolsRoute } from './routes/amm-routes/fetchPools';
import { addLiquidityRoute } from './routes/amm-routes/addLiquidity';
import { executeSwapRoute } from './routes/amm-routes/executeSwap';
import { listPoolsRoute } from './routes/amm-routes/listPools';
import { poolInfoRoute } from './routes/amm-routes/poolInfo';
import { positionInfoRoute } from './routes/amm-routes/positionInfo';
import { positionsOwnedRoute } from './routes/amm-routes/positionsOwned';
import { quoteLiquidityRoute } from './routes/amm-routes/quoteLiquidity';
import { quoteSwapRoute } from './routes/amm-routes/quoteSwap';
import { removeLiquidityRoute } from './routes/amm-routes/removeLiquidity';
/**
 * Registers all Hydration AMM routes to the Fastify instance.
 * Includes routes for pool management, liquidity operations, and swap functionality.
 * @param fastify - The Fastify instance to register routes with
 */
export const hydrationAMMRoutes: FastifyPluginAsync = async (fastify) => {
  // Register sensible plugin for better error handling
  await fastify.register(sensible);

  // Register all AMM route handlers
  await fastify.register(listPoolsRoute);
  await fastify.register(poolInfoRoute);
  await fastify.register(quoteSwapRoute);
  await fastify.register(quoteLiquidityRoute);
  await fastify.register(executeSwapRoute);
  await fastify.register(addLiquidityRoute);
  await fastify.register(removeLiquidityRoute);
  await fastify.register(positionInfoRoute);
  await fastify.register(positionsOwnedRoute);
};

/**
 * Exports organized Hydration routes by category.
 * Currently includes AMM (Automated Market Maker) routes.
 */
export const hydrationRoutes = {
  amm: hydrationAMMRoutes,
};

export default hydrationRoutes;
