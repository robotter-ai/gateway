jest.mock('../../../src/connectors/hydration/hydration');

jest.mock('../../../src/services/config-manager-v2', () => ({
  ConfigManagerV2: {
    getInstance: jest.fn(() => ({
      get: jest.fn((key: string) => {
        if (key === 'server.logPath') return 'logs';
        if (key === 'hydration.networks.mainnet.nodeURL')
          return 'ws://localhost:9944';
        if (key === 'hydration.networks.mainnet.transactionURL')
          return 'https://hydration.api.subscan.io/api/scan/extrinsic';
        if (key === 'hydration.networks.mainnet.tokenListType') return 'FILE';
        if (key === 'hydration.networks.mainnet.tokenListSource')
          return 'src/templates/lists/hydration.json';
        if (key === 'hydration.networks.mainnet.nativeCurrencySymbol')
          return 'HDX';
        if (key === 'hydration.networks.mainnet.feePaymentCurrencySymbol')
          return 'HDX';
        return undefined;
      }),
      set: jest.fn(),
    })),
  },
}));

jest.mock('@polkadot/api', () => ({
  ApiPromise: {
    create: jest.fn().mockResolvedValue({
      tx: {},
      rpc: {
        chain: {
          getHeader: jest.fn().mockResolvedValue({
            number: { toNumber: () => 123456 },
          }),
        },
      },
    }),
  },
  WsProvider: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
  })),
  HttpProvider: jest.fn(),
}));

jest.mock('@polkadot/util-crypto', () => ({
  ...jest.requireActual('@polkadot/util-crypto'),
  decodeAddress: jest.fn(() => new Uint8Array(32)),
  encodeAddress: jest.fn(() => 'mocked-address'),
  cryptoWaitReady: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../src/chains/polkadot/polkadot.validators', () => ({
  validatePolkadotAddress: jest.fn().mockReturnValue(true),
}));

import { BigNumber } from '@galacticcouncil/sdk';
import Fastify from 'fastify';
import fs from 'fs-extra';

import { addLiquidityRoute } from '../../../src/connectors/hydration/routes/amm-routes/addLiquidity';
import { executeSwapRoute } from '../../../src/connectors/hydration/routes/amm-routes/executeSwap';
import { listPoolsRoute } from '../../../src/connectors/hydration/routes/amm-routes/listPools';
import { poolInfoRoute } from '../../../src/connectors/hydration/routes/amm-routes/poolInfo';
import { positionInfoRoute } from '../../../src/connectors/hydration/routes/amm-routes/positionInfo';
import { positionsOwnedRoute } from '../../../src/connectors/hydration/routes/amm-routes/positionsOwned';
import { quoteLiquidityRoute } from '../../../src/connectors/hydration/routes/amm-routes/quoteLiquidity';
import { quoteSwapRoute } from '../../../src/connectors/hydration/routes/amm-routes/quoteSwap';
import { removeLiquidityRoute } from '../../../src/connectors/hydration/routes/amm-routes/removeLiquidity';
import { ConfigManagerCertPassphrase } from '../../../src/services/config-manager-cert-passphrase';

const CHAIN_NETWORK = 'mainnet';
const MOCK_ADDRESS_WALLET = '0x360CC4D00B4cbfCB854367D6Dd30C6aFBe74697a';

jest.spyOn(fs, 'readFile').mockImplementation((file: any) => {
  const _pathStr = file?.toString?.() || '';

  if (_pathStr.includes('/wallet/') && _pathStr.endsWith('.json')) {
    return Promise.resolve(Buffer.from('encrypted-mnemonic'));
  }

  if (_pathStr.includes('src/templates/root.yml')) {
    return Promise.resolve(
      Buffer.from(`
networks:
  polkadot:
    mainnet:
      nodeURL: ws://localhost:9944
  `),
    );
  }
  if (_pathStr.includes('src/templates/lists/hydration.json')) {
    return Promise.resolve(
      Buffer.from(
        JSON.stringify([
          { symbol: 'HDX', name: 'HydraDX', decimals: 12, id: '0x1' },
          { symbol: 'USDT', name: 'Tether', decimals: 6, id: '0x2' },
        ]),
      ),
    );
  }
  return Promise.resolve(Buffer.from('[]'));
});

