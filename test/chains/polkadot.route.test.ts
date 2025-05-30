import Fastify from 'fastify';

import { Polkadot } from '../../src/chains/polkadot/polkadot';
import { balancesRoute } from '../../src/chains/polkadot/routes/balances';
import { estimateGasRoute } from '../../src/chains/polkadot/routes/estimate-gas';
import { pollRoute } from '../../src/chains/polkadot/routes/poll';
import { statusRoute } from '../../src/chains/polkadot/routes/status';
import { tokensRoute } from '../../src/chains/polkadot/routes/tokens';

import {
  TEST_WALLET,
  MOCK_TOKENS,
  CHAIN_NETWORK,
  MOCK_BALANCES,
  CHAIN_NAME,
  MOCK_ESTIMATE_GAS,
  MOCK_POLL,
  MOCK_STATUS,
} from './polkadot.mocks';

describe('Fastify Route - POST /balances', () => {
  let app;
  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();
    await app.register(balancesRoute);
  });
  it('returns 200 and balances when called with valid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/balances',
      payload: {
        network: CHAIN_NETWORK,
        address: TEST_WALLET,
        tokens: MOCK_TOKENS.tokens.map((token) => token.symbol),
      },
    });
    console.log(res.body);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(MOCK_BALANCES);
  });
});

describe('Fastify Route - POST /estimate-gas', () => {
  let app;
  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();
    await app.register(estimateGasRoute);
    jest
      .spyOn(Polkadot.prototype, 'estimateTransactionGas')
      .mockResolvedValue(MOCK_ESTIMATE_GAS);
  });
  it('returns 200 and gas estimation when called with valid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/estimate-gas',
      payload: {
        network: CHAIN_NETWORK,
        gasLimit: 100000,
      },
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.gasPriceToken).toBe('DOT');
    expect(data.gasLimit).toBe(100000);
    expect(data.gasCost).toBeGreaterThan(0);
  });
});

describe('Fastify Route - POST /poll', () => {
  let app;
  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();
    await app.register(pollRoute);
    jest
      .spyOn(Polkadot.prototype, 'pollTransaction')
      .mockResolvedValue(MOCK_POLL);
  });
  it('returns 200 and transaction status when called with valid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/poll',
      payload: {
        network: CHAIN_NETWORK,
        txHash: '0xabc',
      },
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.txHash).toBe('0xabc');
    expect(data.txStatus).toBeDefined();
  });
});

describe('Fastify Route - GET /status', () => {
  let app;
  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();
    await app.register(statusRoute);
    jest
      .spyOn(Polkadot.prototype, 'getNetworkStatus')
      .mockResolvedValue(MOCK_STATUS);
  });
  it('returns 200 and network status when called with valid query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/status?network=${CHAIN_NETWORK}`,
    });
    const data = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(data.chain).toBe(CHAIN_NAME);
    expect(data.network).toBe(CHAIN_NETWORK);
    expect(data.nativeCurrency).toBeDefined();
  });
});

describe('Fastify Route - GET /tokens', () => {
  let app;
  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();
    await app.register(tokensRoute);
  });
  it('returns 200 and tokens when called with valid query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/tokens?network=${CHAIN_NETWORK}&tokenSymbols=DOT,USDT`,
    });
    console.log(res.body);
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(Array.isArray(data.tokens)).toBe(true);
    expect(data.tokens.length).toBeGreaterThan(0);
    expect(data.tokens[0].symbol).toBeDefined();
  });
});
