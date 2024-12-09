import LRUCache from 'lru-cache';
import { Polkadot } from '../../chains/polkadot/polkadot';
import { HydrationConfig } from './hydration.config';
import { getPolkadotConfig } from '../../chains/polkadot/polkadot.config';
import { percentRegexp } from '../../services/config-manager-v2';
import { ExternalAsset, PoolBase } from '@galacticcouncil/sdk';

import { TradeRouter, PoolService, } from '@galacticcouncil/sdk';
import { PriceRequest } from '../../amm/amm.requests';
import { HttpException, TOKEN_NOT_SUPPORTED_ERROR_CODE, TOKEN_NOT_SUPPORTED_ERROR_MESSAGE } from '../../services/error-handler';
import { pow } from 'mathjs';
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

    const baseToken: ExternalAsset | null = this.chain.getAssetForSymbol(
      req.base
    );
    const quoteToken: ExternalAsset | null = this.chain.getAssetForSymbol(
      req.quote
    );

    if (baseToken === null || quoteToken === null)
      throw new HttpException(
        500,
        TOKEN_NOT_SUPPORTED_ERROR_MESSAGE,
        TOKEN_NOT_SUPPORTED_ERROR_CODE
      );

    // const baseAsset = { id: baseToken.id, decimals: baseToken.decimals };
    // const quoteAsset = {
    //   id: quoteToken.id,
    //   decimals: quoteToken.decimals,
    // };

    const amount = Number(req.amount) * <number>pow(10, baseToken.decimals);
    const isBuy: boolean = req.side === 'BUY';
    const queryPools: PoolBase[] = await trade.getPools()
    const pool: PoolBase | undefined = queryPools.find((query) => query.id === req.poolId)
    const price = await trade.getBestSpotPrice(req.base, req.quote)
    logger.info(
      `Best quote for ${baseToken.symbol}-${quoteToken.symbol}: ` +
      `${price}` +
      `${baseToken.symbol}.`
    );
    const expectedPrice = isBuy === true ? 1 / Number(price) : Number(price);
    const expectedAmount =
      req.side === 'BUY'
        ? Number(req.amount)
        : expectedPrice * Number(req.amount);

    return { expectedAmount, expectedPrice, amount, pool };
  }

  // async executeTrade(
  //   account: Account,
  //   quote: SwapQuote,
  //   isBuy: boolean
  // ): Promise<Trade> {


  //   logger.info(`Swap transaction Id: ${tx.txnID}`);

  // }
  getSlippage(): number {
    const allowedSlippage = this._config.allowedSlippage;
    const nd = allowedSlippage.match(percentRegexp);
    let slippage = 0.0;
    if (nd) slippage = Number(nd[1]) / Number(nd[2]);
    return slippage;
  }



}
