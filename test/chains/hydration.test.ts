jest.mock('../../src/services/config-manager-v2', () => ({
  ConfigManagerV2: {
    getInstance: jest.fn(() => ({
      get: jest.fn((key: string) => {
        if (key === 'polkadot.networks.mainnet.nodeURL') {
          return 'ws://localhost:9944';
        }
        if (key === 'polkadot.networks.mainnet.transactionURL') {
          return 'https://hydration.api.subscan.io/api/scan/extrinsic';
        }
        if (key === 'polkadot.networks.mainnet.tokenListType') {
          return 'FILE';
        }
        if (key === 'polkadot.networks.mainnet.tokenListSource') {
          return 'src/templates/lists/hydration.json';
        }
        if (key === 'polkadot.networks.mainnet.nativeCurrencySymbol') {
          return 'HDX';
        }
        if (key === 'polkadot.networks.mainnet.feePaymentCurrencySymbol') {
          return 'HDX';
        }
        return undefined;
      }),
      set: jest.fn(),
    })),
  },
}));

jest.mock('fs-extra', () => ({
  copySync: jest.fn(),
}));

import { beforeAll } from '@jest/globals';
import { ApiPromise } from '@polkadot/api';
import {
  ApiTypes,
  ModuleErrors,
  QueryableModuleConsts,
  SubmittableModuleExtrinsics,
} from '@polkadot/api/types';
import { Metadata } from '@polkadot/types';
import {
  FrameSystemAccountInfo,
  OrmlTokensAccountData,
} from '@polkadot/types/lookup';
import Fastify from 'fastify';

import { Hydration } from '../../src/chains/hydration/hydration';
import { balancesRoute } from '../../src/chains/hydration/routes/balances';
import { estimateGasRoute } from '../../src/chains/hydration/routes/estimate-gas';
import { pollRoute } from '../../src/chains/hydration/routes/poll';
import { statusRoute } from '../../src/chains/hydration/routes/status';
import { tokensRoute } from '../../src/chains/hydration/routes/tokens';
import { ConfigManagerCertPassphrase } from '../../src/services/config-manager-cert-passphrase';

const MOCK_API = {
  query: {
    system: {
      account: jest.fn().mockResolvedValue({
        data: {
          free: { toString: () => '1000000000000' },
          reserved: { toString: () => '0' },
        },
      }),
    },
    assets: {
      account: jest.fn().mockResolvedValue({
        isEmpty: false,
        balance: { toString: () => '500000000' },
      }),
    },
    tokens: {
      accounts: jest.fn().mockResolvedValue({
        free: { toString: () => '1234567890' },
      }),
    },
    staking: {
      validators: {
        entries: jest.fn().mockResolvedValue([]),
        address: jest.fn().mockResolvedValue({}),
      },
    },
  },
  rpc: {
    chain: {
      getHeader: jest.fn().mockResolvedValue({
        number: { toNumber: () => 123456 },
      }),
      getBlock: jest
        .fn()
        .mockResolvedValue({ block: { header: { number: 123456 } } }),
    },
  },
  derive: {
    staking: {
      account: jest.fn().mockResolvedValue({}),
    },
  },
  tx: {
    balances: {
      transfer: jest.fn().mockReturnValue({
        signAndSend: jest.fn().mockResolvedValue({ hash: '0xabc' }),
      }),
      transferKeepAlive: jest.fn().mockReturnValue({}),
    },
    system: {
      remark: jest.fn().mockReturnValue({
        paymentInfo: jest.fn().mockResolvedValue({
          partialFee: { toString: () => '100000' },
        }),
      }),
    },
  },
  consts: {
    somePallet: {},
  },
  errors: {
    somePallet: {},
  },
  runtimeMetadata: {},
};
const CHAIN_NAME = 'polkadot';
const CHAIN_NETWORK = 'mainnet';
const MOCK_ADDRESS_WALLET = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';

const MockDecrypt = () => {
  jest.spyOn(Hydration.prototype, 'decrypt').mockImplementation(async () => {
    return 'seed sock milk update focus rotate barely fade car face mechanic mercy';
  });
};

const MockAxiosGet = () => {
  jest.spyOn(Hydration.prototype, 'axiosGet').mockResolvedValue({
    data: [{ symbol: 'DOT', name: 'Polkadot', decimals: 10, id: '0x1' }],
  });
};
const MockBalances = () => {
  return {
    balances: {
      HDX: 1,
      USDT: 1234.56789,
    },
  };
};
const MockAxiosPost = () => {
  jest.spyOn(Hydration.prototype, 'axiosPost').mockResolvedValue({
    data: { data: { success: true, fee: '1000000' } },
  });
};

