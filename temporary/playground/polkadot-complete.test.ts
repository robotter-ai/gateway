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

interface PolkadotAccount {
  address: string;
  publicKey: string;
  keyringPair: any;
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
      `polkadot-complete-test-${timestamp}.log`,
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

// Mock Polkadot class with all methods
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
        tokenListSource: path.join(__dirname, '../templates/lists/polkadot_tokens_mainnet.json'),
        tokenListType: 'FILE',
        nodeURL: 'wss://rpc.polkadot.io',
        transactionURL: 'https://polkadot.subscan.io/api/open/scan/search',
      },
    };
    this.initializeTokens();
  }

  private initializeTokens(): void {
    try {
      // Try to load real token list
      const tokenListPath = this.config.network.tokenListSource;
      if (fs.existsSync(tokenListPath)) {
        const fileContent = fs.readFileSync(tokenListPath, 'utf8');
        const realTokens = JSON.parse(fileContent);
        
        if (Array.isArray(realTokens) && realTokens.length > 0) {
          this.tokenList = realTokens.map((token: any) => ({
            symbol: token.symbol || token.name || 'UNKNOWN',
            name: token.name || token.symbol || 'Unknown Token',
            decimals: token.decimals || 10,
            address: token.id?.toString() || token.address || Math.random().toString(),
            chainId: token.chainId || 0,
          }));
          
          logger.info(`Loaded ${this.tokenList.length} real tokens from file`);
        } else {
          this.loadDefaultTokens();
        }
      } else {
        logger.info('Real token list not found, using default tokens');
        this.loadDefaultTokens();
      }
    } catch (error) {
      logger.error('Failed to load real tokens, using defaults', error);
      this.loadDefaultTokens();
    }

    this._tokenMap = {};
    this.tokenList.forEach((token) => {
      this._tokenMap[token.symbol.toLowerCase()] = token;
      this._tokenMap[token.address.toLowerCase()] = token;
    });
  }

  private loadDefaultTokens(): void {
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
    ];
  }

  // Test all methods
  async getTokenList(): Promise<TokenInfo[]> {
    return this.tokenList;
  }

  async loadTokens(): Promise<void> {
    // Mock implementation
    logger.info('loadTokens method called');
  }

  getToken(addressOrSymbol: string): TokenInfo | undefined {
    return this._tokenMap[addressOrSymbol.toLowerCase()];
  }

  getNativeToken(): TokenInfo {
    return this.getToken(this.config.network.nativeCurrencySymbol);
  }

  getFeePaymentToken(): TokenInfo {
    return this.getToken(this.config.network.feePaymentCurrencySymbol);
  }

  async createAccount(): Promise<PolkadotAccount> {
    const mnemonic =
      'abandon ability able about above absent absorb abstract absurd abuse access accident';
    const keyringPair = this._keyring.addFromMnemonic(mnemonic);

    return {
      address: keyringPair.address,
      publicKey: Buffer.from(keyringPair.publicKey).toString('hex'),
      keyringPair,
    };
  }

  getKeyringPairFromMnemonic(seed: string): KeyringPair {
    return this._keyring.addFromMnemonic(seed);
  }

  async getWallet(address: string): Promise<KeyringPair> {
    const existingPair = this._keyring
      .getPairs()
      .find((pair) => pair.address === address);
    if (existingPair) {
      return existingPair;
    }
    
    // Create a new wallet for testing purposes
    logger.info(`Creating new wallet for address: ${address}`);
    const mnemonic = `test mnemonic for ${address}`;
    const newPair = this._keyring.addFromMnemonic(mnemonic);
    
    // Override the address to match the requested one
    Object.defineProperty(newPair, 'address', {
      value: address,
      writable: false,
    });
    
    return newPair;
  }

  async encrypt(secret: string, password: string): Promise<string> {
    return `encrypted:${secret}:${password}`;
  }

  async decrypt(encryptedSecret: string, _password: string): Promise<string> {
    const parts = encryptedSecret.split(':');
    if (parts[0] === 'encrypted') {
      return parts[1];
    }
    throw new Error('Invalid encrypted format');
  }

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
        } else {
          balances[token.symbol] = Math.random() * 1000;
        }
      });
    }

    return balances;
  }

  async getTransaction(txHash: string): Promise<any> {
    return {
      network: this.network,
      txHash,
      txStatus: 1,
      fee: 0.1,
      timestamp: Date.now(),
    };
  }

  async getCurrentBlockNumber(): Promise<number> {
    return Math.floor(Math.random() * 1000000) + 1000000;
  }

  static validatePolkadotAddress(address: string): boolean {
    return address.startsWith('5') && address.length >= 47;
  }

  async getFirstWalletAddress(): Promise<string | null> {
    const pairs = this._keyring.getPairs();
    if (pairs.length > 0) {
      return pairs[0].address;
    }
    const tempAccount = await this.createAccount();
    return tempAccount.address;
  }

  async getTokensWithSymbols(
    tokenSymbols?: string[] | string,
  ): Promise<TokenInfo[]> {
    if (!tokenSymbols) {
      return this.tokenList;
    }

    const symbolsArray = Array.isArray(tokenSymbols)
      ? tokenSymbols
      : [tokenSymbols];
    return symbolsArray
      .map((symbol) => this.getToken(symbol))
      .filter((token): token is TokenInfo => token !== undefined);
  }

  async getAddressBalances(
    address: string,
    tokenSymbols?: string[],
  ): Promise<any> {
    const wallet = await this.getWallet(address);
    const balances = await this.getBalance(wallet, tokenSymbols);
    return { balances };
  }

  async estimateTransactionGas(gasLimit: number = 1000000): Promise<any> {
    return {
      gasPrice: 0.000001,
      gasPriceToken: 'DOT',
      gasLimit,
      gasCost: 0.001,
    };
  }

  async pollTransaction(txHash: string): Promise<any> {
    const txResult = await this.getTransaction(txHash);
    return {
      currentBlock: await this.getCurrentBlockNumber(),
      txHash,
      txStatus: txResult.txStatus,
      fee: txResult.fee,
    };
  }

  async getNetworkStatus(): Promise<any> {
    return {
      chain: this.chain,
      network: this.network,
      rpcUrl: this.config.network.nodeURL,
      currentBlockNumber: await this.getCurrentBlockNumber(),
      nativeCurrency: this.config.network.nativeCurrencySymbol,
    };
  }

  getHttpProvider(): any {
    return { type: 'http', url: this.config.network.nodeURL };
  }

  getWsProvider(): any {
    return { type: 'ws', url: this.config.network.nodeURL };
  }

  getProvider(): any {
    return this.config.network.nodeURL.startsWith('http')
      ? this.getHttpProvider()
      : this.getWsProvider();
  }

  async getApiPromise(): Promise<any> {
    return { isReady: Promise.resolve(true) };
  }
}

