import LRUCache from 'lru-cache';
import { Polkadot } from '../../chains/polkadot/polkadot';
import { HydrationConfig } from './hydration.config';
import { getPolkadotConfig } from '../../chains/polkadot/polkadot.config';
import { percentRegexp } from '../../services/config-manager-v2';
import { PoolBase } from '@galacticcouncil/sdk';

import { TradeRouter, PoolService } from '@galacticcouncil/sdk';
import { PriceRequest, TradeRequest } from '../../amm/amm.requests';
import {
  HttpException,
  TOKEN_NOT_SUPPORTED_ERROR_CODE,
  TOKEN_NOT_SUPPORTED_ERROR_MESSAGE,
} from '../../services/error-handler';

import { ApiPromise, WsProvider } from '@polkadot/api';
import { logger } from 'ethers';

export class Hydration {
  private static _instances: LRUCache<string, Hydration>;
  private chain: Polkadot;
  private _poolMap: Record<string, PoolBase> = {};
  private _config: HydrationConfig.NetworkConfig;
  private _ready: boolean = false;

  constructor(network: string) {
    this._config = HydrationConfig.config;
    this.chain = Polkadot.getInstance(network);
  }
  public get storedAssetList(): PoolBase[] {
    return Object.values(this._poolMap);
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

  async estimateTrade(req: PriceRequest) {
    const wsProvider = new WsProvider('wss://rpc.hydradx.cloud');
    const api = await ApiPromise.create({ provider: wsProvider });
    const poolService = new PoolService(api);
    const trade = new TradeRouter(poolService);
    const asset = await trade.getAllAssets();

    const tokenIdBase = asset.find((a) => a.symbol === req.base)?.id ?? '0'; //HDX default
    const tokenIdQuote = asset.find((a) => a.symbol === req.quote)?.id ?? '10'; // USDT default

    const symbolBase = asset.find((a) => req.base === a.symbol)?.symbol ?? '0'; //HDX default
    const symbolQuote =
      asset.find((a) => req.quote === a.symbol)?.symbol ?? '10'; // USDT default

    if (symbolBase === null || symbolQuote === null)
      throw new HttpException(
        500,
        TOKEN_NOT_SUPPORTED_ERROR_MESSAGE,
        TOKEN_NOT_SUPPORTED_ERROR_CODE,
      );

    // const baseAsset = { id: baseToken.id, decimals: baseToken.decimals };
    // const quoteAsset = {
    //   id: quoteToken.id,
    //   decimals: quoteToken.decimals,
    // };

    // const amount = Number(req.amount) * <number>pow(10, baseToken.decimals);
    const isBuy: boolean = req.side === 'BUY';
    const queryPools: PoolBase[] = await trade.getPools();
    const pool: PoolBase | undefined = queryPools.find(
      (query) => query.id === req.poolId,
    );

    const price = await trade.getBestSpotPrice(tokenIdBase, tokenIdQuote);
    logger.info(
      `Best quote for ${symbolBase}-${symbolQuote}: ` +
      `${price?.amount}` +
      `${symbolBase}.`,
    );
    const expectedPrice =
      isBuy === true ? 1 / Number(price?.amount) : Number(price?.amount);
    const expectedAmount =
      req.side === 'BUY'
        ? Number(req.amount)
        : expectedPrice * Number(req.amount);

    return { expectedAmount, expectedPrice, pool };
  }

  async executeTrade(req: TradeRequest) {
    const wsProvider = new WsProvider('wss://rpc.hydradx.cloud');
    const api = await ApiPromise.create({ provider: wsProvider });
    const poolService = new PoolService(api);
    const trade = new TradeRouter(poolService);
    const asset = await trade.getAllAssets();

    const tokenBase = asset.find((a) => a.symbol === req.base)?.id ?? '0'; //HDX default
    const tokenQuote = asset.find((a) => a.symbol === req.quote)?.id ?? '10'; //  USDT default

    const getBuy = await trade.getBestBuy(tokenBase, tokenQuote, req.amount);
    const getSell = await trade.getBestSell(tokenBase, tokenQuote, req.amount);

    if (req.side === 'BUY') return getBuy;
    return getSell;
  }
  getSlippage(): number {
    const allowedSlippage = this._config.allowedSlippage;
    const nd = allowedSlippage.match(percentRegexp);
    let slippage = 0.0;
    if (nd) slippage = Number(nd[1]) / Number(nd[2]);
    return slippage;
  }
}
