import LRUCache from 'lru-cache';
import { Polkadot } from '../../chains/polkadot/polkadot';
import { HydrationConfig } from './hydration.config';
import { getPolkadotConfig } from '../../chains/polkadot/polkadot.config';
import { percentRegexp } from '../../services/config-manager-v2';
import {
  TradeRouter,
  PoolService,
  Trade,
  BigNumber,
} from '@galacticcouncil/sdk';
import { PriceRequest } from '../../amm/amm.requests';
import {
  HttpException,
  TOKEN_NOT_SUPPORTED_ERROR_CODE,
  TOKEN_NOT_SUPPORTED_ERROR_MESSAGE,
} from '../../services/error-handler';
import { ApiPromise, WsProvider } from '@polkadot/api';

export class Hydration {
  private static _instances: LRUCache<string, Hydration>;
  private chain: Polkadot;
  private _config: HydrationConfig.NetworkConfig;
  private _ready: boolean = false;
  private wsProvider = new WsProvider('wss://rpc.hydradx.cloud');

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

  getSlippage(): BigNumber {
    const allowedSlippage = this._config.allowedSlippage;
    const nd = allowedSlippage.match(percentRegexp);
    let slippage = 0.0;
    if (nd) slippage = Number(nd[1]) / Number(nd[2]);
    return BigNumber(slippage * 10 ** 12);
  }

  public async getAllTokens() {
    const api = await ApiPromise.create({ provider: this.wsProvider });
    const poolService = new PoolService(api);
    await poolService.syncRegistry();
    const tradeRouter = new TradeRouter(poolService);
    return await tradeRouter.getAllAssets();
  }

  async estimateTrade(req: PriceRequest): Promise<Trade> {
    const api = await ApiPromise.create({ provider: this.wsProvider });
    const poolService = new PoolService(api);
    await poolService.syncRegistry();
    const tradeRouter = new TradeRouter(poolService);
    const asset = await tradeRouter.getAllAssets();
    const tokenIdBase = asset.find((a) => a.symbol === req.base).id;
    const tokenIdQuote = asset.find((a) => a.symbol === req.quote).id;

    if (tokenIdBase === null || tokenIdQuote === null)
      throw new HttpException(
        500,
        TOKEN_NOT_SUPPORTED_ERROR_MESSAGE,
        TOKEN_NOT_SUPPORTED_ERROR_CODE,
      );

    const isBuy: boolean = req.side === 'BUY';

    const tokenIn = isBuy ? tokenIdBase : tokenIdQuote;
    const tokenOut = isBuy ? tokenIdQuote : tokenIdBase;

    const trade = await tradeRouter.getBestSell(tokenIn, tokenOut, req.amount);

    return trade;
  }

  async executeTrade(address: string, trade: Trade) {
    const api = await ApiPromise.create({ provider: this.wsProvider });
    const poolService = new PoolService(api);
    await poolService.syncRegistry();


    const slippage = new BigNumber('1'); //this.getSlippage()
    const transaction = trade.toTx(slippage).get() as any;

    const keyringPair = await this.chain.getAccountFromAddress(address);

    return new Promise((resolve, reject) => {
      try {
        transaction.signAndSend(keyringPair, (result) => {
          if (result.dispatchError) {
            if (result.dispatchError.isModule) {
              // Decodifica o erro utilizando o registry da API
              const decoded = api.registry.findMetaError(
                result.dispatchError.asModule,
              );
              const { name } = decoded;
              reject(
                new Error(
                  `Hydration.executeTrade received an unexpected error: ${name}.`,
                ),
              );
            } else {
              reject(
                new Error(
                  `Hydration.executeTrade received an unexpected error: ${result.dispatchError.toString()}.`,
                ),
              );
            }
          } else {
            if (result.status.type === 'InBlock') {
              const txHash = JSON.parse(result.status.toString()).inBlock;
              console.log('Swap done! TX HASH:', txHash);
              resolve(txHash);
            }
          }
        });
      } catch (error: any) {
        reject(error.message);
      }
    });
  }
}
