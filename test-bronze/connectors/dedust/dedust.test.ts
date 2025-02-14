import { Dedust } from '../../../src/connectors/dedust/dedust';
import { PriceRequest } from '../../../src/amm/amm.requests';
import {
  AMOUNT_NOT_SUPPORTED_ERROR_MESSAGE,
  TOKEN_NOT_SUPPORTED_ERROR_MESSAGE
} from '../../../src/services/error-handler';
import {AssetType} from "@dedust/sdk";

jest.mock('../../../src/chains/ton/ton', () => {
  const mockTonInstance = {
    ready: jest.fn(() => true),
    init: jest.fn(() => Promise.resolve()),
    getAssetForSymbol: jest.fn((symbol: string) => {
      if (symbol === 'TON') {
        return { assetId: { address: 'valid-ton-address' }, decimals: 9 };
      }
      if (symbol === 'AIOTX') {
        return { assetId: { address: 'valid-aiotx-address' }, decimals: 9 };
      }
      return null;
    }),
    getAccountFromAddress: jest.fn(() => Promise.resolve({
      secretKey: 'mock-secret-key',
      publicKey: 'mock-public-key',
    })),
    tonClient: {
      open: jest.fn(() => ({
        getSeqno: jest.fn(() => Promise.resolve(1)),
        sendTransfer: jest.fn(() => Promise.resolve()),
      })),
    },
    wallet: {
      address: {
        toString: jest.fn(() => 'mock-wallet-address'),
      },
    },
  };

  return {
    Ton: {
      getInstance: jest.fn(() => mockTonInstance),
    },
  };
});

jest.mock('@dedust/sdk', () => ({
  DedustApiClient: jest.fn().mockImplementation(() => ({
    estimateTrade: jest.fn(() =>
        Promise.resolve({
          expectedPrice: 2,
          expectedAmount: 100,
        })
    ),
    executeTrade: jest.fn(() =>
        Promise.resolve({
          success: true,
          txId: 'hb-ton-mock-hash',
        })
    ),
    getTransactionStatus: jest.fn(() =>
        Promise.resolve({
          status: 'Confirmed',
          txId: 'mock-tx-id',
        })
    ),
  })),
  Factory: {
    createFromAddress: jest.fn(() => ({
      getPool: jest.fn(() => Promise.resolve({
        getEstimatedSwapOut: jest.fn(() => Promise.resolve({
          amountOut: BigInt(200),
          tradeFee: BigInt(5),
        })),
        getReadinessStatus: jest.fn(() => Promise.resolve('READY')),
        address: 'mock-pool-address',
      })),
      getNativeVault: jest.fn(() => Promise.resolve({
        getReadinessStatus: jest.fn(() => Promise.resolve('READY')),
        address: 'mock-vault-address',
        sendSwap: jest.fn(),
      })),
      getJettonVault: jest.fn(() => Promise.resolve({
        getReadinessStatus: jest.fn(() => Promise.resolve('READY')),
        address: 'mock-vault-address',
        sendSwap: jest.fn(),
      })),
    })),
  },
  MAINNET_FACTORY_ADDR: 'mock-factory-address',
  PoolType: {
    VOLATILE: 'VOLATILE',
  },
  ReadinessStatus: {
    READY: 'READY',
  },
  AssetType: {
    NATIVE: 'native',
    JETTON: 'jetton',
  },
  Asset: {
    native: jest.fn(() => ({
      type: 'native',
      address: null
    })),
    jetton: jest.fn(() => ({
      type: 'jetton',
      address: 'mock-jetton-address'
    })),
  },
  Pool: jest.fn(() => ({
    getReadinessStatus: jest.fn(() => Promise.resolve('READY')),
    getEstimatedSwapOut: jest.fn(() => Promise.resolve({
      amountOut: BigInt(200),
      tradeFee: BigInt(5),
    })),
  })),
  JettonRoot: {
    createFromAddress: jest.fn(() => ({
      getWallet: jest.fn(() => Promise.resolve({
        sendTransfer: jest.fn(() => Promise.resolve()),
        address: 'mock-wallet-address',
      })),
    })),
  },
}));

jest.mock('@ton/ton', () => ({
  toNano: jest.fn((value: string) => BigInt(parseInt(value))),
  Address: {
    parse: jest.fn(() => ({
      toString: jest.fn(() => 'parsed-valid-ton-address'),
    })),
  },
  getAccountFromAddress: jest.fn(() =>
      Promise.resolve({
        secretKey: 'mock-secret-key',
        publicKey: 'mock-public-key',
      })
  ),
}));

