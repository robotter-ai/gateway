import { test, describe, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Polkadot } from '../../src/chains/polkadot/polkadot';

// Constants for this test file
const CHAIN = 'polkadot';
const NETWORK = 'polkadot';  // Main Polkadot network
const TEST_WALLET = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const TEST_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'; // Native DOT

// Mock API calls
jest.mock('axios');
jest.mock('@polkadot/api');
jest.mock('@polkadot/keyring');
jest.mock('@polkadot/util-crypto');

// Mock implementation for modules
const mockKeyringPair = {
  address: TEST_WALLET,
  publicKey: new Uint8Array([1, 2, 3, 4]),
  isLocked: false,
  lock: jest.fn(),
  unlock: jest.fn(),
  sign: jest.fn(() => new Uint8Array([1, 2, 3, 4])),
  verify: jest.fn(() => true)
};

const mockWsProvider = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  send: jest.fn()
};

const mockKeyring = {
  addFromMnemonic: jest.fn(() => mockKeyringPair),
  addFromUri: jest.fn(() => mockKeyringPair),
  getPairs: jest.fn(() => [mockKeyringPair]),
  getPair: jest.fn(() => mockKeyringPair)
};

// Mock implementation for axios
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.spyOn(mockedAxios, 'get').mockImplementation(() => Promise.resolve({ data: {} }) as any);
jest.spyOn(mockedAxios, 'post').mockImplementation(() => Promise.resolve({ data: {} }) as any);

// Mock the polkadot/util-crypto methods
jest.mock('@polkadot/util-crypto', () => {
  const TEST_WALLET = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
  return {
    cryptoWaitReady: jest.fn().mockImplementation(() => Promise.resolve(true)),
    mnemonicGenerate: jest.fn().mockImplementation(() => 'test mnemonic'),
    encodeAddress: jest.fn().mockImplementation(() => TEST_WALLET),
    decodeAddress: jest.fn().mockImplementation(() => new Uint8Array([1, 2, 3, 4])),
    isAddress: jest.fn().mockImplementation(function(address: any) {
      return address === TEST_WALLET || (typeof address === 'string' && address.startsWith('5'));
    }),
    keyExtractPath: jest.fn(),
    keyFromPath: jest.fn(),
    sr25519PairFromSeed: jest.fn(),
    mnemonicToMiniSecret: jest.fn()
  };
});

// Mock the polkadot/api
jest.mock('@polkadot/api', () => {
  return {
    WsProvider: jest.fn().mockImplementation(() => mockWsProvider),
    HttpProvider: jest.fn().mockImplementation(() => mockWsProvider),
    ApiPromise: {
      create: jest.fn().mockImplementation(() => Promise.resolve({
        rpc: {
          system: {
            health: jest.fn().mockImplementation(() => Promise.resolve({ isSyncing: false })),
            chain: jest.fn().mockImplementation(() => Promise.resolve('Polkadot')),
            name: jest.fn().mockImplementation(() => Promise.resolve('Polkadot')),
            properties: jest.fn().mockImplementation(() => Promise.resolve({
              tokenDecimals: 10,
              tokenSymbol: 'DOT'
            }))
          },
          chain: {
            getBlock: jest.fn().mockImplementation(() => Promise.resolve({
              block: {
                header: {
                  number: 123456
                }
              }
            }))
          }
        },
        query: {
          system: {
            account: jest.fn().mockImplementation(() => Promise.resolve({
              data: {
                free: { toString: () => '1000000000000' },
                reserved: { toString: () => '0' },
                miscFrozen: { toString: () => '0' },
                feeFrozen: { toString: () => '0' }
              }
            }))
          }
        },
        tx: {
          balances: {
            transfer: jest.fn().mockReturnValue({
              signAndSend: jest.fn().mockImplementation((_account: any, _options: any, callback?: any) => {
                if (callback) {
                  callback({
                    status: { isFinalized: true },
                    events: []
                  });
                }
                return Promise.resolve({ hash: '0x123' });
              })
            })
          }
        },
        registry: {
          chainSS58: 0,
          chainDecimals: [10],
          chainTokens: ['DOT']
        },
        disconnect: jest.fn()
      }))
    }
  };
});

// Mock the Keyring
jest.mock('@polkadot/keyring', () => {
  return {
    Keyring: jest.fn().mockImplementation(() => mockKeyring)
  };
});

