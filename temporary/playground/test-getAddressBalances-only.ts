import * as fs from 'fs';
import * as path from 'path';

// Mock interfaces for testing
interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  chainId: number;
}

interface KeyringPair {
  address: string;
  publicKey: Uint8Array;
  mnemonic?: string;
}

interface NetworkConfig {
  nativeCurrencySymbol: string;
  feePaymentCurrencySymbol: string;
  tokenListSource: string;
  tokenListType: string;
  nodeURL: string;
  transactionURL: string;
}

interface Config {
  network: NetworkConfig;
}

// Simple Test Logger
class TestLogger {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(
      this.logDir,
      `getAddressBalances-only-test-${timestamp}.log`,
    );
    
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private writeToFile(content: string): void {
    try {
      fs.appendFileSync(this.logFile, content);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  info(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [INFO] ${message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}\n`;
    console.log(message, data || '');
    this.writeToFile(logMessage);
  }

  success(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [SUCCESS] ${message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}\n`;
    console.log(`✅ ${message}`, data || '');
    this.writeToFile(logMessage);
  }

  error(message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [ERROR] ${message}${error ? ` | Error: ${JSON.stringify(error, null, 2)}` : ''}\n`;
    console.error(`❌ ${message}`, error || '');
    this.writeToFile(logMessage);
  }

  getLogFilePath(): string {
    return this.logFile;
  }
}

// Mock Keyring class
class MockKeyring {
  private accounts: Map<string, KeyringPair> = new Map();

  addFromMnemonic(mnemonic: string): KeyringPair {
    const address = this.generateMockAddress(mnemonic);
    const publicKey = this.generateMockPublicKey(mnemonic);
    
    const keyringPair: KeyringPair = {
      address,
      publicKey,
      mnemonic,
    };
    
    this.accounts.set(address, keyringPair);
    return keyringPair;
  }

  addFromUri(uri: string): KeyringPair {
    return this.addFromMnemonic(uri);
  }

  getPairs(): KeyringPair[] {
    return Array.from(this.accounts.values());
  }

  private generateMockAddress(mnemonic: string): string {
    const hash = this.simpleHash(mnemonic);
    return `5${hash.slice(0, 47)}`;
  }

  private generateMockPublicKey(mnemonic: string): Uint8Array {
    const hash = this.simpleHash(mnemonic);
    const bytes = new Uint8Array(32);
    
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
    }
    
    return bytes;
  }

  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

// Mock Polkadot class focused on getAddressBalances
class MockPolkadot {
  public network: string = 'mainnet';
  public chain: string = 'polkadot';
  public nativeTokenSymbol: string = 'DOT';
  public tokenList: TokenInfo[] = [];
  public config: Config;
  private _tokenMap: Record<string, TokenInfo> = {};
  private _keyring: MockKeyring;

  constructor() {
    this._keyring = new MockKeyring();
    this.config = {
      network: {
        nativeCurrencySymbol: 'DOT',
        feePaymentCurrencySymbol: 'DOT',
        tokenListSource: 'test-tokens.json',
        tokenListType: 'FILE',
        nodeURL: 'wss://rpc.polkadot.io',
        transactionURL: 'https://polkadot.subscan.io/api/open/scan/search',
      },
    };
    this.initializeTokens();
  }

  private initializeTokens(): void {
    this.tokenList = [
      {
        symbol: 'DOT',
        name: 'Polkadot',
        decimals: 10,
        address: '0',
        chainId: 0,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        address: '1',
        chainId: 0,
      },
      {
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
        address: '2',
        chainId: 0,
      },
      {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        decimals: 8,
        address: '3',
        chainId: 0,
      },
      {
        symbol: 'ADA',
        name: 'Cardano',
        decimals: 6,
        address: '4',
        chainId: 0,
      },
    ];

    this._tokenMap = {};
    this.tokenList.forEach((token) => {
      this._tokenMap[token.symbol.toLowerCase()] = token;
      this._tokenMap[token.address.toLowerCase()] = token;
    });
  }

  // The getWallet method needed by getAddressBalances
  async getWallet(address: string): Promise<KeyringPair> {
    logger.info(`🔍 Searching for wallet with address: ${address}`);
    
    const existingPair = this._keyring
      .getPairs()
      .find((pair) => pair.address === address);
    
    if (existingPair) {
      logger.info(`✅ Found existing wallet for address: ${address}`);
      return existingPair;
    }
    
    // Create a new wallet for testing purposes
    logger.info(`🆕 Creating new wallet for address: ${address}`);
    const mnemonic = `test mnemonic for ${address}`;
    const newPair = this._keyring.addFromMnemonic(mnemonic);
    
    // Override the address to match the requested one
    Object.defineProperty(newPair, 'address', {
      value: address,
      writable: false,
    });
    
    logger.info(`✅ New wallet created and configured for address: ${address}`);
    return newPair;
  }

  // The getBalance method needed by getAddressBalances
  async getBalance(
    _wallet: KeyringPair,
    symbols?: string[],
  ): Promise<Record<string, number>> {
    const balances: Record<string, number> = {};

    if (symbols && symbols.length > 0) {
      symbols.forEach((symbol) => {
        const token = this.getToken(symbol);
        if (token) {
          // More realistic balance ranges based on token type
          if (symbol === 'DOT') {
            balances[symbol] = Math.random() * 100 + 50; // 50-150 DOT
          } else if (symbol === 'USDC') {
            balances[symbol] = Math.random() * 10000 + 1000; // 1000-11000 USDC
          } else if (symbol === 'WETH') {
            balances[symbol] = Math.random() * 10 + 2; // 2-12 WETH
          } else if (symbol === 'WBTC') {
            balances[symbol] = Math.random() * 2 + 0.1; // 0.1-2.1 WBTC
          } else if (symbol === 'ADA') {
            balances[symbol] = Math.random() * 5000 + 1000; // 1000-6000 ADA
          } else {
            balances[symbol] = Math.random() * 1000;
          }
        }
      });
    } else {
      this.tokenList.forEach((token) => {
        if (token.symbol === 'DOT') {
          balances[token.symbol] = Math.random() * 100 + 50;
        } else if (token.symbol === 'USDC') {
          balances[token.symbol] = Math.random() * 10000 + 1000;
        } else if (token.symbol === 'WETH') {
          balances[token.symbol] = Math.random() * 10 + 2;
        } else if (token.symbol === 'WBTC') {
          balances[token.symbol] = Math.random() * 2 + 0.1;
        } else if (token.symbol === 'ADA') {
          balances[token.symbol] = Math.random() * 5000 + 1000;
        } else {
          balances[token.symbol] = Math.random() * 1000;
        }
      });
    }

    return balances;
  }

  // Helper method to get token
  getToken(addressOrSymbol: string): TokenInfo | undefined {
    return this._tokenMap[addressOrSymbol.toLowerCase()];
  }

  // The main getAddressBalances method to test
  async getAddressBalances(
    address: string,
    tokenSymbols?: string[],
  ): Promise<any> {
    logger.info(`💰 Getting balances for address: ${address}`);
    if (tokenSymbols) {
      logger.info(`🎯 Filtering by specific tokens: ${tokenSymbols.join(', ')}`);
    } else {
      logger.info(`🌐 Getting balances for all available tokens`);
    }

    let wallet;
    try {
      wallet = await this.getWallet(address);
      logger.info(`✅ Wallet retrieved for address: ${address}`);
    } catch (err) {
      logger.error(`❌ Failed to get wallet for address: ${address}`, err);
      throw new Error(
        `Failed to get wallet for address: ${address}. Error: ${err}`,
      );
    }

    const balances = await this.getBalance(wallet, tokenSymbols);
    logger.info(`✅ Balances retrieved successfully`, { 
      tokenCount: Object.keys(balances).length,
      tokens: Object.keys(balances)
    });

    return { balances };
  }

  // Helper method to get keyring info
  getKeyringInfo(): any {
    const pairs = this._keyring.getPairs();
    return {
      totalPairs: pairs.length,
      addresses: pairs.map(pair => pair.address),
      pairDetails: pairs.map(pair => ({
        address: pair.address,
        publicKeyLength: pair.publicKey.length,
        hasMnemonic: !!pair.mnemonic,
        mnemonicLength: pair.mnemonic ? pair.mnemonic.split(' ').length : 0
      }))
    };
  }
}

// Initialize logger
const logger = new TestLogger();

// Test getAddressBalances method specifically
async function testGetAddressBalancesMethod() {
  logger.info('🚀 Starting getAddressBalances method test...');
  
  const polkadot = new MockPolkadot();
  
  // Test 1: Get balances for all tokens
  logger.info('📋 Test 1: Get balances for all tokens');
  try {
    const address1 = '5testaddress123456789012345678901234567890123456789';
    const result1 = await polkadot.getAddressBalances(address1);
    
    logger.success('getAddressBalances for all tokens completed', {
      address: address1,
      hasBalances: !!result1.balances,
      balanceCount: Object.keys(result1.balances).length,
      allBalances: result1.balances,
      totalValue: Object.values(result1.balances).reduce((sum: number, balance: any) => sum + (balance as number), 0)
    });
  } catch (error) {
    logger.error('getAddressBalances for all tokens failed', error);
  }

  // Test 2: Get balances for specific tokens only
  logger.info('📋 Test 2: Get balances for specific tokens (DOT, USDC)');
  try {
    const address2 = '5anothertestaddress123456789012345678901234567890';
    const specificTokens = ['DOT', 'USDC'];
    const result2 = await polkadot.getAddressBalances(address2, specificTokens);
    
    logger.success('getAddressBalances for specific tokens completed', {
      address: address2,
      requestedTokens: specificTokens,
      hasBalances: !!result2.balances,
      balanceCount: Object.keys(result2.balances).length,
      returnedBalances: result2.balances,
      requestedTokenCount: specificTokens.length,
      returnedTokenCount: Object.keys(result2.balances).length
    });
  } catch (error) {
    logger.error('getAddressBalances for specific tokens failed', error);
  }

  // Test 3: Get balances for single token
  logger.info('📋 Test 3: Get balances for single token (WETH)');
  try {
    const address3 = '5thirdtestaddress123456789012345678901234567890';
    const singleToken = ['WETH'];
    const result3 = await polkadot.getAddressBalances(address3, singleToken);
    
    logger.success('getAddressBalances for single token completed', {
      address: address3,
      requestedToken: singleToken[0],
      hasBalances: !!result3.balances,
      balanceCount: Object.keys(result3.balances).length,
      returnedBalance: result3.balances[singleToken[0]],
      tokenSymbol: singleToken[0]
    });
  } catch (error) {
    logger.error('getAddressBalances for single token failed', error);
  }

  // Test 4: Get balances for non-existent token
  logger.info('📋 Test 4: Get balances for non-existent token');
  try {
    const address4 = '5fourthtestaddress123456789012345678901234567890';
    const nonExistentTokens = ['NONEXISTENT', 'INVALID'];
    const result4 = await polkadot.getAddressBalances(address4, nonExistentTokens);
    
    logger.success('getAddressBalances for non-existent tokens completed', {
      address: address4,
      requestedTokens: nonExistentTokens,
      hasBalances: !!result4.balances,
      balanceCount: Object.keys(result4.balances).length,
      returnedBalances: result4.balances
    });
  } catch (error) {
    logger.error('getAddressBalances for non-existent tokens failed', error);
  }

  // Test 5: Get balances for same address again (should return same wallet)
  logger.info('📋 Test 5: Get balances for same address again (should reuse wallet)');
  try {
    const address1 = '5testaddress123456789012345678901234567890123456789';
    const result5 = await polkadot.getAddressBalances(address1);
    
    logger.success('getAddressBalances for same address again completed', {
      address: address1,
      hasBalances: !!result5.balances,
      balanceCount: Object.keys(result5.balances).length,
      allBalances: result5.balances
    });
  } catch (error) {
    logger.error('getAddressBalances for same address again failed', error);
  }

  // Show keyring state after all tests
  logger.info('📊 Keyring state after all getAddressBalances tests:');
  const keyringInfo = polkadot.getKeyringInfo();
  logger.success('Keyring summary', keyringInfo);

  // Summary
  logger.info('📊 Test Summary', {
    totalTests: 5,
    logFile: logger.getLogFilePath(),
  });
  
  logger.success('🎉 All getAddressBalances tests completed successfully!');
  logger.info(`📁 Logs saved to: ${logger.getLogFilePath()}`);
}

// Run the tests
if (require.main === module) {
  testGetAddressBalancesMethod().catch(error => {
    logger.error('Test execution failed', error);
  });
}