const MockfsReadFile = () => {
  jest
    .spyOn(Hydration.prototype, 'fsReadFile')
    .mockImplementation((path: string) => {
      const pathStr = path?.toString?.() || '';

      if (pathStr.includes('/wallet/') && pathStr.endsWith('.json')) {
        return Promise.resolve(Buffer.from('encrypted-mnemonic'));
      }

      if (pathStr.includes('src/templates/root.yml')) {
        return Promise.resolve(
          Buffer.from(`
networks:
  polkadot:
    mainnet:
      nodeURL: ws://localhost:9944
  `),
        );
      }
      if (pathStr.includes('src/templates/lists/hydration.json')) {
        return Promise.resolve(
          Buffer.from(
            JSON.stringify([
              { symbol: 'HDX', name: 'HydraDX', decimals: 12, id: '0x1' },
              { symbol: 'USDT', name: 'Tether', decimals: 6, id: '0x2' },
            ]),
          ),
        );
      }
      return Promise.resolve(Buffer.from(''));
    });
};

const MockapiPromiseTx = () => {
  jest
    .spyOn(Hydration.prototype, 'apiPromiseTx')
    .mockImplementation(
      () =>
        MOCK_API.tx as unknown as Promise<
          SubmittableModuleExtrinsics<'promise'>
        >,
    );
};

const MockReadPassphrase = () => {
  jest
    .spyOn(ConfigManagerCertPassphrase, 'readPassphrase')
    .mockReturnValue('test-passphrase');
};

const MockapiPromiseErrors = () => {
  jest
    .spyOn(Hydration.prototype, 'apiPromiseErrors')
    .mockReturnValue(
      MOCK_API.errors as unknown as Promise<ModuleErrors<ApiTypes>>,
    );
};
const MockapiPromiseCreate = () => {
  jest
    .spyOn(Hydration.prototype, 'apiPromiseCreate')
    .mockResolvedValue(MOCK_API as unknown as ApiPromise);
};

beforeAll(async () => {
  app = Fastify();
  await app.register(balancesRoute);
  await app.register(estimateGasRoute);
  await app.register(pollRoute);
  await app.register(statusRoute);
  await app.register(tokensRoute);
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  jest.restoreAllMocks();
  delete process.env.NODE_ENV;
});

let app;
describe('Polkadot Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockAxiosGet();
    MockfsReadFile();
  });

  describe('POST /balances', () => {
    it('returns 200 and balances when called with valid payload', async () => {
      MockDecrypt();
      MockReadPassphrase();
      MockapiPromiseCreate();
      const mockBalances = MockBalances();
      const res = await app.inject({
        method: 'POST',
        url: '/balances',
        payload: {
          network: CHAIN_NETWORK,
          address: MOCK_ADDRESS_WALLET,
          tokens: Object.keys(mockBalances.balances),
        },
      });
      const responseBody = JSON.parse(res.body);

      console.log('[balancesRoute] res:', res.body);
      expect(res.statusCode).toBe(200);
      expect(responseBody).toHaveProperty('balances');
      expect(responseBody.balances).toEqual(mockBalances.balances);
    });
  });

  describe('POST /estimate-gas', () => {
    it('returns 200 and gas estimation when called with valid payload', async () => {
      MockapiPromiseTx();
      MockapiPromiseCreate();
      MockapiPromiseErrors();
      const res = await app.inject({
        method: 'POST',
        url: '/estimate-gas',
        payload: {
          chain: 'polkadot',
          network: CHAIN_NETWORK,
          from: MOCK_ADDRESS_WALLET,
          to: MOCK_ADDRESS_WALLET,
          value: '1000000000',
          gasLimit: 100000,
        },
      });
      const data = JSON.parse(res.body);
      console.log('[estimateGasRoute] res:', res.body);
      expect(res.statusCode).toBe(200);
      expect(data.gasPriceToken).toBe('HDX');
      expect(data.gasLimit).toBe(100000);
      expect(data.gasCost).toBeGreaterThan(0);
    });
  });

  describe('POST /poll', () => {
    it('returns 200 and transaction status when called with valid payload', async () => {
      MockAxiosPost();
      MockapiPromiseCreate();
      const res = await app.inject({
        method: 'POST',
        url: '/poll',
        payload: { network: CHAIN_NETWORK, txHash: '0xabc' },
      });
      const data = JSON.parse(res.body);
      console.log('[pollRoute] res:', res.body);
      expect(res.statusCode).toBe(200);
      expect(data.txHash).toBe('0xabc');
      expect(data.txStatus).toBeDefined();
    });
  });

  describe('GET /status', () => {
    it('returns 200 and network status when called with valid query', async () => {
      MockapiPromiseCreate();
      const res = await app.inject({
        method: 'GET',
        url: `/status?network=${CHAIN_NETWORK}`,
      });
      console.log('[statusRoute] res:', res.body);
      const data = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(data.chain).toBe(CHAIN_NAME);
      expect(data.network).toBe(CHAIN_NETWORK);
      expect(data.nativeCurrency).toBeDefined();
    });
  });

  describe('GET /tokens', () => {
    it('returns 200 and tokens when called with valid query', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/tokens?network=${CHAIN_NETWORK}&tokenSymbols=DOT,USDT`,
      });

      const data = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(data.tokens)).toBe(true);
      expect(data.tokens.length).toBeGreaterThan(0);
      expect(data.tokens[0].symbol).toBeDefined();
    });
  });
});