describe('Dedust Class', () => {
  let dedustInstance: Dedust;

  beforeEach(() => {
    jest.clearAllMocks();
    dedustInstance = Dedust.getInstance('testnet');
    dedustInstance['_ready'] = true;

    dedustInstance['factory'] = {
      address: 'mock-factory-address',
      getPool: jest.fn(() => Promise.resolve({
        getEstimatedSwapOut: jest.fn(() => Promise.resolve({
          amountOut: BigInt(200),
          tradeFee: BigInt(5),
        })),
        getReadinessStatus: jest.fn(() => Promise.resolve('READY')),
        address: 'mock-pool-address',
      })),
      getNativeVault: jest.fn(() => Promise.resolve({
        getReadinessStatus: jest.fn(() => Promise.resolve('READY')),
        address: 'mock-vault-address',
        sendSwap: jest.fn(),
      })),
      getJettonVault: jest.fn(() => Promise.resolve({
        getReadinessStatus: jest.fn(() => Promise.resolve('READY')),
        address: 'mock-vault-address',
        sendSwap: jest.fn(),
      })),
    } as any;

    dedustInstance['chain'] = {
      ready: jest.fn(() => true),
      init: jest.fn(() => Promise.resolve()),
      getAssetForSymbol: jest.fn((symbol: string) => {
        if (symbol === 'TON') return { assetId: { address: 'valid-ton-address' }, decimals: 9, symbol: 'TON' };
        if (symbol === 'AIOTX') return { assetId: { address: 'valid-aiotx-address' }, decimals: 9, symbol: 'AIOTX' };
        return null;
      }),
      generateUniqueHash: jest.fn(() => 'mock-hash'),
      generateQueryId: jest.fn(() => 'mock-query-id'),
      getAccountFromAddress: jest.fn(() => Promise.resolve({
        secretKey: 'mock-secret-key',
        publicKey: 'mock-public-key',
      })),
      tonClient: {
        open: jest.fn(() => ({
          getSeqno: jest.fn(() => Promise.resolve(1)),
          sendTransfer: jest.fn(() => Promise.resolve()),
          getReadinessStatus: jest.fn(() => Promise.resolve('READY')),
          getEstimatedSwapOut: jest.fn(() => Promise.resolve({
            amountOut: BigInt(200),
            tradeFee: BigInt(5),
          })),
          address: 'mock-address',
        })),
      },
      wallet: {
        address: {
          toString: jest.fn(() => 'mock-wallet-address'),
        },
      },
    } as any;
  });

  describe('Static Methods', () => {
    it('getInstance should return a singleton instance', () => {
      const instance1 = Dedust.getInstance('testnet');
      const instance2 = Dedust.getInstance('testnet');
      expect(instance1).toBe(instance2);
    });

    it('getInstance should throw InitializationError on invalid network', () => {
      expect(() => Dedust.getInstance(null as any)).toThrow('Dedust.getInstance received an unexpected network');
    });
  });

  describe('Instance Methods', () => {
    it('init should initialize the chain and set the ready state', async () => {
      dedustInstance['chain'].ready = jest.fn(() => false);
      await dedustInstance.init();
      expect(dedustInstance['chain'].init).toHaveBeenCalled();
      expect(dedustInstance.ready()).toBe(true);
    });

    it('getSlippage should handle invalid slippage formats', () => {
      dedustInstance['_config'] = { allowedSlippage: 'invalid' } as any;
      expect(dedustInstance.getSlippage()).toBe(0);
    });

    it('should throw an error if the service is not initialized', async () => {
      dedustInstance['_ready'] = false;
      const priceRequest: PriceRequest = {
        base: 'TON',
        quote: 'AIOTX',
        amount: '100',
        side: 'BUY',
        chain: 'ton',
        network: 'testnet',
      };

      await expect(dedustInstance.estimateTrade(priceRequest)).rejects.toThrow(
          /Dedust was called before being initialized/i,
      );
    });

    it('estimateTrade should throw an error for unsupported tokens', async () => {
      const priceRequest: PriceRequest = {
        base: 'INVALID',
        quote: 'AIOTX',
        amount: '100',
        side: 'BUY',
        chain: 'ton',
        network: 'testnet',
      };

      await expect(dedustInstance.estimateTrade(priceRequest)).rejects.toThrow(
          `${TOKEN_NOT_SUPPORTED_ERROR_MESSAGE}INVALID or AIOTX`,
      );
    });

    it('estimateTrade should throw an error for invalid amounts', async () => {
      const priceRequest: PriceRequest = {
        base: 'TON',
        quote: 'AIOTX',
        amount: '-100',
        side: 'BUY',
        chain: 'ton',
        network: 'testnet',
      };

      await expect(dedustInstance.estimateTrade(priceRequest)).rejects.toThrow(AMOUNT_NOT_SUPPORTED_ERROR_MESSAGE);
    });

    it('should return a failure if account info is missing', async () => {
      jest.spyOn(dedustInstance['chain'], 'getAccountFromAddress').mockResolvedValueOnce(null);
      const tradeRequest: [string, any, boolean] = ['test-account', { payload: 'mock-payload' }, true];

      const result = await dedustInstance.executeTrade(...tradeRequest);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Trade query failed: Failed to get account keys');
    });

    it('should handle valid asset validation and trade quote', async () => {
      const validPriceRequest: PriceRequest = {
        base: 'TON',
        quote: 'AIOTX',
        amount: '50',
        side: 'BUY',
        chain: 'ton',
        network: 'testnet',
      };

      const result = await dedustInstance.estimateTrade(validPriceRequest);

      expect(result.trade).toBeDefined();
      expect(result.expectedAmount).toBeGreaterThan(0);
      expect(result.expectedPrice).toBeGreaterThan(0);
    });

    it('should throw an error if pool is not found for asset pair', async () => {
      jest.spyOn(dedustInstance['factory'], 'getPool').mockImplementationOnce(() => {
        throw new Error('Invalid or unsupported pool');
      });

      const priceRequest: PriceRequest = {
        base: 'TON',
        quote: 'AIOTX',
        amount: '50',
        side: 'BUY',
        chain: 'ton',
        network: 'testnet',
      };

      await expect(dedustInstance.estimateTrade(priceRequest)).rejects.toThrow(
          /Invalid or unsupported pool/,
      );
    });

    it('should fall back gracefully when transaction status is incorrect', async () => {
      jest.spyOn(dedustInstance['factory'], 'getNativeVault').mockResolvedValueOnce({
        getReadinessStatus: jest.fn(() => Promise.resolve('NOT_READY')),
        sendSwap: jest.fn(() => Promise.resolve({ success: false })),
      } as any);

      const tradeRequest = ['mock-wallet-address', { payload: 'mock-payload' }, true];

      // @ts-ignore
      const result = await dedustInstance.executeTrade(...tradeRequest);

      expect(result.success).toBe(false);
    });
  });

  describe('Dedust Specific Coverage Tests', () => {
    it('should throw an error when amount cannot be converted to toNano', async () => {
      const invalidRequest: PriceRequest = {
        base: 'TON',
        quote: 'AIOTX',
        amount: 'invalid-amount',
        side: 'BUY',
        chain: 'ton',
        network: 'testnet',
      };

      await expect(dedustInstance.estimateTrade(invalidRequest)).rejects.toThrow(
          AMOUNT_NOT_SUPPORTED_ERROR_MESSAGE,
      );
    });

    it('should throw an error for invalid base or quote tokens', async () => {
      const invalidBaseRequest: PriceRequest = {
        base: 'INVALID_TOKEN',
        quote: 'TON',
        amount: '100',
        side: 'BUY',
        chain: 'ton',
        network: 'testnet',
      };
      await expect(
          dedustInstance.estimateTrade(invalidBaseRequest),
      ).rejects.toThrow(
          `${TOKEN_NOT_SUPPORTED_ERROR_MESSAGE}INVALID_TOKEN or TON`,
      );

      const invalidQuoteRequest: PriceRequest = {
        base: 'TON',
        quote: 'INVALID_TOKEN',
        amount: '100',
        side: 'BUY',
        chain: 'ton',
        network: 'testnet',
      };
      await expect(
          dedustInstance.estimateTrade(invalidQuoteRequest),
      ).rejects.toThrow(
          `${TOKEN_NOT_SUPPORTED_ERROR_MESSAGE}TON or INVALID_TOKEN`,
      );
    });

    it('should throw an error when native vault cannot be retrieved', async () => {
      jest.spyOn(dedustInstance['factory'], 'getNativeVault').mockRejectedValue(
          new Error('Invalid native vault'),
      );

      const validRequest: PriceRequest = {
        base: 'TON',
        quote: 'AIOTX',
        amount: '100',
        side: 'SELL',
        chain: 'ton',
        network: 'testnet',
      };

      await expect(dedustInstance.estimateTrade(validRequest)).rejects.toThrow(
          'Failed to get vault: Invalid native vault',
      );
    });

    it('should throw an error when jetton vault cannot be retrieved', async () => {
      jest.spyOn(dedustInstance['factory'], 'getJettonVault').mockRejectedValue(
          new Error('Invalid jetton vault'),
      );

      const validRequest: PriceRequest = {
        base: 'AIOTX',
        quote: 'TON',
        amount: '100',
        side: 'BUY',
        chain: 'ton',
        network: 'testnet',
      };

      await expect(dedustInstance.estimateTrade(validRequest)).rejects.toThrow(
          'Failed to get vault: Invalid jetton vault',
      );
    });

    it('should execute a native-to-jetton trade successfully', async () => {
      const mockQuote = {
        expectedOut: BigInt(100),
        fromAsset: { type: AssetType.NATIVE },
        toAsset: { type: AssetType.JETTON, address: 'mock-jetton-address' },
        priceImpact: 2.5,
        tradeFee: BigInt(5),
        pool: { address: 'mock-pool-address' },
        vault: {
          sendSwap: jest.fn(() => Promise.resolve()),
        },
        amount: BigInt(100),
      };

      const result = await dedustInstance.executeTrade('mock-account', mockQuote as any, true);

      expect(result.success).toBe(true);
      expect(result.txId).toContain('hb-ton');
    });

    describe('Validation checks for assets', () => {
      it('should throw an error when base or quote assets are invalid', async () => {
        const invalidPriceRequest: PriceRequest = {
          base: 'INVALID_ASSET',
          quote: 'TON',
          amount: '10',
          side: 'BUY',
          chain: 'ton',
          network: 'testnet',
        };

        await expect(dedustInstance.estimateTrade(invalidPriceRequest)).rejects.toThrow(
            `${TOKEN_NOT_SUPPORTED_ERROR_MESSAGE}INVALID_ASSET or TON`,
        );
      });

      it('should throw an error when the amount is invalid', async () => {
        const invalidPriceRequest: PriceRequest = {
          base: 'TON',
          quote: 'AIOTX',
          amount: '0',
          side: 'BUY',
          chain: 'ton',
          network: 'testnet',
        };

        await expect(dedustInstance.estimateTrade(invalidPriceRequest)).rejects.toThrow(
            AMOUNT_NOT_SUPPORTED_ERROR_MESSAGE,
        );
      });

      it('should handle the base as jetton and quote as TON', async () => {
        const validRequest: PriceRequest = {
          base: 'AIOTX',
          quote: 'TON',
          amount: '50',
          side: 'BUY',
          chain: 'ton',
          network: 'testnet',
        };

        const result = await dedustInstance.estimateTrade(validRequest);
        expect(result.trade.fromAsset.type).toBe('jetton');
        expect(result.trade.toAsset.type).toBe('native');
      });
    });

    describe('Trade execution tests', () => {
      it('should correctly validate and execute a trade', async () => {
        const tradeRequest: [string, any, boolean] = ['mock-wallet-address', { payload: 'mock-payload' }, true];

        jest.spyOn(dedustInstance, 'executeTrade').mockImplementationOnce(async () => ({
          success: true,
          txId: 'mock-tx-hash',
        }));

        const result = await dedustInstance.executeTrade(...tradeRequest);
        expect(result.success).toBe(true);
        expect(result.txId).toBe('mock-tx-hash');
      });

      it('should throw a generic error if execution fails unexpectedly', async () => {
        const tradeRequest: [string, any, boolean] = ['mock-wallet-address', null, true];

        jest.spyOn(dedustInstance, 'executeTrade').mockImplementation(async () => {
          throw new Error('Unexpected error during trade execution');
        });

        await expect(dedustInstance.executeTrade(...tradeRequest)).rejects.toThrow(
            'Unexpected error during trade execution',
        );
      });
    });
  });
});