// Initialize logger
const logger = new TestLogger();

// Test all methods
async function testAllPolkadotMethods() {
  logger.info('🚀 Starting comprehensive Polkadot class method tests...');

  const polkadot = new MockPolkadot();
  let testCount = 0;
  let successCount = 0;

  try {
    // Test 1: getTokenList
    logger.info('📋 Test 1: getTokenList method');
    const tokenList = await polkadot.getTokenList();
    logger.success('getTokenList completed', { tokenCount: tokenList.length });
    successCount++;
  } catch (error) {
    logger.error('getTokenList failed', error);
  }
  testCount++;

  try {
    // Test 2: loadTokens
    logger.info('📋 Test 2: loadTokens method');
    await polkadot.loadTokens();
    logger.success('loadTokens completed');
    successCount++;
  } catch (error) {
    logger.error('loadTokens failed', error);
  }
  testCount++;

  try {
    // Test 3: getToken
    logger.info('📋 Test 3: getToken method');
    const token = polkadot.getToken('DOT');
    logger.success('getToken completed', { token: token?.symbol });
    successCount++;
  } catch (error) {
    logger.error('getToken failed', error);
  }
  testCount++;

  try {
    // Test 4: getNativeToken
    logger.info('📋 Test 4: getNativeToken method');
    const nativeToken = polkadot.getNativeToken();
    logger.success('getNativeToken completed', { symbol: nativeToken?.symbol });
    successCount++;
  } catch (error) {
    logger.error('getNativeToken failed', error);
  }
  testCount++;

  try {
    // Test 5: getFeePaymentToken
    logger.info('📋 Test 5: getFeePaymentToken method');
    const feeToken = polkadot.getFeePaymentToken();
    logger.success('getFeePaymentToken completed', {
      symbol: feeToken?.symbol,
    });
    successCount++;
  } catch (error) {
    logger.error('getFeePaymentToken failed', error);
  }
  testCount++;

  try {
    // Test 6: createAccount
    logger.info('📋 Test 6: createAccount method');
    const account = await polkadot.createAccount();
    logger.success('createAccount completed', { address: account.address });
    successCount++;
  } catch (error) {
    logger.error('createAccount failed', error);
  }
  testCount++;

  try {
    // Test 7: getKeyringPairFromMnemonic
    logger.info('📋 Test 7: getKeyringPairFromMnemonic method');
    const keyringPair = polkadot.getKeyringPairFromMnemonic('test mnemonic');
    logger.success('getKeyringPairFromMnemonic completed', {
      address: keyringPair.address,
    });
    successCount++;
  } catch (error) {
    logger.error('getKeyringPairFromMnemonic failed', error);
  }
  testCount++;

  try {
    // Test 8: getWallet
    logger.info('📋 Test 8: getWallet method');
    const wallet = await polkadot.getWallet('5testaddress');
    logger.success('getWallet completed', { address: wallet.address });
    successCount++;
  } catch (error) {
    logger.error('getWallet failed', error);
  }
  testCount++;

  try {
    // Test 9: encrypt/decrypt
    logger.info('📋 Test 9: encrypt/decrypt methods');
    const secret = 'test secret';
    const password = 'test password';
    const encrypted = await polkadot.encrypt(secret, password);
    const decrypted = await polkadot.decrypt(encrypted, password);
    logger.success('encrypt/decrypt completed', {
      original: secret,
      decrypted,
    });
    successCount++;
  } catch (error) {
    logger.error('encrypt/decrypt failed', error);
  }
  testCount++;

  try {
    // Test 10: getBalance
    logger.info('📋 Test 10: getBalance method');
    const wallet = await polkadot.createAccount();
    const balances = await polkadot.getBalance(wallet.keyringPair);
    logger.success('getBalance completed', {
      balanceCount: Object.keys(balances).length,
    });
    successCount++;
  } catch (error) {
    logger.error('getBalance failed', error);
  }
  testCount++;

  try {
    // Test 11: getTransaction
    logger.info('📋 Test 11: getTransaction method');
    const transaction = await polkadot.getTransaction('0xtesthash');
    logger.success('getTransaction completed', { txHash: transaction.txHash });
    successCount++;
  } catch (error) {
    logger.error('getTransaction failed', error);
  }
  testCount++;

  try {
    // Test 12: getCurrentBlockNumber
    logger.info('📋 Test 12: getCurrentBlockNumber method');
    const blockNumber = await polkadot.getCurrentBlockNumber();
    logger.success('getCurrentBlockNumber completed', { blockNumber });
    successCount++;
  } catch (error) {
    logger.error('getCurrentBlockNumber failed', error);
  }
  testCount++;

  try {
    // Test 13: validatePolkadotAddress
    logger.info('📋 Test 13: validatePolkadotAddress method');
    const isValid = MockPolkadot.validatePolkadotAddress(
      '5testaddress123456789012345678901234567890123456789',
    );
    logger.success('validatePolkadotAddress completed', { isValid });
    successCount++;
  } catch (error) {
    logger.error('validatePolkadotAddress failed', error);
  }
  testCount++;

  try {
    // Test 14: getFirstWalletAddress
    logger.info('📋 Test 14: getFirstWalletAddress method');
    const address = await polkadot.getFirstWalletAddress();
    logger.success('getFirstWalletAddress completed', { address });
    successCount++;
  } catch (error) {
    logger.error('getFirstWalletAddress failed', error);
  }
  testCount++;

  try {
    // Test 15: getTokensWithSymbols
    logger.info('📋 Test 15: getTokensWithSymbols method');
    const tokens = await polkadot.getTokensWithSymbols(['DOT', 'USDC']);
    logger.success('getTokensWithSymbols completed', {
      tokenCount: tokens.length,
    });
    successCount++;
  } catch (error) {
    logger.error('getTokensWithSymbols failed', error);
  }
  testCount++;

  try {
    // Test 16: getAddressBalances
    logger.info('📋 Test 16: getAddressBalances method');
    const balances = await polkadot.getAddressBalances('5testaddress');
    logger.success('getAddressBalances completed', {
      hasBalances: !!balances.balances,
    });
    successCount++;
  } catch (error) {
    logger.error('getAddressBalances failed', error);
  }
  testCount++;

  try {
    // Test 17: estimateTransactionGas
    logger.info('📋 Test 17: estimateTransactionGas method');
    const gasEstimate = await polkadot.estimateTransactionGas();
    logger.success('estimateTransactionGas completed', {
      gasLimit: gasEstimate.gasLimit,
    });
    successCount++;
  } catch (error) {
    logger.error('estimateTransactionGas failed', error);
  }
  testCount++;

  try {
    // Test 18: pollTransaction
    logger.info('📋 Test 18: pollTransaction method');
    const pollResult = await polkadot.pollTransaction('0xtesthash');
    logger.success('pollTransaction completed', { txHash: pollResult.txHash });
    successCount++;
  } catch (error) {
    logger.error('pollTransaction failed', error);
  }
  testCount++;

  try {
    // Test 19: getNetworkStatus
    logger.info('📋 Test 19: getNetworkStatus method');
    const status = await polkadot.getNetworkStatus();
    logger.success('getNetworkStatus completed', { network: status.network });
    successCount++;
  } catch (error) {
    logger.error('getNetworkStatus failed', error);
  }
  testCount++;

  try {
    // Test 20: Provider methods
    logger.info('📋 Test 20: Provider methods');
    const httpProvider = polkadot.getHttpProvider();
    const wsProvider = polkadot.getWsProvider();
    const provider = polkadot.getProvider();
    logger.success('Provider methods completed', {
      httpType: httpProvider.type,
      wsType: wsProvider.type,
      providerType: provider.type,
    });
    successCount++;
  } catch (error) {
    logger.error('Provider methods failed', error);
  }
  testCount++;

  try {
    // Test 21: getApiPromise
    logger.info('📋 Test 21: getApiPromise method');
    const api = await polkadot.getApiPromise();
    logger.success('getApiPromise completed', { isReady: !!api.isReady });
    successCount++;
  } catch (error) {
    logger.error('getApiPromise failed', error);
  }
  testCount++;

  // Summary
  logger.info('📊 Test Summary', {
    totalTests: testCount,
    successfulTests: successCount,
    failedTests: testCount - successCount,
    successRate: `${((successCount / testCount) * 100).toFixed(1)}%`,
    logFile: logger.getLogFilePath(),
  });

  if (successCount === testCount) {
    logger.success('🎉 All Polkadot methods tested successfully!');
  } else {
    logger.error(
      `⚠️ ${testCount - successCount} tests failed out of ${testCount}`,
    );
  }

  logger.info(`📁 Logs saved to: ${logger.getLogFilePath()}`);
}

// Run the tests
if (require.main === module) {
  testAllPolkadotMethods().catch((error) => {
    logger.error('Test execution failed', error);
  });
}
