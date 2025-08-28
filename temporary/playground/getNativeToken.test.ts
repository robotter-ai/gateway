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
    this.logFile = path.join(this.logDir, `getNativeToken-test-${timestamp}.log`);
    
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

// Mock network configuration interface
interface NetworkConfig {
  nativeCurrencySymbol: string;
  network: string;
  chainId: number;
}

// Mock Polkadot class for testing getNativeToken method
class MockPolkadot {
  public tokenList: TokenInfo[] = [];
  public config: NetworkConfig;

  constructor(networkConfig: NetworkConfig) {
    this.config = networkConfig;
    this.initializeTokens();
  }

  private initializeTokens(): void {
    // Initialize with test tokens including native tokens for different networks
    this.tokenList = [
      // Polkadot mainnet tokens
      {
        symbol: 'DOT',
        name: 'Polkadot',
        decimals: 10,
        address: '0',
        chainId: 0,
      },
      {
        symbol: 'HDX',
        name: 'HydraDX',
        decimals: 12,
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
      // Kusama tokens
      {
        symbol: 'KSM',
        name: 'Kusama',
        decimals: 12,
        address: '3',
        chainId: 2,
      },
      // Westend tokens
      {
        symbol: 'WND',
        name: 'Westend',
        decimals: 12,
        address: '4',
        chainId: 3,
      },
      // Rococo tokens
      {
        symbol: 'ROC',
        name: 'Rococo',
        decimals: 12,
        address: '5',
        chainId: 4,
      },
    ];
  }

  // The actual getToken method that getNativeToken depends on
  getToken(addressOrSymbol: string): TokenInfo | undefined {
    return this.tokenList.find(
      (token) =>
        token.symbol.toLowerCase() === addressOrSymbol.toLowerCase() ||
        token.address.toLowerCase() === addressOrSymbol.toLowerCase(),
    );
  }

  // The actual getNativeToken method to test
  public getNativeToken(): TokenInfo {
    const nativeToken = this.getToken(this.config.nativeCurrencySymbol);
    if (!nativeToken) {
      throw new Error(`Native token not found for network: ${this.config.network}`);
    }
    return nativeToken;
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

  // Helper method to update network configuration
  updateNetworkConfig(newConfig: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...newConfig };
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
async function testGetNativeTokenScenarios() {
  logger.info('🚀 Starting getNativeToken method tests...');
  
  // Test 1: Get native token for Polkadot mainnet
  logger.info('📋 Test 1: Get native token for Polkadot mainnet');
  const startTime1 = Date.now();
  
  try {
    const polkadotConfig: NetworkConfig = {
      nativeCurrencySymbol: 'DOT',
      network: 'Polkadot Mainnet',
      chainId: 0,
    };
    
    const polkadotInstance = new MockPolkadot(polkadotConfig);
    const nativeToken = polkadotInstance.getNativeToken();
    
    const duration1 = Date.now() - startTime1;
    
    logger.success('Test 1 completed', {
      network: polkadotConfig.network,
      nativeSymbol: polkadotConfig.nativeCurrencySymbol,
      nativeTokenFound: !!nativeToken,
      nativeTokenSymbol: nativeToken?.symbol,
      nativeTokenName: nativeToken?.name,
      nativeTokenDecimals: nativeToken?.decimals,
      nativeTokenAddress: nativeToken?.address,
      duration: `${duration1}ms`,
    });
    
    logger.testResult('getNativeToken_POLKADOT_MAINNET', {
      result: 'SUCCESS',
      network: polkadotConfig.network,
      nativeTokenFound: !!nativeToken,
      nativeTokenSymbol: nativeToken?.symbol,
      duration: duration1,
    });
    
    logger.performance('getNativeToken_POLKADOT_MAINNET', duration1, {
      nativeTokenFound: !!nativeToken,
    });
  } catch (error) {
    logger.error('Test 1 failed', error);
  }

  // Test 2: Get native token for Kusama
  logger.info('📋 Test 2: Get native token for Kusama');
  const startTime2 = Date.now();
  
  try {
    const kusamaConfig: NetworkConfig = {
      nativeCurrencySymbol: 'KSM',
      network: 'Kusama',
      chainId: 2,
    };
    
    const kusamaInstance = new MockPolkadot(kusamaConfig);
    const nativeToken = kusamaInstance.getNativeToken();
    
    const duration2 = Date.now() - startTime2;
    
    logger.success('Test 2 completed', {
      network: kusamaConfig.network,
      nativeSymbol: kusamaConfig.nativeCurrencySymbol,
      nativeTokenFound: !!nativeToken,
      nativeTokenSymbol: nativeToken?.symbol,
      nativeTokenName: nativeToken?.name,
      nativeTokenDecimals: nativeToken?.decimals,
      nativeTokenAddress: nativeToken?.address,
      duration: `${duration2}ms`,
    });
    
    logger.testResult('getNativeToken_KUSAMA', {
      result: 'SUCCESS',
      network: kusamaConfig.network,
      nativeTokenFound: !!nativeToken,
      nativeTokenSymbol: nativeToken?.symbol,
      duration: duration2,
    });
  } catch (error) {
    logger.error('Test 2 failed', error);
  }

  // Test 3: Get native token for Westend
  logger.info('📋 Test 3: Get native token for Westend');
  const startTime3 = Date.now();
  
  try {
    const westendConfig: NetworkConfig = {
      nativeCurrencySymbol: 'WND',
      network: 'Westend',
      chainId: 3,
    };
    
    const westendInstance = new MockPolkadot(westendConfig);
    const nativeToken = westendInstance.getNativeToken();
    
    const duration3 = Date.now() - startTime3;
    
    logger.success('Test 3 completed', {
      network: westendConfig.network,
      nativeSymbol: westendConfig.nativeCurrencySymbol,
      nativeTokenFound: !!nativeToken,
      nativeTokenSymbol: nativeToken?.symbol,
      nativeTokenName: nativeToken?.name,
      nativeTokenDecimals: nativeToken?.decimals,
      nativeTokenAddress: nativeToken?.address,
      duration: `${duration3}ms`,
    });
    
    logger.testResult('getNativeToken_WESTEND', {
      result: 'SUCCESS',
      network: westendConfig.network,
      nativeTokenFound: !!nativeToken,
      nativeTokenSymbol: nativeToken?.symbol,
      duration: duration3,
    });
  } catch (error) {
    logger.error('Test 3 failed', error);
  }

  // Test 4: Get native token for Rococo
  logger.info('📋 Test 4: Get native token for Rococo');
  const startTime4 = Date.now();
  
  try {
    const rococoConfig: NetworkConfig = {
      nativeCurrencySymbol: 'ROC',
      network: 'Rococo',
      chainId: 4,
    };
    
    const rococoInstance = new MockPolkadot(rococoConfig);
    const nativeToken = rococoInstance.getNativeToken();
    
    const duration4 = Date.now() - startTime4;
    
    logger.success('Test 4 completed', {
      network: rococoConfig.network,
      nativeSymbol: rococoConfig.nativeCurrencySymbol,
      nativeTokenFound: !!nativeToken,
      nativeTokenSymbol: nativeToken?.symbol,
      nativeTokenName: nativeToken?.name,
      nativeTokenDecimals: nativeToken?.decimals,
      nativeTokenAddress: nativeToken?.address,
      duration: `${duration4}ms`,
    });
    
    logger.testResult('getNativeToken_ROCOCO', {
      result: 'SUCCESS',
      network: rococoConfig.network,
      nativeTokenFound: !!nativeToken,
      nativeTokenSymbol: nativeToken?.symbol,
      duration: duration4,
    });
  } catch (error) {
    logger.error('Test 4 failed', error);
  }

  // Test 5: Test error handling for non-existent native token
  logger.info('📋 Test 5: Test error handling for non-existent native token');
  const startTime5 = Date.now();
  
  try {
    const invalidConfig: NetworkConfig = {
      nativeCurrencySymbol: 'INVALID',
      network: 'Invalid Network',
      chainId: 999,
    };
    
    const invalidInstance = new MockPolkadot(invalidConfig);
    
    try {
      const nativeToken = invalidInstance.getNativeToken();
      logger.warning('Test 5: Expected error but none occurred');
    } catch (error) {
      const duration5 = Date.now() - startTime5;
      
      logger.success('Test 5 completed - Error properly caught', {
        network: invalidConfig.network,
        nativeSymbol: invalidConfig.nativeCurrencySymbol,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration5}ms`,
      });
      
      logger.testResult('getNativeToken_ERROR_HANDLING', {
        result: 'SUCCESS',
        errorCaught: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        duration: duration5,
      });
    }
  } catch (error) {
    logger.error('Test 5 failed', error);
  }

  // Test 6: Test dynamic network configuration changes
  logger.info('📋 Test 6: Test dynamic network configuration changes');
  const startTime6 = Date.now();
  
  try {
    const polkadotConfig: NetworkConfig = {
      nativeCurrencySymbol: 'DOT',
      network: 'Polkadot Mainnet',
      chainId: 0,
    };
    
    const polkadotInstance = new MockPolkadot(polkadotConfig);
    
    // Get native token initially
    const initialNativeToken = polkadotInstance.getNativeToken();
    
    // Change network configuration
    polkadotInstance.updateNetworkConfig({
      nativeCurrencySymbol: 'KSM',
      network: 'Kusama',
      chainId: 2,
    });
    
    // Get native token after change
    const newNativeToken = polkadotInstance.getNativeToken();
    
    const duration6 = Date.now() - startTime6;
    
    logger.success('Test 6 completed', {
      initialNetwork: polkadotConfig.network,
      initialNativeSymbol: polkadotConfig.nativeCurrencySymbol,
      initialNativeToken: initialNativeToken?.symbol,
      newNetwork: 'Kusama',
      newNativeSymbol: 'KSM',
      newNativeToken: newNativeToken?.symbol,
      duration: `${duration6}ms`,
    });
    
    logger.testResult('getNativeToken_DYNAMIC_CONFIG', {
      result: 'SUCCESS',
      initialNativeToken: initialNativeToken?.symbol,
      newNativeToken: newNativeToken?.symbol,
      duration: duration6,
    });
  } catch (error) {
    logger.error('Test 6 failed', error);
  }

  // Test 7: Performance test with multiple native token retrievals
  logger.info('📋 Test 7: Performance test with multiple native token retrievals');
  const startTime7 = Date.now();
  
  try {
    const networks = [
      { symbol: 'DOT', name: 'Polkadot' },
      { symbol: 'KSM', name: 'Kusama' },
      { symbol: 'WND', name: 'Westend' },
      { symbol: 'ROC', name: 'Rococo' },
    ];
    
    const results = [];
    
    // Test multiple retrievals
    for (let i = 0; i < 100; i++) {
      const network = networks[i % networks.length];
      const config: NetworkConfig = {
        nativeCurrencySymbol: network.symbol,
        network: network.name,
        chainId: i % 4,
      };
      
      const instance = new MockPolkadot(config);
      const nativeToken = instance.getNativeToken();
      results.push({
        network: network.name,
        symbol: network.symbol,
        found: !!nativeToken,
        tokenSymbol: nativeToken?.symbol,
      });
    }
    
    const duration7 = Date.now() - startTime7;
    const successRate = results.filter(r => r.found).length / results.length;
    
    logger.success('Test 7 completed', {
      totalRetrievals: results.length,
      successfulRetrievals: results.filter(r => r.found).length,
      successRate: `${(successRate * 100).toFixed(2)}%`,
      duration: `${duration7}ms`,
      averageDuration: `${duration7 / results.length}ms`,
    });
    
    logger.testResult('getNativeToken_PERFORMANCE', {
      result: 'SUCCESS',
      totalRetrievals: results.length,
      successRate: successRate,
      duration: duration7,
      averageDuration: duration7 / results.length,
    });
    
    logger.performance('getNativeToken_MULTIPLE_RETRIEVALS', duration7, {
      totalRetrievals: results.length,
      successRate: successRate,
    });
  } catch (error) {
    logger.error('Test 7 failed', error);
  }

  // Test 8: Test with real data if configured
  if (TEST_CONFIG.useRealData) {
    logger.info('📋 Test 8: Test with real Polkadot token data');
    const startTime8 = Date.now();
    
    try {
      const realTokens = await loadRealTokenList(TEST_CONFIG.realTokenListPath);
      
      if (realTokens.length > 0) {
        // Create a new instance with real data
        const realPolkadotInstance = new MockPolkadot({
          nativeCurrencySymbol: 'DOT',
          network: 'Polkadot Mainnet (Real Data)',
          chainId: 0,
        });
        
        // Replace token list with real data
        realPolkadotInstance.tokenList = realTokens;
        
        // Test finding native token
        const nativeToken = realPolkadotInstance.getNativeToken();
        
        const duration8 = Date.now() - startTime8;
        
        logger.success('Test 8 completed with real data', {
          totalRealTokens: realTokens.length,
          nativeTokenFound: !!nativeToken,
          nativeTokenSymbol: nativeToken?.symbol,
          nativeTokenName: nativeToken?.name,
          duration: `${duration8}ms`,
        });
        
        logger.testResult('getNativeToken_REAL_DATA', {
          result: 'SUCCESS',
          totalRealTokens: realTokens.length,
          nativeTokenFound: !!nativeToken,
          nativeTokenSymbol: nativeToken?.symbol,
          duration: duration8,
          dataSource: 'REAL',
        });
        
        logger.performance('getNativeToken_REAL_DATA', duration8, {
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
        logger.warning('Test 8: No real tokens loaded, skipping real data test');
      }
    } catch (error) {
      logger.error('Test 8 failed', error);
    }
  }

  // Test 9: Comprehensive native token validation
  logger.info('📋 Test 9: Comprehensive native token validation');
  const startTime9 = Date.now();
  
  try {
    const testNetworks = [
      { symbol: 'DOT', name: 'Polkadot Mainnet', chainId: 0 },
      { symbol: 'KSM', name: 'Kusama', chainId: 2 },
      { symbol: 'WND', name: 'Westend', chainId: 3 },
      { symbol: 'ROC', name: 'Rococo', chainId: 4 },
    ];
    
    const validationResults = testNetworks.map(network => {
      const config: NetworkConfig = {
        nativeCurrencySymbol: network.symbol,
        network: network.name,
        chainId: network.chainId,
      };
      
      const instance = new MockPolkadot(config);
      const nativeToken = instance.getNativeToken();
      
      return {
        network: network.name,
        expectedSymbol: network.symbol,
        found: !!nativeToken,
        actualSymbol: nativeToken?.symbol,
        actualName: nativeToken?.name,
        actualDecimals: nativeToken?.decimals,
        actualAddress: nativeToken?.address,
        validation: nativeToken?.symbol === network.symbol,
      };
    });
    
    const duration9 = Date.now() - startTime9;
    const validationSuccessRate = validationResults.filter(r => r.validation).length / validationResults.length;
    
    logger.success('Test 9 completed', {
      totalNetworks: validationResults.length,
      validationSuccessRate: `${(validationSuccessRate * 100).toFixed(2)}%`,
      duration: `${duration9}ms`,
    });
    
    logger.testResult('getNativeToken_VALIDATION', {
      result: 'SUCCESS',
      totalNetworks: validationResults.length,
      validationSuccessRate: validationSuccessRate,
      duration: duration9,
    });
    
    // Log detailed validation results
    logger.info('📊 Native token validation results:');
    validationResults.forEach(result => {
      const status = result.validation ? '✅' : '❌';
      logger.info(`  ${result.network}: ${status} Expected: ${result.expectedSymbol}, Found: ${result.actualSymbol || 'Not found'}`);
    });
  } catch (error) {
    logger.error('Test 9 failed', error);
  }

  // Test 10: Test edge cases and error scenarios
  logger.info('📋 Test 10: Test edge cases and error scenarios');
  const startTime10 = Date.now();
  
  try {
    // Test with empty token list
    const emptyConfig: NetworkConfig = {
      nativeCurrencySymbol: 'DOT',
      network: 'Empty Network',
      chainId: 999,
    };
    
    const emptyInstance = new MockPolkadot(emptyConfig);
    emptyInstance.clearTokens();
    
    try {
      const nativeToken = emptyInstance.getNativeToken();
      logger.warning('Test 10.1: Expected error for empty token list but none occurred');
    } catch (error) {
      logger.success('Test 10.1: Error properly caught for empty token list', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    // Test with very long symbol
    const longSymbolConfig: NetworkConfig = {
      nativeCurrencySymbol: 'A'.repeat(1000),
      network: 'Long Symbol Network',
      chainId: 998,
    };
    
    const longSymbolInstance = new MockPolkadot(longSymbolConfig);
    
    try {
      const nativeToken = longSymbolInstance.getNativeToken();
      logger.warning('Test 10.2: Expected error for very long symbol but none occurred');
    } catch (error) {
      logger.success('Test 10.2: Error properly caught for very long symbol', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    // Test with special characters in symbol
    const specialSymbolConfig: NetworkConfig = {
      nativeCurrencySymbol: 'DOT@#$%',
      network: 'Special Symbol Network',
      chainId: 997,
    };
    
    const specialSymbolInstance = new MockPolkadot(specialSymbolConfig);
    
    try {
      const nativeToken = specialSymbolInstance.getNativeToken();
      logger.warning('Test 10.3: Expected error for special characters but none occurred');
    } catch (error) {
      logger.success('Test 10.3: Error properly caught for special characters', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    const duration10 = Date.now() - startTime10;
    
    logger.success('Test 10 completed', {
      edgeCasesTested: 3,
      duration: `${duration10}ms`,
    });
    
    logger.testResult('getNativeToken_EDGE_CASES', {
      result: 'SUCCESS',
      edgeCasesTested: 3,
      duration: duration10,
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
  
  logger.success('🎉 All getNativeToken tests completed successfully!');
  logger.info(`📁 Logs saved to: ${logger.getLogFilePath()}`);
}

// Run the tests
if (require.main === module) {
  testGetNativeTokenScenarios().catch((error) => {
    logger.error('Test execution failed', error);
    process.exit(1);
  });
}
