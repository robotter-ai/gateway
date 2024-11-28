import LRUCache from 'lru-cache';
import { Polkadot } from '../../chains/polkadot/polkadot';
import { HydrationConfig } from './hydration.config';
import { PriceRequest, TradeRequest } from '../../amm/amm.requests';
import { getPolkadotConfig } from '../../chains/polkadot/polkadot.config';
import { percentRegexp } from '../../services/config-manager-v2';

export class Hydration {
  private static _instances: LRUCache<string, Hydration>;
  private chain!: Polkadot;
  private _config: HydrationConfig.NetworkConfig;
  private _ready: boolean = false;

  constructor(network: string) {
    this._config = HydrationConfig.config;
    this.chain = Polkadot.getInstance(network);
  }

  public static getInstance(network: string): Hydration {
    const config = getPolkadotConfig(network);
    if (Hydration._instances === undefined) {
      Hydration._instances = new LRUCache<string, Hydration>({
        max: config.network.maxLRUCacheInstances,
      });
    }

    if (!Hydration._instances) {
      Hydration._instances = new LRUCache<string, Hydration>({ max: 10 });
    }

    if (!Hydration._instances.has(network)) {
      const instance = new Hydration(network);
      Hydration._instances.set(network, instance);
      instance.init();
    }

    return Hydration._instances.get(network)!;
  }

  public async init() {
    if (!this.chain.ready()) {
      await this.chain.init();
    }
    this._ready = true;
  }

  public ready(): boolean {
    return this._ready;
  }
  getSlippage(): number {
    const allowedSlippage = this._config.allowedSlippage;
    const nd = allowedSlippage.match(percentRegexp);
    let slippage = 0.0;
    if (nd) slippage = Number(nd[1]) / Number(nd[2]);
    return slippage;
  }
  public async estimateTrade(req: PriceRequest) {
    const price = await this.chain.getBalance(req.base);
    const amount = req.side === 'BUY' ? Number(req.amount) / Number(price) : Number(req.amount) * Number(price);
    return { price, amount };
  }

  public async executeTrade(req: TradeRequest) {
    const account = this.chain.getKeyring().addFromUri(req.address);
    const txHash = await this.chain.executeTrade({keyPair: account, address: account.address}, req.quote, Number(req.amount));
    return txHash;
  }

  public async estimateGas(from: string, to: string,) {
    return await this.chain.estimateGas(from, to);
  }
}
