/**
 * Utility mocks for testing the Polkadot chain.
 * Includes wallet, keyring, WS provider and Axios.
 */

import { ApiPromise } from '@polkadot/api';
import {
  ApiTypes,
  ModuleErrors,
  SubmittableModuleExtrinsics,
  QueryableModuleConsts,
} from '@polkadot/api/types';
import type { KeyringPair } from '@polkadot/keyring/types';
import { Metadata } from '@polkadot/types';
import axios from 'axios';

import { Polkadot } from '../../src/chains/polkadot/polkadot';
import {
  PolkadotBalanceResponse,
  PolkadotPollResponse,
  PolkadotEstimateGasResponse,
  PolkadotStatusResponse,
  PolkadotTokensResponse,
} from '../../src/chains/polkadot/polkadot.types';
import { ConfigManagerCertPassphrase } from '../../src/services/config-manager-cert-passphrase';

export const TEST_WALLET = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
export const CHAIN_NAME = 'polkadot';
export const CHAIN_NETWORK = 'mainnet';

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
export const MOCK_ADDRESS = TEST_WALLET;
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
export const MOCK_BALANCES: PolkadotBalanceResponse = {
  balances: {
    DOT: 1000000000000000000,
    USDT: 1234567890,
  },
};

export const MOCK_WALLET: Partial<KeyringPair> = {
  address: TEST_WALLET,
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

export const MOCK_WS_PROVIDER = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  send: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
};

export const MOCK_KEYRING = {
  addFromMnemonic: jest.fn(() => MOCK_WALLET),
  addFromUri: jest.fn(() => MOCK_WALLET),
  getPairs: jest.fn(() => [MOCK_WALLET]),
  getPair: jest.fn(() => MOCK_WALLET),
};

export const MOCKED_AXIOS = axios as jest.Mocked<typeof axios>;

export const MOCK_AXIOS_INSTANCE = {
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
};
export const MOCK_ENCRYPT = jest.fn(
  (_data: string, _pass: string) => 'encrypted-data',
);
export const MOCK_DECRYPT = jest.fn((_encrypted: string, pass: string) =>
  pass === 'correct-password' ? 'decrypted-data' : '',
);
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

jest
  .spyOn(Polkadot.prototype, 'apiPromiseCreate')
  .mockResolvedValue(MOCK_API as unknown as ApiPromise);
jest.spyOn(Polkadot.prototype, 'utilCryptoWaitReady').mockResolvedValue(true);

jest
  .spyOn(Polkadot.prototype, 'apiPromiseQuerySystemAccount')
  .mockImplementation((target, addr) =>
    MOCK_API.query.system.account(target, addr),
  );
jest
  .spyOn(Polkadot.prototype, 'apiPromiseRpcChainGetHeader')
  .mockImplementation(() => MOCK_API.rpc.chain.getHeader());
jest
  .spyOn(Polkadot.prototype, 'apiPromiseQueryAssetsAccount')
  .mockImplementation(() => MOCK_API.query.assets.account('0x1', '0x2'));
jest
  .spyOn(Polkadot.prototype, 'apiPromiseQueryTokensAccounts')
  .mockImplementation(() => MOCK_API.query.tokens.accounts('0x1', '0x2'));
jest
  .spyOn(Polkadot.prototype, 'apiPromiseDeriveStakingAccount')
  .mockImplementation(() => MOCK_API.derive.staking.account('0x1'));
jest
  .spyOn(Polkadot.prototype, 'apiPromiseQueryStakingValidatorsEntries')
  .mockImplementation(() => MOCK_API.query.staking.validators.entries());
jest
  .spyOn(Polkadot.prototype, 'apiPromiseQueryStakingValidators')
  .mockImplementation(() => MOCK_API.query.staking.validators.address('0x1'));
jest
  .spyOn(Polkadot.prototype, 'apiPromiseRpcChainGetBlock')
  .mockImplementation(() => MOCK_API.rpc.chain.getBlock('0x123'));

jest
  .spyOn(Polkadot.prototype, 'apiPromiseRuntimeMetadata')
  .mockReturnValue(MOCK_API.runtimeMetadata as unknown as Promise<Metadata>);
jest
  .spyOn(Polkadot.prototype, 'apiPromiseTx')
  .mockImplementation(
    () =>
      MOCK_API.tx as unknown as Promise<SubmittableModuleExtrinsics<'promise'>>,
  );
jest
  .spyOn(Polkadot.prototype, 'apiPromiseConsts')
  .mockReturnValue(
    MOCK_API.consts as unknown as Promise<QueryableModuleConsts>,
  );
jest
  .spyOn(Polkadot.prototype, 'apiPromiseErrors')
  .mockReturnValue(
    MOCK_API.errors as unknown as Promise<ModuleErrors<ApiTypes>>,
  );
jest
  .spyOn(Polkadot.prototype, 'apiPromiseTxBalancesTransfer')
  .mockImplementation(() => MOCK_API.tx.balances.transfer('0x1', '1000'));
jest
  .spyOn(Polkadot.prototype, 'apiPromiseTxBalancesTransferKeepAlive')
  .mockImplementation(() =>
    MOCK_API.tx.balances.transferKeepAlive('0x1', '1000'),
  );
jest
  .spyOn(Polkadot.prototype, 'submittableExtrinsicPaymentInfo')
  .mockResolvedValue({
    partialFee: { toString: () => '100000' },
  });
jest.spyOn(Polkadot.prototype, 'fsReadFile').mockResolvedValue(
  Buffer.from(
    JSON.stringify([
      { symbol: 'DOT', name: 'Polkadot', decimals: 10, id: '0x1' },
      { symbol: 'USDT', name: 'Tether', decimals: 6, id: '0x2' },
    ]),
  ),
);
jest.spyOn(Polkadot.prototype, 'axiosGet').mockResolvedValue({
  data: [{ symbol: 'DOT', name: 'Polkadot', decimals: 10, id: '0x1' }],
});
jest.spyOn(Polkadot.prototype, 'axiosPost').mockResolvedValue({
  data: { data: { success: true, fee: '1000000' } },
});

jest
  .spyOn(ConfigManagerCertPassphrase, 'readPassphrase')
  .mockReturnValue('test-passphrase');
