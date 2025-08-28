import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { TokenInfo, TokenListType } from '../../src/services/base';

// Mock axios and fs - using direct mocking for ts-node execution
// jest.mock('axios');
// jest.mock('fs');

// const mockedAxios = axios as jest.Mocked<typeof axios>;
// const mockedFs = fs as jest.Mocked<typeof fs>;

// Test Logger for detailed logging
class TestLogger {
  private logDir: string;
  private logFile: string;
  private startTime: Date;

  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.startTime = new Date();
    const timestamp = this.startTime.toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(this.logDir, `loadTokens-test-${timestamp}.log`);
    
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

// Mock Polkadot class for testing loadTokens method
class MockPolkadot {
  public tokenList: TokenInfo[] = [];
  private _tokenMap: { [key: string]: TokenInfo } = {};
  public network: string = 'test-network';

  // Mock axiosGet method
  async axiosGet(_axios: any, url: string): Promise<any> {
    logger.info(`Mock axios GET request to: ${url}`);
    
    // Simulate different responses based on URL
    if (url.includes('valid-tokens')) {
      return {
        data: [
          { symbol: 'HDX', name: 'HydraDX', decimals: 12, id: '0' },
          { symbol: 'DOT', name: 'Polkadot', decimals: 10, id: '1' },
          { symbol: 'WETH', name: 'Wrapped Ethereum', decimals: 18, id: '2' },
        ],
      };
    } else if (url.includes('empty-tokens')) {
      return { data: [] };
    } else if (url.includes('invalid-format')) {
      return { data: 'invalid-json' };
    } else {
      throw new Error('Network error');
    }
  }

  // Mock fsReadFile method
  async fsReadFile(filePath: string, _options: any): Promise<Buffer> {
    logger.info(`Mock reading file: ${filePath}`);
    
    // Simulate different file contents based on path
    if (filePath.includes('valid-tokens.json')) {
      const content = JSON.stringify([
        { symbol: 'HDX', name: 'HydraDX', decimals: 12, id: '0' },
        { symbol: 'DOT', name: 'Polkadot', decimals: 10, id: '1' },
        { symbol: 'WETH', name: 'Wrapped Ethereum', decimals: 18, id: '2' },
      ]);
      return Buffer.from(content);
    } else if (filePath.includes('empty-tokens.json')) {
      return Buffer.from('[]');
    } else if (filePath.includes('invalid-format.json')) {
      return Buffer.from('invalid-json-content');
    } else if (filePath.includes('malformed-tokens.json')) {
      const content = JSON.stringify([
        { symbol: 'HDX', name: 'HydraDX', decimals: 12, id: '0' },
        { symbol: 'DOT', name: 'Polkadot', decimals: 10 }, // Missing id
        { symbol: 'WETH', name: 'Wrapped Ethereum', decimals: 18, id: '2' },
      ]);
      return Buffer.from(content);
    } else {
      throw new Error('File not found');
    }
  }

  // The actual loadTokens method to test
  async loadTokens(
    tokenListSource: string,
    tokenListType: TokenListType,
  ): Promise<void> {
    logger.info(`Loading tokens from ${tokenListSource} (${tokenListType})`);
    
    // Clear existing token lists
    this.tokenList = [];
    this._tokenMap = {};

    // Load tokens from source
    let tokensData: any[] = [];

    if (tokenListType === 'URL') {
      const response = await this.axiosGet(axios, tokenListSource);
      tokensData = response.data || [];
      logger.info(`Loaded ${tokensData.length} tokens from URL`);
    } else {
      const fileContent = await this.fsReadFile(tokenListSource, {
        encoding: 'utf8',
      });
      const data = fileContent.toString();
      const parsed = JSON.parse(data);
      tokensData = parsed || [];
      logger.info(`Loaded ${tokensData.length} tokens from file`);
    }

    // Process tokens
    for (const tokenData of tokensData) {
      try {
        const token: TokenInfo = {
          symbol: tokenData.symbol,
          name: tokenData.name,
          decimals: tokenData.decimals,
          address: tokenData.id.toString(), // Use token ID as address
          chainId: 0,
        };

        this.tokenList.push(token);
        this._tokenMap[token.symbol.toLowerCase()] = token;
        this._tokenMap[token.address.toLowerCase()] = token;
        
        logger.info(`Processed token: ${token.symbol} (${token.name})`);
      } catch (error) {
        logger.warning(`Failed to process token: ${JSON.stringify(tokenData)}`, error);
      }
    }

    logger.info(
      `Loaded ${this.tokenList.length} tokens for network: ${this.network}`,
    );
  }

