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

import { Polkadot } from '../../../src/chains/polkadot/polkadot';
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

// jest.mock('@polkadot/util-crypto', () => ({
//   ...jest.requireActual('@polkadot/util-crypto'),
//   decodeAddress: jest.fn(),
// }));

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
      accounts: jest.fn().mockImplementation((tokenAddress) => {
        if (tokenAddress === '0x1234567890abcdef') {
          return Promise.resolve({
            free: { toString: () => '1234567890000000000000' },
          });
        }
        return Promise.resolve({
          free: { toString: () => '12345678900000000000' },
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
      shareToken: jest.fn().mockImplementation(() => {
        return Promise.resolve({
          toString: () => '0x1234567890abcdef',
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
                assetId: '31',
                shares: '1000000000000000000',
                amount: '1000000000000000000',
                price: 10,
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
                owner: '0x360CC4D00B4cbfCB854367D6Dd30C6aFBe74697a',
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
    },
    omnipool: {
      addLiquidityWithLimit: jest.fn().mockReturnValue({
        signAndSend: jest.fn().mockResolvedValue({ hash: '0xOP' }),
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
      getToken: jest.fn().mockImplementation((symbol) => {
        if (symbol === 'HDX' || symbol === '0x1')
          return { address: '0x1', decimals: 12, symbol: 'HDX' };
        if (symbol === 'USDT' || symbol === '0x2')
          return { address: '0x2', decimals: 6, symbol: 'USDT' };
        return null;
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
      ...originalModule.Hydration,
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
            return null;
          }),
          getNativeToken: jest
            .fn()
            .mockReturnValue({ address: '0x1', decimals: 12, symbol: 'HDX' }),
          getFeePaymentToken: jest.fn().mockReturnValue({ decimals: 12 }),
        };

        // realInstance.getPoolInfo = jest.fn().mockResolvedValue({
        //   id: 'pool-1',
        //   baseTokenAddress: '0x1',
        //   quoteTokenAddress: '0x2',
        //   poolType: 'XYK',
        //   price: 10,
        // });

        realInstance.getPoolService = jest.fn().mockResolvedValue({
          syncRegistry: jest.fn().mockResolvedValue(undefined),
          getPools: jest.fn().mockResolvedValue([
            {
              address: 'pool-1',
              id: 'pool-1',
              type: 'xyk',
              tokens: [
                {
                  symbol: 'HDX',
                  balance: '1000000000000',
                  decimals: 12,
                  id: '0x1',
                },
                {
                  symbol: 'USDT',
                  balance: '10000000000',
                  decimals: 6,
                  id: '0x2',
                },
              ],
            },
          ]),
        });

        realInstance.poolServiceGetPools = jest.fn().mockResolvedValue([
          {
            address: 'pool-1',
            id: 'pool-1',
            type: 'xyk',
            tokens: [
              {
                symbol: 'HDX',
                balance: '1000000000000',
                decimals: 12,
                id: '0x1',
              },
              {
                symbol: 'USDT',
                balance: '10000000000',
                decimals: 6,
                id: '0x2',
              },
            ],
          },
        ]);

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
          getToken: jest.fn().mockImplementation((symbol) => {
            if (symbol === 'HDX' || symbol === '0x1')
              return { address: '0x1', decimals: 12, symbol: 'HDX' };
            if (symbol === 'USDT' || symbol === '0x2')
              return { address: '0x2', decimals: 6, symbol: 'USDT' };
            return null;
          }),
          getFeePaymentToken: jest.fn().mockReturnValue({ decimals: 12 }),
        });

        realInstance.getSlippagePercentage = jest
          .fn()
          .mockReturnValue(new BigNumber(1));

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

        realInstance.getPoolDetails = jest.fn().mockResolvedValue({
          address: 'pool-1',
          baseTokenAddress: '0x1',
          quoteTokenAddress: '0x2',
          feePct: 0.05,
          price: 10,
          baseTokenAmount: 1000000000000,
          quoteTokenAmount: 10000000000,
          poolType: 'XYK',
          lpMint: {
            address: '0x1234567890abcdef',
            decimals: 18,
          },
          tokens: ['HDX', 'USDT'],
        });

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
//
const mockApiPromiseCreate = () => {
  jest
    .spyOn(Polkadot.prototype, 'apiPromiseCreate')
    .mockResolvedValue(_MOCK_API as unknown as any);
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

    // Log the full error object
    console.error('Full error object:', error);

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
    it('should successfully add liquidity', async () => {
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
  });

  describe('POST /execute-swap', () => {
    it('should successfully execute swap', async () => {
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
  });

  describe('GET /list-pools', () => {
    it('should successfully list pools', async () => {
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
  });

  describe('GET /pool-info', () => {
    it('should successfully get pool info', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/pool-info?network=mainnet&poolAddress=pool-1',
      });
      console.log('[poolInfoRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        address: 'pool-1',
        baseTokenAddress: '0x1',
        quoteTokenAddress: '0x2',
        feePct: 0.05,
        price: 10,
        baseTokenAmount: 1000000000000,
        quoteTokenAmount: 10000000000,
        poolType: 'XYK',
        lpMint: {
          address: '0x1234567890abcdef',
          decimals: 18,
        },
        tokens: ['HDX', 'USDT'],
      });
      expect(result).toBeDefined();
    });
  });

  describe('GET /quote-liquidity', () => {
    it('should successfully get liquidity quote', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/quote-liquidity?network=mainnet&poolAddress=pool-1&baseTokenAmount=100&quoteTokenAmount=100&slippagePct=1',
      });
      console.log('[quoteLiquidityRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(typeof response.baseTokenAmount).toBe('number');
      expect(typeof response.quoteTokenAmount).toBe('number');
    });
  });

  describe('GET /quote-swap', () => {
    it('should successfully get swap quote', async () => {
      const result = await app.inject({
        method: 'GET',
        url: '/quote-swap?network=mainnet&baseToken=HDX&quoteToken=USDT&amount=100&side=BUY',
      });
      console.log('[quoteSwapRoute] res:', result.body);
      expect(result).toBeDefined();
    });
  });

  describe('POST /remove-liquidity', () => {
    it('should successfully remove liquidity', async () => {
      const result = await app.inject({
        method: 'POST',
        url: '/remove-liquidity',
        payload: {
          network: CHAIN_NETWORK,
          walletAddress: MOCK_ADDRESS_WALLET,
          poolAddress: 'pool-1',
          percentageToRemove: 1,
          tokenId: '31',
        },
      });
      console.log('[removeLiquidityRoute] res:', result.body);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        signature: '0x1234567890abcdef',
        fee: 1e-7,
        baseTokenAmountRemoved: 0.000123456789,
        quoteTokenAmountRemoved: 1.234567,
        sharesPercentageRemoved: 1,
        sharesAmountRemoved: 123456.789,
      });
      expect(result).toBeDefined();
    });
  });

  //   describe('GET /position-info', () => {
  //     it('should successfully get position info', async () => {
  //       console.log('Starting position-info test...');
  //       const result = await app.inject({
  //         method: 'GET',
  //         url: '/position-info?network=mainnet&walletAddress=0x360CC4D00B4cbfCB854367D6Dd30C6aFBe74697a&poolAddress=pool-1&baseToken=HDX&quoteToken=USDT',
  //       });
  //       console.log('[positionInfoRoute] res:', result.body);
  //       console.log('[positionInfoRoute] status:', result.statusCode);
  //       expect(result.statusCode).toBe(200);
  //       expect(JSON.parse(result.body)).toEqual({
  //         poolAddress: 'pool-1',
  //         walletAddress: 'mocked-address',
  //         baseTokenAddress: '0x1',
  //         quoteTokenAddress: '0x2',
  //         lpTokenAmount: 12.3456789,
  //         baseTokenAmount: 1234567890,
  //         quoteTokenAmount: 12345678.9,
  //         price: 10,
  //       });
  //       expect(result).toBeDefined();
  //     });
  //   });
  //
  //   describe('GET /positions-owned', () => {
  //     it('should successfully get positions owned', async () => {
  //       const result = await app.inject({
  //         method: 'GET',
  //         url: '/positions-owned?network=mainnet&walletAddress=7FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty&tokenId=31',
  //       });
  //       console.log('[positionsOwnedRoute] res:', result.body);
  //       expect(result).toBeDefined();
  //     });
  //   });
});
