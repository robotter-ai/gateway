

jest.mock('../../src/services/config-manager-v2', () => ({
  ConfigManagerV2: {
    getInstance: jest.fn(() => ({
      get: jest.fn((key: string) => {
        if (key === 'polkadot.networks.mainnet.nodeURL') {
          return 'ws://localhost:9944';
        }
        return undefined;
      }),
      set: jest.fn(),
    })),
  },
}));

jest.mock('fs', () => {
  const realFs = jest.requireActual('fs');
  return {
    ...realFs,
    copyFileSync: jest.fn(),
    existsSync: jest.fn((filePath: string) => {
      if (
        filePath.includes('conf') ||
        filePath.includes('conf/root.yml') ||
        filePath.includes('conf/hydration.json') ||
        filePath.includes('conf/polkadot.yml') ||
        filePath.includes('conf/list')
      ) {
        return true;
      }
      return realFs.existsSync(filePath);
    }),

    realpathSync: jest.fn((filePath: string) => filePath),

    lstatSync: jest.fn((filePath: string) => ({
      isDirectory: () => filePath.endsWith('conf'),
      isFile: () => !filePath.endsWith('conf'),
    })),

    statSync: jest.fn((filePath: string) => ({
      isDirectory: () => filePath.endsWith('conf'),
      isFile: () => !filePath.endsWith('conf'),
    })),

    realFileSync: jest.fn((filePath: string) => {
      if (filePath.includes('/conf/root.yml')) {
        return 'templates/root.yml';
      }
      return realFs.readFileSync(filePath, 'utf8');
    }),

    readFileSync: jest.fn((filePath: string, ...args) => {
      if (filePath.includes('conf/root.yml')) {
        return realFs.readFileSync(
          path.resolve(__dirname, '../../src/templates/root.yml'),
          ...args,
        );
      }
      if (filePath.includes('conf/hydration.yml')) {
        return realFs.readFileSync(
          path.resolve(__dirname, '../../src/templates/lists/hydration.json'),
          ...args,
        );
      }
      if (filePath.includes('conf/polkadot.yml')) {
        return realFs.readFileSync(
          path.resolve(__dirname, '../../src/templates/polkadot.yml'),
          ...args,
        );
      }
      if (filePath.includes('conf/ethereum')) {
        return realFs.readFileSync(
          path.resolve(__dirname, '../../src/templates/ethereum.yml'),
          ...args,
        );
      }
      if (filePath.includes('conf/server.yml')) {
        return `
GMTOffset: -8
port: 15888
docsPort: 0
certificatePath: ./certs/
logPath: ./logs
ipWhitelist: []
logToStdOut: false
fastifyLogs: false `;
      }

      return realFs.readFileSync(filePath, ...args);
    }),
    promises: {
      readFile: jest.fn(async (filePath: string) => {
        if (filePath.includes('/conf/root.yml')) {
          return 'templates/root.yml';
        }
        return '';
      }),
    },
  };
});

jest.mock('fs-extra', () => ({
  copySync: jest.fn(),
}));
// @ts-ignore
import path from 'path';

import Fastify from 'fastify';

