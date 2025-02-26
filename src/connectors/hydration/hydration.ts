import LRUCache from 'lru-cache';
// noinspection ES6PreferShortImport
import { Polkadot } from '../../chains/polkadot/polkadot';
import { HydrationConfig } from './hydration.config';
// noinspection ES6PreferShortImport
import { getPolkadotConfig } from '../../chains/polkadot/polkadot.config';
import {
  BigNumber,
  PoolService,
  Trade,
  TradeRouter,
  TradeType,
} from '@galacticcouncil/sdk';
// noinspection ES6PreferShortImport
import { PriceRequest } from '../../amm/amm.requests';
// noinspection ES6PreferShortImport
import {
  HttpException,
  TOKEN_NOT_SUPPORTED_ERROR_CODE,
  TOKEN_NOT_SUPPORTED_ERROR_MESSAGE,
} from '../../services/error-handler';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';

export class Hydration {
  private static _instances: LRUCache<string, Hydration>;
  private chain: Polkadot;
  private _config: HydrationConfig.NetworkConfig;
  private _ready: boolean = false;
  private api: ApiPromise;
  private tradeRouter: TradeRouter;

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
    }

    return Hydration._instances.get(network)!;
  }

  public async init() {
    if (!this.chain.ready()) {
      await this.chain.init();
    }

    await cryptoWaitReady();

    const wsProvider = new WsProvider('wss://rpc.hydradx.cloud');

    this.api = await ApiPromise.create({ provider: wsProvider });

    const poolService = new PoolService(this.api);
    await poolService.syncRegistry();
    this.tradeRouter = new TradeRouter(poolService);

    this._ready = true;
  }

  public ready(): boolean {
    return this._ready;
  }

  public calculateTradeLimit(
    trade: Trade,
    slippagePercentage: BigNumber,
    side: TradeType,
  ): BigNumber {
    const ONE_HUNDRED = BigNumber('100');

    let amount: BigNumber;
    let slippage: BigNumber;
    let tradeLimit: BigNumber;
    if (side === TradeType.Buy) {
      // maxAmountIn

      amount = trade.amountIn;

      slippage = amount
        .div(ONE_HUNDRED)
        .multipliedBy(slippagePercentage)
        .decimalPlaces(0, 1);

      tradeLimit = amount.plus(slippage);
    } else if (side === TradeType.Sell) {
      // minAmountOut

      amount = trade.amountOut;

      slippage = amount
        .div(ONE_HUNDRED)
        .multipliedBy(slippagePercentage)
        .decimalPlaces(0, 1);

      tradeLimit = amount.minus(slippage);
    } else {
      throw new Error('Invalid side');
    }

    // console.log(`Trade: ${JSON.stringify(trade, null, 2)}`);
    console.log(`trade -> amountOut: ${trade.amountOut}`);
    console.log(`trade -> amountIn: ${trade.amountIn}`);
    console.log(`trade -> spotPrice: ${trade.spotPrice}`);
    console.log(`Side: ${side}`);
    console.log(`Amount: ${amount.toString()}`);
    console.log(`Slippage percentage: ${slippagePercentage.toString()}%`);
    console.log(`Slippage: ${slippage.toString()}`);
    console.log(
      `Trade limit (${side === TradeType.Buy ? 'maxAmountIn' : 'minAmountOut'}): ${tradeLimit.toString()}`,
    );

    return tradeLimit;
  }

  public async getAllTokens() {
    return await this.tradeRouter.getAllAssets();
  }

  async estimateTrade(req: PriceRequest): Promise<Trade> {
    const asset = await this.tradeRouter.getAllAssets();
    const tokenIdBase = asset.find((a) => a.symbol === req.base).id;
    const tokenIdQuote = asset.find((a) => a.symbol === req.quote).id;

    if (tokenIdBase === null || tokenIdQuote === null)
      throw new HttpException(
        500,
        TOKEN_NOT_SUPPORTED_ERROR_MESSAGE,
        TOKEN_NOT_SUPPORTED_ERROR_CODE,
      );

    let trade: Trade;
    if (req.side === 'BUY') {
      // buy 1 HDX (base, assetOut) with USDT (quote, assetIn)
      trade = await this.tradeRouter.getBestBuy(
        tokenIdQuote,
        tokenIdBase,
        BigNumber(req.amount),
      );
    } else if (req.side === 'SELL') {
      // sell 1 HDX (base, assetIn) for USDT (quote, assetOut)
      trade = await this.tradeRouter.getBestSell(
        tokenIdBase,
        tokenIdQuote,
        BigNumber(req.amount),
      );
    } else {
      throw new HttpException(
        500,
        'Hydration.estimateTrade received an unexpected side.',
        500,
      );
    }

    return trade;
  }

  async executeTrade(address: string, trade: Trade) {
    if (trade) {
      console.log(
        `Route found: ${trade.swaps
          .map((pool) => pool.poolAddress)
          .join(' -> ')}`,
      );
      console.log(
        `Estimated ${trade.type === TradeType.Buy ? 'output' : 'input'} amount: ${trade.type === TradeType.Buy ? trade.amountOut : trade.amountIn}`,
      );

      const tradeLimit = this.calculateTradeLimit(
        trade,
        BigNumber(this._config.allowedSlippage),
        trade.type,
      );

      const transaction = trade.toTx(tradeLimit).get<any>();

      const keyPair = await this.chain.getAccountFromAddress(address);

      try {
        const txHash = await new Promise<string>((resolve, reject) => {
          transaction.signAndSend(keyPair, (result: any) => {
            if (result.dispatchError) {
              if (result.dispatchError.isModule) {
                const decoded = this.api.registry.findMetaError(
                  result.dispatchError.asModule,
                );
                const { name } = decoded;
                console.error(`Error: ${name}`);
                reject(name);
              } else {
                console.error(
                  'Unknown error:',
                  result.dispatchError.toString(),
                );
                reject(result.dispatchError.toString());
              }
            } else if (result.status.isInBlock) {
              const hash = result.status.asInBlock.toString();
              console.log('Swap done! TX HASH:', hash);
              resolve(hash);
            }
          });
        });

        return {
          txHash,
          error: '',
        };
      } catch (err) {
        return {
          txHash: '',
          error: err as string,
        };
      }
    } else {
      console.log('No route found for the swap.');
      return {
        txHash: '',
        error: 'No route found',
      };
    }
  }
  // async getTransactionStatus(txHash: string, network: string): Promise<PollResponse> {
  //     let api: ApiPromise | undefined;
  //
  //     try {
  //         api = await ApiPromise.create({ provider: this.wsProvider });
  //
  //         // Get finalized block info
  //         const finalizedHead = await api.rpc.chain.getFinalizedHead();
  //         const finalizedHeader = await api.rpc.chain.getHeader(finalizedHead);
  //         const finalizedBlockNumber = finalizedHeader.number.toNumber();
  //
  //         // Get current block info
  //         const currentHeader = await api.rpc.chain.getHeader();
  //         const currentBlockNumber = currentHeader.number.toNumber();
  //
  //         const searchDepth = 200;
  //         let foundExtrinsic = null;
  //         let foundBlockNumber: number | undefined;
  //         let foundBlockHash: string | undefined;
  //
  //         // Search backwards through recent blocks
  //         for (let i = currentBlockNumber; i > currentBlockNumber - searchDepth; i--) {
  //             const blockHash = await api.rpc.chain.getBlockHash(i);
  //             const block = await api.rpc.chain.getBlock(blockHash);
  //
  //             for (const extrinsic of block.block.extrinsics) {
  //                 if (extrinsic.hash.toHex() === txHash) {
  //                     foundExtrinsic = extrinsic;
  //                     foundBlockNumber = i;
  //                     foundBlockHash = blockHash.toHex();
  //                     break;
  //                 }
  //             }
  //             if (foundExtrinsic) break;
  //         }
  //
  //         // Determine status
  //         let txStatus = 0; // PENDING
  //         if (foundExtrinsic && foundBlockNumber) {
  //             txStatus = (finalizedBlockNumber - foundBlockNumber) >= 12 ? 2 : 1;
  //         }
  //
  //         const response: PollResponse = {
  //             network,
  //             timestamp: Date.now(),
  //             currentBlock: currentBlockNumber,
  //             txHash,
  //             txStatus,
  //             txBlock: foundBlockNumber || 0,
  //             //@ts-ignore
  //             txData: foundExtrinsic ? {
  //                 hash: txHash,
  //                 blockHash: foundBlockHash || null,
  //                 blockNumber: foundBlockNumber || null,
  //                 from: foundExtrinsic.signer?.toString() || '',
  //                 to: foundExtrinsic.method?.section || '',
  //                 gasPrice: null,
  //                 gasLimit: '0',
  //                 value: '0',
  //                 nonce: 0,
  //                 data: foundExtrinsic.method?.toHex() || '',
  //                 r: null,
  //                 s: null,
  //                 v: null,
  //                 chainId: typeof network === 'string' ? network : '0',
  //                 wait: async () => Promise.resolve({} as CustomTransactionReceipt)
  //             } : null,
  //             txReceipt: null
  //         };
  //
  //         return response;
  //     } catch (error) {
  //         console.error('Error getting transaction status:', error);
  //         throw error;
  //     } finally {
  //         if (api) {
  //             await api.disconnect();
  //         }
  //     }
  // }
}
