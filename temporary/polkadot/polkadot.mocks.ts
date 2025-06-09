/**
 * Utility mocks for testing the Polkadot chain.
 * Includes wallet, keyring, WS provider and Axios.
 */

import fs from 'fs';
import path from 'path';
import { Observable } from 'rxjs';
import { ApiPromise } from '@polkadot/api';
import {
  ApiTypes,
  ModuleErrors,
  SubmittableModuleExtrinsics,
  QueryableModuleConsts,
  StorageEntryBase,
} from '@polkadot/api/types';
import { Keyring } from '@polkadot/keyring';
import type { KeyringPair } from '@polkadot/keyring/types';
import { Metadata } from '@polkadot/types';
import {
  FrameSystemAccountInfo,
  OrmlTokensAccountData,
} from '@polkadot/types/lookup';
import axios from 'axios';
import Fastify from 'fastify';

import { Polkadot } from '../../src/chains/polkadot/polkadot';
import {
  PolkadotPollResponse,
  PolkadotEstimateGasResponse,
  PolkadotStatusResponse,
  PolkadotTokensResponse,
} from '../../src/chains/polkadot/polkadot.types';
import { ConfigManagerCertPassphrase } from '../../src/services/config-manager-cert-passphrase';

jest.mock('fs', () => {
  const realFs = jest.requireActual('fs') as typeof fs;
  return {
    ...realFs,
    existsSync: jest.fn((filePath) => {
      if (
        filePath.includes('conf') ||
        filePath.includes('conf/root.yml') ||
        filePath.includes('conf/hydration.json') ||
        filePath.includes('conf/polkadot.yml') ||
        filePath.includes('conf/lists')
      ) {
        return true;
      }
      return realFs.existsSync(filePath);
    }),
    copyFileSync: jest.fn(() => {}),
    realpathSync: jest.fn((filePath) => filePath),
    lstatSync: jest.fn((filePath) => filePath),
    statSync: jest.fn((filePath) => filePath),
    // readFileSync: jest.fn((filePath: string, ...args) => {
    //   if (filePath.includes('conf/root.yml')) {
    //     return realFs.readFileSync(
    //       path.resolve(__dirname, '../../src/templates/root.yml'),
    //       ...args,
    //     );
    //   }
    //   if (filePath.includes('conf/hydration.yml')) {
    //     return realFs.readFileSync(
    //       path.resolve(__dirname, '../../src/templates/lists/hydration.json'),
    //       ...args,
    //     );
    //   }
    //   if (filePath.includes('conf/polkadot.yml')) {
    //     return realFs.readFileSync(
    //       path.resolve(__dirname, '../../src/templates/polkadot.yml'),
    //       ...args,
    //     );
    //   }
    //   return realFs.readFileSync(filePath, ...args);
    // }),
    promises: {
      readFile: jest.fn(async (filePath: string, ...args) => {
        if (filePath.includes('conf/root.yml')) {
          return realFs.promises.readFile(
            path.resolve(__dirname, '../../src/templates/root.yml'),
            ...args,
          );
        }
        if (filePath.includes('conf/hydration.yml')) {
          return realFs.promises.readFile(
            path.resolve(__dirname, '../../src/templates/lists/hydration.json'),
            ...args,
          );
        }
        if (filePath.includes('conf/polkadot.yml')) {
          return realFs.promises.readFile(
            path.resolve(__dirname, '../../src/templates/polkadot.yml'),
            ...args,
          );
        }
        return realFs.promises.readFile(filePath, ...args);
      }),
    },
  };
});

jest.mock('../../src/services/config-manager-v2', () => ({
  ConfigManagerV2: {
    getInstance: jest.fn(() => ({
      get: jest.fn((key: string) => {
        const configMap: Record<string, any> = {
          'server.logPath': './logs',
          'server.GMTOffset': '+00:00',
          'polkadot.networks.mainnet.nodeURL': 'ws://localhost:9944',
          'polkadot.networks.mainnet.transactionURL':
            'https://hydration.api.subscan.io/api/scan/extrinsic',
          'polkadot.networks.mainnet.tokenListType': 'FILE',
          'polkadot.networks.mainnet.tokenListSource':
            'src/templates/lists/hydration.json',
          'polkadot.networks.mainnet.nativeCurrencySymbol': 'HDX',
          'polkadot.networks.mainnet.feePaymentCurrencySymbol': 'HDX',
        };
        return configMap[key];
      }),
      set: jest.fn(),
    })),
  },
}));

