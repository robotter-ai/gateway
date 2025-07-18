import { FastifyPluginAsync } from 'fastify';

import { balancesRoute } from './routes/balances';
import { estimateGasRoute } from './routes/estimate-gas';
import { pollRoute } from './routes/poll';
import { statusRoute } from './routes/status';
import { tokensRoute } from './routes/tokens';

/**
 * Registers all Polkadot-related routes with the Fastify instance
 *
 * This plugin registers the following endpoints:
 * - GET /status - Network status information
 * - GET /tokens - Token list retrieval
 * - POST /balances - Account balance lookup
 * - POST /poll - Transaction status polling
 * - POST /estimate-gas - Gas estimation for transactions
 */
export const polkadotRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(statusRoute);
  fastify.register(tokensRoute);
  fastify.register(balancesRoute);
  fastify.register(pollRoute);
  fastify.register(estimateGasRoute);
};

export default polkadotRoutes;
