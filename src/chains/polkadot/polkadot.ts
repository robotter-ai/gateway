import LRUCache from 'lru-cache';
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { getPolkadotConfiguration } from './polkadot.config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
// noinspection ES6PreferShortImport
import { TokenListType, walletPath } from '../../services/base';
import axios from 'axios';
import { Asset } from '@galacticcouncil/sdk';
import { promises as fs } from 'fs';
import { PolkadotController } from './polkadot.controller';
// noinspection ES6PreferShortImport
import { ConfigManagerCertPassphrase } from '../../services/config-manager-cert-passphrase';
import fse from 'fs-extra';
import { BigNumber } from 'bignumber.js';
// noinspection ES6PreferShortImport
import { PollResponse } from '../../network/network.requests';
// noinspection ES6PreferShortImport
import { HydrationTransaction } from '../../connectors/hydration/hydration.types';

type AssetListType = TokenListType;
export class Polkadot {
  private _assetMap: Record<string, Asset> = {};
  private static _instances: LRUCache<string, Polkadot>;
  private _chain: string = 'polkadot';
  private readonly _network: string;
  private polkadotApi: ApiPromise;
  private readonly _keyring: Keyring;
  private readonly _assetListType: AssetListType;
  private readonly _assetListSource: string;
  private _ready: boolean = false;
  public gasPrice: number;
  public gasLimit: number;
  public gasCost: number;
  public nodeUrl: string;
  public controller: typeof PolkadotController;
  public nativeTokenSymbol: string;

  constructor(
    network: string,
    nodeUrl: string,
    assetListType: AssetListType,
    assetListSource: string,
  ) {
    const config = getPolkadotConfiguration(network);
    this._network = network;
    this.nativeTokenSymbol = config.nativeCurrencySymbol;
    this.gasPrice = 0;
    this.nodeUrl = nodeUrl;
    this.polkadotApi = new ApiPromise({ provider: new WsProvider(nodeUrl) });
    this._keyring = new Keyring({ type: 'sr25519' });
    this._assetListType = assetListType;
    this._assetListSource = assetListSource;
    this.gasLimit = 0;
    this.gasCost = 0;
    this.controller = PolkadotController;
  }
  public get polkadot(): ApiPromise {
    return this.polkadotApi;
  }
  public get chain(): string {
    return this._chain;
  }

  public get network(): string {
    return this._network;
  }
  public get keyring(): Keyring {
    return this._keyring;
  }

  public get storedAssetList(): Asset[] {
    return Object.values(this._assetMap);
  }
  public ready(): boolean {
    return this._ready;
  }
  public async init(): Promise<void> {
    const provider = new WsProvider(this.nodeUrl);
    this.polkadotApi = await ApiPromise.create({ provider });
    await this.loadAssets();
    this._ready = true;
    return;
  }
  async close() {
    return;
  }

  public static getInstance(network: string): Polkadot {
    const config = getPolkadotConfiguration(network);
    if (Polkadot._instances === undefined) {
      Polkadot._instances = new LRUCache<string, Polkadot>({
        max: config.network.maximumLRUCacheInstances,
      });
    }
    if (!Polkadot._instances.has(config.network.name)) {
      if (network !== null) {
        const nodeUrl = config.network.nodeURL;
        const assetListType = config.network.assetListType as TokenListType;
        const assetListSource = config.network.assetListSource;
        Polkadot._instances.set(
          config.network.name,
          new Polkadot(network, nodeUrl, assetListType, assetListSource),
        );
      } else {
        throw new Error(
          `Polkadot.getInstance received an unexpected network: ${network}.`,
        );
      }
    }
    return Polkadot._instances.get(config.network.name) as Polkadot;
  }

  public static getConnectedInstances(): { [name: string]: Polkadot } {
    const connectedInstances: { [name: string]: Polkadot } = {};
    if (this._instances !== undefined) {
      const keys = Array.from(this._instances.keys());
      for (const instance of keys) {
        if (instance !== undefined) {
          connectedInstances[instance] = this._instances.get(
            instance,
          ) as Polkadot;
        }
      }
    }
    return connectedInstances;
  }

  public async getCurrentBlockNumber(): Promise<number> {
    const header = await this.polkadotApi.rpc.chain.getHeader();
    return header.number.toNumber();
  }

  public getAssetForSymbol(symbol: string): Asset | null {
    return this._assetMap[symbol] ? this._assetMap[symbol] : null;
  }

