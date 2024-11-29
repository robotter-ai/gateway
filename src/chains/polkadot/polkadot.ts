import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';

import { getPolkadotConfig } from './polkadot.config';
import { PolkadotController } from './polkadot.controller';
import { mnemonicToSecretKey } from 'algosdk';
import Account from './polkadot.types';
import { createCipheriv, randomBytes } from 'crypto';

export class Polkadot {
  private static _instances: Map<string, Polkadot> = new Map();
  private _api!: ApiPromise;
  private _keyring!: Keyring;
  private _network: string;
  private _ready: boolean = false;
  public gasPrice: number;
  public gasLimit: number;
  public gasCost: number;
  public controller: typeof PolkadotController;

  private constructor(network: string) {
    this._network = network;
    this.gasPrice = 0;
    this.gasLimit = 0;
    this.gasCost = 0;
    this.controller = PolkadotController;
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

  public async getBalance(address: string): Promise<string> {
    const codec = await this._api.query.system.account(address);
    return codec.toString()
  }
  public encrypt(mnemonic: string, password: string): string {
    const iv = randomBytes(16);
    const key = Buffer.alloc(32);
    key.write(password);

    const cipher = createCipheriv('aes-256-cbc', key, iv);

    const encrypted = Buffer.concat([cipher.update(mnemonic), cipher.final()]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  public async estimateGas(from: string, to: string): Promise<number> {
    const transfer = this._api.tx.balances.transfer(to);
    const { partialFee } = await transfer.paymentInfo(from);
    return partialFee.toNumber();
  }

  public async executeTrade(fromAccount: Account, to: string, amount: number): Promise<string> {
    const transfer = this._api.tx.balances.transfer(to, amount);
    const hash = await transfer.signAndSend(fromAccount.addr);
    return hash.toHex();
  }

  public getKeyring(): Keyring {
    return this._keyring;
  }
}
