import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { getPolkadotConfig } from './polkadot.config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import fse from 'fs-extra';
import { ConfigManagerCertPassphrase } from '../../services/config-manager-cert-passphrase';
import { TokenListType, walletPath } from '../../services/base';
import { PollResponse } from './polkadot.requests';
import LRUCache from 'lru-cache';
import axios from 'axios';
import { promises as fs } from 'fs';
import { Asset } from '@galacticcouncil/sdk';

type AssetListType = TokenListType;
export class Polkadot {
  private _assetMap: Record<string, Asset> = {};
  private static _instances: LRUCache<string, Polkadot>;
  private _chain: string = 'polkadot';
  private _network: string;
  private _polkadot: ApiPromise;
  private _keyring: Keyring;
  private _assetListType: AssetListType;
  private _assetListSource: string;
  private _ready: boolean = false;
  public gasPrice: number;
  public gasLimit: number;
  public gasCost: number;
  public nativeTokenSymbol: string;


  constructor(
    network: string,
    nodeURL: string,
    assetListType: AssetListType,
    assetListSource: string
  ) {
    const config = getPolkadotConfig(network);
    this._network = network
    this.nativeTokenSymbol = config.nativeCurrencySymbol;
    this.gasPrice = 0;
    const provider = new WsProvider(nodeURL);
    this._polkadot = new ApiPromise({ provider })
    this._keyring = new Keyring({ type: 'sr25519' });
    this._assetListType = assetListType;
    this._assetListSource = assetListSource;
    this.gasLimit = 0;
    this.gasCost = 0;
  }
  public get polkadot(): ApiPromise {
    return this._polkadot;
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
    await this.loadAssets();
    this._ready = true;
  }

  public static getInstance(network: string): Polkadot {
    const config = getPolkadotConfig(network);
    if (Polkadot._instances === undefined) {
      Polkadot._instances = new LRUCache<string, Polkadot>({
        max: config.network.maxLRUCacheInstances,
      });
    }
    if (!Polkadot._instances.has(config.network.name)) {
      if (network !== null) {
        const nodeUrl = config.network.nodeURL;
        const assetListType = config.network.assetListType as TokenListType;
        const assetListSource = config.network.assetListSource;
        Polkadot._instances.set(
          config.network.name,
          new Polkadot(
            network,
            nodeUrl,
            assetListType,
            assetListSource
          )
        );
      } else {
        throw new Error(
          `Algorand.getInstance received an unexpected network: ${network}.`
        );
      }
    }

    return Polkadot._instances.get(config.network.name) as Polkadot
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


  public async getCurrentBlockNumber(): Promise<number> {
    const header = await this._polkadot.rpc.chain.getHeader();
    return header.number.toNumber();
  }


  public getAccountFromAddress(address: string) {
    const Account = this._keyring.addFromAddress(address);
    return Account;
  }
  public getAccountFromPrivatekey(privateKey: string) {
    const privateKeyUint8Array = new TextEncoder().encode(privateKey);
    const Account = this._keyring.addFromAddress(privateKeyUint8Array);
    return Account;
  }

  public getAssetForSymbol(symbol: string): Asset | null {
    return this._assetMap[symbol] ? this._assetMap[symbol] : null;
  }

  public async getAccountInfo(accountAddress: string): Promise<any> {
    const accountInfo =
      await this._polkadot.query.system.account(accountAddress);
    const accountData = accountInfo.toJSON() as any;
    return {
      free: accountData.data?.free || '0',
      reserved: accountData.data?.reserved || '0',
      miscFrozen: accountData.data?.miscFrozen || '0',
      nonce: accountData.nonce || 0,
    };
  }

  public async getNativeBalance(accountAddress: string): Promise<string> {
    const accountInfo =
      await this._polkadot.query.system.account(accountAddress);
    const accountData = accountInfo.toJSON() as any;
    return accountData.data?.free || '0';
  }

  public async getAssetBalance(
    accountAddress: string,
    assetId: number,
  ): Promise<string> {
    const asset = await this._polkadot.query.assets.account(
      assetId,
      accountAddress,
    );

    const assetData = asset.toJSON() as any;

    if (!assetData || !assetData.balance) {
      return '0';
    }

    return assetData.balance.toString();
  }

  // public async transfer(
  //   senderMnemonic: string,
  //   recipientAddress: string,
  //   amount: number,
  // ): Promise<string> {
  //   const sender = this.getAccountFromPrivateKey(senderMnemonic);
  //   const transfer = this._polkadot.tx.balances.transfer(
  //     recipientAddress,
  //     amount,
  //   );
  //   const accountInfo = await this._polkadot.query.system.account(
  //     sender.address,
  //   );
  //   const accountData = accountInfo.toJSON() as any;
  //   const nonce = accountData.nonce || 0;
  //   const signedTx = await transfer.signAsync(sender.keypair, { nonce });
  //   const result = await signedTx.send();
  //   return result.toHex();
  // }

  public async getTransaction(txHash: string): Promise<PollResponse> {
    const blockHash = await this._polkadot.rpc.chain.getBlockHash(txHash);
    const block = await this._polkadot.rpc.chain.getBlock(blockHash);

    const tx = block.block.extrinsics.find(
      (ext) => ext.hash.toHex() === txHash,
    );
    if (!tx) throw new Error('Transaction not found.');

    return {
      currentBlock: block.block.header.number.toNumber(),
      txBlock: block.block.header.number.toNumber(),
      txHash: txHash,
      fee: 0, // Fee can be computed based on transaction details if required
    };
  }



  public encrypt(mnemonic: string, password: string): string {
    const iv = randomBytes(16);
    const key = Buffer.alloc(32);
    key.write(password);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(mnemonic), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  public decrypt(encryptedMnemonic: string, password: string) {
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

  // public async getAccountFromAddress(address: string): Promise<any> {
  //   const path = `${walletPath}/${this._chain}`;
  //   const encryptedPrivateKey: string = await fse.readFile(
  //     `${path}/${address}.json`,
  //     'utf8',
  //   );
  //   const passphrase = ConfigManagerCertPassphrase.readPassphrase();
  //   if (!passphrase) {
  //     throw new Error('missing passphrase');
  //   }
  //   const privatekey = this.decrypt(encryptedPrivateKey, passphrase);
  //   return this.getAccountFromPrivateKey(privatekey);

  // }


  private async loadAssets(): Promise<void> {
    const assetData: Asset[] = await this.getAssetData();
    for (const result of assetData) {
      this._assetMap[result.name.toUpperCase()] = {
        symbol: result.name.toUpperCase(),
        id: result.id,
        decimals: result.decimals,
        existentialDeposit: result.existentialDeposit,
        icon: result.icon,
        isSufficient: result.isSufficient,
        name: result.name,
        type: result.type
      };
    }
  }

  private async getAssetData(): Promise<any> {
    let assetData;
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
