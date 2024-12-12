import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { getPolkadotConfig } from './polkadot.config';
import { mnemonicToSecretKey } from 'algosdk';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import fse from 'fs-extra';
import { ConfigManagerCertPassphrase } from '../../services/config-manager-cert-passphrase';
import { walletPath } from '../../services/base';
import { PollResponse } from './polkadot.requests';
import { Asset } from './polkadot.types';

export class Polkadot {
  private static _instances: Map<string, Polkadot> = new Map();

  private _keyring!: Keyring;
  private _polkadot!: ApiPromise;
  private _assetMap: Record<string, Asset> = {};
  private _network: string;
  private _ready: boolean = false;
  public gasPrice: number;
  public gasLimit: number;
  public gasCost: number;
  public nativeTokenSymbol: string;

  private constructor(network: string) {
    this._network = network;
    const config = getPolkadotConfig(network);
    this.nativeTokenSymbol = config.nativeCurrencySymbol;
    this.gasPrice = 0;
    this.gasLimit = 0;
    this.gasCost = 0;
  }

  public static getInstance(network: string): Polkadot {
    if (!this._instances.has(network)) {
      this._instances.set(network, new Polkadot(network));
    }
    return this._instances.get(network)!;
  }

  public static getConnectedInstances(): { [name: string]: Polkadot } {
    const connectedInstances: { [name: string]: Polkadot } = {};
    for (const [network, instance] of this._instances) {
      connectedInstances[network] = instance;
    }
    return connectedInstances;
  }

  public async init(): Promise<void> {
    const config = getPolkadotConfig(this._network);
    const provider = new WsProvider(config.network.nodeURL);
    this._polkadot = await ApiPromise.create({ provider });
    this._keyring = new Keyring({ type: 'sr25519' });
    this._ready = true;
  }

  public ready(): boolean {
    return this._ready;
  }

  public get polkadot(): ApiPromise {
    if (!this._ready) {
      throw new Error('Polkadot instance not initialized.');
    }
    return this._polkadot;
  }

  public get network(): string {
    return this._network;
  }
  public get storedAssetList(): Asset[] {
    return Object.values(this._assetMap);
  }
  public getAccountFromPrivateKey(mnemonic: string): { address: string; keypair: any } {
    const keypair = mnemonicToSecretKey(mnemonic);
    const address = this._keyring.addFromSeed(keypair.sk).address;
    return { address, keypair };
  }
  public getAssetForSymbol(symbol: string): Asset | null {
    return this._assetMap[symbol] ? this._assetMap[symbol] : null;
  }
  public async getAccountInfo(accountAddress: string): Promise<any> {
    const accountInfo = await this._polkadot.query.system.account(accountAddress);
    const accountData = accountInfo.toJSON() as any;
    return {
      free: accountData.data?.free || '0',
      reserved: accountData.data?.reserved || '0',
      miscFrozen: accountData.data?.miscFrozen || '0',
      nonce: accountData.nonce || 0,
    };
  }

  public async getNativeBalance(accountAddress: string): Promise<string> {
    const accountInfo = await this._polkadot.query.system.account(accountAddress);
    const accountData = accountInfo.toJSON() as any;
    return accountData.data?.free || '0';
  }

  public async getAssetBalance(accountAddress: string, assetId: number): Promise<string> {
    const asset = await this._polkadot.query.assets.account(assetId, accountAddress);


    const assetData = asset.toJSON() as any;

    if (!assetData || !assetData.balance) {
      return '0';
    }

    return assetData.balance.toString();
  }

  public async transfer(
    senderMnemonic: string,
    recipientAddress: string,
    amount: number
  ): Promise<string> {
    const sender = this.getAccountFromPrivateKey(senderMnemonic);
    const transfer = this._polkadot.tx.balances.transfer(recipientAddress, amount);
    const accountInfo = await this._polkadot.query.system.account(sender.address);
    const accountData = accountInfo.toJSON() as any;
    const nonce = accountData.nonce || 0;
    const signedTx = await transfer.signAsync(sender.keypair, { nonce });
    const result = await signedTx.send();
    return result.toHex();
  }

  public async getTransaction(txHash: string): Promise<PollResponse> {
    const blockHash = await this._polkadot.rpc.chain.getBlockHash(txHash);
    const block = await this._polkadot.rpc.chain.getBlock(blockHash);

    const tx = block.block.extrinsics.find((ext) => ext.hash.toHex() === txHash);
    if (!tx) throw new Error('Transaction not found.');

    return {
      currentBlock: block.block.header.number.toNumber(),
      txBlock: block.block.header.number.toNumber(),
      txHash: txHash,
      fee: 0, // Fee can be computed based on transaction details if required
    };
  }

  public async getCurrentBlockNumber(): Promise<number> {
    const header = await this._polkadot.rpc.chain.getHeader();
    return header.number.toNumber();
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
    const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedKey, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString();
  }

  public async getAccountFromAddress(address: string): Promise<any> {
    const path = `${walletPath}/${this._network}`;
    const encryptedMnemonic: string = await fse.readFile(`${path}/${address}.json`, 'utf8');
    const passphrase = ConfigManagerCertPassphrase.readPassphrase();
    if (!passphrase) {
      throw new Error('missing passphrase');
    }
    const mnemonic = this.decrypt(encryptedMnemonic, passphrase);
    return this.getAccountFromPrivateKey(mnemonic);
  }
}