import { Polkadot } from '../../src/chains/polkadot/polkadot';
import { pollRoute } from '../../src/chains/polkadot/routes/poll';
import { balancesRoute } from '../../src/chains/polkadot/routes/balances';
import { estimateGasRoute } from '../../src/chains/polkadot/routes/estimate-gas';
import { statusRoute } from '../../src/chains/polkadot/routes/status';
import { tokensRoute } from '../../src/chains/polkadot/routes/tokens';
const {
  CHAIN_NAME,
  CHAIN_NETWORK,
  MockDecrypt,
  MockEncrypt,
  MockGetToken,
  MockAxiosGet,
  MockAxiosPost,
  MockReadPassphrase,
  MockUtilCryptoWaitReady,
  MockValidatePolkadotAddress,
  mockPolkadotApiPromiseCreate,
  MockapiPromiseTx,
  MockapiPromiseConsts,
  MockapiPromiseErrors,
  MockapiPromiseCreate,
  MockGetNetworkStatus,
  MockapiPromiseRuntimeMetadata,
  MockapiPromiseRpcChainGetBlock,
  MockapiPromiseRpcChainGetHeader,
  MockapiPromiseQueryAssetsAccount,
  MockapiPromiseQuerySystemAccount,
  MockapiPromiseQueryTokensAccounts,
  MockapiPromiseQueryStakingValidators,
  MockapiPromiseQueryStakingValidatorsEntries,
  MockapiPromiseDeriveStakingAccount,
  MocksubmittableExtrinsicPaymentInfo,
  MockapiPromiseTxBalancesTransfer,
  MockapiPromiseTxBalancesTransferKeepAlive,
  MockfsReadFile,
  MockWallet,
  MockBalances,
} = require('../../temporary/polkadot/polkadot.mocks');

let app;
describe('Fastify Route - POST /balances', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();
    await app.register(balancesRoute);
    MockWallet();
    MockDecrypt();
    MockEncrypt();
    MockAxiosGet();
    MockBalances();
    MockfsReadFile();
    MockReadPassphrase();
    MockUtilCryptoWaitReady();
  });
  it('returns 200 and balances when called with valid payload', async () => {
    const mockWallet = MockWallet();
    const mockBalances = MockBalances();
    const payload = {
      network: CHAIN_NETWORK,
      address: mockWallet.address,
      tokens: Object.keys(mockBalances.balances),
    };
    const res = await app.inject({
      method: 'POST',
      url: '/balances',
      payload,
    });
    console.log(res.body);
    expect(res.statusCode).toBe(200);
    const responseBody = JSON.parse(res.body);
    expect(responseBody).toHaveProperty('balances');
    expect(responseBody.balances).toEqual(mockBalances.balances);
  });
});

describe('Fastify Route - POST /estimate-gas', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();
    await app.register(estimateGasRoute);
    MockAxiosGet();
    MockfsReadFile();
    MockapiPromiseCreate();
    MockUtilCryptoWaitReady();
  });
  it('returns 200 and gas estimation when called with valid payload', async () => {
    jest.spyOn(Polkadot.prototype, 'getFeePaymentToken').mockReturnValue({
      symbol: 'DOT',
      decimals: 12,
      chainId: 1,
      address: '0x1',
      name: 'DOT',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/estimate-gas',
      payload: {
        network: CHAIN_NETWORK,
        gasLimit: 100000,
      },
    });
    console.log(res.body);
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.gasPriceToken).toBe('DOT');
    expect(data.gasLimit).toBe(100000);
    expect(data.gasCost).toBeGreaterThan(0);
  });
});

describe('Fastify Route - POST /poll', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();
    await app.register(pollRoute);
    MockAxiosGet();
    MockAxiosPost();
    MockfsReadFile();
    MockapiPromiseCreate();
    MockUtilCryptoWaitReady();
    MockapiPromiseRpcChainGetHeader();
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
  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();
    await app.register(statusRoute);
    MockAxiosGet();
    MockfsReadFile();
    MockGetNetworkStatus();
    MockapiPromiseCreate();
    MockUtilCryptoWaitReady();
    MockapiPromiseRpcChainGetHeader();
  });
  it('returns 200 and network status when called with valid query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/status?network=${CHAIN_NETWORK}`,
    });
    console.log(res.body);
    const data = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(data.chain).toBe(CHAIN_NAME);
    expect(data.network).toBe(CHAIN_NETWORK);
    expect(data.nativeCurrency).toBeDefined();
  });
});

describe('Fastify Route - GET /tokens', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();
    await app.register(tokensRoute);
    MockAxiosGet();
    MockGetToken();
    MockfsReadFile();
    MockUtilCryptoWaitReady();
    MockapiPromiseRpcChainGetHeader();
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