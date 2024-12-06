import { ApiPromise, Keyring, WsProvider, } from '@polkadot/api';

import { getPolkadotConfig } from './polkadot.config';
import { PolkadotController } from './polkadot.controller';
import { mnemonicToSecretKey } from 'algosdk';
import Account from './polkadot.types';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { AssetClient, ExternalAsset } from '@galacticcouncil/sdk';
import { ConfigManagerCertPassphrase } from '../../services/config-manager-cert-passphrase';
import { walletPath } from '../../services/base';
import fse from 'fs-extra';

export class Polkadot {
  private static _instances: Map<string, Polkadot> = new Map();
  private _api!: ApiPromise;
  public nativeTokenSymbol;
  private _assetMap: Record<string, ExternalAsset> = {};
  private _asset: ExternalAsset[] = [];
  private _keyring!: Keyring;
  private _polkadot: AssetClient
  private _network: string;
  private _ready: boolean = false;
  public gasPrice: number;
  public gasLimit: number;

  public gasCost: number;
  public controller: typeof PolkadotController;

  private constructor(network: string) {
    this._network = network;
    const config = getPolkadotConfig(network);
    this.nativeTokenSymbol = config.nativeCurrencySymbol;
    this.gasPrice = 0;
    this._polkadot = new AssetClient(this._api);
    this.gasLimit = 0;
    this.gasCost = 0;
    this.controller = PolkadotController;
  }
  public get polkadot(): AssetClient {
    return this._polkadot;
  }
  public get network(): string {
    return this._network;
  }
  public static getInstance(network: string): Polkadot {
    if (!Polkadot._instances.has(network)) {
      throw new Error(`Instance for network ${network} is not initialized. Please initialize it asynchronously first.`);
    }
    return Polkadot._instances.get(network)!;
  }

  public static getConnectedInstances(): { [name: string]: Polkadot } {
    const connectedInstances: { [name: string]: Polkadot } = {};
    if (this._instances !== undefined) {
      const keys = Array.from(this._instances.keys());
      for (const instance of keys) {
        if (instance !== undefined) {
          connectedInstances[instance] = this._instances.get(
            instance
          ) as Polkadot;
        }
      }
    }
    return connectedInstances;
  }

  public async init(): Promise<void> {
    const config = getPolkadotConfig(this._network);
    const provider = new WsProvider(config.network.nodeURL);
    this._api = await ApiPromise.create({ provider });
    this._keyring = new Keyring({ type: 'sr25519' });
    this._ready = true;
  }

  public ready(): boolean {
    return this._ready;
  }
  public getAccountFromPrivateKey(mnemonic: string): Account {
    return mnemonicToSecretKey(mnemonic);
  }


  async getAccountFromAddress(address: string): Promise<Account> {
    const path = `${walletPath}/${this._polkadot}`;
    const encryptedMnemonic: string = await fse.readFile(
      `${path}/${address}.json`,
      'utf8'
    );
    const passphrase = ConfigManagerCertPassphrase.readPassphrase();
    if (!passphrase) {
      throw new Error('missing passphrase');
    }
    const mnemonic = this.decrypt(encryptedMnemonic, passphrase);

    return mnemonicToSecretKey(mnemonic);
  }
  public async getAssetBalance(

    assetName: string
  ): Promise<string> {
    const polkadotAsset = this._asset;

    const response = await this._polkadot
      .getOnChainAssets(false, polkadotAsset)

    const asset = response.find((asset) => asset.name === assetName);

    if (!asset) {
      throw new Error(`Asset ${assetName} not found`);
    }


    const amount = Number(asset.existentialDeposit) * parseFloat(`1e-${asset.decimals}`);
    return amount.toString();
  }

  public getAssetForSymbol(symbol: string): ExternalAsset | null {
    return this._assetMap[symbol] ? this._assetMap[symbol] : null;
  }



  public encrypt(mnemonic: string, password: string): string {
    const iv = randomBytes(16);
    const key = Buffer.alloc(32);
    key.write(password);

    const cipher = createCipheriv('aes-256-cbc', key, iv);

    const encrypted = Buffer.concat([cipher.update(mnemonic), cipher.final()]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  public getKeyring(): Keyring {
    return this._keyring;
  }


  public decrypt(encryptedMnemonic: string, password: string): string {
    const [iv, encryptedKey] = encryptedMnemonic.split(':');
    const key = Buffer.alloc(32);
    key.write(password);

    const decipher = createDecipheriv(
      'aes-256-cbc',
      key,
      Buffer.from(iv, 'hex')
    );

    const decrpyted = Buffer.concat([
      decipher.update(Buffer.from(encryptedKey, 'hex')),
      decipher.final(),
    ]);

    return decrpyted.toString();
  }

}