export const MOCK_ADDRESS_WALLET =
  '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
export const CHAIN_NAME = 'polkadot';
export const CHAIN_NETWORK = 'mainnet';
export const GAS_LIMITS = [
  {
    gasPriceToken: 'DOT',
    gasLimit: 1,
    gasCost: 0.001,
    gasPrice: 0.00000001,
  },
  {
    gasPriceToken: 'DOT',
    gasLimit: 1000,
    gasCost: 0.001,
    gasPrice: 0.00000001,
  },
  {
    gasPriceToken: 'DOT',
    gasLimit: 50000,
    gasCost: 0.001,
    gasPrice: 0.00000001,
  },
  {
    gasPriceToken: 'DOT',
    gasLimit: 1000000,
    gasCost: 0.001,
    gasPrice: 0.00000001,
  },
];

export const MOCK_ESTIMATE_GAS: PolkadotEstimateGasResponse = {
  gasPriceToken: 'DOT',
  gasLimit: 100000,
  gasCost: 100000,
  gasPrice: 100000,
};
export const MOCK_POLL: PolkadotPollResponse = {
  currentBlock: 123456,
  txHash: '0xabc',
  txBlock: 123456,
  txStatus: 1,
  txData: {},
  fee: 100000,
};
export const MOCK_STATUS: PolkadotStatusResponse = {
  chain: CHAIN_NAME,
  network: CHAIN_NETWORK,
  nativeCurrency: 'DOT',
  rpcUrl: 'https://rpc.polkadot.io',
  currentBlockNumber: 123456,
};
export const MOCK_FASTIFY = {} as any;
export const MOCK_TOKENS: PolkadotTokensResponse = {
  tokens: [
    {
      symbol: 'DOT',
      address: '0x1',
      decimals: 10,
      name: 'Polkadot',
    },
  ],
};
export function MockBalances() {
  return {
    balances: {
      DOT: 50,
      USDT: 500000,
    },
  };
}

export function MockWallet(): Partial<KeyringPair> {
  return {
    address: MOCK_ADDRESS_WALLET,
    publicKey: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    isLocked: false,
    lock: jest.fn(),
    unlock: jest.fn(),
    sign: jest.fn(() => new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2])),
    verify: jest.fn(() => true),
    meta: {
      name: 'Mock Wallet',
      whenCreated: Date.now(),
    },
    type: 'sr25519',
  };
}

export const MockGetNetworkStatus = () => {
  jest.spyOn(Polkadot.prototype, 'getNetworkStatus').mockResolvedValue({
    chain: 'polkadot',
    network: 'mainnet',
    rpcUrl: 'ws://localhost:9944',
    currentBlockNumber: 123456,
    nativeCurrency: 'DOT',
  });
};

export const MockGetToken = () => {
  jest
    .spyOn(Polkadot.prototype, 'getToken')
    .mockImplementation((addressOrSymbol: string) => {
      const tokens = [
        {
          symbol: 'DOT',
          name: 'Polkadot',
          decimals: 10,
          id: '0x1',
          chainId: 1,
          address: '0x1',
        },
        {
          symbol: 'USDT',
          name: 'Tether',
          decimals: 6,
          id: '0x2',
          chainId: 1,
          address: '0x2',
        },
      ];
      return tokens.find(
        (token) =>
          token.symbol.toLowerCase() === addressOrSymbol.toLowerCase() ||
          token.id.toLowerCase() === addressOrSymbol.toLowerCase(),
      );
    });
};

export const MOCK_WS_PROVIDER = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  send: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
};

export const MOCK_KEYRING = {
  addFromMnemonic: jest.fn(() => MockWallet()),
  addFromUri: jest.fn(() => MockWallet()),
  getPairs: jest.fn(() => [MockWallet()]),
  getPair: jest.fn(() => MockWallet()),
};

export const MOCKED_AXIOS = axios as jest.Mocked<typeof axios>;

