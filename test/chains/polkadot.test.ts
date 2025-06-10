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

// jest.mock('fs', () => {
//   const realFs = jest.requireActual('fs');
//   return {
//     ...realFs,
//     copyFileSync: jest.fn(),
//     existsSync: jest.fn((filePath: string) => {
//       if (
//         filePath.includes('conf') ||
//         filePath.includes('conf/root.yml') ||
//         filePath.includes('conf/list/hydration.json') ||
//         filePath.includes('conf/list/hydration.yml') ||
//         filePath.includes('conf/polkadot.yml') ||
//         filePath.includes('conf/list')
//       ) {
//         return true;
//       }
//       return realFs.existsSync(filePath);
//     }),

//     realpathSync: jest.fn((filePath: string) => filePath),
//
//     lstatSync: jest.fn((filePath: string) => ({
//       isDirectory: () => filePath.endsWith('conf'),
//       isFile: () => !filePath.endsWith('conf'),
//     })),
//
//     statSync: jest.fn((filePath: string) => ({
//       isDirectory: () => filePath.endsWith('conf'),
//       isFile: () => !filePath.endsWith('conf'),
//     })),
//
//     realFileSync: jest.fn((filePath: string) => {
//       if (filePath.includes('/conf/root.yml')) {
//         return 'templates/root.yml';
//       }
//       return realFs.readFileSync(filePath, 'utf8');
//     }),
//
//     readFileSync: jest.fn((filePath: string, ...args) => {
//       if (filePath.includes('conf/root.yml')) {
//         return realFs.readFileSync(
//           path.resolve(__dirname, '../../src/templates/root.yml'),
//           ...args,
//         );
//       }
//       if (filePath.includes('conf/hydration.json')) {
//         return realFs.readFileSync(
//           path.resolve(__dirname, '../../src/templates/lists/hydration.json'),
//           ...args,
//         );
//       }
//       if (filePath.includes('conf/hydration.yml')) {
//         return realFs.readFileSync(
//           path.resolve(__dirname, '../../src/templates/hydration.yml'),
//           ...args,
//         );
//       }
//       if (filePath.includes('conf/polkadot.yml')) {
//         return realFs.readFileSync(
//           path.resolve(__dirname, '../../src/templates/polkadot.yml'),
//           ...args,
//         );
//       }
//       if (filePath.includes('conf/server.yml')) {
//         return `
// GMTOffset: -8
// port: 15888
// docsPort: 0
// certificatePath: ./certs/
// logPath: ./logs
// ipWhitelist: []
// logToStdOut: false
// fastifyLogs: false `;
//       }
//
//       return realFs.readFileSync(filePath, ...args);
//     }),
//     promises: {
//       readFile: jest.fn(async (filePath: string) => {
//         if (filePath.includes('/conf/root.yml')) {
//           return 'templates/root.yml';
//         }
//         return '';
//       }),
//     },
// };
// });

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

import { Polkadot } from '../../src/chains/polkadot/polkadot';
import { balancesRoute } from '../../src/chains/polkadot/routes/balances';
import { estimateGasRoute } from '../../src/chains/polkadot/routes/estimate-gas';
import { pollRoute } from '../../src/chains/polkadot/routes/poll';
import { statusRoute } from '../../src/chains/polkadot/routes/status';
import { tokensRoute } from '../../src/chains/polkadot/routes/tokens';
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
  jest.spyOn(Polkadot.prototype, 'decrypt').mockImplementation(async () => {
    return 'seed sock milk update focus rotate barely fade car face mechanic mercy';
  });
};
// const MockEncrypt = jest.fn(
//   (_data?: string, _pass?: string) => 'encrypted-data',
// );

const MockAxiosGet = () => {
  jest.spyOn(Polkadot.prototype, 'axiosGet').mockResolvedValue({
    data: [{ symbol: 'DOT', name: 'Polkadot', decimals: 10, id: '0x1' }],
  });
};
const MockBalances = () => {
  return {
    balances: {
      HDX: 1000000,
     USDT: 1234.56789,
    },
  };
};
const MockAxiosPost = () => {
  jest.spyOn(Polkadot.prototype, 'axiosPost').mockResolvedValue({
    data: { data: { success: true, fee: '1000000' } },
  });
};

