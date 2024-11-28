import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { Account } from './polkadot.types';
import { getPolkadotConfig } from './polkadot.config';

export class Polkadot {
  private static _instances: Map<string, Polkadot> = new Map();
  private _api!: ApiPromise;
  private _keyring!: Keyring;
  private _network: string;
  private _ready: boolean = false;

  private constructor(network: string) {
    this._network = network;
  }

  public static getInstance(network: string): Polkadot {
    if (!Polkadot._instances.has(network)) {
      throw new Error(`Instance for network ${network} is not initialized. Please initialize it asynchronously first.`);
    }
    return Polkadot._instances.get(network)!;
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

  public async getBalance(address: string): Promise<string> {
    const codec = await this._api.query.system.account(address);
    return codec.toString()
  }

  public async estimateGas(from: string, to: string): Promise<number> {
    const transfer = this._api.tx.balances.transfer(to);
    const { partialFee } = await transfer.paymentInfo(from);
    return partialFee.toNumber();
  }

  public async executeTrade(fromAccount: Account, to: string, amount: number): Promise<string> {
    const transfer = this._api.tx.balances.transfer(to, amount);
    const hash = await transfer.signAndSend(fromAccount.keyPair);
    return hash.toHex();
  }

  public getKeyring(): Keyring {
    return this._keyring;
  }
}