export const MOCK_AXIOS_INSTANCE = {
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
};
export const MockEncrypt = jest.fn(
  (_data: string, _pass: string) => 'encrypted-data',
);
export const MockDecrypt = () => {
  jest.spyOn(Polkadot.prototype, 'decrypt').mockImplementation(async () => {
    return 'seed sock milk update focus rotate barely fade car face mechanic mercy';
  });
};

jest
  .spyOn(Keyring.prototype, 'addFromUri')
  .mockReturnValue(MockWallet() as KeyringPair);

export const createMockAxiosInstance = (response: any = { data: {} }) => ({
  get: jest.fn().mockResolvedValue(response),
  post: jest.fn().mockResolvedValue(response),
});

export const MOCK_API = {
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

export function MockValidatePolkadotAddress(returnValue: boolean = true): void {
  jest.mock('../../src/chains/polkadot/polkadot.validators', () => ({
    ...jest.requireActual('../../src/chains/polkadot/polkadot.validators'),
    validatePolkadotAddress: jest.fn().mockReturnValue(returnValue),
  }));
}

export const MockapiPromiseCreate = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseCreate')
    .mockResolvedValue(MOCK_API as unknown as ApiPromise);
};
const mockSystemAccount = Object.assign(
  jest.fn().mockResolvedValue({
    data: {
      free: '1000000000000',
      reserved: '100000000000',
    },
  }),
  {
    at: jest.fn(),
    creator: jest.fn(),
    entriesAt: jest.fn(),
    keysAt: jest.fn(),
    sizeAt: jest.fn(),
    hash: jest.fn(),
    key: jest.fn(),
    keyPrefix: jest.fn(),
    is: jest.fn(),
    multi: jest.fn(),
    range: jest.fn(),
    size: jest.fn(),
    entries: jest.fn(),
    keys: jest.fn(),
    entriesPaged: jest.fn(),
  },
);

jest.spyOn(Polkadot.prototype, 'apiPromiseCreate').mockResolvedValue({
  isReady: true,
  query: {
    system: {
      account: mockSystemAccount as unknown as StorageEntryBase<
        'promise',
        (arg: string | Uint8Array | any) => Observable<FrameSystemAccountInfo>,
        [any]
      >,
    },
    tokens: {
      accounts: jest.fn().mockResolvedValue({
        free: '500000000000',
      }),
    },
    assets: {
      account: jest.fn().mockReturnValue({
        isEmpty: false,
        toJSON: () => ({ balance: '200000000000' }),
      }),
    },
  },
  rpc: {
    chain: {
      getHeader: jest.fn().mockResolvedValue({
        number: {
          toNumber: () => 123456,
        },
      }),
    },
  },
  tx: {},
} as unknown as ApiPromise);

jest.spyOn(Polkadot.prototype, 'getNativeToken').mockReturnValue({
  symbol: 'DOT',
  decimals: 10,
  chainId: 1,
  address: '0x1',
  name: 'Polkadot',
});