const MockfsReadFile = () => {
  jest
    .spyOn(Polkadot.prototype, 'fsReadFile')
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
    .spyOn(Polkadot.prototype, 'apiPromiseTx')
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
const MockapiPromiseConsts = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseConsts')
    .mockReturnValue(
      MOCK_API.consts as unknown as Promise<QueryableModuleConsts>,
    );
};
const MockapiPromiseErrors = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseErrors')
    .mockReturnValue(
      MOCK_API.errors as unknown as Promise<ModuleErrors<ApiTypes>>,
    );
};
const MockapiPromiseCreate = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseCreate')
    .mockResolvedValue(MOCK_API as unknown as ApiPromise);
};
//
// const MockUtilCryptoWaitReady = () => {
//   jest.spyOn(Polkadot.prototype, 'utilCryptoWaitReady').mockResolvedValue(true);
// };
const MockapiPromiseRuntimeMetadata = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseRuntimeMetadata')
    .mockReturnValue(MOCK_API.runtimeMetadata as unknown as Promise<Metadata>);
};
const MockapiPromiseRpcChainGetBlock = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseRpcChainGetBlock')
    .mockImplementation(() => MOCK_API.rpc.chain.getBlock('0x123'));
};
const MockapiPromiseRpcChainGetHeader = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseRpcChainGetHeader')
    .mockImplementation(() => MOCK_API.rpc.chain.getHeader());
};
// const MockapiPromiseQueryAssetsAccount = () => {
//   jest
//     .spyOn(Polkadot.prototype, 'apiPromiseQueryAssetsAccount')
//     .mockImplementation(() => MOCK_API.query.assets.account('0x1', '0x2'));
// };
const MockapiPromiseQuerySystemAccount = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseQuerySystemAccount')
    .mockImplementation(() =>
      Promise.resolve({
        nonce: 0,
        consumers: 0,
        providers: 0,
        sufficients: 0,
        data: {
          free: { toString: () => '1000000000000000000' },
          reserved: { toString: () => '0' },
          miscFrozen: { toString: () => '0' },
          feeFrozen: { toString: () => '0' },
          frozen: { toString: () => '0' },
          flags: { toString: () => '0' },
        },
      } as unknown as FrameSystemAccountInfo),
    );
};
const MockapiPromiseQueryTokensAccounts = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseQueryTokensAccounts')
    .mockImplementation(async (_target, _addr, tokenAddress) => {
      const balances = {
        '0x1': '123000000000000',
        '0x2': '1234567890',
      };
      const amount = balances[tokenAddress] ?? '0';
      return {
        free: { toString: () => amount },
        reserved: { toString: () => '0' },
        frozen: { toString: () => '0' },
      } as unknown as OrmlTokensAccountData;
    });
};

// const MockapiPromiseQueryStakingValidators = () => {
//   jest
//     .spyOn(Polkadot.prototype, 'apiPromiseQueryStakingValidators')
//     .mockImplementation(() => MOCK_API.query.staking.validators.address('0x1'));
// };
// const MockapiPromiseDeriveStakingAccount = () => {
//   jest
//     .spyOn(Polkadot.prototype, 'apiPromiseDeriveStakingAccount')
//     .mockImplementation(() => MOCK_API.derive.staking.account('0x1'));
// };
const MockapiPromiseTxBalancesTransfer = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseTxBalancesTransfer')
    .mockImplementation(() => MOCK_API.tx.balances.transfer('0x1', '1000'));
};
const MocksubmittableExtrinsicPaymentInfo = () => {
  jest
    .spyOn(Polkadot.prototype, 'submittableExtrinsicPaymentInfo')
    .mockResolvedValue({
      partialFee: { toString: () => '100000' },
    });
};
// const MockapiPromiseTxBalancesTransferKeepAlive = () => {
//   jest
//     .spyOn(Polkadot.prototype, 'apiPromiseTxBalancesTransferKeepAlive')
//     .mockImplementation(() =>
//       MOCK_API.tx.balances.transferKeepAlive('0x1', '1000'),
//     );
// };

// const MockapiPromiseQueryStakingValidatorsEntries = () => {
//   jest
//     .spyOn(Polkadot.prototype, 'apiPromiseQueryStakingValidatorsEntries')
//     .mockImplementation(() => MOCK_API.query.staking.validators.entries());
// };

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
  // Cleanup global
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
      MockapiPromiseQuerySystemAccount();
      MockapiPromiseTxBalancesTransfer();
      MockapiPromiseQueryTokensAccounts();

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
      MockapiPromiseConsts();
      MockapiPromiseTxBalancesTransfer();
      MocksubmittableExtrinsicPaymentInfo();
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
      MockapiPromiseErrors();
      MockapiPromiseRpcChainGetBlock();
      MockapiPromiseRpcChainGetHeader();
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
      MockapiPromiseRuntimeMetadata();
      MockapiPromiseRpcChainGetHeader();
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
      MockapiPromiseRpcChainGetHeader();
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
