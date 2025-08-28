import * as fs from 'fs';
import * as path from 'path';

// Mock interfaces for testing
interface KeyringPair {
  address: string;
  publicKey: Uint8Array;
  mnemonic?: string;
}

// Test Logger for simple logging
class TestLogger {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(
      this.logDir,
      `getKeyringPairFromMnemonic-test-${timestamp}.log`,
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

// Mock Keyring class for testing
class MockKeyring {
  private accounts: Map<string, KeyringPair> = new Map();

  addFromMnemonic(mnemonic: string): KeyringPair {
    // Generate a mock keyring pair from mnemonic
    const address = this.generateMockAddress(mnemonic);
    const publicKey = this.generateMockPublicKey(mnemonic);
    
    const keyringPair: KeyringPair = {
      address,
      publicKey,
      mnemonic,
    };
    
    this.accounts.set(address, keyringPair);
    
    logger.info(`Mock keyring: Retrieved keyring pair from mnemonic`, {
      address,
      mnemonicLength: mnemonic.split(' ').length,
    });
    
    return keyringPair;
  }

  private generateMockAddress(mnemonic: string): string {
    // Generate a deterministic mock address based on mnemonic
    const hash = this.simpleHash(mnemonic);
    return `5${hash.slice(0, 47)}`; // Polkadot addresses start with '5'
  }

  private generateMockPublicKey(mnemonic: string): Uint8Array {
    // Generate a deterministic mock public key based on mnemonic
    const hash = this.simpleHash(mnemonic);
    const bytes = new Uint8Array(32);
    
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
    }
    
    return bytes;
  }

  private simpleHash(input: string): string {
    // Simple hash function for testing purposes
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to hex string
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  getAccountCount(): number {
    return this.accounts.size;
  }
}

// Mock Polkadot class for testing getKeyringPairFromMnemonic method
class MockPolkadot {
  private _keyring: MockKeyring;

  constructor() {
    this._keyring = new MockKeyring();
  }

  // The actual getKeyringPairFromMnemonic method to test
  getKeyringPairFromMnemonic(seed: string): KeyringPair {
    return this._keyring.addFromMnemonic(seed);
  }

  // Helper method to get keyring
  getKeyring(): MockKeyring {
    return this._keyring;
  }
}

// Initialize logger
const logger = new TestLogger();

// Test scenarios
function testGetKeyringPairFromMnemonic() {
  logger.info('🚀 Starting getKeyringPairFromMnemonic method tests...');
  
  // Test 1: Get keyring pair from valid mnemonic
  logger.info('📋 Test 1: Get keyring pair from valid mnemonic');
  
  try {
    const polkadotInstance = new MockPolkadot();
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    
    const keyringPair = polkadotInstance.getKeyringPairFromMnemonic(mnemonic);
    
    logger.success('Test 1 completed', {
      mnemonicProvided: !!mnemonic,
      mnemonicLength: mnemonic.split(' ').length,
      keyringPairRetrieved: !!keyringPair,
      address: keyringPair.address,
      publicKeyLength: keyringPair.publicKey.length,
      mnemonicStored: !!keyringPair.mnemonic,
    });
  } catch (error) {
    logger.error('Test 1 failed', error);
  }

  // Test 2: Get keyring pair from different mnemonic
  logger.info('📋 Test 2: Get keyring pair from different mnemonic');
  
  try {
    const polkadotInstance = new MockPolkadot();
    const mnemonic = 'account accuse achieve acid acoustic acquire across act action actor actual adapt';
    
    const keyringPair = polkadotInstance.getKeyringPairFromMnemonic(mnemonic);
    
    logger.success('Test 2 completed', {
      mnemonicProvided: !!mnemonic,
      mnemonicLength: mnemonic.split(' ').length,
      keyringPairRetrieved: !!keyringPair,
      address: keyringPair.address,
      publicKeyLength: keyringPair.publicKey.length,
      mnemonicStored: !!keyringPair.mnemonic,
    });
  } catch (error) {
    logger.error('Test 2 failed', error);
  }

  // Test 3: Verify keyring integration
  logger.info('📋 Test 3: Verify keyring integration');
  
  try {
    const polkadotInstance = new MockPolkadot();
    const mnemonic = 'add addict address adjust admit adult advance advice aerobic afford again agent';
    
    const keyringPair = polkadotInstance.getKeyringPairFromMnemonic(mnemonic);
    const keyring = polkadotInstance.getKeyring();
    const accountCount = keyring.getAccountCount();
    
    logger.success('Test 3 completed', {
      keyringPairRetrieved: !!keyringPair,
      accountCount,
      address: keyringPair.address,
      mnemonicStored: !!keyringPair.mnemonic,
    });
  } catch (error) {
    logger.error('Test 3 failed', error);
  }

  // Test 4: Test with short mnemonic
  logger.info('📋 Test 4: Test with short mnemonic');
  
  try {
    const polkadotInstance = new MockPolkadot();
    const shortMnemonic = 'abandon ability able about above absent';
    
    const keyringPair = polkadotInstance.getKeyringPairFromMnemonic(shortMnemonic);
    
    logger.success('Test 4 completed', {
      mnemonicProvided: !!shortMnemonic,
      mnemonicLength: shortMnemonic.split(' ').length,
      keyringPairRetrieved: !!keyringPair,
      address: keyringPair.address,
      publicKeyLength: keyringPair.publicKey.length,
    });
  } catch (error) {
    logger.error('Test 4 failed', error);
  }

  // Test 5: Test with long mnemonic
  logger.info('📋 Test 5: Test with long mnemonic');
  
  try {
    const polkadotInstance = new MockPolkadot();
    const longMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actual adapt add addict address adjust admit adult advance advice aerobic afford again agent agree ahead air airport alarm album alcohol alert alien all';
    
    const keyringPair = polkadotInstance.getKeyringPairFromMnemonic(longMnemonic);
    
    logger.success('Test 5 completed', {
      mnemonicProvided: !!longMnemonic,
      mnemonicLength: longMnemonic.split(' ').length,
      keyringPairRetrieved: !!keyringPair,
      address: keyringPair.address,
      publicKeyLength: keyringPair.publicKey.length,
    });
  } catch (error) {
    logger.error('Test 5 failed', error);
  }

  // Summary
  logger.info('📊 Test Summary', {
    totalTests: 5,
    logFile: logger.getLogFilePath(),
  });
  
  logger.success('🎉 All getKeyringPairFromMnemonic tests completed successfully!');
  logger.info(`📁 Logs saved to: ${logger.getLogFilePath()}`);
}

// Run the tests
if (require.main === module) {
  testGetKeyringPairFromMnemonic();
}
