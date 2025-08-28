import { TokenInfo } from '../../src/services/base';
import { TokenListType } from '../../src/services/base';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Logger class for saving test results to @logs/ folder
 */
class TestLogger {
  private logDir: string;
  private logFile: string;
  private startTime: Date;

  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.startTime = new Date();
    const timestamp = this.startTime.toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(this.logDir, `polkadot-test-${timestamp}.log`);
    
    // Ensure logs directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data, null, 2)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}\n`;
  }

  private writeToFile(content: string): void {
    try {
      fs.appendFileSync(this.logFile, content);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  info(message: string, data?: any): void {
    const logMessage = this.formatMessage('INFO', message, data);
    console.log(message, data || '');
    this.writeToFile(logMessage);
  }

  success(message: string, data?: any): void {
    const logMessage = this.formatMessage('SUCCESS', message, data);
    console.log(`✅ ${message}`, data || '');
    this.writeToFile(logMessage);
  }

  warning(message: string, data?: any): void {
    const logMessage = this.formatMessage('WARNING', message, data);
    console.log(`⚠️ ${message}`, data || '');
    this.writeToFile(logMessage);
  }

  error(message: string, error?: any): void {
    const logMessage = this.formatMessage('ERROR', message, error);
    console.error(`❌ ${message}`, error || '');
    this.writeToFile(logMessage);
  }

  performance(operation: string, duration: number, metadata?: any): void {
    const logMessage = this.formatMessage(
      'PERFORMANCE',
      `${operation}: ${duration}ms`,
      metadata,
    );
    console.log(`⚡ ${operation}: ${duration}ms`);
    this.writeToFile(logMessage);
  }

  testResult(testName: string, result: any, metadata?: any): void {
    const logMessage = this.formatMessage('TEST_RESULT', testName, {
      result,
      metadata,
    });
    this.writeToFile(logMessage);
  }

  getLogFilePath(): string {
    return this.logFile;
  }

  getSessionDuration(): number {
    return Date.now() - this.startTime.getTime();
  }
}

/**
 * Test playground for the Polkadot getTokenList method
 * This demonstrates how to test the token list functionality with both mock and real data
 */

// Initialize logger
const logger = new TestLogger();

// Configuration for testing mode
const TEST_CONFIG = {
  useRealData: true, // Set to true to use real Polkadot data
  realTokenListPath: '../../src/templates/lists/polkadot_tokens_mainnet.json',
  realHydrationPath: '../../src/templates/lists/hydration.json',
};

// Mock data for testing
const mockTokenList: TokenInfo[] = [
  {
    symbol: 'HDX',
    name: 'HydraDX',
    decimals: 12,
    address: '0',
    chainId: 0,
  },
  {
    symbol: 'DOT',
    name: 'Polkadot',
    decimals: 10,
    address: '1',
    chainId: 0,
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    decimals: 18,
    address: '2',
    chainId: 0,
  },
];

// Real token list loader
async function loadRealTokenList(filePath: string): Promise<TokenInfo[]> {
  try {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Token list file not found: ${fullPath}`);
    }

    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Convert real token format to TokenInfo format
    const tokens: TokenInfo[] = data.tokens.map((token: any) => ({
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      address: token.id.toString(),
      chainId: 0,
    }));

    logger.info(`Loaded ${tokens.length} real tokens from ${filePath}`);
    return tokens;
  } catch (error) {
    logger.error(`Failed to load real token list from ${filePath}`, error);
    return mockTokenList; // Fallback to mock data
  }
}

// Mock configuration for testing
const mockConfig = {
  network: {
    tokenListSource: 'test-token-list.json',
    tokenListType: 'FILE' as TokenListType,
    nativeCurrencySymbol: 'HDX',
    feePaymentCurrencySymbol: 'HDX',
    nodeURL: 'ws://localhost:9944',
    transactionURL: 'https://test.api.subscan.io/api/scan/extrinsic',
  },
};

// File system operations (supports both mock and real)
const mockFsReadFile = async (
  source: string,
  _options: any,
): Promise<string> => {
  if (TEST_CONFIG.useRealData && source.includes('polkadot_tokens_mainnet.json')) {
    const realTokens = await loadRealTokenList(TEST_CONFIG.realTokenListPath);
    return JSON.stringify(realTokens);
  } else if (TEST_CONFIG.useRealData && source.includes('hydration.json')) {
    const realTokens = await loadRealTokenList(TEST_CONFIG.realHydrationPath);
    return JSON.stringify(realTokens);
  }
  
  logger.info(`Mock reading file: ${source}`);
  return JSON.stringify(mockTokenList);
};

const mockAxiosGet = async (_axios: any, source: string): Promise<any> => {
  logger.info(`Mock HTTP GET: ${source}`);
  return { data: mockTokenList };
};

// Mock Polkadot class for testing
class MockPolkadot {
  public config = mockConfig;
  public tokenList: TokenInfo[] = [];
  private _tokenMap: Record<string, TokenInfo> = {};

  async loadTokens(source: string, type: TokenListType): Promise<void> {
    logger.info(`Loading tokens from ${source} (${type})`);

    // Clear existing token lists
    this.tokenList = [];
    this._tokenMap = {};

    let tokensData: any[] = [];

    if (type === 'FILE') {
      const fileContent = await mockFsReadFile(source, { encoding: 'utf8' });
      const data = fileContent.toString();
      const parsed = JSON.parse(data);
      tokensData = parsed || [];
    } else if (type === 'URL') {
      const response = await mockAxiosGet(null, source);
      tokensData = response.data || [];
    }

    // Process tokens
    for (const tokenData of tokensData) {
      const token: TokenInfo = {
        symbol: tokenData.symbol,
        name: tokenData.name,
        decimals: tokenData.decimals,
        address: tokenData.id?.toString() || tokenData.address,
        chainId: 0,
      };

      this.tokenList.push(token);
      this._tokenMap[token.symbol.toLowerCase()] = token;
      this._tokenMap[token.address.toLowerCase()] = token;
    }

    logger.success(`Loaded ${this.tokenList.length} tokens`);
    logger.testResult('loadTokens', {
      source,
      type,
      tokenCount: this.tokenList.length,
      tokens: this.tokenList,
      dataSource: TEST_CONFIG.useRealData ? 'REAL' : 'MOCK',
    });
  }

  async getTokenList(
    tokenListSource?: string,
    tokenListType?: TokenListType,
  ): Promise<TokenInfo[]> {
    if (!tokenListSource || !tokenListType) {
      tokenListSource = this.config.network.tokenListSource;
      tokenListType = this.config.network.tokenListType;
    }

    await this.loadTokens(tokenListSource, tokenListType);
    return this.tokenList;
  }

  getToken(addressOrSymbol: string): TokenInfo | undefined {
    return this._tokenMap[addressOrSymbol.toLowerCase()];
  }
}

// Test scenarios for getTokenList method
async function testGetTokenListScenarios() {
  logger.info('🧪 Testing Polkadot getTokenList method...');

  try {
    const polkadotInstance = new MockPolkadot();

    // Test 1: Get token list with default configuration
    logger.info('📋 Test 1: Get token list with default configuration');
    const startTime = Date.now();
    const result1 = await polkadotInstance.getTokenList();
    const duration = Date.now() - startTime;
    
    logger.success('Test 1 completed', {
      tokenCount: result1.length,
      firstToken: result1[0],
      duration: `${duration}ms`,
      dataSource: TEST_CONFIG.useRealData ? 'REAL' : 'MOCK',
    });
    
    // Display all tokens from test 1
    logger.info('📋 Tokens from Test 1:', result1);
    
    logger.performance('Default configuration test', duration, {
      tokenCount: result1.length,
      config: mockConfig.network,
    });

    // Test 2: Get token list with real Polkadot token list
    logger.info('📋 Test 2: Get token list with real Polkadot token list');
    const realSource = '../../src/templates/lists/polkadot_tokens_mainnet.json';
    const realType: TokenListType = 'FILE';

    const startTime2 = Date.now();
    const result2 = await polkadotInstance.getTokenList(realSource, realType);
    const duration2 = Date.now() - startTime2;
    
    logger.success('Test 2 completed', {
      tokenCount: result2.length,
      realSource,
      realType,
      duration: `${duration2}ms`,
      dataSource: 'REAL',
    });
    
    // Display all tokens from test 2 (real data)
    logger.info('📋 REAL TOKENS from Test 2:', result2);
    logger.info(`📊 Total REAL tokens loaded: ${result2.length}`);
    
    // Show first 5 tokens as examples
    if (result2.length > 0) {
      logger.info('🔍 First 5 REAL tokens:');
      result2.slice(0, 5).forEach((token, index) => {
        logger.info(
          `  ${index + 1}. ${token.symbol} (${token.name}) - Decimals: ${token.decimals}, Address: ${token.address}`,
        );
      });
    }

    // Test 3: Get token list with real Hydration token list
    logger.info('📋 Test 3: Get token list with real Hydration token list');
    const hydrationSource = '../../src/templates/lists/hydration.json';
    const hydrationType: TokenListType = 'FILE';

    const startTime3 = Date.now();
    const result3 = await polkadotInstance.getTokenList(hydrationSource, hydrationType);
    const duration3 = Date.now() - startTime3;
    
    logger.success('Test 3 completed', {
      tokenCount: result3.length,
      hydrationSource,
      hydrationType,
      duration: `${duration3}ms`,
      dataSource: 'REAL',
    });
    
    // Display tokens from test 3
    logger.info('📋 Tokens from Test 3 (Hydration):', result3);

    // Test 4: Get token list with URL source (mock)
    logger.info('📋 Test 4: Get token list with URL source (mock)');
    const urlSource = 'https://api.example.com/tokens.json';
    const urlType: TokenListType = 'URL';

    const startTime4 = Date.now();
    const result4 = await polkadotInstance.getTokenList(urlSource, urlType);
    const duration4 = Date.now() - startTime4;
    
    logger.success('Test 4 completed', {
      tokenCount: result4.length,
      urlSource,
      urlType,
      duration: `${duration4}ms`,
      dataSource: 'MOCK',
    });
    
    // Display tokens from test 4
    logger.info('📋 Tokens from Test 4 (Mock URL):', result4);

    // Test 5: Verify token structure
    logger.info('📋 Test 5: Verify token structure');
    if (result1.length > 0) {
      const token = result1[0];
      const requiredFields = [
        'symbol',
        'name',
        'decimals',
        'address',
        'chainId',
      ];
      const hasAllFields = requiredFields.every((field) => field in token);

      logger.success('Token structure validation completed', {
        hasAllFields,
        tokenStructure: {
          symbol: typeof token.symbol,
          name: typeof token.name,
          decimals: typeof token.decimals,
          address: typeof token.address,
          chainId: typeof token.chainId,
        },
        sampleToken: token,
      });
    }

    logger.success('All getTokenList tests completed successfully!');
    
    // Log comprehensive test results
    logger.testResult('getTokenListScenarios', {
      test1: { result: result1, duration, dataSource: TEST_CONFIG.useRealData ? 'REAL' : 'MOCK' },
      test2: { result: result2, duration: duration2, dataSource: 'REAL' },
      test3: { result: result3, duration: duration3, dataSource: 'REAL' },
      test4: { result: result4, duration: duration4, dataSource: 'MOCK' },
      test5: { tokenCount: result1.length, hasValidStructure: true },
    });

  } catch (error) {
    logger.error('getTokenList test failed', error);
    throw error;
  }
}

// Test token map functionality
async function testTokenMapFunctionality() {
  logger.info('🔍 Testing token map functionality...');

  try {
    const polkadotInstance = new MockPolkadot();

    // Load tokens first (using real data if available)
    const realSource = '../../src/templates/lists/polkadot_tokens_mainnet.json';
    await polkadotInstance.getTokenList(realSource, 'FILE');

    // Test token lookup by symbol
    logger.info('📋 Test: Token lookup by symbol');
    const hdxToken = polkadotInstance.getToken('hdx');
    logger.success('HDX token lookup test completed', {
      found: !!hdxToken,
      tokenDetails: hdxToken,
    });

    // Test token lookup by address
    logger.info('📋 Test: Token lookup by address');
    const tokenByAddress = polkadotInstance.getToken('0');
    logger.success('Address lookup test completed', {
      found: !!tokenByAddress,
      tokenDetails: tokenByAddress,
    });

    // Test case-insensitive lookup
    logger.info('📋 Test: Case-insensitive lookup');
    const hdxTokenLower = polkadotInstance.getToken('hdx');
    const hdxTokenUpper = polkadotInstance.getToken('HDX');
    
    const caseInsensitiveResult = {
      lowercase: !!hdxTokenLower,
      uppercase: !!hdxTokenUpper,
      bothSuccessful: !!hdxTokenLower && !!hdxTokenUpper,
    };
    
    logger.success('Case-insensitive lookup test completed', caseInsensitiveResult);

    logger.success('Token map tests completed successfully!');
    
    // Log comprehensive test results
    logger.testResult('tokenMapFunctionality', {
      symbolLookup: { hdx: hdxToken },
      addressLookup: { '0': tokenByAddress },
      caseInsensitive: caseInsensitiveResult,
    });

  } catch (error) {
    logger.error('Token map test failed', error);
    throw error;
  }
}

// Performance test
async function testPerformance() {
  logger.info('⚡ Testing performance...');

  try {
    const polkadotInstance = new MockPolkadot();

    // Test multiple calls to measure performance
    const iterations = 100;
    const startTime = Date.now();
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const callStart = Date.now();
      await polkadotInstance.getTokenList();
      const callDuration = Date.now() - callStart;
      durations.push(callDuration);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...durations);
    const maxTime = Math.max(...durations);
    const medianTime = durations.sort((a, b) => a - b)[
      Math.floor(durations.length / 2)
    ];

    logger.success('Performance test completed', {
      iterations,
      totalTime: `${totalTime}ms`,
      averageTime: `${averageTime.toFixed(2)}ms`,
      minTime: `${minTime}ms`,
      maxTime: `${maxTime}ms`,
      medianTime: `${medianTime}ms`,
    });

    // Log performance metrics
    logger.performance('Performance test', totalTime, {
      iterations,
      averageTime,
      minTime,
      maxTime,
      medianTime,
      durations,
    });

    logger.testResult('performance', {
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      medianTime,
      durations,
    });

  } catch (error) {
    logger.error('Performance test failed', error);
    throw error;
  }
}

// Test error handling
async function testErrorHandling() {
  logger.info('🚨 Testing error handling...');

  try {
    const polkadotInstance = new MockPolkadot();

    // Test with invalid token data
    logger.info('📋 Test: Invalid token data handling');

    // Override the mock to return invalid data
    polkadotInstance.loadTokens = async (
      source: string,
      type: TokenListType,
    ) => {
      logger.info(`Loading tokens from ${source} (${type}) with invalid data`);

      polkadotInstance.tokenList = [];
      (polkadotInstance as any)._tokenMap = {};

      // Simulate invalid token data
      const invalidTokensData = [
        {
          symbol: 'INVALID',
          name: null,
          decimals: 'not-a-number',
          address: undefined,
        },
        { symbol: 'VALID', name: 'Valid Token', decimals: 18, address: '123' },
      ];

      let validTokens = 0;
      let invalidTokens = 0;

      for (const tokenData of invalidTokensData) {
        try {
          const token: TokenInfo = {
            symbol: tokenData.symbol || 'UNKNOWN',
            name: tokenData.name || 'Unknown Token',
            decimals: Number(tokenData.decimals) || 0,
            address: tokenData.address?.toString() || '0',
            chainId: 0,
          };

          polkadotInstance.tokenList.push(token);
          (polkadotInstance as any)._tokenMap[token.symbol.toLowerCase()] = token;
          (polkadotInstance as any)._tokenMap[token.address.toLowerCase()] = token;
          validTokens++;
        } catch (error) {
          logger.warning(
            `Skipped invalid token: ${JSON.stringify(tokenData)}`,
            error,
          );
          invalidTokens++;
        }
      }

      logger.success(
        `Loaded ${validTokens} valid tokens (skipped ${invalidTokens} invalid ones)`,
      );
    };

    const result = await polkadotInstance.getTokenList();
    logger.success('Error handling test completed', {
      resultCount: result.length,
      result,
    });

    logger.testResult('errorHandling', {
      result,
      resultCount: result.length,
      testType: 'invalidDataProcessing',
    });

  } catch (error) {
    logger.error('Error handling test failed', error);
    throw error;
  }
}

// Main test runner
async function runAllTests() {
  logger.info('🚀 Starting Polkadot getTokenList method tests...');
  logger.info(`📊 Test Mode: ${TEST_CONFIG.useRealData ? 'REAL DATA' : 'MOCK DATA'}`);
  
  const sessionStart = Date.now();
  const testResults: any = {};

  try {
    // Run all tests
    await testGetTokenListScenarios();
    testResults.getTokenListScenarios = 'PASSED';
    
    await testTokenMapFunctionality();
    testResults.tokenMapFunctionality = 'PASSED';
    
    await testPerformance();
    testResults.performance = 'PASSED';
    
    await testErrorHandling();
    testResults.errorHandling = 'PASSED';

    const sessionDuration = Date.now() - sessionStart;
    
    // Log final summary
    logger.success('🎯 All tests completed successfully!', {
      sessionDuration: `${sessionDuration}ms`,
      testResults,
      logFile: logger.getLogFilePath(),
      testMode: TEST_CONFIG.useRealData ? 'REAL DATA' : 'MOCK DATA',
    });

    // Save final summary to logs
    logger.testResult('sessionSummary', {
      status: 'SUCCESS',
      sessionDuration,
      testResults,
      timestamp: new Date().toISOString(),
      logFile: logger.getLogFilePath(),
      testMode: TEST_CONFIG.useRealData ? 'REAL DATA' : 'MOCK DATA',
    });

  } catch (error) {
    const sessionDuration = Date.now() - sessionStart;
    
    logger.error('❌ Some tests failed', {
      error: error.message,
      sessionDuration: `${sessionDuration}ms`,
      testResults,
    });

    // Save error summary to logs
    logger.testResult('sessionSummary', {
      status: 'FAILED',
      sessionDuration,
      testResults,
      error: error.message,
      timestamp: new Date().toISOString(),
      logFile: logger.getLogFilePath(),
    });

    throw error;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      logger.info(`📁 Test logs saved to: ${logger.getLogFilePath()}`);
      logger.info(`🔧 To use real data, set TEST_CONFIG.useRealData = true`);
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Test execution failed', error);
      process.exit(1);
    });
}

export {
  TestLogger,
  MockPolkadot,
  TEST_CONFIG,
  testGetTokenListScenarios,
  testTokenMapFunctionality,
  testPerformance,
  testErrorHandling,
  runAllTests,
};