const _MOCK_API = {
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
      accounts: jest.fn().mockImplementation((tokenId) => {
        if (tokenId === '0x1234567890abcdef') {
          return Promise.resolve({
            free: { toString: () => '1234567890000000000000' },
          });
        }
        return Promise.resolve({
          free: { toString: () => '1000000000000000000' },
        });
      }),
      totalIssuance: jest.fn().mockImplementation((tokenAddress) => {
        if (tokenAddress === '0x1234567890abcdef') {
          return Promise.resolve({
            toString: () => '10000000000000000000000',
          });
        }
        return Promise.resolve({
          toString: () => '1000000000000000000000',
        });
      }),
    },
    staking: {
      validators: {
        entries: jest.fn().mockResolvedValue([]),
        address: jest.fn().mockResolvedValue({}),
      },
    },
    xyk: {
      shareToken: jest.fn().mockImplementation((poolAddress) => {
        if (poolAddress === 'pool-1') {
          return Promise.resolve({
            toString: () => '0x1234567890abcdef',
          });
        }
        return Promise.resolve({
          toString: () => '0xabcdef1234567890',
        });
      }),
    },
    omnipool: {
      positions: {
        entries: jest.fn().mockResolvedValue([
          [
            { args: ['1'] },
            {
              toHuman: () => ({
                assetId: '0x3234567890abcdef',
                shares: '1000000000000000000',
                amount: '1000000000000000000',
                price: '10',
              }),
            },
          ],
        ]),
      },
    },
    uniques: {
      asset: {
        entries: jest.fn().mockResolvedValue([
          [
            { args: ['collection', '1'] },
            {
              unwrap: () => ({
                owner: 'mocked-address',
              }),
            },
          ],
        ]),
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
    xyk: {
      addLiquidity: jest.fn().mockReturnValue({
        signAndSend: jest.fn().mockResolvedValue({ hash: '0xXYK' }),
      }),
      removeLiquidity: jest.fn().mockReturnValue({
        signAndSend: jest.fn().mockResolvedValue({ hash: '0xREMOVE' }),
      }),
    },
    stableswap: {
      addLiquidity: jest.fn().mockReturnValue({
        signAndSend: jest.fn().mockResolvedValue({ hash: '0xSS' }),
      }),
    },
    omnipool: {
      addLiquidityWithLimit: jest.fn().mockReturnValue({
        signAndSend: jest.fn().mockResolvedValue({ hash: '0xOP' }),
      }),
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
      transferKeepAlive: jest.fn().mockReturnValue({
        signAndSend: jest.fn().mockResolvedValue({ hash: '0xkeepalive' }),
      }),
    },
    system: {
      remark: jest.fn().mockReturnValue({
        paymentInfo: jest.fn().mockResolvedValue({
          partialFee: { toString: () => '100000' },
        }),
      }),
    },
    xyk: {
      addLiquidity: jest.fn().mockReturnValue({
        signAndSend: jest.fn().mockResolvedValue({ hash: '0xXYK' }),
      }),
      removeLiquidity: jest.fn().mockReturnValue({
        signAndSend: jest
          .fn()
          .mockResolvedValue({ hash: '0x1234567890abcdef' }),
      }),
    },
    stableswap: {
      addLiquidity: jest.fn().mockReturnValue({
        signAndSend: jest.fn().mockResolvedValue({ hash: '0xSS' }),
      }),
      removeLiquidity: jest.fn().mockReturnValue({
        signAndSend: jest
          .fn()
          .mockResolvedValue({ hash: '0x2234567890abcdef' }),
      }),
    },
    omnipool: {
      addLiquidityWithLimit: jest.fn().mockReturnValue({
        signAndSend: jest.fn().mockResolvedValue({ hash: '0xOP' }),
      }),
      removeLiquidity: jest.fn().mockReturnValue({
        signAndSend: jest
          .fn()
          .mockResolvedValue({ hash: '0x3234567890abcdef' }),
      }),
    },
  },
  consts: {
    somePallet: {},
    omnipool: {
      nftCollectionId: { toString: () => '123' },
    },
  },
  errors: {
    somePallet: {},
  },
  runtimeMetadata: {},
  disconnect: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../../src/chains/polkadot/polkadot', () => ({
  Polkadot: {
    getInstance: jest.fn().mockResolvedValue({
      config: {
        network: {
          nodeURL: 'ws://localhost:9944',
        },
      },
      getWallet: jest.fn().mockResolvedValue({
        address: '0x360CC4D00B4cbfCB854367D6Dd30C6aFBe74697a',
        signAndSend: jest.fn().mockResolvedValue({ hash: '0xSIG' }),
      }),
      getBalance: jest.fn().mockResolvedValue({
        HDX: 1000000,
        USDT: 1000000,
      }),
      getNativeToken: jest
        .fn()
        .mockReturnValue({ address: '0x1', decimals: 12, symbol: 'HDX' }),
      getFirstWalletAddress: jest
        .fn()
        .mockResolvedValue('0x360CC4D00B4cbfCB854367D6Dd30C6aFBe74697a'),
    }),
  },
}));