  public async getNativeBalance(accountAddress: string): Promise<string> {
    const wsProvider = new WsProvider('wss://rpc.hydradx.cloud'); // TODO remove and use hydration!!!
    const api = await ApiPromise.create({ provider: wsProvider });

    const { data: balance } = (await api.query.system.account(
      accountAddress,
    )) as any;

    const decimals = this._assetMap['HDX'].decimals || 12;

    return BigNumber(balance.free?.toString() ?? '0')
      .div(BigNumber(Math.pow(10, decimals)))
      .toFixed(decimals);
  }

  public async getAssetBalance(
    accountAddress: string,
    tokenSymbol: string,
  ): Promise<string> {
    const token = this._assetMap[tokenSymbol];
    if (!token) {
      throw new Error(`Token ${tokenSymbol} not found`);
    }
    const wsProvider = new WsProvider('wss://rpc.hydradx.cloud'); // TODO remove and use hydration!!!
    const api = await ApiPromise.create({ provider: wsProvider });

    const assetBalance = (await api.query.tokens.accounts(
      accountAddress,
      token.id,
    )) as any;

    // noinspection UnnecessaryLocalVariableJS
    const freeBalance = new BigNumber(String(assetBalance?.free || 0))
      .div(new BigNumber(Math.pow(10, token.decimals)))
      .toFixed(token.decimals);

    return freeBalance;
  }

  /**
   * Retrieves extrinsic (transaction) information from Subscan.
   *
   * @param txHash - The extrinsic (transaction) hash (e.g. "0x1234abcd...")
   * @returns A promise resolving to the extrinsic information.
   */
  public async getTransaction(txHash: string): Promise<PollResponse> {
    const url = 'https://hydration.api.subscan.io/api/scan/extrinsic';

    const headers = {
      'Content-Type': 'application/json',
    };

    const body = {
      hash: txHash,
    };

    const response = await axios.post<HydrationTransaction>(url, body, {
      headers,
    });

    const transaction: HydrationTransaction = response.data;

    return {
      network: null,
      timestamp: transaction.generated_at,
      currentBlock: null,
      txHash: transaction.data.extrinsic_hash,
      txStatus: transaction.data.success ? 'success' : 'failed',
      txBlock: transaction.data.block_hash,
      txData: transaction.data,
      txReceipt: null,
      tokenId: null,
    } as unknown as PollResponse;
  }

  public encrypt(mnemonic: string, password: string): string {
    const iv = randomBytes(16);
    const key = Buffer.alloc(32);
    key.write(password);

    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(mnemonic), cipher.final()]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  public decrypt(encryptedMnemonic: string, password: string): string {
    const [iv, encryptedKey] = encryptedMnemonic.split(':');
    const key = Buffer.alloc(32);
    key.write(password);
    const decipher = createDecipheriv(
      'aes-256-cbc',
      key,
      Buffer.from(iv, 'hex'),
    );

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedKey, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString();
  }

  public async getAccountFromPrivateKey(
    seed: string,
  ): Promise<{ keyPair: any; address: string }> {
    //Extracts the phrase, path and password from a SURI format for specifying secret keys <secret>/<soft-key>//<hard-key>///<password> (the ///password may be omitted, and /<soft-key> and //<hard-key> maybe repeated and mixed). The secret can be a hex string, mnemonic phrase or a string (to be padded)

    const keyPair = this.keyring.addFromUri(seed);
    const address = keyPair.address;

    return {
      keyPair,
      address,
    };
  }

  async getAccountFromAddress(address: string) {
    const path = `${walletPath}/${this._chain}`;
    const encryptedMnemonic: string = await fse.readFile(
      `${path}/${address}.json`,
      'utf8',
    );
    const passphrase = ConfigManagerCertPassphrase.readPassphrase();
    if (!passphrase) {
      throw new Error('missing passphrase');
    }
    const mnemonic = this.decrypt(encryptedMnemonic, passphrase);
    console.log(encryptedMnemonic);

    return this.keyring.addFromUri(mnemonic);
  }

  private async loadAssets(): Promise<void> {
    const assetData: Asset[] = await this.getAssetData();
    for (const result of assetData) {
      this._assetMap[result.symbol.toUpperCase()] = {
        symbol: result.symbol.toUpperCase(),
        id: result.id,
        decimals: result.decimals,
        existentialDeposit: result.existentialDeposit,
        icon: result.icon,
        isSufficient: result.isSufficient,
        name: result.name,
        type: result.type,
      };
    }
  }

  private async getAssetData(): Promise<any> {
    let assetData: any;
    if (this._assetListType === 'URL') {
      const response = await axios.get(this._assetListSource);
      assetData = response.data.results;
    } else {
      const data = JSON.parse(await fs.readFile(this._assetListSource, 'utf8'));
      assetData = data.tokens;
    }
    return assetData;
  }

  public get storedTokenList() {
    return this._assetMap;
  }
}