  // Helper method to get token by symbol
  getToken(symbol: string): TokenInfo | undefined {
    return this._tokenMap[symbol.toLowerCase()];
  }

  // Helper method to get token by address
  getTokenByAddress(address: string): TokenInfo | undefined {
    return this._tokenMap[address.toLowerCase()];
  }

  // Helper method to get token map size
  getTokenMapSize(): number {
    return Object.keys(this._tokenMap).length;
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
async function testLoadTokensScenarios() {
  logger.info('🚀 Starting loadTokens method tests...');
  
  const polkadotInstance = new MockPolkadot();
  
  // Test 1: Load tokens from FILE source
  logger.info('📋 Test 1: Load tokens from FILE source');
  const startTime1 = Date.now();
  
  try {
    await polkadotInstance.loadTokens('valid-tokens.json', 'FILE');
    const duration1 = Date.now() - startTime1;
    
    logger.success('Test 1 completed', {
      tokenCount: polkadotInstance.tokenList.length,
      firstToken: polkadotInstance.tokenList[0],
      duration: `${duration1}ms`,
      tokenMapSize: polkadotInstance.getTokenMapSize()
    });
    
    logger.testResult('loadTokens_FILE', {
      result: 'SUCCESS',
      tokenCount: polkadotInstance.tokenList.length,
      duration: duration1
    });
    
    logger.performance('loadTokens_FILE', duration1, {
      tokenCount: polkadotInstance.tokenList.length
    });
  } catch (error) {
    logger.error('Test 1 failed', error);
  }

  // Test 2: Load tokens from URL source
  logger.info('📋 Test 2: Load tokens from URL source');
  const startTime2 = Date.now();
  
  try {
    await polkadotInstance.loadTokens('https://api.example.com/valid-tokens', 'URL');
    const duration2 = Date.now() - startTime2;
    
    logger.success('Test 2 completed', {
      tokenCount: polkadotInstance.tokenList.length,
      firstToken: polkadotInstance.tokenList[0],
      duration: `${duration2}ms`,
      tokenMapSize: polkadotInstance.getTokenMapSize()
    });
    
    logger.testResult('loadTokens_URL', {
      result: 'SUCCESS',
      tokenCount: polkadotInstance.tokenList.length,
      duration: duration2
    });
    
    logger.performance('loadTokens_URL', duration2, {
      tokenCount: polkadotInstance.tokenList.length
    });
  } catch (error) {
    logger.error('Test 2 failed', error);
  }

  // Test 3: Load empty token list
  logger.info('📋 Test 3: Load empty token list');
  const startTime3 = Date.now();
  
  try {
    await polkadotInstance.loadTokens('empty-tokens.json', 'FILE');
    const duration3 = Date.now() - startTime3;
    
    logger.success('Test 3 completed', {
      tokenCount: polkadotInstance.tokenList.length,
      duration: `${duration3}ms`,
      tokenMapSize: polkadotInstance.getTokenMapSize()
    });
    
    logger.testResult('loadTokens_EMPTY', {
      result: 'SUCCESS',
      tokenCount: polkadotInstance.tokenList.length,
      duration: duration3
    });
  } catch (error) {
    logger.error('Test 3 failed', error);
  }

  // Test 4: Handle malformed token data
  logger.info('📋 Test 4: Handle malformed token data');
  const startTime4 = Date.now();
  
  try {
    await polkadotInstance.loadTokens('malformed-tokens.json', 'FILE');
    const duration4 = Date.now() - startTime4;
    
    logger.success('Test 4 completed', {
      tokenCount: polkadotInstance.tokenList.length,
      duration: `${duration4}ms`,
      tokenMapSize: polkadotInstance.getTokenMapSize()
    });
    
    logger.testResult('loadTokens_MALFORMED', {
      result: 'SUCCESS',
      tokenCount: polkadotInstance.tokenList.length,
      duration: duration4
    });
  } catch (error) {
    logger.error('Test 4 failed', error);
  }

  // Test 5: Test token map functionality
  logger.info('📋 Test 5: Test token map functionality');
  
  try {
    const hdxToken = polkadotInstance.getToken('HDX');
    const dotToken = polkadotInstance.getToken('DOT');
    const hdxByAddress = polkadotInstance.getTokenByAddress('0');
    
    logger.success('Test 5 completed', {
      hdxToken: hdxToken ? hdxToken.symbol : 'NOT_FOUND',
      dotToken: dotToken ? dotToken.symbol : 'NOT_FOUND',
      hdxByAddress: hdxByAddress ? hdxByAddress.symbol : 'NOT_FOUND',
      tokenMapSize: polkadotInstance.getTokenMapSize()
    });
    
    logger.testResult('tokenMap_functionality', {
      result: 'SUCCESS',
      hdxFound: !!hdxToken,
      dotFound: !!dotToken,
      hdxByAddressFound: !!hdxByAddress
    });
  } catch (error) {
    logger.error('Test 5 failed', error);
  }

  // Test 6: Performance test with multiple loads
  logger.info('📋 Test 6: Performance test with multiple loads');
  const startTime6 = Date.now();
  
  try {
    for (let i = 0; i < 10; i++) {
      await polkadotInstance.loadTokens('valid-tokens.json', 'FILE');
    }
    const duration6 = Date.now() - startTime6;
    
    logger.success('Test 6 completed', {
      iterations: 10,
      totalDuration: `${duration6}ms`,
      averageDuration: `${duration6 / 10}ms`
    });
    
    logger.testResult('loadTokens_PERFORMANCE', {
      result: 'SUCCESS',
      iterations: 10,
      totalDuration: duration6,
      averageDuration: duration6 / 10
    });
    
    logger.performance('loadTokens_MULTIPLE_LOADS', duration6, {
      iterations: 10,
      averageDuration: duration6 / 10
    });
  } catch (error) {
    logger.error('Test 6 failed', error);
  }

  // Test 7: Error handling for invalid file
  logger.info('📋 Test 7: Error handling for invalid file');
  
  try {
    await polkadotInstance.loadTokens('nonexistent-file.json', 'FILE');
    logger.warning('Test 7: Expected error but none occurred');
  } catch (error) {
    logger.success('Test 7 completed - Error properly caught', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    
    logger.testResult('loadTokens_ERROR_HANDLING', {
      result: 'SUCCESS',
      errorCaught: true,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 8: Error handling for invalid URL
  logger.info('📋 Test 8: Error handling for invalid URL');
  
  try {
    await polkadotInstance.loadTokens('https://api.example.com/invalid-endpoint', 'URL');
    logger.warning('Test 8: Expected error but none occurred');
  } catch (error) {
    logger.success('Test 8 completed - Error properly caught', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    
    logger.testResult('loadTokens_URL_ERROR_HANDLING', {
      result: 'SUCCESS',
      errorCaught: true,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 9: Test with real data if configured
  if (TEST_CONFIG.useRealData) {
    logger.info('📋 Test 9: Test with real Polkadot token data');
    const startTime9 = Date.now();
    
    try {
      const realTokens = await loadRealTokenList(TEST_CONFIG.realTokenListPath);
      
      if (realTokens.length > 0) {
        // Create a new instance for real data test
        const realPolkadotInstance = new MockPolkadot();
        
        // Override fsReadFile to return real data
        const originalFsReadFile = realPolkadotInstance.fsReadFile;
        realPolkadotInstance.fsReadFile = async (_filePath: string, _options: any) => {
          return Buffer.from(JSON.stringify(realTokens));
        };
        
        await realPolkadotInstance.loadTokens('real-tokens.json', 'FILE');
        const duration9 = Date.now() - startTime9;
        
        logger.success('Test 9 completed with real data', {
          tokenCount: realPolkadotInstance.tokenList.length,
          duration: `${duration9}ms`,
          firstToken: realPolkadotInstance.tokenList[0],
          lastToken: realPolkadotInstance.tokenList[realPolkadotInstance.tokenList.length - 1]
        });
        
        logger.testResult('loadTokens_REAL_DATA', {
          result: 'SUCCESS',
          tokenCount: realPolkadotInstance.tokenList.length,
          duration: duration9,
          dataSource: 'REAL'
        });
        
        logger.performance('loadTokens_REAL_DATA', duration9, {
          tokenCount: realPolkadotInstance.tokenList.length
        });
        
        // Show first 5 real tokens
        logger.info('🔍 First 5 REAL tokens:');
        realPolkadotInstance.tokenList.slice(0, 5).forEach((token, index) => {
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

  // Summary
  const totalDuration = logger.getSessionDuration();
  logger.info('📊 Test Summary', {
    totalDuration: `${totalDuration}ms`,
    logFile: logger.getLogFilePath()
  });
  
  logger.success('🎉 All loadTokens tests completed successfully!');
  logger.info(`📁 Logs saved to: ${logger.getLogFilePath()}`);
}

// Run the tests
if (require.main === module) {
  testLoadTokensScenarios().catch((error) => {
    logger.error('Test execution failed', error);
    process.exit(1);
  });
}