export const mockPolkadotApiPromiseCreate = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseCreate')
    .mockResolvedValue(MOCK_API as unknown as ApiPromise);
};
export const MockUtilCryptoWaitReady = () => {
  jest.spyOn(Polkadot.prototype, 'utilCryptoWaitReady').mockResolvedValue(true);
};
export const MockapiPromiseQuerySystemAccount = () => {
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

export const MockapiPromiseRpcChainGetHeader = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseRpcChainGetHeader')
    .mockImplementation(() => MOCK_API.rpc.chain.getHeader());
};
export const MockapiPromiseQueryAssetsAccount = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseQueryAssetsAccount')
    .mockImplementation(() => MOCK_API.query.assets.account('0x1', '0x2'));
};
export const MockapiPromiseQueryTokensAccounts = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseQueryTokensAccounts')
    .mockImplementation(async (_target, _addr, tokenAddress) => {
      // Create a mock registry if needed, or use any as a workaround for tests
      const mockData = {
        free: { toString: () => (tokenAddress === '0x2' ? '1234567890' : '0') },
        reserved: { toString: () => '0' },
        frozen: { toString: () => '0' },
      };
      return mockData as unknown as OrmlTokensAccountData;
    });
};
export const MockapiPromiseDeriveStakingAccount = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseDeriveStakingAccount')
    .mockImplementation(() => MOCK_API.derive.staking.account('0x1'));
};
export const MockapiPromiseQueryStakingValidatorsEntries = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseQueryStakingValidatorsEntries')
    .mockImplementation(() => MOCK_API.query.staking.validators.entries());
};
export const MockapiPromiseQueryStakingValidators = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseQueryStakingValidators')
    .mockImplementation(() => MOCK_API.query.staking.validators.address('0x1'));
};
export const MockapiPromiseRpcChainGetBlock = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseRpcChainGetBlock')
    .mockImplementation(() => MOCK_API.rpc.chain.getBlock('0x123'));
};
export const MockapiPromiseRuntimeMetadata = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseRuntimeMetadata')
    .mockReturnValue(MOCK_API.runtimeMetadata as unknown as Promise<Metadata>);
};
export const MockapiPromiseTx = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseTx')
    .mockImplementation(
      () =>
        MOCK_API.tx as unknown as Promise<
          SubmittableModuleExtrinsics<'promise'>
        >,
    );
};
export const MockapiPromiseConsts = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseConsts')
    .mockReturnValue(
      MOCK_API.consts as unknown as Promise<QueryableModuleConsts>,
    );
};
export const MockapiPromiseErrors = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseErrors')
    .mockReturnValue(
      MOCK_API.errors as unknown as Promise<ModuleErrors<ApiTypes>>,
    );
};
export const MockapiPromiseTxBalancesTransfer = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseTxBalancesTransfer')
    .mockImplementation(() => MOCK_API.tx.balances.transfer('0x1', '1000'));
};
export const MockapiPromiseTxBalancesTransferKeepAlive = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseTxBalancesTransferKeepAlive')
    .mockImplementation(() =>
      MOCK_API.tx.balances.transferKeepAlive('0x1', '1000'),
    );
};

export const MocksubmittableExtrinsicPaymentInfo = () => {
  jest
    .spyOn(Polkadot.prototype, 'submittableExtrinsicPaymentInfo')
    .mockResolvedValue({
      partialFee: { toString: () => '100000' },
    });
};
export const MockfsReadFile = () => {
  jest
    .spyOn(Polkadot.prototype, 'fsReadFile')
    .mockImplementation((path: string) => {
      const pathStr = path?.toString?.() || '';
      console.log('[Mock fsReadFile] path:', pathStr);

      if (pathStr.endsWith('.json') && pathStr.includes('/wallet/')) {
        return Promise.resolve(Buffer.from('deadbeef:encrypted-mnemonic'));
      }
      return Promise.resolve(
        Buffer.from(
          JSON.stringify([
            { symbol: 'DOT', name: 'Polkadot', decimals: 10, id: '0x1' },
            { symbol: 'USDT', name: 'Tether', decimals: 6, id: '0x2' },
          ]),
        ),
      );
    });
};
export const MockAxiosGet = () => {
  jest.spyOn(Polkadot.prototype, 'axiosGet').mockResolvedValue({
    data: [{ symbol: 'DOT', name: 'Polkadot', decimals: 10, id: '0x1' }],
  });
};
export const MockAxiosPost = () => {
  jest.spyOn(Polkadot.prototype, 'axiosPost').mockResolvedValue({
    data: { data: { success: true, fee: '1000000' } },
  });
};
export const MockReadPassphrase = () => {
  jest
    .spyOn(ConfigManagerCertPassphrase, 'readPassphrase')
    .mockReturnValue('test-passphrase');
};

const walletDir = path.join(__dirname, 'tmp_wallets');
const walletFile = path.join(walletDir, 'test_wallet.json');

beforeAll(() => {
  if (!fs.existsSync(walletDir)) fs.mkdirSync(walletDir);
  fs.writeFileSync(walletFile, 'mocked-encrypted-mnemonic');
});

afterAll(() => {
  fs.unlinkSync(walletFile);
  fs.rmdirSync(walletDir);
});

const fastify = Fastify({ logger: true });
fastify.setErrorHandler((error: any, request: any, reply: any) => {
  const errorResponse: any = {
    error: error.name,
    message: error.message,
    statusCode: error.statusCode || 500,
    stack: error.stack,
  };
  request.log.error(errorResponse);
  reply.status(errorResponse.statusCode).send(errorResponse);
});
fastify.post('/fail', async () => {
  throw new Error('Erro proposital');
});