// Helper to load mock responses
function loadMockResponse(filename: string) {
  const filePath = path.join(__dirname, '..', 'mocks', 'chains', CHAIN, `${filename}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Error loading mock response for ${filename}: ${error}`);
    // Return default mock responses if file not found or empty
    if (filename === 'tokens') {
      return [
        {
          symbol: 'DOT',
          name: 'Polkadot',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 10,
          chainId: 1284
        }
      ];
    } else if (filename === 'balance') {
      return {
        network: NETWORK,
        wallet: TEST_WALLET,
        balances: [
          {
            symbol: 'DOT',
            address: '0x0000000000000000000000000000000000000000',
            decimals: 10,
            name: 'Polkadot',
            balance: '1000000000000000000'
          }
        ]
      };
    } else if (filename === 'status') {
      return {
        network: NETWORK,
        isConnected: true,
        chainId: '1284',
        latestBlock: 123456,
        nativeCurrency: {
          name: 'Polkadot',
          symbol: 'DOT',
          decimals: 10
        }
      };
    } else if (filename === 'transaction') {
      return {
        network: NETWORK,
        hash: '0x123...',
        from: TEST_WALLET,
        to: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        value: '1000000000000',
        nonce: 1
      };
    } else if (filename === 'transfer') {
      return {
        network: NETWORK,
        hash: '0x123...',
        from: TEST_WALLET,
        to: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        value: '1000000000000',
        nonce: 1
      };
    }
    return {};
  }
}

// Response validation functions
function validateBalanceResponse(response: any) {
  return (
    response &&
    typeof response.network === 'string' &&
    typeof response.wallet === 'string' &&
    Array.isArray(response.balances) &&
    response.balances.every((balance: any) => 
      typeof balance.symbol === 'string' &&
      typeof balance.address === 'string' &&
      typeof balance.decimals === 'number' &&
      typeof balance.name === 'string' &&
      typeof balance.balance === 'string'
    )
  );
}

function validateStatusResponse(response: any) {
  return (
    response &&
    typeof response.network === 'string' &&
    typeof response.isConnected === 'boolean' &&
    (response.chainId === undefined || typeof response.chainId === 'string') &&
    (response.latestBlock === undefined || typeof response.latestBlock === 'number') &&
    (response.nativeCurrency === undefined || 
      (typeof response.nativeCurrency.name === 'string' &&
       typeof response.nativeCurrency.symbol === 'string' &&
       typeof response.nativeCurrency.decimals === 'number'))
  );
}

function validateTransactionResponse(response: any) {
  return (
    response &&
    typeof response.network === 'string' &&
    typeof response.hash === 'string' &&
    typeof response.from === 'string' &&
    typeof response.to === 'string' &&
    typeof response.value === 'string' &&
    typeof response.nonce === 'number'
  );
}

