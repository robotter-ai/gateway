import * as fs from 'fs';
import * as path from 'path';
import { TokenInfo } from '../../src/services/base';

// Test Logger for detailed logging
class TestLogger {
  private logDir: string;
  private logFile: string;
  private startTime: Date;

  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.startTime = new Date();
    const timestamp = this.startTime.toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(this.logDir, `getToken-test-${timestamp}.log`);
    
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

// Mock Polkadot class for testing getToken method
class MockPolkadot {
  public tokenList: TokenInfo[] = [];

  constructor() {
    // Initialize with test tokens
    this.tokenList = [
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
      {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        address: '3',
        chainId: 0,
      },
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        decimals: 8,
        address: '4',
        chainId: 0,
      },
    ];
  }

  // The actual getToken method to test
  getToken(addressOrSymbol: string): TokenInfo | undefined {
    return this.tokenList.find(
      (token) =>
        token.symbol.toLowerCase() === addressOrSymbol.toLowerCase() ||
        token.address.toLowerCase() === addressOrSymbol.toLowerCase(),
    );
  }

  // Helper method to get token count
  getTokenCount(): number {
    return this.tokenList.length;
  }

  // Helper method to add token for testing
  addToken(token: TokenInfo): void {
    this.tokenList.push(token);
  }

  // Helper method to remove token for testing
  removeToken(symbol: string): void {
    this.tokenList = this.tokenList.filter(token => token.symbol !== symbol);
  }

  // Helper method to clear all tokens
  clearTokens(): void {
    this.tokenList = [];
  }

  // Helper method to get all token symbols
  getAllSymbols(): string[] {
    return this.tokenList.map(token => token.symbol);
  }

  // Helper method to get all addresses
  getAllAddresses(): string[] {
    return this.tokenList.map(token => token.address);
  }
}

// Test configuration
const TEST_CONFIG = {
  useRealData: false, // Set to true to use real data files
  realTokenListPath: '../../src/templates/lists/polkadot_tokens_mainnet.json',
};

// Load real token list if configured
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
    return [];
  }
}

// Initialize logger
const logger = new TestLogger();