jest.mock('../../../src/connectors/hydration/hydration.config', () => ({
  HydrationConfig: {
    config: {
      network: {
        nodeURL: 'ws://localhost:9944',
        transactionURL: 'https://hydration.api.subscan.io/api/scan/extrinsic',
        tokenListSource: 'src/templates/lists/hydration.json',
        tokenListType: 'FILE',
        nativeCurrencySymbol: 'HDX',
        feePaymentCurrencySymbol: 'HDX',
      },
      allowedSlippage: '1',
      tradingTypes: ['amm', 'swap'],
      availableNetworks: [{ chain: 'polkadot', networks: ['mainnet'] }],
      gasPrice: 0.00000177,
      gasLimit: 338667,
      gasCost: 0.6,
      priorityLevel: 'normal',
    },
  },
}));

jest.mock('../../../src/connectors/hydration/hydration', () => {
  const originalModule = jest.requireActual(
    '../../../src/connectors/hydration/hydration',
  );

  return {
    ...originalModule,
    Hydration: {
      getInstance: jest.fn().mockImplementation(async () => {
        const realInstance = new originalModule.Hydration();

        realInstance.submitTransaction = jest.fn().mockResolvedValue({
          txHash: '0x1234567890abcdef',
          transaction: {
            events: [
              {
                toHuman: () => ({
                  event: {
                    method: 'TransactionFeePaid',
                    data: { actualFee: '100000' },
                  },
                }),
              },
            ],
          },
        });

        realInstance.getApiPromise = jest.fn().mockResolvedValue(_MOCK_API);

        realInstance.polkadot = {
          getWallet: jest.fn().mockResolvedValue({
            address: '0x360CC4D00B4cbfCB854367D6Dd30C6aFBe74697a',
            signAndSend: jest.fn().mockResolvedValue({ hash: '0xSIG' }),
          }),
          getBalance: jest.fn().mockResolvedValue({
            HDX: 1000000,
            USDT: 1000000,
          }),
          getToken: jest.fn().mockImplementation((symbol) => {
            if (symbol === 'HDX' || symbol === '0x1')
              return { address: '0x1', decimals: 12, symbol: 'HDX' };
            if (symbol === 'USDT' || symbol === '0x2')
              return { address: '0x2', decimals: 6, symbol: 'USDT' };
            if (symbol === 'H2O')
              return {
                address: '0x5555555555555555555555555555555555555555',
                decimals: 18,
                symbol: 'H2O',
              };
            if (symbol === 'USDC')
              return {
                address: '0x6666666666666666666666666666666666666666',
                decimals: 6,
                symbol: 'USDC',
              };
            if (symbol === '0x5555555555555555555555555555555555555555')
              return {
                address: '0x5555555555555555555555555555555555555555',
                decimals: 18,
                symbol: 'H2O',
              };
            if (symbol === '0x6666666666666666666666666666666666666666')
              return {
                address: '0x6666666666666666666666666666666666666666',
                decimals: 6,
                symbol: 'USDC',
              };
            if (symbol === '0x1234567890123456789012345678901234567890')
              return {
                address: '0x1234567890123456789012345678901234567890',
                decimals: 6,
                symbol: 'USDC',
              };
            if (symbol === '0x0987654321098765432109876543210987654321')
              return {
                address: '0x0987654321098765432109876543210987654321',
                decimals: 6,
                symbol: 'USDT',
              };
            return null;
          }),
          getNativeToken: jest
            .fn()
            .mockReturnValue({ address: '0x1', decimals: 12, symbol: 'HDX' }),
          getFeePaymentToken: jest.fn().mockReturnValue({ decimals: 12 }),
        };

        realInstance.getPoolService = jest.fn().mockResolvedValue({
          syncRegistry: jest.fn().mockResolvedValue(undefined),
        });

        realInstance.poolServiceGetPools = jest
          .fn()
          .mockImplementation((includeOnly = []) => {
            const pools = [
              {
                address: 'pool-1',
                id: '1',
                type: 'xyk',
                tokens: [
                  {
                    symbol: 'H2O',
                    balance: '1000000000000000000000',
                    decimals: 18,
                    id: '0x5555555555555555555555555555555555555555',
                  },
                  {
                    symbol: 'USDC',
                    balance: '1000000000',
                    decimals: 6,
                    id: '0x6666666666666666666666666666666666666666',
                  },
                ],
              },
              {
                address: 'stableswap',
                id: '2',
                type: 'stableswap',
                tokens: [
                  {
                    symbol: 'USDC',
                    balance: '1000000000',
                    decimals: 6,
                    id: '0x6666666666666666666666666666666666666666',
                  },
                  {
                    symbol: 'USDT',
                    balance: '1000000000',
                    decimals: 6,
                    id: '0x2',
                  },
                ],
              },
              {
                address: 'omnipool',
                id: '5',
                type: 'omnipool',
                tokens: [
                  {
                    symbol: 'H2O',
                    balance: '1000000000000000000000',
                    decimals: 18,
                    id: '0x1111111111111111111111111111111111111111',
                  },
                  {
                    symbol: 'USDC',
                    balance: '1000000000',
                    decimals: 6,
                    id: '0x2222222222222222222222222222222222222222',
                  },
                ],
              },
            ];

            if (includeOnly.length > 0) {
              return pools.filter((pool) => includeOnly.includes(pool.type));
            }

            return pools;
          });

        realInstance.getTokenSymbol = jest
          .fn()
          .mockImplementation((address) => {
            if (address === '0x1') return 'HDX';
            if (address === '0x2') return 'USDT';
            return 'UNKNOWN';
          });

        realInstance.polkadotGetInstance = jest.fn().mockResolvedValue({
          getWallet: jest.fn().mockResolvedValue({
            address: '0x360CC4D00B4cbfCB854367D6Dd30C6aFBe74697a',
            signAndSend: jest.fn().mockResolvedValue({ hash: '0xSIG' }),
          }),
          getBalance: jest.fn().mockResolvedValue({
            HDX: 1000000,
            USDT: 1000000,
          }),
          getFeePaymentToken: jest.fn().mockReturnValue({ decimals: 12 }),
        });

        // realInstance.getSlippagePercentage = jest
        //   .fn()
        //   .mockReturnValue(new BigNumber(1));

        realInstance.getTradeRouter = jest.fn().mockResolvedValue({
          getBestBuy: jest.fn().mockResolvedValue({
            amountIn: new BigNumber('100000000000'),
            amountOut: new BigNumber('99000000'),
            spotPrice: new BigNumber('0.99'),
            swaps: [{ poolAddress: 'pool-1', tradeFeePct: 100 }],
            toTx: jest.fn().mockReturnValue({
              get: jest.fn().mockReturnValue({
                signAndSend: jest.fn().mockResolvedValue({ hash: '0xswap' }),
                paymentInfo: jest.fn().mockResolvedValue({
                  weight: {
                    refTime: { toBn: () => new BigNumber(1) },
                    proofSize: { toBn: () => new BigNumber(0) },
                  },
                }),
              }),
            }),
            toHuman: jest.fn().mockReturnValue({
              amountIn: '0.1',
              amountOut: '0.099',
              spotPrice: '0.99',
              swaps: [{ poolAddress: 'pool-1', tradeFeePct: 100 }],
            }),
          }),
          getBestSell: jest.fn().mockResolvedValue({
            amountIn: new BigNumber('100000000000'),
            amountOut: new BigNumber('99000000'),
            spotPrice: new BigNumber('1.01'),
            swaps: [{ poolAddress: 'pool-1', tradeFeePct: 100 }],
            toTx: jest.fn().mockReturnValue({
              get: jest.fn().mockReturnValue({
                signAndSend: jest.fn().mockResolvedValue({ hash: '0xswap' }),
                paymentInfo: jest.fn().mockResolvedValue({
                  weight: {
                    refTime: { toBn: () => new BigNumber(1) },
                    proofSize: { toBn: () => new BigNumber(0) },
                  },
                }),
              }),
            }),
            toHuman: jest.fn().mockReturnValue({
              amountIn: '0.1',
              amountOut: '0.099',
              spotPrice: '1.01',
              swaps: [{ poolAddress: 'pool-1', tradeFeePct: 100 }],
            }),
          }),
        });

        realInstance.calculateTradeLimit = jest
          .fn()
          .mockReturnValue('100000000000');

        const originalGetTokenSymbol =
          realInstance.getTokenSymbol.bind(realInstance);
        realInstance.getTokenSymbol = jest
          .fn()
          .mockImplementation(originalGetTokenSymbol);

        return realInstance;
      }),
    },
  };
});