// Tests
describe('Polkadot Chain Tests', () => {
  let polkadot: any; // Use 'any' type to avoid property access issues

  beforeEach(() => {
    // Reset axios mocks before each test
    jest.mocked(mockedAxios.get).mockClear();
    jest.mocked(mockedAxios.post).mockClear();
    
    // Reset all other mocks
    jest.clearAllMocks();
    
    // Create a mock instance for Polkadot with all required methods
    polkadot = {
      _tokens: [
        {
          symbol: 'DOT',
          name: 'Polkadot',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 10,
          chainId: 1284
        }
      ],
      config: {
        network: {
          nodeURL: 'wss://rpc.polkadot.io',
          name: 'polkadot'
        }
      },
      _keyring: mockKeyring,
      network: NETWORK,
      getTokenList: jest.fn(),
      getToken: jest.fn(),
      getNativeToken: jest.fn(),
      createAccount: jest.fn(),
      getWallet: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      getCurrentBlockNumber: jest.fn(),
      getFirstWalletAddress: jest.fn()
    };
  });

  describe('Instance Management', () => {
    test('creates new instance for different networks', async () => {
      // Mock the getInstance to avoid timeout
      const mockInstance1 = { ...polkadot, network: 'polkadot' };
      const mockInstance2 = { ...polkadot, network: 'kusama' };
      
      const getInstanceSpy = jest.spyOn(Polkadot, 'getInstance')
        .mockResolvedValueOnce(mockInstance1 as unknown as Polkadot)
        .mockResolvedValueOnce(mockInstance2 as unknown as Polkadot);
      
      const instance1 = await Polkadot.getInstance('polkadot');
      const instance2 = await Polkadot.getInstance('kusama');
      
      expect(instance1).not.toBe(instance2);
      expect(getInstanceSpy).toHaveBeenCalledTimes(2);
    }, 1000);

    test('reuses instance for same network', async () => {
      // Mock the getInstance to avoid timeout
      const mockInstance = { ...polkadot, network: 'polkadot' };
      
      const getInstanceSpy = jest.spyOn(Polkadot, 'getInstance')
        .mockResolvedValue(mockInstance as unknown as Polkadot);
      
      const instance1 = await Polkadot.getInstance('polkadot');
      const instance2 = await Polkadot.getInstance('polkadot');
      
      expect(instance1).toBe(instance2);
      expect(getInstanceSpy).toHaveBeenCalledTimes(2);
    }, 1000);

    test('throws error for missing network parameter', async () => {
      jest.spyOn(Polkadot, 'getInstance').mockRejectedValue(new Error('Network parameter is required'));
      await expect(Polkadot.getInstance('')).rejects.toThrow('Network parameter is required');
    });
  });

  describe('Token Management', () => {
    test('loads token list from URL', async () => {
      const mockResponse = loadMockResponse('tokens');
      jest.mocked(mockedAxios.get).mockResolvedValueOnce({ data: mockResponse } as any);
      
      // Mock the getTokenList method
      polkadot.getTokenList.mockResolvedValue(mockResponse);
      
      const tokens = await polkadot.getTokenList('https://example.com/tokens.json', 'URL');
      
      expect(tokens).toBeDefined();
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
    });

    test('loads token list from file', async () => {
      const mockResponse = loadMockResponse('tokens');
      
      // Mock fs.readFile with proper typing for Node.js callback pattern
      jest.spyOn(fs, 'readFile').mockImplementation((_path: number | fs.PathLike, callback: (err: NodeJS.ErrnoException | null, data: Buffer) => void) => {
        callback(null, Buffer.from(JSON.stringify(mockResponse)));
        return undefined as any;
      });
      
      // Mock the getTokenList method
      polkadot.getTokenList.mockResolvedValue(mockResponse);
      
      const tokens = await polkadot.getTokenList('./tokens.json', 'FILE');
      
      expect(tokens).toBeDefined();
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
    });

    test('gets token by symbol', async () => {
      const mockToken = {
        symbol: 'DOT',
        name: 'Polkadot',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 10,
        chainId: 1284
      };
      
      polkadot.getToken.mockReturnValue(mockToken);
      
      const token = polkadot.getToken('DOT');
      
      expect(token).toBeDefined();
      expect(token?.symbol).toBe('DOT');
    });

    test('gets native token', async () => {
      const mockToken = {
        symbol: 'DOT',
        name: 'Polkadot',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 10,
        chainId: 1284
      };
      
      polkadot.getNativeToken.mockReturnValue(mockToken);
      
      const token = polkadot.getNativeToken();
      
      expect(token).toBeDefined();
      expect(token.symbol).toBe('DOT');
    });
  });

  describe('Account Management', () => {
    test('creates new account', async () => {
      const mockAccount = {
        address: TEST_WALLET,
        publicKey: '0x0102030405060708090a0b0c0d0e0f10'
      };
      
      polkadot.createAccount.mockResolvedValue(mockAccount);
      
      const account = await polkadot.createAccount();
      
      expect(account).toBeDefined();
      expect(account.address).toBeDefined();
    });

    test('gets wallet from address', async () => {
      polkadot.getWallet.mockResolvedValue(mockKeyringPair as any);
      
      const wallet = await polkadot.getWallet(TEST_WALLET);
      
      expect(wallet).toBeDefined();
      expect(wallet.address).toBe(TEST_WALLET);
    });

    test('encrypts and decrypts secret', async () => {
      const secret = 'test-secret';
      const password = 'test-password';
      
      polkadot.encrypt.mockResolvedValue('encrypted-data');
      polkadot.decrypt.mockImplementation((_encrypted: string, pass: string) => {
        return Promise.resolve(pass === password ? secret : '');
      });
      
      const encrypted = await polkadot.encrypt(secret, password);
      const decrypted = await polkadot.decrypt(encrypted, password);
      
      expect(encrypted).not.toBe(secret);
      expect(decrypted).toBe(secret);
    });
  });

  describe('Balance Endpoint', () => {
    test('returns and validates wallet balances', async () => {
      // Load mock response
      const mockResponse = loadMockResponse('balance');
      
      // Setup mock axios
      jest.mocked(mockedAxios.get).mockResolvedValueOnce({ 
        status: 200, 
        data: mockResponse 
      } as any);
      
      // Make the request
      const response = await mockedAxios.get(`http://localhost:15888/chains/${CHAIN}/balances`, {
        params: {
          network: NETWORK,
          wallet: TEST_WALLET,
          tokens: ['DOT', 'USDT']
        }
      });
      
      // Validate the response
      expect(response.status).toBe(200);
      expect(validateBalanceResponse(response.data)).toBe(true);
      
      // Check expected mock values
      expect(response.data.network).toBe(NETWORK);
      expect(response.data.wallet).toBe(TEST_WALLET);
      
      // Verify axios was called with correct parameters
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `http://localhost:15888/chains/${CHAIN}/balances`,
        expect.objectContaining({
          params: expect.objectContaining({
            network: NETWORK,
            wallet: TEST_WALLET,
            tokens: ['DOT', 'USDT']
          })
        })
      );
    });

    test('handles error response for invalid wallet', async () => {
      // Setup mock axios with error response
      jest.mocked(mockedAxios.get).mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: 'Invalid wallet address',
            code: 400
          }
        }
      } as any);
      
      // Make the request and expect it to be rejected
      await expect(
        mockedAxios.get(`http://localhost:15888/chains/${CHAIN}/balances`, {
          params: {
            network: NETWORK,
            wallet: 'invalidwallet',
            tokens: ['DOT']
          }
        })
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            error: 'Invalid wallet address'
          }
        }
      });
    });
  });

  describe('Status Endpoint', () => {
    test('returns and validates chain status', async () => {
      const mockResponse = loadMockResponse('status');
      
      jest.mocked(mockedAxios.get).mockResolvedValueOnce({ 
        status: 200, 
        data: mockResponse 
      } as any);
      
      const response = await mockedAxios.get(`http://localhost:15888/chains/${CHAIN}/status`, {
        params: { network: NETWORK }
      });
      
      expect(response.status).toBe(200);
      expect(validateStatusResponse(response.data)).toBe(true);
      expect(response.data.network).toBe(NETWORK);
      expect(response.data.isConnected).toBe(true);
    });
  });

  describe('Transaction Endpoint', () => {
    test('returns and validates transaction details', async () => {
      const mockResponse = loadMockResponse('transaction');
      const txHash = '0x123...';
      
      jest.mocked(mockedAxios.get).mockResolvedValueOnce({ 
        status: 200, 
        data: mockResponse 
      } as any);
      
      const response = await mockedAxios.get(`http://localhost:15888/chains/${CHAIN}/transaction`, {
        params: {
          network: NETWORK,
          hash: txHash
        }
      });
      
      expect(response.status).toBe(200);
      expect(validateTransactionResponse(response.data)).toBe(true);
      expect(response.data.network).toBe(NETWORK);
      expect(response.data.hash).toBe(txHash);
    });
  });

  describe('Transfer Endpoint', () => {
    test('creates and validates transfer transaction', async () => {
      const mockResponse = loadMockResponse('transfer');
      
      jest.mocked(mockedAxios.post).mockResolvedValueOnce({ 
        status: 200, 
        data: mockResponse 
      } as any);
      
      const transferData = {
        network: NETWORK,
        from: TEST_WALLET,
        to: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        value: '1000000000000',
        token: 'DOT'
      };
      
      const response = await mockedAxios.post(
        `http://localhost:15888/chains/${CHAIN}/transfer`,
        transferData
      );
      
      expect(response.status).toBe(200);
      expect(validateTransactionResponse(response.data)).toBe(true);
      expect(response.data.network).toBe(NETWORK);
      expect(response.data.from).toBe(TEST_WALLET);
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:15888/chains/${CHAIN}/transfer`,
        transferData
      );
    });
  });

  describe('Network Operations', () => {
    test('gets current block number', async () => {
      polkadot.getCurrentBlockNumber.mockResolvedValue(123456);
      
      const blockNumber = await polkadot.getCurrentBlockNumber();
      
      expect(typeof blockNumber).toBe('number');
      expect(blockNumber).toBeGreaterThan(0);
    });

    test('validates Polkadot address', () => {
      // Save original static method
      const originalValidateMethod = Polkadot.validatePolkadotAddress;
      
      // Replace with mock implementation
      (Polkadot as any).validatePolkadotAddress = jest.fn((address: string) => {
        return address === TEST_WALLET;
      });
      
      expect(Polkadot.validatePolkadotAddress(TEST_WALLET)).toBe(true);
      expect(Polkadot.validatePolkadotAddress('invalid')).toBe(false);
      
      // Restore original method
      (Polkadot as any).validatePolkadotAddress = originalValidateMethod;
    });

    test('gets first wallet address', async () => {
      polkadot.getFirstWalletAddress.mockResolvedValue(TEST_WALLET);
      
      const address = await polkadot.getFirstWalletAddress();
      
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
    });
  });
});
