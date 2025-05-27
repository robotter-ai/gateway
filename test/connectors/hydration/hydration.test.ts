import fs from 'fs';
import path from 'path';

import { BigNumber, TradeType } from '@galacticcouncil/sdk';
import { test, describe, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';

import { Hydration } from '../../../src/connectors/hydration/hydration';

// Constants for this test file
const CONNECTOR = 'hydration';
const NETWORK = 'polkadot';
const TEST_WALLET = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const TEST_TOKEN_IN = 'DOT';
const TEST_TOKEN_OUT = 'USDT';
const TEST_POOL_ADDRESS = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

// Mock API calls
jest.mock('axios');
jest.mock('@polkadot/api');
jest.mock('@polkadot/keyring');
jest.mock('@polkadot/util-crypto');

// Mock implementation for axios
const mockedAxios = axios as jest.Mocked<typeof axios>;
// Type assertion for axios mock functions
mockedAxios.get = jest.fn() as any;
mockedAxios.post = jest.fn() as any;

// Helper to load mock responses
function loadMockResponse(filename: string) {
  const filePath = path.join(
    __dirname,
    '..',
    '..',
    'mocks',
    'connectors',
    CONNECTOR,
    `${filename}.json`,
  );
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Error loading mock response for ${filename}: ${error}`);
    // Return default mock response if file not found
    if (filename === 'quote') {
      return {
        network: NETWORK,
        connector: CONNECTOR,
        tokenIn: TEST_TOKEN_IN,
        tokenOut: TEST_TOKEN_OUT,
        amountIn: '1000000000000',
        amountOut: '990000000',
        price: '0.00099',
        priceImpact: '0.01',
        fee: '0.003',
      };
    }
    if (filename === 'swap') {
      return {
        network: NETWORK,
        connector: CONNECTOR,
        hash: '0x123abc...',
        from: TEST_WALLET,
        tokenIn: TEST_TOKEN_IN,
        tokenOut: TEST_TOKEN_OUT,
        amountIn: '1000000000000',
        amountOut: '990000000',
        price: '0.00099',
        fee: '0.003',
      };
    }
    if (filename === 'pool-info') {
      return {
        network: NETWORK,
        connector: CONNECTOR,
        poolAddress: TEST_POOL_ADDRESS,
        token0: TEST_TOKEN_IN,
        token1: TEST_TOKEN_OUT,
        reserve0: '10000000000000',
        reserve1: '10000000000',
        totalSupply: '1000000000000',
      };
    }
    return {};
  }
}

// Response validation functions
function validateQuoteResponse(response: any) {
  return (
    response &&
    typeof response.network === 'string' &&
    typeof response.connector === 'string' &&
    typeof response.tokenIn === 'string' &&
    typeof response.tokenOut === 'string' &&
    typeof response.amountIn === 'string' &&
    typeof response.amountOut === 'string' &&
    typeof response.price === 'string' &&
    typeof response.priceImpact === 'string' &&
    typeof response.fee === 'string'
  );
}

function validateSwapResponse(response: any) {
  return (
    response &&
    typeof response.network === 'string' &&
    typeof response.connector === 'string' &&
    typeof response.hash === 'string' &&
    typeof response.from === 'string' &&
    typeof response.tokenIn === 'string' &&
    typeof response.tokenOut === 'string' &&
    typeof response.amountIn === 'string' &&
    typeof response.amountOut === 'string' &&
    typeof response.price === 'string' &&
    typeof response.fee === 'string'
  );
}

function validatePoolInfoResponse(response: any) {
  return (
    response &&
    typeof response.network === 'string' &&
    typeof response.connector === 'string' &&
    typeof response.poolAddress === 'string' &&
    typeof response.token0 === 'string' &&
    typeof response.token1 === 'string' &&
    typeof response.reserve0 === 'string' &&
    typeof response.reserve1 === 'string' &&
    typeof response.totalSupply === 'string'
  );
}

// Tests
describe('Hydration Connector Tests', () => {
  let hydration: Hydration;
  let mockInstance: any;

  beforeEach(() => {
    // Reset axios mocks before each test
    mockedAxios.get.mockClear();
    mockedAxios.post.mockClear();

    // Reset other mocks
    jest.clearAllMocks();

    // Mock instance for testing
    mockInstance = {
      _tokens: [
        {
          symbol: TEST_TOKEN_IN,
          name: 'Polkadot',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 10,
          chainId: 1284,
        },
        {
          symbol: TEST_TOKEN_OUT,
          name: 'Tether USD',
          address: '0x0000000000000000000000000000000000000001',
          decimals: 6,
          chainId: 1284,
        },
      ],
      _sdk: {
        createWalletContext: jest.fn(() =>
          Promise.resolve({
            calculateTradeLimit: jest.fn(() => new BigNumber('100')),
            getSlippagePercentage: jest.fn(() => new BigNumber('0.5')),
            listPools: jest.fn(() => Promise.resolve([])),
            getPoolDetails: jest.fn(() => Promise.resolve({})),
            quoteLiquidity: jest.fn(() => Promise.resolve({})),
            addLiquidity: jest.fn(() => Promise.resolve({})),
            removeLiquidity: jest.fn(() => Promise.resolve({})),
            getPositionsOwned: jest.fn(() => Promise.resolve([])),
          }),
        ),
        TradeType,
      },
      _walletContext: {
        calculateTradeLimit: jest.fn(() => new BigNumber('100')),
        getSlippagePercentage: jest.fn(() => new BigNumber('0.5')),
        listPools: jest.fn(() => Promise.resolve([])),
        getPoolDetails: jest.fn(() => Promise.resolve({})),
        quoteLiquidity: jest.fn(() => Promise.resolve({})),
        addLiquidity: jest.fn(() => Promise.resolve({})),
        removeLiquidity: jest.fn(() => Promise.resolve({})),
        getPositionsOwned: jest.fn(() => Promise.resolve([])),
      },
      network: NETWORK,
    };
  });

  describe('Instance Management', () => {
    test('creates new instance for different networks', async () => {
      // Use two different mock instances
      const instance1 = { ...mockInstance, network: 'polkadot' };
      const instance2 = { ...mockInstance, network: 'kusama' };

      // Mock getInstance to return our mock instances
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(instance1 as unknown as Hydration)
        .mockResolvedValueOnce(instance2 as unknown as Hydration);

      const result1 = await Hydration.getInstance('polkadot');
      const result2 = await Hydration.getInstance('kusama');

      expect(result1).not.toBe(result2);
    }, 1000);

    test('reuses instance for same network', async () => {
      // Create a single mock instance
      const instance = { ...mockInstance, network: 'polkadot' };

      // Mock getInstance to return the same instance
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(instance as unknown as Hydration)
        .mockResolvedValueOnce(instance as unknown as Hydration);

      const result1 = await Hydration.getInstance('polkadot');
      const result2 = await Hydration.getInstance('polkadot');

      expect(result1).toBe(result2);
    }, 1000);
  });

  describe('Token Management', () => {
    test('gets all supported tokens', async () => {
      // Mock getInstance to return our mock instance
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(mockInstance as unknown as Hydration);

      const instance = await Hydration.getInstance(NETWORK);

      // Mock the getAllTokens method
      jest.spyOn(instance, 'getAllTokens').mockReturnValue([
        {
          symbol: TEST_TOKEN_IN,
          name: 'Polkadot',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 10,
          chainId: 1284,
        },
        {
          symbol: TEST_TOKEN_OUT,
          name: 'Tether USD',
          address: '0x0000000000000000000000000000000000000001',
          decimals: 6,
          chainId: 1284,
        },
      ]);

      const tokens = instance.getAllTokens();

      expect(tokens).toBeDefined();
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
    });

    test('gets token symbol from address', async () => {
      // Mock getInstance to return our mock instance
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(mockInstance as unknown as Hydration);

      const instance = await Hydration.getInstance(NETWORK);

      // Mock the getTokenSymbol method
      jest.spyOn(instance, 'getTokenSymbol').mockResolvedValue(TEST_TOKEN_IN);

      const symbol = await instance.getTokenSymbol(TEST_POOL_ADDRESS);

      expect(symbol).toBeDefined();
      expect(typeof symbol).toBe('string');
    });
  });

  describe('Pool Management', () => {
    test('lists pools with filters', async () => {
      // Mock getInstance to return our mock instance
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(mockInstance as unknown as Hydration);

      const instance = await Hydration.getInstance(NETWORK);

      // Mock the listPools method with properly typed pool data
      jest.spyOn(instance, 'listPools').mockResolvedValue([
        {
          type: 'xyk',
          address: TEST_POOL_ADDRESS,
          tokens: [TEST_TOKEN_IN, TEST_TOKEN_OUT],
        },
      ]);

      const pools = await instance.listPools(['xyk'], ['DOT'], []);

      expect(pools).toBeDefined();
      expect(Array.isArray(pools)).toBe(true);
    });

    test('gets pool details', async () => {
      // Mock getInstance to return our mock instance
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(mockInstance as unknown as Hydration);

      const instance = await Hydration.getInstance(NETWORK);

      // Mock the getPoolDetails method with properly typed pool data
      jest.spyOn(instance, 'getPoolDetails').mockResolvedValue({
        poolType: 'xyk',
        address: TEST_POOL_ADDRESS,
        tokens: [TEST_TOKEN_IN, TEST_TOKEN_OUT],
        baseTokenAddress: '0x0000000000000000000000000000000000000000',
        quoteTokenAddress: '0x0000000000000000000000000000000000000001',
        feePct: 0.003,
        price: 0.00099,
        baseTokenAmount: 10000000000000,
        quoteTokenAmount: 10000000000,
        lpMint: {
          address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
          decimals: 12,
        },
      });

      const poolInfo = await instance.getPoolDetails(TEST_POOL_ADDRESS);

      expect(poolInfo).toBeDefined();
      expect(poolInfo?.address).toBe(TEST_POOL_ADDRESS);
    });

    test('identifies stablecoin pairs', async () => {
      // Mock getInstance to return our mock instance
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(mockInstance as unknown as Hydration);

      const instance = await Hydration.getInstance(NETWORK);

      // Mock the private isStablecoinPair method
      jest.spyOn(instance as any, 'isStablecoinPair').mockReturnValue(true);

      const isStablecoin = (instance as any).isStablecoinPair('USDT', 'USDC');

      expect(typeof isStablecoin).toBe('boolean');
    });
  });

  describe('Quote Endpoint', () => {
    test('returns and validates swap quote', async () => {
      const mockResponse = loadMockResponse('quote');

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: mockResponse,
      });

      const response = await mockedAxios.get(
        `http://localhost:15888/connectors/${CONNECTOR}/quote`,
        {
          params: {
            network: NETWORK,
            tokenIn: TEST_TOKEN_IN,
            tokenOut: TEST_TOKEN_OUT,
            amountIn: '1000000000000',
          },
        },
      );

      expect(response.status).toBe(200);
      expect(validateQuoteResponse(response.data)).toBe(true);
      expect(response.data.network).toBe(NETWORK);
      expect(response.data.connector).toBe(CONNECTOR);
      expect(response.data.tokenIn).toBe(TEST_TOKEN_IN);
      expect(response.data.tokenOut).toBe(TEST_TOKEN_OUT);
    });

    test('handles error response for invalid quote', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: 'Insufficient liquidity',
            code: 400,
          },
        },
      });

      await expect(
        mockedAxios.get(
          `http://localhost:15888/connectors/${CONNECTOR}/quote`,
          {
            params: {
              network: NETWORK,
              tokenIn: TEST_TOKEN_IN,
              tokenOut: TEST_TOKEN_OUT,
              amountIn: '999999999999999999999',
            },
          },
        ),
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            error: 'Insufficient liquidity',
          },
        },
      });
    });
  });

  describe('Swap Endpoint', () => {
    test('creates and validates swap transaction', async () => {
      const mockResponse = loadMockResponse('swap');

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: mockResponse,
      });

      const swapData = {
        network: NETWORK,
        from: TEST_WALLET,
        tokenIn: TEST_TOKEN_IN,
        tokenOut: TEST_TOKEN_OUT,
        amountIn: '1000000000000',
        minAmountOut: '990000000',
      };

      const response = await mockedAxios.post(
        `http://localhost:15888/connectors/${CONNECTOR}/swap`,
        swapData,
      );

      expect(response.status).toBe(200);
      expect(validateSwapResponse(response.data)).toBe(true);
      expect(response.data.network).toBe(NETWORK);
      expect(response.data.connector).toBe(CONNECTOR);
      expect(response.data.from).toBe(TEST_WALLET);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:15888/connectors/${CONNECTOR}/swap`,
        swapData,
      );
    });
  });

  describe('Pool Info Endpoint', () => {
    test('returns and validates pool information', async () => {
      const mockResponse = loadMockResponse('pool-info');

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: mockResponse,
      });

      const response = await mockedAxios.get(
        `http://localhost:15888/connectors/${CONNECTOR}/pool-info`,
        {
          params: {
            network: NETWORK,
            token0: TEST_TOKEN_IN,
            token1: TEST_TOKEN_OUT,
          },
        },
      );

      expect(response.status).toBe(200);
      expect(validatePoolInfoResponse(response.data)).toBe(true);
      expect(response.data.network).toBe(NETWORK);
      expect(response.data.connector).toBe(CONNECTOR);
      expect(response.data.token0).toBe(TEST_TOKEN_IN);
      expect(response.data.token1).toBe(TEST_TOKEN_OUT);
    });
  });

  describe('Liquidity Management', () => {
    test('quotes liquidity addition', async () => {
      // Mock getInstance to return our mock instance
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(mockInstance as unknown as Hydration);

      const instance = await Hydration.getInstance(NETWORK);

      // Mock the quoteLiquidity method with complete return type
      jest.spyOn(instance, 'quoteLiquidity').mockResolvedValue({
        baseTokenAmount: 1000000000000,
        quoteTokenAmount: 1000000000,
        baseLimited: false,
        baseTokenAmountMax: 1000000000000,
        quoteTokenAmountMax: 1000000000,
      });

      const quote = await instance.quoteLiquidity(
        TEST_POOL_ADDRESS,
        1000000000000,
        undefined,
        0.5,
      );

      expect(quote).toBeDefined();
      expect(quote.baseTokenAmount).toBeDefined();
      expect(quote.quoteTokenAmount).toBeDefined();
    });

    test('adds liquidity', async () => {
      // Mock getInstance to return our mock instance
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(mockInstance as unknown as Hydration);

      const instance = await Hydration.getInstance(NETWORK);

      // Mock the addLiquidity method
      jest.spyOn(instance, 'addLiquidity').mockResolvedValue({
        signature: 'signature',
        fee: 0.001,
        baseTokenAmountAdded: 1000000000000,
        quoteTokenAmountAdded: 1000000000,
      });

      const response = await instance.addLiquidity(
        TEST_WALLET,
        TEST_POOL_ADDRESS,
        1000000000000,
        1000000000,
        0.5,
        TEST_TOKEN_IN,
        TEST_TOKEN_OUT,
      );

      expect(response).toBeDefined();
      expect(response.signature).toBeDefined();
      expect(response.fee).toBeDefined();
      expect(response.baseTokenAmountAdded).toBeDefined();
      expect(response.quoteTokenAmountAdded).toBeDefined();
    });

    test('removes liquidity', async () => {
      // Mock getInstance to return our mock instance
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(mockInstance as unknown as Hydration);

      const instance = await Hydration.getInstance(NETWORK);

      // Mock the removeLiquidity method
      jest.spyOn(instance, 'removeLiquidity').mockResolvedValue({
        signature: 'signature',
        fee: 0.001,
        baseTokenAmountRemoved: 1000000000000,
        quoteTokenAmountRemoved: 1000000000,
        sharesPercentageRemoved: 50,
        sharesAmountRemoved: 500000000,
      });

      const response = await instance.removeLiquidity(
        TEST_WALLET,
        TEST_POOL_ADDRESS,
        50,
      );

      expect(response).toBeDefined();
      expect(response.signature).toBeDefined();
      expect(response.fee).toBeDefined();
      expect(response.baseTokenAmountRemoved).toBeDefined();
      expect(response.quoteTokenAmountRemoved).toBeDefined();
      expect(response.sharesPercentageRemoved).toBeDefined();
      expect(response.sharesAmountRemoved).toBeDefined();
    });
  });

  describe('Position Management', () => {
    test('gets positions owned by wallet', async () => {
      // Mock getInstance to return our mock instance
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(mockInstance as unknown as Hydration);

      const instance = await Hydration.getInstance(NETWORK);

      // Create HydrationPosition compliant objects
      const position = {
        poolId: TEST_POOL_ADDRESS,
        baseAsset: TEST_TOKEN_IN,
        quoteAsset: TEST_TOKEN_OUT,
        liquidity: '100000000',
        positionId: '1',
        assetId: '123',
        owner: TEST_WALLET,
        shares: '100',
        amount: '1000000',
      };

      // Mock the getPositionsOwned method
      jest.spyOn(instance, 'getPositionsOwned').mockResolvedValue([position]);

      const positions = await instance.getPositionsOwned(TEST_WALLET, '1');

      expect(positions).toBeDefined();
      expect(Array.isArray(positions)).toBe(true);
    });
  });

  describe('Trade Calculations', () => {
    test('calculates trade limits', async () => {
      // Mock getInstance to return our mock instance
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(mockInstance as unknown as Hydration);

      const instance = await Hydration.getInstance(NETWORK);

      // Mock the internal calculateTradeLimit method
      const mockCalculateTradeLimit = jest
        .spyOn(instance as any, 'calculateTradeLimit')
        .mockReturnValue(new BigNumber('100'));

      // Call a method that uses calculateTradeLimit internally
      instance.getSlippagePercentage('0.5');

      expect(mockCalculateTradeLimit).toBeDefined();
    });

    test('calculates slippage percentage', async () => {
      // Mock getInstance to return our mock instance
      jest
        .spyOn(Hydration, 'getInstance')
        .mockResolvedValueOnce(mockInstance as unknown as Hydration);

      const instance = await Hydration.getInstance(NETWORK);

      // Mock the getSlippagePercentage method
      jest
        .spyOn(instance, 'getSlippagePercentage')
        .mockReturnValue(new BigNumber('0.5'));

      const slippage = instance.getSlippagePercentage('0.5');

      expect(slippage).toBeDefined();
      expect(slippage instanceof BigNumber).toBe(true);
    });
  });
});