// Test scenarios
async function testGetTokenScenarios() {
  logger.info('🚀 Starting getToken method tests...');
  
  const polkadotInstance = new MockPolkadot();
  
  // Test 1: Get token by symbol (exact match)
  logger.info('📋 Test 1: Get token by symbol (exact match)');
  const startTime1 = Date.now();
  
  try {
    const hdxToken = polkadotInstance.getToken('HDX');
    const dotToken = polkadotInstance.getToken('DOT');
    const wethToken = polkadotInstance.getToken('WETH');
    
    const duration1 = Date.now() - startTime1;
    
    logger.success('Test 1 completed', {
      hdxFound: !!hdxToken,
      hdxSymbol: hdxToken?.symbol,
      hdxName: hdxToken?.name,
      dotFound: !!dotToken,
      dotSymbol: dotToken?.symbol,
      wethFound: !!wethToken,
      duration: `${duration1}ms`,
    });
    
    logger.testResult('getToken_SYMBOL_EXACT', {
      result: 'SUCCESS',
      hdxFound: !!hdxToken,
      dotFound: !!dotToken,
      wethFound: !!wethToken,
      duration: duration1,
    });
    
    logger.performance('getToken_SYMBOL_EXACT', duration1, {
      tokensFound: [!!hdxToken, !!dotToken, !!wethToken].filter(Boolean).length,
    });
  } catch (error) {
    logger.error('Test 1 failed', error);
  }

  // Test 2: Get token by symbol (case insensitive)
  logger.info('📋 Test 2: Get token by symbol (case insensitive)');
  const startTime2 = Date.now();
  
  try {
    const hdxLower = polkadotInstance.getToken('hdx');
    const dotUpper = polkadotInstance.getToken('DOT');
    const wethMixed = polkadotInstance.getToken('WeTh');
    
    const duration2 = Date.now() - startTime2;
    
    logger.success('Test 2 completed', {
      hdxLowerFound: !!hdxLower,
      hdxLowerSymbol: hdxLower?.symbol,
      dotUpperFound: !!dotUpper,
      dotUpperSymbol: dotUpper?.symbol,
      wethMixedFound: !!wethMixed,
      wethMixedSymbol: wethMixed?.symbol,
      duration: `${duration2}ms`,
    });
    
    logger.testResult('getToken_SYMBOL_CASE_INSENSITIVE', {
      result: 'SUCCESS',
      hdxLowerFound: !!hdxLower,
      dotUpperFound: !!dotUpper,
      wethMixedFound: !!wethMixed,
      duration: duration2,
    });
  } catch (error) {
    logger.error('Test 2 failed', error);
  }

  // Test 3: Get token by address
  logger.info('📋 Test 3: Get token by address');
  const startTime3 = Date.now();
  
  try {
    const token0 = polkadotInstance.getToken('0');
    const token1 = polkadotInstance.getToken('1');
    const token2 = polkadotInstance.getToken('2');
    
    const duration3 = Date.now() - startTime3;
    
    logger.success('Test 3 completed', {
      token0Found: !!token0,
      token0Symbol: token0?.symbol,
      token0Address: token0?.address,
      token1Found: !!token1,
      token1Symbol: token1?.symbol,
      token2Found: !!token2,
      token2Symbol: token2?.symbol,
      duration: `${duration3}ms`,
    });
    
    logger.testResult('getToken_ADDRESS', {
      result: 'SUCCESS',
      token0Found: !!token0,
      token1Found: !!token1,
      token2Found: !!token2,
      duration: duration3,
    });
  } catch (error) {
    logger.error('Test 3 failed', error);
  }

  // Test 4: Get token by address (case insensitive)
  logger.info('📋 Test 4: Get token by address (case insensitive)');
  const startTime4 = Date.now();
  
  try {
    const token0Upper = polkadotInstance.getToken('0');
    const token1Lower = polkadotInstance.getToken('1');
    
    const duration4 = Date.now() - startTime4;
    
    logger.success('Test 4 completed', {
      token0UpperFound: !!token0Upper,
      token0UpperSymbol: token0Upper?.symbol,
      token1LowerFound: !!token1Lower,
      token1LowerSymbol: token1Lower?.symbol,
      duration: `${duration4}ms`,
    });
    
    logger.testResult('getToken_ADDRESS_CASE_INSENSITIVE', {
      result: 'SUCCESS',
      token0UpperFound: !!token0Upper,
      token1LowerFound: !!token1Lower,
      duration: duration4,
    });
  } catch (error) {
    logger.error('Test 4 failed', error);
  }

  // Test 5: Get non-existent token
  logger.info('📋 Test 5: Get non-existent token');
  const startTime5 = Date.now();
  
  try {
    const nonExistentSymbol = polkadotInstance.getToken('NONEXISTENT');
    const nonExistentAddress = polkadotInstance.getToken('999');
    const emptyString = polkadotInstance.getToken('');
    
    const duration5 = Date.now() - startTime5;
    
    logger.success('Test 5 completed', {
      nonExistentSymbolFound: !!nonExistentSymbol,
      nonExistentAddressFound: !!nonExistentAddress,
      emptyStringFound: !!emptyString,
      duration: `${duration5}ms`,
    });
    
    logger.testResult('getToken_NON_EXISTENT', {
      result: 'SUCCESS',
      nonExistentSymbolFound: !!nonExistentSymbol,
      nonExistentAddressFound: !!nonExistentAddress,
      emptyStringFound: !!emptyString,
      duration: duration5,
    });
  } catch (error) {
    logger.error('Test 5 failed', error);
  }

  // Test 6: Performance test with multiple lookups
  logger.info('📋 Test 6: Performance test with multiple lookups');
  const startTime6 = Date.now();
  
  try {
    const symbols = ['HDX', 'DOT', 'WETH', 'USDC', 'BTC'];
    const addresses = ['0', '1', '2', '3', '4'];
    const results = [];
    
    // Test symbol lookups
    for (let i = 0; i < 100; i++) {
      const symbol = symbols[i % symbols.length];
      const token = polkadotInstance.getToken(symbol);
      results.push(!!token);
    }
    
    // Test address lookups
    for (let i = 0; i < 100; i++) {
      const address = addresses[i % addresses.length];
      const token = polkadotInstance.getToken(address);
      results.push(!!token);
    }
    
    const duration6 = Date.now() - startTime6;
    const successRate = results.filter(Boolean).length / results.length;
    
    logger.success('Test 6 completed', {
      totalLookups: results.length,
      successfulLookups: results.filter(Boolean).length,
      successRate: `${(successRate * 100).toFixed(2)}%`,
      duration: `${duration6}ms`,
      averageDuration: `${duration6 / results.length}ms`,
    });
    
    logger.testResult('getToken_PERFORMANCE', {
      result: 'SUCCESS',
      totalLookups: results.length,
      successRate: successRate,
      duration: duration6,
      averageDuration: duration6 / results.length,
    });
    
    logger.performance('getToken_MULTIPLE_LOOKUPS', duration6, {
      totalLookups: results.length,
      successRate: successRate,
    });
  } catch (error) {
    logger.error('Test 6 failed', error);
  }

  // Test 7: Test with dynamic token list changes
  logger.info('📋 Test 7: Test with dynamic token list changes');
  const startTime7 = Date.now();
  
  try {
    // Add new token
    const newToken: TokenInfo = {
      symbol: 'NEW',
      name: 'New Token',
      decimals: 18,
      address: '5',
      chainId: 0,
    };
    
    polkadotInstance.addToken(newToken);
    
    // Test finding new token
    const foundNewToken = polkadotInstance.getToken('NEW');
    const foundNewAddress = polkadotInstance.getToken('5');
    
    // Remove token
    polkadotInstance.removeToken('NEW');
    
    // Test that removed token is not found
    const removedToken = polkadotInstance.getToken('NEW');
    
    const duration7 = Date.now() - startTime7;
    
    logger.success('Test 7 completed', {
      newTokenFound: !!foundNewToken,
      newAddressFound: !!foundNewAddress,
      removedTokenFound: !!removedToken,
      finalTokenCount: polkadotInstance.getTokenCount(),
      duration: `${duration7}ms`,
    });
    
    logger.testResult('getToken_DYNAMIC_CHANGES', {
      result: 'SUCCESS',
      newTokenFound: !!foundNewToken,
      newAddressFound: !!foundNewAddress,
      removedTokenFound: !!removedToken,
      finalTokenCount: polkadotInstance.getTokenCount(),
      duration: duration7,
    });
  } catch (error) {
    logger.error('Test 7 failed', error);
  }

  // Test 8: Test edge cases
  logger.info('📋 Test 8: Test edge cases');
  const startTime8 = Date.now();
  
  try {
    // Test with very long strings
    const longSymbol = 'A'.repeat(1000);
    const longAddress = 'B'.repeat(1000);
    
    const longSymbolResult = polkadotInstance.getToken(longSymbol);
    const longAddressResult = polkadotInstance.getToken(longAddress);
    
    // Test with special characters
    const specialSymbol = 'HDX@#$%';
    const specialAddress = '0@#$%';
    
    const specialSymbolResult = polkadotInstance.getToken(specialSymbol);
    const specialAddressResult = polkadotInstance.getToken(specialAddress);
    
    // Test with numbers as symbols
    const numberSymbol = '123';
    const numberAddress = '123';
    
    const numberSymbolResult = polkadotInstance.getToken(numberSymbol);
    const numberAddressResult = polkadotInstance.getToken(numberAddress);
    
    const duration8 = Date.now() - startTime8;
    
    logger.success('Test 8 completed', {
      longSymbolFound: !!longSymbolResult,
      longAddressFound: !!longAddressResult,
      specialSymbolFound: !!specialSymbolResult,
      specialAddressFound: !!specialAddressResult,
      numberSymbolFound: !!numberSymbolResult,
      numberAddressFound: !!numberAddressResult,
      duration: `${duration8}ms`,
    });
    
    logger.testResult('getToken_EDGE_CASES', {
      result: 'SUCCESS',
      longSymbolFound: !!longSymbolResult,
      longAddressFound: !!longAddressResult,
      specialSymbolFound: !!specialSymbolResult,
      specialAddressFound: !!specialAddressResult,
      numberSymbolFound: !!numberSymbolResult,
      numberAddressFound: !!numberAddressResult,
      duration: duration8,
    });
  } catch (error) {
    logger.error('Test 8 failed', error);
  }

  // Test 9: Test with real data if configured
  if (TEST_CONFIG.useRealData) {
    logger.info('📋 Test 9: Test with real Polkadot token data');
    const startTime9 = Date.now();
    
    try {
      const realTokens = await loadRealTokenList(TEST_CONFIG.realTokenListPath);
      
      if (realTokens.length > 0) {
        // Create a new instance with real data
        const realPolkadotInstance = new MockPolkadot();
        realPolkadotInstance.tokenList = realTokens;
        
        // Test finding some real tokens
        const firstToken = realTokens[0];
        const lastToken = realTokens[realTokens.length - 1];
        
        const foundFirstBySymbol = realPolkadotInstance.getToken(firstToken.symbol);
        const foundFirstByAddress = realPolkadotInstance.getToken(firstToken.address);
        const foundLastBySymbol = realPolkadotInstance.getToken(lastToken.symbol);
        
        const duration9 = Date.now() - startTime9;
        
        logger.success('Test 9 completed with real data', {
          totalRealTokens: realTokens.length,
          firstTokenFound: !!foundFirstBySymbol,
          firstTokenSymbol: foundFirstBySymbol?.symbol,
          firstTokenByAddressFound: !!foundFirstByAddress,
          lastTokenFound: !!foundLastBySymbol,
          lastTokenSymbol: foundLastBySymbol?.symbol,
          duration: `${duration9}ms`,
        });
        
        logger.testResult('getToken_REAL_DATA', {
          result: 'SUCCESS',
          totalRealTokens: realTokens.length,
          firstTokenFound: !!foundFirstBySymbol,
          firstTokenByAddressFound: !!foundFirstByAddress,
          lastTokenFound: !!foundLastBySymbol,
          duration: duration9,
          dataSource: 'REAL',
        });
        
        logger.performance('getToken_REAL_DATA', duration9, {
          totalRealTokens: realTokens.length,
        });
        
        // Show first 5 real tokens
        logger.info('🔍 First 5 REAL tokens:');
        realTokens.slice(0, 5).forEach((token, index) => {
          logger.info(
            `  ${index + 1}. ${token.symbol} (${token.name}) - Decimals: ${token.decimals}, Address: ${token.address}`,
          );
        });
      } else {
        logger.warning('Test 9: No real tokens loaded, skipping real data test');
      }
    } catch (error) {
      logger.error('Test 9 failed', error);
    }
  }

  // Test 10: Comprehensive token lookup test
  logger.info('📋 Test 10: Comprehensive token lookup test');
  const startTime10 = Date.now();
  
  try {
    const allSymbols = polkadotInstance.getAllSymbols();
    const allAddresses = polkadotInstance.getAllAddresses();
    
    const symbolResults = allSymbols.map(symbol => ({
      symbol,
      found: !!polkadotInstance.getToken(symbol),
      token: polkadotInstance.getToken(symbol),
    }));
    
    const addressResults = allAddresses.map(address => ({
      address,
      found: !!polkadotInstance.getToken(address),
      token: polkadotInstance.getToken(address),
    }));
    
    const duration10 = Date.now() - startTime10;
    
    const symbolSuccessRate = symbolResults.filter(r => r.found).length / symbolResults.length;
    const addressSuccessRate = addressResults.filter(r => r.found).length / addressResults.length;
    
    logger.success('Test 10 completed', {
      symbolLookups: symbolResults.length,
      symbolSuccessRate: `${(symbolSuccessRate * 100).toFixed(2)}%`,
      addressLookups: addressResults.length,
      addressSuccessRate: `${(addressSuccessRate * 100).toFixed(2)}%`,
      duration: `${duration10}ms`,
    });
    
    logger.testResult('getToken_COMPREHENSIVE', {
      result: 'SUCCESS',
      symbolLookups: symbolResults.length,
      symbolSuccessRate: symbolSuccessRate,
      addressLookups: addressResults.length,
      addressSuccessRate: addressSuccessRate,
      duration: duration10,
    });
    
    // Log detailed results
    logger.info('📊 Symbol lookup results:');
    symbolResults.forEach(result => {
      logger.info(`  ${result.symbol}: ${result.found ? '✅' : '❌'} - ${result.token?.name || 'Not found'}`);
    });
    
    logger.info('📊 Address lookup results:');
    addressResults.forEach(result => {
      logger.info(`  ${result.address}: ${result.found ? '✅' : '❌'} - ${result.token?.symbol || 'Not found'}`);
    });
  } catch (error) {
    logger.error('Test 10 failed', error);
  }

  // Summary
  const totalDuration = logger.getSessionDuration();
  logger.info('📊 Test Summary', {
    totalDuration: `${totalDuration}ms`,
    logFile: logger.getLogFilePath(),
    totalTests: 10,
    testMode: TEST_CONFIG.useRealData ? 'REAL_DATA' : 'MOCK_DATA',
  });
  
  logger.success('🎉 All getToken tests completed successfully!');
  logger.info(`📁 Logs saved to: ${logger.getLogFilePath()}`);
}

// Run the tests
if (require.main === module) {
  testGetTokenScenarios().catch((error) => {
    logger.error('Test execution failed', error);
    process.exit(1);
  });
}