const mockReadPassphrase = () => {
  jest
    .spyOn(ConfigManagerCertPassphrase, 'readPassphrase')
    .mockReturnValue('test-passphrase');
};

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = Fastify();
  app.setErrorHandler((error, reply) => {
    console.error('Test Error Details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      statusCode: error.statusCode,
    });
    reply.status(500).send({
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    reply.status(404).send({
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
  });
  await app.register(require('@fastify/sensible'));
  await app.register(addLiquidityRoute);
  await app.register(executeSwapRoute);
  await app.register(listPoolsRoute);
  await app.register(poolInfoRoute);
  await app.register(quoteLiquidityRoute);
  await app.register(quoteSwapRoute);
  await app.register(removeLiquidityRoute);
  await app.register(positionInfoRoute);
  await app.register(positionsOwnedRoute);
  await app.ready();
}, 30000);

let app;
afterAll(async () => {
  await app.close();
  jest.restoreAllMocks();
  delete process.env.NODE_ENV;
}, 10000);

describe('Hydration Router Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  describe('POST /add-liquidity', () => {
    it('should successfully add liquidity to XYK pool', async () => {
      const result = await app.inject({
        method: 'POST',
        url: '/add-liquidity',
        payload: {
          poolAddress: 'pool-1',
          network: CHAIN_NETWORK,
          walletAddress: MOCK_ADDRESS_WALLET,
          baseTokenAmount: 0.1,
          quoteTokenAmount: 0.01,
          slippagePct: 1,
          baseToken: 'HDX',
          quoteToken: 'USDT',
        },
      });
      console.log('[addLiquidityRoute] res:', result.body);
      expect(JSON.parse(result.body)).toEqual({
        signature: '0x1234567890abcdef',
        fee: 1e-7,
        baseTokenAmountAdded: 0.1,
        quoteTokenAmountAdded: 0.01,
      });
      expect(result).toBeDefined();
    });

    it('should successfully add liquidity to STABLESWAP pool', async () => {
      const result = await app.inject({
        method: 'POST',
        url: '/add-liquidity',
        payload: {
          poolAddress: 'stableswap',
          network: CHAIN_NETWORK,
          walletAddress: MOCK_ADDRESS_WALLET,
          baseTokenAmount: 0.1,
          quoteTokenAmount: 0.01,
          slippagePct: 1,
          baseToken: 'HDX',
          quoteToken: 'USDT',
        },
      });
      console.log('[addLiquidityRoute STABLESWAP] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(result).toBeDefined();
    });

    it('should successfully add liquidity to OMNIPOOL', async () => {
      const result = await app.inject({
        method: 'POST',
        url: '/add-liquidity',
        payload: {
          poolAddress: 'omnipool',
          network: CHAIN_NETWORK,
          walletAddress: MOCK_ADDRESS_WALLET,
          baseTokenAmount: 0.1,
          quoteTokenAmount: 0,
          slippagePct: 1,
          baseToken: 'HDX',
          quoteToken: 'USDT',
        },
      });
      console.log('[addLiquidityRoute OMNIPOOL base] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(result).toBeDefined();
    });

    it('should successfully add liquidity to OMNIPOOL with quote token only', async () => {
      const result = await app.inject({
        method: 'POST',
        url: '/add-liquidity',
        payload: {
          poolAddress: 'omnipool',
          network: CHAIN_NETWORK,
          walletAddress: MOCK_ADDRESS_WALLET,
          baseTokenAmount: 0,
          quoteTokenAmount: 0.1,
          slippagePct: 1,
          baseToken: 'HDX',
          quoteToken: 'USDT',
        },
      });
      console.log('[addLiquidityRoute OMNIPOOL quote] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        signature: '0x1234567890abcdef',
        fee: 1e-7,
        baseTokenAmountAdded: 0,
        quoteTokenAmountAdded: 0.1,
      });
      expect(result).toBeDefined();
    });
  });

  describe('POST /execute-swap', () => {
    it('should successfully execute swap BUY', async () => {
      mockReadPassphrase();
      const result = await app.inject({
        method: 'POST',
        url: '/execute-swap',
        payload: {
          network: CHAIN_NETWORK,
          walletAddress: MOCK_ADDRESS_WALLET,
          baseToken: 'HDX',
          quoteToken: 'USDT',
          amount: 0.1,
          side: 'BUY',
          poolAddress: 'xyk',
          slippagePct: 1,
        },
      });
      console.log('[executeSwapRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(result).toBeDefined();
    });
    it('should successfully execute swap SELL', async () => {
      mockReadPassphrase();
      const result = await app.inject({
        method: 'POST',
        url: '/execute-swap',
        payload: {
          network: CHAIN_NETWORK,
          walletAddress: MOCK_ADDRESS_WALLET,
          baseToken: 'HDX',
          quoteToken: 'USDT',
          amount: 0.1,
          side: 'SELL',
          poolAddress: 'xyk',
          slippagePct: 1,
        },
      });
      console.log('[executeSwapRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(result).toBeDefined();
    });
  });

  describe('GET /list-pools', () => {
    it('should successfully list pools XYK', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/list-pools',
        payload: {
          network: CHAIN_NETWORK,
          types: 'xyk',
          tokenSymbols: 'HDX,USDT',
        },
      });
      console.log('[listPoolsRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(result).toBeDefined();
    });
    it('should successfully list pools Stableswap', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/list-pools',
        payload: {
          network: CHAIN_NETWORK,
          types: 'stableswap',
          tokenSymbols: 'HDX,USDT',
        },
      });
      console.log('[listPoolsRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(result).toBeDefined();
    });
    it('should successfully list pools Omnipool', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/list-pools',
        payload: {
          network: CHAIN_NETWORK,
          types: 'omnipool',
          tokenSymbols: 'HDX,USDT',
        },
      });
      console.log('[listPoolsRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(result).toBeDefined();
    });

    it('should successfully filter pools by token addresses', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/list-pools?network=mainnet&tokenAddresses=0x5555555555555555555555555555555555555555,0x6666666666666666666666666666666666666666',
      });
      console.log('[listPoolsRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response).toEqual({ pools: [] });
      expect(result).toBeDefined();
    });

    it('should successfully filter pools by token addresses and exclude pool tokens', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/list-pools?network=mainnet&tokenAddresses=0x1111111111111111111111111111111111111111,0x2222222222222222222222222222222222222222',
      });
      console.log('[listPoolsRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response).toEqual({ pools: [] });
      expect(result).toBeDefined();
    });
  });

  describe('GET /pool-info', () => {
    it('should successfully get pool info XYK', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/pool-info?network=mainnet&poolAddress=pool-1',
      });
      console.log('[poolInfoRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        address: 'pool-1',
        baseTokenAddress: '0x5555555555555555555555555555555555555555',
        quoteTokenAddress: '0x6666666666666666666666666666666666666666',
        feePct: 0.05,
        price: 1.0,
        baseTokenAmount: 1000,
        quoteTokenAmount: 1000,
        poolType: 'xyk',
        lpMint: {
          address: '0x1234567890abcdef',
          decimals: 0,
        },
        tokens: ['H2O', 'USDC'],
      });
      expect(result).toBeDefined();
    });
    it('should successfully get pool info Stableswap', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/pool-info?network=mainnet&poolAddress=stableswap',
      });
      console.log('[poolInfoRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        address: 'stableswap',
        baseTokenAddress: '0x6666666666666666666666666666666666666666',
        quoteTokenAddress: '0x2',
        feePct: 0.05,
        price: 1.0,
        baseTokenAmount: 1000,
        quoteTokenAmount: 1000,
        poolType: 'stableswap',
        lpMint: {
          address: '2',
          decimals: 18,
        },
        tokens: ['USDC', 'USDT'],
      });
      expect(result).toBeDefined();
    });
    it('should successfully get pool info Omnipool', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/pool-info?network=mainnet&poolAddress=omnipool',
      });
      console.log('[poolInfoRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        address: 'omnipool',
        baseTokenAddress: '0x5555555555555555555555555555555555555555',
        quoteTokenAddress: '0x5555555555555555555555555555555555555555',
        feePct: 0.05,
        price: 1.0,
        baseTokenAmount: 0,
        quoteTokenAmount: 0,
        poolType: 'omnipool',
        lpMint: {
          address: '0x5555555555555555555555555555555555555555',
          decimals: 18,
        },
        tokens: ['H2O', 'USDC'],
      });
      expect(result).toBeDefined();
    });
  });

  describe('GET /quote-liquidity', () => {
    it('should successfully get liquidity quote XYK', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/quote-liquidity?network=mainnet&poolAddress=pool-1&baseTokenAmount=100&quoteTokenAmount=100&slippagePct=1',
      });
      console.log('[quoteLiquidityRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response).toEqual({
        baseLimited: false,
        baseTokenAmount: 100,
        quoteTokenAmount: 100,
        baseTokenAmountMax: 101,
        quoteTokenAmountMax: 101,
      });
    });
    it('should successfully get liquidity quote Stableswap', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/quote-liquidity?network=mainnet&poolAddress=stableswap&baseTokenAmount=100&quoteTokenAmount=100&slippagePct=1',
      });
      console.log('[quoteLiquidityRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response).toEqual({
        baseLimited: false,
        baseTokenAmount: 100,
        quoteTokenAmount: 100,
        baseTokenAmountMax: 101,
        quoteTokenAmountMax: 101,
      });
    });
    it('should successfully get liquidity quote Omnipool', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/quote-liquidity?network=mainnet&poolAddress=omnipool&baseTokenAmount=100&quoteTokenAmount=100&slippagePct=1',
      });
      console.log('[quoteLiquidityRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response).toEqual({
        baseLimited: false,
        baseTokenAmount: 120,
        quoteTokenAmount: 100,
        baseTokenAmountMax: 121.2,
        quoteTokenAmountMax: 101,
      });
    });

    it('should successfully get liquidity quote with BaseHeavy strategy', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/quote-liquidity?network=mainnet&poolAddress=pool-1&baseTokenAmount=100&quoteTokenAmount=100&strategyType=BaseHeavy&slippagePct=1',
      });
      console.log('[quoteLiquidityRoute BaseHeavy] res:', result.body);
      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response.baseTokenAmount).toBe(100);
      expect(response.quoteTokenAmount).toBe(100);
    });
  });

  describe('GET /quote-swap', () => {
    it('should successfully get swap quote BUY', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/quote-swap?network=mainnet&baseToken=USDC&quoteToken=USDT&amount=100&side=BUY',
      });
      console.log('[quoteSwapRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response).toEqual({
        estimatedAmountIn: 0.1,
        estimatedAmountOut: 0.099,
        minAmountOut: 0.099,
        maxAmountIn: 0.2,
        baseTokenBalanceChange: 0.099,
        quoteTokenBalanceChange: -0.1,
        price: 1.010101010101,
        gasPrice: 0.00000177,
        gasLimit: 338667,
        gasCost: 0.6,
      });
      expect(result).toBeDefined();
    });
    it('should successfully get swap quote SELL', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/quote-swap?network=mainnet&baseToken=HDX&quoteToken=USDT&amount=100&side=SELL',
      });
      console.log('[quoteSwapRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response).toEqual({
        estimatedAmountIn: 0.1,
        estimatedAmountOut: 0.099,
        maxAmountIn: 0.1,
        minAmountOut: 0,
        baseTokenBalanceChange: -0.1,
        quoteTokenBalanceChange: 0.099,
        price: 0.99,
        gasPrice: 0.00000177,
        gasLimit: 338667,
        gasCost: 0.6,
      });
      expect(result).toBeDefined();
    });
  });

  describe('POST /remove-liquidity', () => {
    it('should successfully remove liquidity XYK', async () => {
      const result = await app.inject({
        method: 'POST',
        url: '/remove-liquidity',
        payload: {
          network: CHAIN_NETWORK,
          walletAddress: MOCK_ADDRESS_WALLET,
          poolAddress: 'pool-1',
          percentageToRemove: 1,
          tokenId: '0x1234567890abcdef',
        },
      });
      console.log('[removeLiquidityRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        signature: '0x1234567890abcdef',
        fee: 1e-7,
        baseTokenAmountRemoved: 0.01,
        quoteTokenAmountRemoved: 0.01,
        sharesPercentageRemoved: 1,
        sharesAmountRemoved: 0.01,
      });
      expect(result).toBeDefined();
    });
    it('should successfully remove liquidity Stableswap', async () => {
      const result = await app.inject({
        method: 'POST',
        url: '/remove-liquidity',
        payload: {
          network: CHAIN_NETWORK,
          walletAddress: MOCK_ADDRESS_WALLET,
          poolAddress: 'stableswap',
          percentageToRemove: 1,
          tokenId: '0x2234567890abcdef',
        },
      });
      console.log('[removeLiquidityRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        signature: '0x1234567890abcdef',
        fee: 1e-7,
        baseTokenAmountRemoved: 0.01,
        quoteTokenAmountRemoved: 0.01,
        sharesPercentageRemoved: 1,
        sharesAmountRemoved: 0.01,
      });
      expect(result).toBeDefined();
    });

    it('should successfully remove liquidity Omnipool', async () => {
      const result = await app.inject({
        method: 'POST',
        url: '/remove-liquidity',
        payload: {
          network: CHAIN_NETWORK,
          walletAddress: MOCK_ADDRESS_WALLET,
          poolAddress: 'omnipool',
          percentageToRemove: 1,
          tokenId: '0x3234567890abcdef',
        },
      });
      console.log('[removeLiquidityRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        signature: '0x1234567890abcdef',
        fee: 1e-7,
        baseTokenAmountRemoved: 0.01,
        quoteTokenAmountRemoved: 0,
        sharesPercentageRemoved: 1,
        sharesAmountRemoved: 0.01,
      });
      expect(result).toBeDefined();
    });
  });

  describe('GET /position-info', () => {
    it('should successfully get position info', async () => {
      console.log('Starting position-info test...');
      const result = await app.inject({
        method: 'GET',
        url: '/position-info?network=mainnet&walletAddress=0x360CC4D00B4cbfCB854367D6Dd30C6aFBe74697a&poolAddress=pool-1&baseToken=HDX&quoteToken=USDT',
      });
      console.log('[positionInfoRoute] res:', result.body);
      console.log('[positionInfoRoute] status:', result.statusCode);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        poolAddress: 'pool-1',
        walletAddress: 'mocked-address',
        baseTokenAddress: '0x5555555555555555555555555555555555555555',
        quoteTokenAddress: '0x6666666666666666666666666666666666666666',
        lpTokenAmount: 1,
        baseTokenAmount: 0.1,
        quoteTokenAmount: 0.1,
        price: 1,
      });
      expect(result).toBeDefined();
    });
  });

  describe('GET /positions-owned', () => {
    it('should successfully get positions owned', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/positions-owned?network=mainnet&walletAddress=7FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty&tokenId=31',
      });
      console.log('[positionsOwnedRoute] res:', result.body);
      expect(result).toBeDefined();
    });

    it('should filter out positions with zero or negative shares', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/positions-owned?network=mainnet&walletAddress=7FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty&tokenId=0x3234567890abcdef',
      });

      console.log('[positionsOwnedRoute with zero shares] res:', result.body);
      expect(result.statusCode).toBe(200);

      const response = JSON.parse(result.body);
      // Verify that the response contains positions and they all have valid shares
      expect(Array.isArray(response)).toBe(true);
      if (response && response.length > 0) {
        response.forEach((position) => {
          expect(new BigNumber(position.shares).gt(0)).toBe(true);
        });
      }
    });
  });
});
