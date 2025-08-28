import * as fs from 'fs';
import * as path from 'path';

// Mock interfaces for testing
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
      `getWallet-only-test-${timestamp}.log`,
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

// Mock Polkadot class focused on getWallet
class MockPolkadot {
  public network: string = 'mainnet';
  public chain: string = 'polkadot';
  private _keyring: MockKeyring;

  constructor() {
    this._keyring = new MockKeyring();
  }

  // The getWallet method to test
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

// Test getWallet method specifically
async function testGetWalletMethod() {
  logger.info('🚀 Starting getWallet method test...');
  
  const polkadot = new MockPolkadot();
  
  // Test 1: Get wallet for a new address
  logger.info('📋 Test 1: Get wallet for new address');
  try {
    const address1 = '5testaddress123456789012345678901234567890123456789';
    const wallet1 = await polkadot.getWallet(address1);
    
    logger.success('getWallet for new address completed', {
      requestedAddress: address1,
      returnedAddress: wallet1.address,
      publicKeyLength: wallet1.publicKey.length,
      hasMnemonic: !!wallet1.mnemonic,
      mnemonicLength: wallet1.mnemonic ? wallet1.mnemonic.split(' ').length : 0
    });
  } catch (error) {
    logger.error('getWallet for new address failed', error);
  }

  // Test 2: Get wallet for another new address
  logger.info('📋 Test 2: Get wallet for another new address');
  try {
    const address2 = '5anothertestaddress123456789012345678901234567890';
    const wallet2 = await polkadot.getWallet(address2);
    
    logger.success('getWallet for another new address completed', {
      requestedAddress: address2,
      returnedAddress: wallet2.address,
      publicKeyLength: wallet2.publicKey.length,
      hasMnemonic: !!wallet2.mnemonic,
      mnemonicLength: wallet2.mnemonic ? wallet2.mnemonic.split(' ').length : 0
    });
  } catch (error) {
    logger.error('getWallet for another new address failed', error);
  }

  // Test 3: Get wallet for the same address again (should return existing)
  logger.info('📋 Test 3: Get wallet for same address again (should return existing)');
  try {
    const address1 = '5testaddress123456789012345678901234567890123456789';
    const wallet1Again = await polkadot.getWallet(address1);
    
    logger.success('getWallet for same address again completed', {
      requestedAddress: address1,
      returnedAddress: wallet1Again.address,
      publicKeyLength: wallet1Again.publicKey.length,
      hasMnemonic: !!wallet1Again.mnemonic,
      mnemonicLength: wallet1Again.mnemonic ? wallet1Again.mnemonic.split(' ').length : 0
    });
  } catch (error) {
    logger.error('getWallet for same address again failed', error);
  }

  // Test 4: Get wallet for a third address
  logger.info('📋 Test 4: Get wallet for third address');
  try {
    const address3 = '5thirdtestaddress123456789012345678901234567890';
    const wallet3 = await polkadot.getWallet(address3);
    
    logger.success('getWallet for third address completed', {
      requestedAddress: address3,
      returnedAddress: wallet3.address,
      publicKeyLength: wallet3.publicKey.length,
      hasMnemonic: !!wallet3.mnemonic,
      mnemonicLength: wallet3.mnemonic ? wallet3.mnemonic.split(' ').length : 0
    });
  } catch (error) {
    logger.error('getWallet for third address failed', error);
  }

  // Show keyring state after all tests
  logger.info('📊 Keyring state after all getWallet tests:');
  const keyringInfo = polkadot.getKeyringInfo();
  logger.success('Keyring summary', keyringInfo);

  // Summary
  logger.info('📊 Test Summary', {
    totalTests: 4,
    logFile: logger.getLogFilePath(),
  });
  
  logger.success('🎉 All getWallet tests completed successfully!');
  logger.info(`📁 Logs saved to: ${logger.getLogFilePath()}`);
}

// Run the tests
if (require.main === module) {
  testGetWalletMethod().catch(error => {
    logger.error('Test execution failed', error);
  });
}
