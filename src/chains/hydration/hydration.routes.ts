import { FastifyPluginAsync } from 'fastify';

import { balancesRoute } from './routes/balances';
import { estimateGasRoute } from './routes/estimate-gas';
import { pollRoute } from './routes/poll';
import { statusRoute } from './routes/status';
import { tokensRoute } from './routes/tokens';

/**
 * Main hydration routes plugin that registers all hydration chain endpoints
 */
export const hydrationRoutes: FastifyPluginAsync = async (fastify) => {
  // Register all hydration route plugins
  await fastify.register(balancesRoute);
  await fastify.register(estimateGasRoute);
  await fastify.register(pollRoute);
  await fastify.register(statusRoute);
  await fastify.register(tokensRoute);
};

export default hydrationRoutes;
