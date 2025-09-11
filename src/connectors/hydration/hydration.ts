/* eslint-disable prettier/prettier */
import { createSdkContext, BigNumber, PoolType } from "@galacticcouncil/sdk";
import { ApiPromise, HttpProvider, WsProvider } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { encodeAddress, decodeAddress, cryptoWaitReady } from '@polkadot/util-crypto';

import { Polkadot } from '../../chains/polkadot/polkadot';
import { runWithRetryAndTimeout } from "../../chains/polkadot/polkadot.utils";
import { validatePolkadotAddress } from '../../chains/polkadot/polkadot.validators';
import { PoolItem } from '../../schemas/trading-types/amm-schema';
import { percentRegexp } from '../../services/config-manager-v2';
import { logger } from '../../services/logger';

import { HydrationConfig } from './hydration.config';
import {
  ExternalPoolInfo,
  HydrationAddLiquidityResponse,
  HydrationAllPositionsResponse,
  HydrationExecuteSwapResponse,
  HydrationPoolInfo,
  HydrationPositionInfo,
  HydrationQuoteLiquidityResponse,
  HydrationRemoveLiquidityResponse,
  HydrationPosition,
  HydrationToken,
  LiquidityQuote,
  PositionStrategyType,
  SwapQuote,
  SwapRoute
} from './hydration.types';

// Pool types
const POOL_TYPE = {
  XYK: 'xyk',
  LBP: 'lbp',
  OMNIPOOL: 'omnipool',
  STABLESWAP: 'stableswap',
  AAVE: 'aave'
};

// Hydration-specific constants
const HYDRA_ADDRESS_PREFIX = 63;

const LP_DECIMALS = 18;

/**
 * Main class for interacting with the Hydration protocol on Polkadot
 */
export class Hydration {
  private static _instances: { [name: string]: Hydration } = {};
  public polkadot: Polkadot;
  public config: HydrationConfig.NetworkConfig;
  // noinspection JSUnusedLocalSymbols
  private apiPromise: ApiPromise;
  // noinspection JSUnusedLocalSymbols
  private sdkContext: any;

  /**
   * Private constructor - use getInstance instead
   */
  private constructor() {
    this.config = HydrationConfig.config;
  }


  /**
   * Get or create an instance of the Hydration class
   * @param network The network to connect to
   * @returns A Promise that resolves to a Hydration instance
   */
  public static async getInstance(network: string): Promise<Hydration> {
    if (!Hydration._instances[network]) {
      Hydration._instances[network] = new Hydration();
      await Hydration._instances[network].init(network);
    }
    return Hydration._instances[network];
  }

  /**
   * Initialize the Hydration instance
   * @param network The network to connect to
   */
  private async init(network: string) {
    logger.info(`Initializing Hydration for network: ${network}`);
    this.polkadot = await Polkadot.getInstance(network);
    await this.cryptoWaitReady();
    await this.getSdkContext();
    logger.info(`Hydration initialized for network: ${network}`);
  }


  /**
   * Get all supported tokens
   * @returns A Promise that resolves to an array of supported tokens
   */
  public getAllTokens() {
    return this.polkadot.tokenList;
  }

  /**
   * Get all tokens available in the Hydration ecosystem using Galactic Council SDK
   * @param includeInvalid Whether to include invalid assets
   * @returns A Promise that resolves to an array of all tokens with complete metadata
   */
  async getAllTokensFromSDK(includeInvalid: boolean = false): Promise<HydrationToken[]> {
    try {
      const sdkContext = await this.getSdkContext();
      const assets = await sdkContext.client.asset.getOnChainAssets(includeInvalid);
      
      return assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        decimals: asset.decimals,
        icon: asset.icon,
        type: asset.type,
        existentialDeposit: asset.existentialDeposit,
        isSufficient: asset.isSufficient,
        location: asset.location,
        meta: asset.meta,
        isWhiteListed: asset.isWhiteListed
      }));
    } catch (error) {
      logger.error(`Error getting all tokens from SDK: ${error.message}`);
      throw new Error(`Failed to get all tokens: ${error.message}`);
    }
  }

  /**
   * Get all tradeable tokens using Galactic Council SDK TradeRouter
   * @returns A Promise that resolves to an array of tradeable tokens
   */
  async getTradeableTokensFromSDK(): Promise<HydrationToken[]> {
    try {
      const sdkContext = await this.getSdkContext();
      const assets = await sdkContext.api.router.getAllAssets();
      
      return assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        decimals: asset.decimals,
        icon: asset.icon,
        type: asset.type,
        existentialDeposit: asset.existentialDeposit,
        isSufficient: asset.isSufficient,
        location: asset.location,
        meta: asset.meta,
        isWhiteListed: asset.isWhiteListed
      }));
    } catch (error) {
      logger.error(`Error getting tradeable tokens from SDK: ${error.message}`);
      throw new Error(`Failed to get tradeable tokens: ${error.message}`);
    }
  }

  /**
   * Get detailed information about a Hydration pool
   * @param poolAddress The address of the pool
   * @returns A Promise that resolves to pool information or null if not found
   */
  async getPoolInfo(poolAddress: string): Promise<ExternalPoolInfo | null> {
    try {
      const sdkContext = await this.getSdkContext();
      const pools = await this.sdkContextGetPools(sdkContext, []);
      let poolData;

      if (!poolAddress) {
        // Assumes the user wants the information for the Omnipool
        poolData = pools.find(pool => pool.type.toLowerCase() === POOL_TYPE.OMNIPOOL.toLowerCase());
      } else {
        poolData = pools.find(pool => pool.address === poolAddress || pool.id === poolAddress);
      }

      if (!poolData) {
        logger.error(`Pool not found: ${poolAddress}`);
        return null;
      }

      // Check if it's an omnipool - add null check for type
      const poolType = poolData.type || 'xyk'; // Default to xyk if type is null
      const isOmnipool = poolType.toLowerCase() === POOL_TYPE.OMNIPOOL;

      if (isOmnipool) {
        // For omnipool, use hub asset (H2O) as both base and quote token
        const hubAsset = this.polkadot.getToken('H2O');
        if (!hubAsset) {
          throw new Error('Hub asset (H2O) not found');
        }

        return {
          address: poolData.address,
          baseTokenAddress: hubAsset.address,
          quoteTokenAddress: hubAsset.address,
          feePct: 500 / 10000, // Default fee for omnipool
          price: 1, // Default price for omnipool
          baseTokenAmount: 0,
          quoteTokenAmount: 0,
          poolType: POOL_TYPE.OMNIPOOL,
          id: poolData.id,
          tokens: poolData.tokens.map(token => token.symbol)
        };
      }

      // For regular pools, continue with existing logic
      const baseToken = this.polkadot.getToken(poolData.tokens[0].symbol);
      const quoteToken = this.polkadot.getToken(poolData.tokens[1].symbol);

      if (!baseToken) {
        throw new Error(`Base token not found for pool ${poolAddress}: ${poolData.tokens[0].symbol}`);
      } else if (!quoteToken) {
        throw new Error(`Quote token not found for pool ${poolAddress}: ${poolData.tokens[1].symbol}`);
      }

      const baseTokenAmount = Number(BigNumber(poolData.tokens[0].balance.toString())
        .div(BigNumber(10).pow(poolData.tokens[0].decimals))
        .toFixed(poolData.tokens[0].decimals));

      const quoteTokenAmount = Number(BigNumber(poolData.tokens[1].balance.toString())
        .div(BigNumber(10).pow(poolData.tokens[1].decimals))
        .toFixed(poolData.tokens[1].decimals));

      let poolPrice = 1;
      try {
        const sdkContext = await this.getSdkContext();
        const amountBN = BigNumber('1');

        const buyQuote = await this.sdkContextGetBestBuy(
          sdkContext,
          quoteToken.address,
          baseToken.address,
          amountBN
        );

        const sellQuote = await this.sdkContextGetBestSell(
          sdkContext,
          baseToken.address,
          quoteToken.address,
          amountBN
        );

        const buyPrice = Number(buyQuote.toHuman().spotPrice);
        const sellPrice = Number(sellQuote.toHuman().spotPrice);
        const midPrice = (buyPrice + sellPrice) / 2;

        if (!isNaN(midPrice) && isFinite(midPrice)) {
          poolPrice = Number(midPrice.toFixed(6));
        }
      } catch (priceError) {
        if (baseTokenAmount > 0 && quoteTokenAmount > 0) {
          poolPrice = quoteTokenAmount / baseTokenAmount;
        }
      }

      return {
        address: poolData.address,
        baseTokenAddress: baseToken.address,
        quoteTokenAddress: quoteToken.address,
        feePct: 500 / 10000,
        price: poolPrice,
        baseTokenAmount,
        quoteTokenAmount,
        poolType: poolData.type || 'xyk',
        id: poolData.id,
        tokens: [poolData.tokens[0].symbol, poolData.tokens[1].symbol] // Include base and quote tokens
      };
    } catch (error) {
      logger.error(`Error getting pool info for ${poolAddress}:`, error);
      return null;
    }
  }

  /**
   * Get a quote for a swap
   * @param baseTokenSymbol Base token symbol or address
   * @param quoteTokenSymbol Quote token symbol or address
   * @param amount Amount to swap
   * @param side 'BUY' or 'SELL'
   * @param _poolAddress Pool address (optional, will find best pool if not specified)
   * @param slippagePct Slippage percentage (1 means 1%) (optional, uses default if not specified)
   * @returns A Promise that resolves to a swap quote
   */
  async getSwapQuote(
    baseTokenSymbol: string,
    quoteTokenSymbol: string,
    amount: number,
    side: 'BUY' | 'SELL',
    _poolAddress?: string,
    slippagePct?: number
  ): Promise<SwapQuote> {
    const sdkContext = await this.getSdkContext();

    // Get token info
    const baseToken = this.polkadot.getToken(baseTokenSymbol);
    const quoteToken = this.polkadot.getToken(quoteTokenSymbol);

    if (!baseToken || !quoteToken) {
      throw new Error(`Token not found: ${!baseToken ? baseTokenSymbol : quoteTokenSymbol}`);
    }

    const baseTokenId = baseToken.address;
    const quoteTokenId = quoteToken.address;

    if (!baseTokenId || !quoteTokenId) {
      throw new Error(`Token not supported in Hydration: ${!baseTokenId ? baseToken.symbol : quoteToken.symbol}`);
    }

    const amountBN = BigNumber(amount.toString());
    let trade: any;

    if (side === 'BUY') {
      trade = await this.sdkContextGetBestBuy(
        sdkContext,
        quoteTokenId,
        baseTokenId,
        amountBN
      );
    } else {
      trade = await this.sdkContextGetBestSell(
        sdkContext,
        baseTokenId,
        quoteTokenId,
        amountBN
      );
    }

    if (!trade) {
      throw new Error(`No route found for ${baseToken.symbol}/${quoteToken.symbol}`);
    }

    const tradeHuman = trade.toHuman();
    const effectiveSlippage = this.getSlippagePercentage(slippagePct);
    const estimatedAmountIn = new BigNumber(tradeHuman.amountIn.toString());
    const estimatedAmountOut = new BigNumber(tradeHuman.amountOut.toString());
    const isStablecoinPair = this.isStablecoinPair(baseToken.symbol, quoteToken.symbol);

    // Calculate the price
    let price: BigNumber;
    if (isStablecoinPair) {
      if (side === 'BUY') {
        price = estimatedAmountIn.dividedBy(estimatedAmountOut);
      } else {
        price = estimatedAmountIn.dividedBy(estimatedAmountOut);
      }

      if (price.lt(new BigNumber(0.5)) || price.gt(new BigNumber(2.0))) {
        price = (new BigNumber(1.0)).plus((estimatedAmountIn.minus(estimatedAmountOut)).dividedBy(BigNumber.max(estimatedAmountIn, estimatedAmountOut)));
        logger.warn(`Adjusting unreasonable stablecoin price (${estimatedAmountIn}/${estimatedAmountOut}) to ${price}`);
      }
    } else {
      if (side === 'BUY') {
        price = estimatedAmountIn.dividedBy(estimatedAmountOut);
      } else {
        price = estimatedAmountOut.dividedBy(estimatedAmountIn);
      }
    }

    if (!price.isFinite() || price.isNaN()) {
      price = new BigNumber(tradeHuman.spotPrice.toString());
      logger.warn(`Using fallback spotPrice: ${price}`);
    }

    let minAmountOut, maxAmountIn;

    if (side === 'BUY') {
      minAmountOut = estimatedAmountOut;
      maxAmountIn = estimatedAmountIn.multipliedBy((new BigNumber(100)).plus(effectiveSlippage).dividedBy(new BigNumber(100)));
    } else {
      maxAmountIn = estimatedAmountIn;
      minAmountOut = estimatedAmountOut.multipliedBy((new BigNumber(100)).minus(effectiveSlippage).dividedBy(new BigNumber(100)));
    }

    const route: SwapRoute[] = tradeHuman.swaps.map(swap => ({
      poolAddress: swap.poolAddress,
      baseToken,
      quoteToken,
      percentage: swap.tradeFeePct || 100
    }));

    const gasPrice = this.config.gasPrice;
    const gasLimit = this.config.gasLimit;
    const gasCost = this.config.gasCost;
    const fee = gasCost;

    const baseTokenBalanceChange = side === 'BUY' ? estimatedAmountOut : estimatedAmountIn.multipliedBy(new BigNumber(-1));
    const quoteTokenBalanceChange = side === 'BUY' ? estimatedAmountIn.multipliedBy(new BigNumber(-1)) : estimatedAmountOut;

    return {
      estimatedAmountIn: estimatedAmountIn.toNumber(),
      estimatedAmountOut: estimatedAmountOut.toNumber(),
      minAmountOut: minAmountOut.toNumber(),
      maxAmountIn: maxAmountIn.toNumber(),
      baseTokenBalanceChange: baseTokenBalanceChange.toNumber(),
      quoteTokenBalanceChange: quoteTokenBalanceChange.toNumber(),
      price: price.toNumber(),
      route,
      fee,
      gasPrice,
      gasLimit,
      gasCost
    };
  }

  /**
   * Execute a swap
   * @param wallet The wallet to use for the swap
   * @param baseTokenSymbol Base token symbol or address
   * @param quoteTokenSymbol Quote token symbol or address
   * @param amount Amount to swap
   * @param side 'BUY' or 'SELL'
   * @param poolAddress Pool address
   * @param slippagePct Slippage percentage (1 means 1%) (optional)
   * @returns A Promise that resolves to the swap execution result
   */
  async executeSwap(
    wallet: KeyringPair,
    baseTokenSymbol: string,
    quoteTokenSymbol: string,
    amount: number,
    side: 'BUY' | 'SELL',
    _poolAddress: string,
    slippagePct?: number
  ): Promise<any> {
    const sdkContext = await this.getSdkContext();

    const baseToken = this.polkadot.getToken(baseTokenSymbol);
    const quoteToken = this.polkadot.getToken(quoteTokenSymbol);

    if (!baseToken || !quoteToken) {
      throw new Error(`Token not found: ${!baseToken ? baseTokenSymbol : quoteTokenSymbol}`);
    }

    const amountBN = BigNumber(amount.toString());
    let trade: any;

    if (side === 'BUY') {
      trade = await this.sdkContextGetBestBuy(
        sdkContext,
        quoteToken.address,
        baseToken.address,
        amountBN
      );
    } else {
      trade = await this.sdkContextGetBestSell(
        sdkContext,
        baseToken.address,
        quoteToken.address,
        amountBN
      );
    }

    if (!trade) {
      throw new Error(`No route found for ${baseToken.symbol}/${quoteToken.symbol}`);
    }

    const effectiveSlippage = this.getSlippagePercentage(slippagePct);
    
    // Use the new SDK TxBuilderFactory to create transaction
    const slippagePercentage = effectiveSlippage.dividedBy(100).toNumber(); // Convert to decimal
    
    const builtTx = await sdkContext.tx.trade(trade)
      .withBeneficiary(wallet.address)
      .withSlippage(slippagePercentage)
      .build();
    
    // Get the actual submittable transaction from the SDK
    const tx = builtTx.get();
    const apiPromise = await this.getApiPromise();

    const { txHash, transaction } = await this.submitTransaction(apiPromise, tx, wallet);

    const feePaymentToken = this.polkadot.getFeePaymentToken();

    let fee: BigNumber;
    try {
      fee = new BigNumber(transaction.events.map((it: any) => it.toHuman()).filter((it: any) => it.event.method == 'TransactionFeePaid')[0].event.data.actualFee.toString().replaceAll(',', '')).dividedBy(Math.pow(10, feePaymentToken.decimals));
    } catch (error) {
      logger.error(`It was not possible to extract the fee from the transaction:`, error);
      fee = new BigNumber(Number.NaN);
    }

    const tradeHuman = trade.toHuman();

    return {
      signature: txHash,
      totalInputSwapped: tradeHuman.amountIn,
      totalOutputSwapped: tradeHuman.amountOut,
      fee: fee.toNumber(),
      baseTokenBalanceChange: side === 'BUY' ? tradeHuman.amountOut : -tradeHuman.amountIn,
      quoteTokenBalanceChange: side === 'BUY' ? -tradeHuman.amountIn : tradeHuman.amountOut,
      priceImpact: 0
    };
  }

  /**
   * Get slippage percentage
   * @returns The slippage percentage
   */
  getSlippagePercentage(slippagePercentage: number | string | BigNumber): BigNumber {
    let actualSlippagePercentage: string;

    if (slippagePercentage === null || slippagePercentage === undefined) {
      actualSlippagePercentage = this.config.allowedSlippage;
    } else {
      actualSlippagePercentage = new BigNumber(slippagePercentage.toString()).dividedBy(new BigNumber(100)).toString();
    }

    if (actualSlippagePercentage.includes('/')) {
      const match = actualSlippagePercentage.match(percentRegexp);

      actualSlippagePercentage = new BigNumber(match[1]).dividedBy(BigNumber(match[2])).toString();
    } else {
      actualSlippagePercentage = actualSlippagePercentage.toString();
    }

    return new BigNumber(actualSlippagePercentage).multipliedBy(new BigNumber(100));
  }

  /**
   * Get a quote for adding liquidity
   * @param poolAddress The pool address
   * @param lowerPrice The lower price
   * @param upperPrice The upper price
   * @param amount The amount to add
   * @param amountType 'base' or 'quote'
   * @param strategyType Strategy type (optional)
   * @returns A Promise that resolves to a liquidity quote
   */
  async getLiquidityQuote(
    poolAddress: string,
    lowerPrice: number,
    upperPrice: number,
    amount: number,
    amountType: 'base' | 'quote',
    strategyType: PositionStrategyType = PositionStrategyType.Balanced
  ): Promise<LiquidityQuote> {
    try {
      const poolInfo = await this.getPoolInfo(poolAddress);
      if (!poolInfo) {
        throw new Error(`Pool not found: ${poolAddress}`);
      }

      const currentPrice = poolInfo.price || 10;
      const poolType = poolInfo.poolType?.toLowerCase() || 'xyk'; // Default to xyk if type is null

      if (!amount || amount <= 0) {
        logger.warn(`Invalid amount provided: ${amount}, using default value 1`);
        amount = 1;
      }

      logger.info(`Calculating liquidity quote for ${poolType} pool`);

      let baseTokenAmount = 0;
      let quoteTokenAmount = 0;

      if (poolType.includes('stable')) {
        if (amountType === 'base') {
          baseTokenAmount = amount;
          quoteTokenAmount = amount * currentPrice;
        } else {
          quoteTokenAmount = amount;
          baseTokenAmount = amount / currentPrice;
        }
      } else if (poolType.includes('xyk') || poolType.includes('constantproduct')) {
        if (amountType === 'base') {
          baseTokenAmount = amount;
          switch (strategyType) {
            case PositionStrategyType.BaseHeavy:
              quoteTokenAmount = baseTokenAmount * currentPrice / 2;
              break;
            case PositionStrategyType.QuoteHeavy:
              quoteTokenAmount = baseTokenAmount * currentPrice * 2;
              break;
            case PositionStrategyType.Balanced:
              quoteTokenAmount = baseTokenAmount * currentPrice;
              break;
            case PositionStrategyType.Imbalanced: {
              const midPrice = (lowerPrice + upperPrice) / 2;
              quoteTokenAmount = baseTokenAmount * currentPrice *
                (currentPrice < midPrice ? 0.7 : 1.3);
              break;
            }
            default:
              quoteTokenAmount = baseTokenAmount * currentPrice;
          }
        } else {
          quoteTokenAmount = amount;
          switch (strategyType) {
            case PositionStrategyType.BaseHeavy:
              baseTokenAmount = quoteTokenAmount / currentPrice * 2;
              break;
            case PositionStrategyType.QuoteHeavy:
              baseTokenAmount = quoteTokenAmount / currentPrice / 2;
              break;
            case PositionStrategyType.Balanced:
              baseTokenAmount = quoteTokenAmount / currentPrice;
              break;
            case PositionStrategyType.Imbalanced: {
              const midPrice = (lowerPrice + upperPrice) / 2;
              baseTokenAmount = quoteTokenAmount / currentPrice *
                (currentPrice < midPrice ? 1.3 : 0.7);
              break;
            }
            default:
              baseTokenAmount = quoteTokenAmount / currentPrice;
          }
        }
      } else if (poolType.includes('omni')) {
        if (amountType === 'base') {
          baseTokenAmount = amount;
          const pricePosition = (currentPrice - lowerPrice) / (upperPrice - lowerPrice);
          const weightMultiplier = pricePosition < 0.5 ? 1.2 : 0.8;
          quoteTokenAmount = baseTokenAmount * currentPrice * weightMultiplier;
        } else {
          quoteTokenAmount = amount;
          const pricePosition = (currentPrice - lowerPrice) / (upperPrice - lowerPrice);
          const weightMultiplier = pricePosition < 0.5 ? 0.8 : 1.2;
          baseTokenAmount = quoteTokenAmount / currentPrice * weightMultiplier;
        }
      } else {
        if (amountType === 'base') {
          baseTokenAmount = amount;
          switch (strategyType) {
            case PositionStrategyType.BaseHeavy:
              quoteTokenAmount = baseTokenAmount * currentPrice / 2;
              break;
            case PositionStrategyType.QuoteHeavy:
              quoteTokenAmount = baseTokenAmount * currentPrice * 2;
              break;
            case PositionStrategyType.Balanced:
              quoteTokenAmount = baseTokenAmount * currentPrice;
              break;
            case PositionStrategyType.Imbalanced: {
              const midPrice = (lowerPrice + upperPrice) / 2;
              quoteTokenAmount = baseTokenAmount * currentPrice *
                (currentPrice < midPrice ? 0.7 : 1.3);
              break;
            }
            default:
              quoteTokenAmount = baseTokenAmount * currentPrice;
          }
        } else {
          quoteTokenAmount = amount;
          switch (strategyType) {
            case PositionStrategyType.BaseHeavy:
              baseTokenAmount = quoteTokenAmount / currentPrice * 2;
              break;
            case PositionStrategyType.QuoteHeavy:
              baseTokenAmount = quoteTokenAmount / currentPrice / 2;
              break;
            case PositionStrategyType.Balanced:
              baseTokenAmount = quoteTokenAmount / currentPrice;
              break;
            case PositionStrategyType.Imbalanced: {
              const midPrice = (lowerPrice + upperPrice) / 2;
              baseTokenAmount = quoteTokenAmount / currentPrice *
                (currentPrice < midPrice ? 1.3 : 0.7);
              break;
            }
            default:
              baseTokenAmount = quoteTokenAmount / currentPrice;
          }
        }
      }

      baseTokenAmount = Number(baseTokenAmount) || 0;
      quoteTokenAmount = Number(quoteTokenAmount) || 0;

      let liquidity = 0;
      if (poolType.includes('stable')) {
        liquidity = Math.sqrt(baseTokenAmount * quoteTokenAmount * currentPrice);
      } else if (poolType.includes('xyk') || poolType.includes('constantproduct')) {
        liquidity = Math.sqrt(baseTokenAmount * quoteTokenAmount);
      } else if (poolType.includes('omni')) {
        liquidity = Math.sqrt(baseTokenAmount * quoteTokenAmount) *
          (1 + Math.min(0.2, Math.abs(currentPrice - (lowerPrice + upperPrice) / 2) / ((upperPrice - lowerPrice) / 2)));
      } else {
        liquidity = Math.sqrt(baseTokenAmount * quoteTokenAmount) || 0;
      }

      return {
        baseTokenAmount,
        quoteTokenAmount,
        lowerPrice,
        upperPrice,
        liquidity
      };
    } catch (error) {
      logger.error(`Failed to get liquidity quote: ${error.message}`);
      return {
        baseTokenAmount: 1,
        quoteTokenAmount: 10,
        lowerPrice: 9.5,
        upperPrice: 10.5,
        liquidity: 3.16
      };
    }
  }

  /**
   * Get token symbol from address
   * @param tokenAddress Token address
   * @returns Token symbol
   */
  async getTokenSymbol(tokenAddress: string): Promise<string> {
    const token = this.polkadot.getToken(tokenAddress);
    if (!token) {
      throw new Error(`Token not found: ${tokenAddress}`);
    }
    return token.symbol;
  }

  /**
   * Check if a pair of tokens represents a stablecoin pair
   * @param token1Symbol First token symbol
   * @param token2Symbol Second token symbol
   * @returns Boolean indicating if this is a stablecoin pair
   */
  private isStablecoinPair(token1Symbol: string, token2Symbol: string): boolean {
    const stablecoins = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'USDN', 'USDJ', 'sUSD', 'GUSD', 'HUSD'];
    const isToken1Stable = stablecoins.some(s => token1Symbol.toUpperCase().includes(s));
    const isToken2Stable = stablecoins.some(s => token2Symbol.toUpperCase().includes(s));
    return isToken1Stable && isToken2Stable;
  }

  /**
   * Gets the HTTP provider for the Polkadot node
   */
  public getHttpProvider(): HttpProvider {
    // if (!this.httpProvider) {
    //   this.httpProvider = new HttpProvider(this.polkadot.config.network.nodeURL);
    // }
    //
    // return this.httpProvider;

    return new HttpProvider(this.polkadot.config.network.nodeURL);
  }

  /**
   * Gets the WebSocket provider for the Polkadot node
   */
  public getWsProvider(): WsProvider {
    // if (!this.wsProvider) {
    //   this.wsProvider = new WsProvider(this.polkadot.config.network.nodeURL);
    // }
    //
    // return this.wsProvider;

    return new WsProvider(this.polkadot.config.network.nodeURL);
  }

  /**
   * Get the appropriate provider based on the URL scheme
   */
  public getProvider(): WsProvider | HttpProvider {
    if (this.polkadot.config.network.nodeURL.startsWith('http')) {
      return this.getHttpProvider();
    } else {
      return this.getWsProvider();
    }
  }

  /**
   * Get ApiPromise instance
   */
  public async getApiPromise(): Promise<ApiPromise> {
    return await this.apiPromiseCreate({ provider: this.getProvider() });
  }

  /**
   * Get SDK Context instance
   */
  public async getSdkContext(): Promise<any> {
    if (!this.sdkContext) {
      const api = await this.getApiPromise();
      this.sdkContext = await this.sdkContextCreate(api);
    }
    return this.sdkContext;
  }

  /**
   * Get pools from the SDK context with retry capability
   */
  @runWithRetryAndTimeout()
  public async sdkContextGetPools(target: any, includeOnly: PoolType[]): Promise<any[]> {
    return await target.ctx.pool.getPools(includeOnly);
  }

  /**
   * Get best sell trade with retry capability
   */
  @runWithRetryAndTimeout()
  public async sdkContextGetBestSell(target: any, assetIn: string, assetOut: string, amountIn: BigNumber | string | number): Promise<any> {
    return await target.api.router.getBestSell(assetIn, assetOut, amountIn);
  }

  /**
   * Get best buy trade with retry capability
   */
  @runWithRetryAndTimeout()
  public async sdkContextGetBestBuy(target: any, assetIn: string, assetOut: string, amountOut: BigNumber | string | number): Promise<any> {
    return await target.api.router.getBestBuy(assetIn, assetOut, amountOut);
  }

  /**
   * Wait for crypto library to be ready with retry capability
   */
  @runWithRetryAndTimeout()
  public async cryptoWaitReady(): Promise<boolean> {
    return await cryptoWaitReady();
  }

  /**
   * Create ApiPromise instance with retry capability
   */
  @runWithRetryAndTimeout()
  public async apiPromiseCreate(options: { provider: WsProvider | HttpProvider }): Promise<ApiPromise> {
    return await ApiPromise.create({
      ...options,
      noInitWarn: true,
      throwOnConnect: true,
      throwOnUnknown: true
    });
  }

  /**
   * Get Polkadot instance with retry capability
   */
  @runWithRetryAndTimeout()
  public async polkadotGetInstance(target: typeof Polkadot, network: string): Promise<Polkadot> {
    return await target.getInstance(network);
  }

  /**
   * Create SDK context with retry capability
   */
  @runWithRetryAndTimeout()
  public async sdkContextCreate(api: ApiPromise): Promise<any> {
    return await createSdkContext(api);
  }

  /**
   * Clean up SDK context resources
   */
  public async cleanup(): Promise<void> {
    if (this.sdkContext) {
      await this.sdkContext.destroy();
      this.sdkContext = undefined;
    }
    if (this.apiPromise) {
      await this.apiPromise.disconnect();
      this.apiPromise = undefined;
    }
  }

  /**
   * Add liquidity to a Hydration position
   * @param walletAddress The user's wallet address
   * @param poolId The pool ID to add liquidity to
   * @param baseTokenAmount Amount of base token to add
   * @param quoteTokenAmount Amount of quote token to add
   * @param slippagePct Optional slippage percentage (1 means 1%) (default from config)
   * @param baseTokenSymbol Optional base token symbol (only used for omnipool)
   * @param quoteTokenSymbol Optional quote token symbol (only used for omnipool)
   * @returns Details of the liquidity addition
   */
  async addLiquidity(
    walletAddress: string,
    poolId: string,
    baseTokenAmount: number,
    quoteTokenAmount: number,
    slippagePct?: number,
    baseTokenSymbol?: string,
    quoteTokenSymbol?: string
  ): Promise<HydrationAddLiquidityResponse> {
    // Get wallet
    const wallet = await this.polkadot.getWallet(walletAddress);

    // Get pool info
    const pool = await this.getPoolInfo(poolId);
    if (!pool) {
      throw new Error(`Pool not found: ${poolId}`);
    }

    // Get token symbols from addresses
    if (!baseTokenSymbol) {
      baseTokenSymbol = await this.getTokenSymbol(pool.baseTokenAddress);
    }
    if (!quoteTokenSymbol) {
      quoteTokenSymbol = await this.getTokenSymbol(pool.quoteTokenAddress);
    }

    // Validate amounts
    if (baseTokenAmount <= 0 && quoteTokenAmount <= 0) {
      throw new Error('You must provide at least one non-zero amount');
    }

    // Check balances with transaction buffer
    const balances = await this.polkadot.getBalance(wallet, [baseTokenSymbol, quoteTokenSymbol]);
    const requiredBase = baseTokenAmount;
    const requiredQuote = quoteTokenAmount;

    // Check base token balance
    if (balances[baseTokenSymbol] < requiredBase) {
      throw new Error(
        `Insufficient ${baseTokenSymbol} balance. Required: ${requiredBase}, Available: ${balances[baseTokenSymbol]}`
      );
    }

    // Check quote token balance
    if (balances[quoteTokenSymbol] < requiredQuote) {
      throw new Error(
        `Insufficient ${quoteTokenSymbol} balance. Required: ${requiredQuote}, Available: ${balances[quoteTokenSymbol]}`
      );
    }

    logger.info(`Adding liquidity to pool ${poolId}: ${baseTokenAmount.toFixed(4)} ${baseTokenSymbol}, ${quoteTokenAmount.toFixed(4)} ${quoteTokenSymbol}`);

    const baseToken = this.polkadot.getToken(baseTokenSymbol);
    const quoteToken = this.polkadot.getToken(quoteTokenSymbol);

    if (!baseToken || !quoteToken) {
      throw new Error(`Asset not found: ${!baseToken ? baseTokenSymbol : quoteTokenSymbol}`);
    }

    // Convert amounts to BigNumber with proper decimals
    const baseAmountBN = new BigNumber(baseTokenAmount)
      .multipliedBy(new BigNumber(10).pow(baseToken.decimals))
      .integerValue(BigNumber.ROUND_DOWN);

    const quoteAmountBN = new BigNumber(quoteTokenAmount)
      .multipliedBy(new BigNumber(10).pow(quoteToken.decimals))
      .integerValue(BigNumber.ROUND_DOWN);

    const effectiveSlippage = this.getSlippagePercentage(slippagePct);

    // Using the GalacticCouncil SDK to prepare the transaction
    const apiPromise = await this.getApiPromise();

    let addLiquidityTx;
    const poolType = pool.poolType?.toLowerCase() || POOL_TYPE.XYK;

    logger.info(`Adding liquidity to ${poolType} pool (${poolId})`);

    switch (poolType) {
      case POOL_TYPE.XYK: {
        const quoteAmountMaxLimit = this.calculateMaxAmountIn(quoteAmountBN, effectiveSlippage);
        addLiquidityTx = apiPromise.tx.xyk.addLiquidity(
          baseToken.address,
          quoteToken.address,
          baseAmountBN.toString(),
          quoteAmountMaxLimit.toString()
        );
        break;
      }

      case POOL_TYPE.STABLESWAP: {
        const assets = [
          { assetId: baseToken.address, amount: baseAmountBN.toString() },
          { assetId: quoteToken.address, amount: quoteAmountBN.toString() }
        ].filter(asset => new BigNumber(asset.amount).gt(0));

        const numericPoolId = parseInt(pool.id);
        if (isNaN(numericPoolId)) {
          throw new Error(`Invalid pool ID for stableswap: ${pool.id}`);
        }

        addLiquidityTx = apiPromise.tx.stableswap.addLiquidity(
          numericPoolId,
          assets
        );
        break;
      }

      case POOL_TYPE.OMNIPOOL: {
        if (baseTokenAmount > 0) {
          const minSharesLimit = this.calculateMinSharesLimit(baseAmountBN, effectiveSlippage);
          addLiquidityTx = apiPromise.tx.omnipool.addLiquidityWithLimit(
            baseToken.address,
            baseAmountBN.toString(),
            minSharesLimit.toString()
          );
          quoteTokenAmount = 0;
          quoteTokenSymbol = null;
        } else if (quoteTokenAmount > 0) {
          const minSharesLimit = this.calculateMinSharesLimit(quoteAmountBN, effectiveSlippage);
          addLiquidityTx = apiPromise.tx.omnipool.addLiquidityWithLimit(
            quoteToken.address,
            quoteAmountBN.toString(),
            minSharesLimit.toString()
          );
          baseTokenAmount = 0;
          baseTokenSymbol = null;
        } else {
          throw new Error('You must provide at least one non-zero amount');
        }

        break;
      }

      default:
        throw new Error(`Unsupported pool type: ${poolType}`);
    }

    const { txHash, transaction } = await this.submitTransaction(apiPromise, addLiquidityTx, wallet, poolType);

    const feePaymentToken = this.polkadot.getFeePaymentToken();

    let fee: BigNumber;
    try {
      fee = new BigNumber(transaction.events.map((it) => it.toHuman()).filter((it) => it.event.method == 'TransactionFeePaid')[0].event.data.actualFee.toString().replaceAll(',', '')).dividedBy(Math.pow(10, feePaymentToken.decimals));
    } catch (error) {
      logger.error(`It was not possible to extract the fee from the transaction:`, error);
      fee = new BigNumber(Number.NaN);
    }

    logger.info(`Liquidity added to pool ${poolId} with tx hash: ${txHash}`);

    return {
      signature: txHash,
      baseTokenAmountAdded: baseTokenAmount,
      quoteTokenAmountAdded: quoteTokenAmount,
      fee: fee.toNumber()
    };
  }

  /**
   * Calculate maximum amount in based on slippage
   * @param amount The amount to calculate maximum for
   * @param slippagePct The slippage percentage (1 means 1%)
   * @returns Maximum amount with slippage applied
   */
  private calculateMaxAmountIn(amount: BigNumber, slippagePct: BigNumber): BigNumber {
    return amount.multipliedBy(((new BigNumber(100)).plus(slippagePct)).dividedBy(100)).integerValue(BigNumber.ROUND_DOWN);
  }

  /**
   * Calculate minimum shares limit based on slippage
   * @param amount The amount to calculate minimum for
   * @param slippagePct The slippage percentage (1 means 1%)
   * @returns Minimum amount with slippage applied
   */
  private calculateMinSharesLimit(amount: BigNumber, slippagePct: BigNumber): BigNumber {
    return amount.multipliedBy(((new BigNumber(100)).minus(slippagePct)).dividedBy(100)).integerValue(BigNumber.ROUND_DOWN);
  }

  /**
   * Submit a transaction and wait for it to be included in a block
   * @param api Polkadot API instance
   * @param tx Transaction to submit
   * @param wallet Wallet to sign the transaction
   * @param poolType Type of pool (for event detection)
   * @returns Transaction hash if successful
   * @throws Error if transaction fails
   */
  private async submitTransaction(api: any, tx: any, wallet: any, poolType?: string): Promise<{ txHash: string, transaction: any }> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return new Promise<{ txHash: string, transaction: any }>(async (resolve, reject) => {
      let unsub: () => void;

      const txId = tx.hex || tx.hash?.toHex?.() || 'unknown';
      logger.debug(`Transaction created with ID: ${txId}`);

      const statusHandler = async (result: any) => {
        try {
          const txHash = result.txHash.toString();

          if (result.status.isInBlock || result.status.isFinalized) {
            const blockHash = result.status.isInBlock ? result.status.asInBlock : result.status.asFinalized;
            logger.debug(`Transaction ${txHash} ${result.status.isInBlock ? 'in block' : 'finalized'}: ${blockHash.toString()}`);

            if (result.dispatchError) {
              const errorMessage = await this.extractErrorMessage(api, result.dispatchError);
              logger.error(`Transaction ${txHash} failed with dispatch error: ${errorMessage}`);
              unsub();
              reject(new Error(`Transaction ${txHash} failed: ${errorMessage}`));
              return;
            }

            if (await this.hasFailedEvent(api, result.events)) {
              const errorMessage = await this.extractEventErrorMessage(api, result.events);
              logger.error(`Transaction ${txHash} failed with event error: ${errorMessage}`);
              unsub();
              reject(new Error(`Transaction ${txHash} failed: ${errorMessage}`));
              return;
            }

            if (await this.hasSuccessEvent(api, result.events, poolType)) {
              logger.info(`Transaction ${txHash} succeeded in block ${blockHash.toString()}`);
              unsub();
              resolve({ txHash: txHash, transaction: result });
              return;
            }

            if (result.status.isFinalized) {
              logger.warn(`Transaction ${txHash} finalized with no specific success/failure event. Assuming success.`);
              unsub();
              resolve({ txHash: txHash, transaction: result });
              return;
            }
          }
          else if (result.status.isDropped || result.status.isInvalid || result.status.isUsurped) {
            const statusType = result.status.type;
            const statusValue = result.status.value.toString();
            const errorMessage = `Transaction ${statusType}: ${statusValue}`;
            logger.error(`Transaction ${txHash} - ${errorMessage}`);
            unsub();
            reject(new Error(`Transaction ${txHash} ${statusType}: ${statusValue}`));
            return;
          }
        } catch (error) {
          const fallbackHash = tx.hex || tx.hash?.toHex?.() || 'unknown';
          logger.error(`Error processing transaction status: ${error.message}`);
          unsub();
          reject(new Error(`Transaction ${fallbackHash} processing failed: ${error.message}`));
        }
      };

      try {
        logger.info(`Submitting transaction...`);
        unsub = await tx.signAndSend(wallet, statusHandler);
      } catch (error) {
        const fallbackHash = tx.hex || tx.hash?.toHex?.() || 'unknown';
        logger.error(`Exception during transaction submission: ${error.message}`);
        reject(new Error(`Transaction ${fallbackHash} submission failed: ${error.message}`));
      }
    });
  }

  /**
   * Extract a meaningful error message from a dispatch error
   * @param api API instance
   * @param dispatchError Dispatch error
   * @returns Error message
   */
  private async extractErrorMessage(api: any, dispatchError: any): Promise<string> {
    if (dispatchError.isModule) {
      try {
        const { docs, name, section } = api.registry.findMetaError(dispatchError.asModule);
        return `${section}.${name}: ${docs.join(' ')}`;
      } catch (error) {
        return `Unknown module error: ${dispatchError.asModule.toString()}`;
      }
    } else {
      return dispatchError.toString();
    }
  }

  /**
   * Extract error message from failure events
   * @param api API instance
   * @param events Events array
   * @returns Error message
   */
  private async extractEventErrorMessage(api: any, events: any[]): Promise<string> {
    const failureEvent = events.find(({ event }) =>
      api.events.system.ExtrinsicFailed.is(event)
    );

    if (!failureEvent) return 'Unknown transaction failure';

    const { event: { data: [error] } } = failureEvent;

    if (error.isModule) {
      try {
        const { docs, name, section } = api.registry.findMetaError(error.asModule);
        return `${section}.${name}: ${docs.join(' ')}`;
      } catch (e) {
        return `Unknown module error: ${error.toString()}`;
      }
    } else {
      return error.toString();
    }
  }

  /**
   * Check if events contain a failure event
   * @param api API instance
   * @param events Events array
   * @returns True if failure event exists
   */
  private async hasFailedEvent(api: any, events: any[]): Promise<boolean> {
    return events.some(({ event }) =>
      api.events.system.ExtrinsicFailed.is(event)
    );
  }

  /**
   * Check if events contain a success event specific to the pool type
   * @param api API instance
   * @param events Events array
   * @param poolType Pool type
   * @returns True if success event exists
   */
  private async hasSuccessEvent(api: any, events: any[], poolType?: string): Promise<boolean> {
    return events.some(({ event }) =>
      api.events.system.ExtrinsicSuccess.is(event) ||
      (poolType === POOL_TYPE.XYK && api.events.xyk.LiquidityAdded?.is(event)) ||
      (poolType === POOL_TYPE.LBP && api.events.lbp.LiquidityAdded?.is(event)) ||
      (poolType === POOL_TYPE.OMNIPOOL && api.events.omnipool.LiquidityAdded?.is(event)) ||
      (poolType === POOL_TYPE.STABLESWAP && api.events.stableswap.LiquidityAdded?.is(event))
    );
  }

  /**
   * List all available pools with filtering options
   * @param types Pool types to filter by
   * @param tokenSymbols Token symbols to filter by
   * @param tokenAddresses Token addresses to filter by
   * @returns A list of filtered pools
   */
  async listPools(
    types: string[] = [],
    tokenSymbols: string[] = [],
    tokenAddresses: string[] = []
  ): Promise<PoolItem[]> {
    types = types.map(type => type.toLowerCase());
    tokenSymbols = tokenSymbols.map(symbol => symbol.toLowerCase());
    tokenAddresses = tokenAddresses.map(address => address.toLowerCase());

    const allTokenAddresses = tokenAddresses
      .concat(tokenSymbols.map(symbol => this.polkadot.getToken(symbol).address.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));

    // Get all pools and token mappings
    const sdkContext = await this.getSdkContext();
    const pools = await this.sdkContextGetPools(sdkContext, []);

    const filteredPools = pools.filter(pool => {
      // Filter by pool type
      if (types.length > 0) {
        if (!types.includes(pool.type?.toLowerCase())) {
          return false;
        }
      }

      // If no token filters, return true
      if (!(allTokenAddresses.length > 0)) {
        return true;
      }

      const poolTokenAddresses = pool.tokens
        .filter(token => !token.symbol.toLowerCase().includes('-pool'))
        .map(token => token.id.toString().toLowerCase())
        .sort((a, b) => a.localeCompare(b));

      if (JSON.stringify(poolTokenAddresses) !== JSON.stringify(allTokenAddresses)) {
        return false;
      }

      return true;
    });

    const poolList = filteredPools.map(pool => ({
      address: pool.address,
      type: pool.type,
      tokens: pool.tokens
        .map(token => token.symbol)
        // .filter(symbol => !symbol.includes('-Pool'))
        .sort((a, b) => a.localeCompare(b))
    }));

    return poolList;
  }

  /**
   * Get a detailed liquidity quote with adjusted pricing and strategy
   * @param poolAddress The pool address
   * @param baseTokenAmount Amount of base token to add
   * @param quoteTokenAmount Amount of quote token to add
   * @param slippagePct Slippage percentage (1 means 1%) (optional)
   * @returns A detailed liquidity quote with recommended amounts
   */
  async quoteLiquidity(
    poolAddress: string,
    baseTokenAmount?: number,
    quoteTokenAmount?: number,
    slippagePct?: number
  ): Promise<HydrationQuoteLiquidityResponse> {
    // Validate inputs
    if (!baseTokenAmount && !quoteTokenAmount) {
      throw new Error('Either baseTokenAmount or quoteTokenAmount must be provided');
    }

    // Get pool info
    const poolInfo = await this.getPoolInfo(poolAddress);
    if (!poolInfo) {
      throw new Error(`Pool not found: ${poolAddress}`);
    }

    // Validate pool info
    if (!poolInfo.baseTokenAddress || !poolInfo.quoteTokenAddress) {
      throw new Error('Invalid pool info: missing token addresses');
    }

    // Get token symbols
    const baseTokenSymbol = await this.getTokenSymbol(poolInfo.baseTokenAddress);
    const quoteTokenSymbol = await this.getTokenSymbol(poolInfo.quoteTokenAddress);

    if (!baseTokenSymbol || !quoteTokenSymbol) {
      throw new Error('Failed to get token symbols');
    }

    logger.info(`Preparing liquidity quote for ${baseTokenSymbol}/${quoteTokenSymbol} pool`);

    // Determine price range based on pool type
    const currentPrice = poolInfo.price || 10;
    let priceRange = 0.05; // Default 5%

    // Safely get pool type with fallback
    const poolType = (poolInfo.poolType || '').toLowerCase();

    // Adjust price range based on pool type
    if (poolType.includes('stable')) {
      priceRange = 0.005; // 0.5% for stable pools
    } else if (poolType.includes('xyk') || poolType.includes('constantproduct')) {
      priceRange = 0.05; // 5% for XYK pools
    } else if (poolType.includes('omni')) {
      priceRange = 0.15; // 15% for Omnipool (wider range)
    }

    const lowerPrice = currentPrice * (1 - priceRange);
    const upperPrice = currentPrice * (1 + priceRange);

    // Determine which amount to use for the quote
    let amount: number;
    let amountType: 'base' | 'quote';

    if (baseTokenAmount && quoteTokenAmount) {
      // Choose amount type based on pool characteristics
      if (poolInfo.poolType?.toLowerCase().includes('stable')) {
        amount = quoteTokenAmount;
        amountType = 'quote';
      } else {
        const baseValue = baseTokenAmount * currentPrice;
        const quoteValue = quoteTokenAmount;

        if (baseValue > quoteValue) {
          amount = baseTokenAmount;
          amountType = 'base';
        } else {
          amount = quoteTokenAmount;
          amountType = 'quote';
        }
      }
    } else {
      amount = baseTokenAmount || quoteTokenAmount;
      amountType = baseTokenAmount ? 'base' : 'quote';
    }

    // Choose strategy based on pool type and price position
    let positionStrategy = PositionStrategyType.Balanced;

    if (poolInfo.poolType?.toLowerCase().includes('stable')) {
      positionStrategy = PositionStrategyType.Balanced;
    }
    else if (poolInfo.poolType?.toLowerCase().includes('xyk') ||
      poolInfo.poolType?.toLowerCase().includes('constantproduct')) {
      if (currentPrice < currentPrice * (1 - priceRange * 0.5)) {
        positionStrategy = PositionStrategyType.BaseHeavy;
      }
      else if (currentPrice > currentPrice * (1 + priceRange * 0.5)) {
        positionStrategy = PositionStrategyType.QuoteHeavy;
      }
      else {
        positionStrategy = PositionStrategyType.Balanced;
      }
    }
    else if (poolInfo.poolType?.toLowerCase().includes('omni')) {
      positionStrategy = PositionStrategyType.Imbalanced;
    }

    // Get liquidity quote
    const quote = await this.getLiquidityQuote(
      poolAddress,
      lowerPrice,
      upperPrice,
      amount,
      amountType,
      positionStrategy
    );

    const effectiveSlippage = this.getSlippagePercentage(slippagePct);

    // Ensure valid values
    const finalBaseAmount = new BigNumber(quote.baseTokenAmount.toString() || 0);
    const finalQuoteAmount = new BigNumber(quote.quoteTokenAmount.toString() || 0);

    // Return standardized response
    return {
      baseLimited: amountType === 'base',
      baseTokenAmount: finalBaseAmount.toNumber(),
      quoteTokenAmount: finalQuoteAmount.toNumber(),
      baseTokenAmountMax: finalBaseAmount.multipliedBy((new BigNumber(100)).plus(effectiveSlippage).dividedBy(new BigNumber(100))).toNumber(),
      quoteTokenAmountMax: finalQuoteAmount.multipliedBy((new BigNumber(100)).plus(effectiveSlippage).dividedBy(new BigNumber(100))).toNumber()
    };
  }

  /**
   * Execute a swap using a wallet address
   * @param network The blockchain network (e.g., 'mainnet')
   * @param walletAddress The user's wallet address
   * @param baseTokenIdentifier Base token symbol or address
   * @param quoteTokenIdentifier Quote token symbol or address
   * @param amount Amount to swap
   * @param side 'BUY' or 'SELL'
   * @param poolAddress Pool address
   * @param slippagePct Slippage percentage (1 means 1%) (optional)
   * @returns Result of the swap execution
   */
  async executeSwapWithWalletAddress(
    network: string,
    walletAddress: string,
    baseTokenIdentifier: string,
    quoteTokenIdentifier: string,
    amount: number,
    side: 'BUY' | 'SELL',
    poolAddress: string,
    slippagePct?: number
  ): Promise<HydrationExecuteSwapResponse> {
    // Validate inputs
    if (!baseTokenIdentifier || !quoteTokenIdentifier) {
      throw new Error('Base token and quote token are required');
    }

    if (!amount || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    if (side !== 'BUY' && side !== 'SELL') {
      throw new Error('Side must be "BUY" or "SELL"');
    }

    // Get the wallet
    const polkadot = await this.polkadotGetInstance(Polkadot, network);
    const wallet = await polkadot.getWallet(walletAddress);

    const effectiveSlippage = this.getSlippagePercentage(slippagePct);

    // Execute swap
    const result = await this.executeSwap(
      wallet,
      baseTokenIdentifier,
      quoteTokenIdentifier,
      amount,
      side,
      poolAddress,
      effectiveSlippage.toNumber()
    );

    logger.info(`Swap executed: ${result.totalInputSwapped} ${side === 'BUY' ? quoteTokenIdentifier : baseTokenIdentifier} for ${result.totalOutputSwapped} ${side === 'BUY' ? baseTokenIdentifier : quoteTokenIdentifier}`);

    return {
      signature: result.signature,
      totalInputSwapped: result.totalInputSwapped,
      totalOutputSwapped: result.totalOutputSwapped,
      fee: result.fee,
      baseTokenBalanceChange: result.baseTokenBalanceChange,
      quoteTokenBalanceChange: result.quoteTokenBalanceChange
    };
  }

  /**
   * Get detailed pool information with proper typing for the API
   * @param poolAddress Address of the pool to query
   * @returns Detailed pool information in the HydrationPoolInfo format
   */
  async getPoolDetails(poolAddress: string): Promise<HydrationPoolInfo | null> {
    const poolInfo = await this.getPoolInfo(poolAddress);

    if (!poolInfo) {
      return null;
    }

    const apiPromise = await this.getApiPromise();

    const poolType = poolInfo.poolType?.toLowerCase();

    let lpMint = { address: '', decimals: 0 };

    switch (poolType) {
      case POOL_TYPE.XYK: {
        const shareTokenId = await apiPromise.query.xyk.shareToken(poolAddress);
        const baseSymbol = await this.getTokenSymbol(poolInfo.baseTokenAddress);
        const baseToken = this.polkadot.getToken(baseSymbol);
        lpMint = {
          address: shareTokenId.toString(),
          decimals: baseToken?.decimals || 0
        };
        break;
      }

      case POOL_TYPE.STABLESWAP: {
        lpMint = {
          address: poolInfo.id || '',
          decimals: 18
        };
        break;
      }

      case POOL_TYPE.OMNIPOOL: {
        const hubAsset = await this.polkadot.getToken('H2O');
        lpMint = {
          address: hubAsset?.address || '',
          decimals: hubAsset?.decimals || 0
        };
        break;
      }

      default:
        logger.warn(`Unknown pool type "${poolType}" for pool ${poolAddress}`);
        break;
    }

    // For other pool types, return standard response
    const result = {
      address: poolInfo.address,
      baseTokenAddress: poolInfo.baseTokenAddress,
      quoteTokenAddress: poolInfo.quoteTokenAddress,
      feePct: poolInfo.feePct,
      price: poolInfo.price,
      baseTokenAmount: poolInfo.baseTokenAmount,
      quoteTokenAmount: poolInfo.quoteTokenAmount,
      poolType: poolInfo.poolType,
      lpMint: lpMint,
      tokens: poolInfo.tokens // Include base and quote tokens
    };

    if (poolInfo.poolType?.toLowerCase() === POOL_TYPE.OMNIPOOL) {
      result.tokens = poolInfo.tokens;
    }

    return result;
  }

  /**
   * Remove liquidity from a Hydration position
   * @param walletAddress The user's wallet address
   * @param poolAddress The pool address to remove liquidity from
   * @param percentageToRemove Percentage to remove (1-100)
   * @param tokenId Token ID to remove liquidity from (optional)
   * @returns Details of the liquidity removal operation
   */
  async removeLiquidity(
    walletAddress: string,
    poolAddress: string,
    percentageToRemove: number,
    tokenId?: string | number
  ): Promise<HydrationRemoveLiquidityResponse> {
    if (percentageToRemove <= 0 || percentageToRemove > 100) {
      throw new Error('Percentage to remove must be between 0 and 100');
    }

    // Get wallet
    const wallet = await this.polkadot.getWallet(walletAddress);

    // Get pool info
    const pool = await this.getPoolInfo(poolAddress);
    if (!pool) {
      throw new Error(`Pool not found: ${poolAddress}`);
    }

    const apiPromise = await this.getApiPromise();
    const poolType = pool.poolType?.toLowerCase() || POOL_TYPE.XYK;
    let removeLiquidityTx: any;
    let userSharesToRemove: BigNumber;
    let totalUserSharesInThePool: BigNumber;
    let shareTokenDecimals: number;

    let baseTokenAmountRemoved: BigNumber = new BigNumber(0);
    let quoteTokenAmountRemoved: BigNumber = new BigNumber(0);

    switch (poolType) {
      case POOL_TYPE.XYK: {
        const shareTokenId = await apiPromise.query.xyk.shareToken(poolAddress);
        const baseToken = this.polkadot.getToken(pool.baseTokenAddress);
        const quoteToken = this.polkadot.getToken(pool.quoteTokenAddress);

        if (!baseToken || !quoteToken) {
          throw new Error(`Token not found: ${!baseToken ? pool.baseTokenAddress : pool.quoteTokenAddress}`);
        }

        shareTokenDecimals = baseToken.decimals;

        const rawBalance = await apiPromise.query.tokens.accounts(walletAddress, shareTokenId);
        const freeBalance = rawBalance.free.toString();

        if (new BigNumber(freeBalance).lte(0)) {
          throw new Error(`User has no liquidity in this pool.`);
        }

        totalUserSharesInThePool = new BigNumber(freeBalance);
        const percentageToRemoveBN = BigNumber(percentageToRemove.toString());
        userSharesToRemove = percentageToRemoveBN.multipliedBy(totalUserSharesInThePool).dividedBy(100).integerValue(BigNumber.ROUND_DOWN);

        if (userSharesToRemove.lte(0)) {
          throw new Error(`Calculated liquidity to remove is zero.`);
        }

        const sdkContext = await this.getSdkContext();
        const pools = await this.sdkContextGetPools(sdkContext, []);
        const poolData = pools.find(p => p.address === poolAddress || p.id === poolAddress);

        if (!poolData) {
          throw new Error(`Could not find pool data for ${poolAddress}`);
        }

        const [token0, token1] = poolData.tokens;
        const baseTokenReserve = new BigNumber(token0.balance.toString());
        const quoteTokenReserve = new BigNumber(token1.balance.toString());

        const poolTotalSupply = await apiPromise.query.tokens.totalIssuance(shareTokenId);
        const totalSupply = new BigNumber(poolTotalSupply.toString());

        const expectedBaseTokenAmount = baseTokenReserve
          .multipliedBy(userSharesToRemove)
          .dividedBy(totalSupply)
          .integerValue(BigNumber.ROUND_DOWN);

        const expectedQuoteTokenAmount = quoteTokenReserve
          .multipliedBy(userSharesToRemove)
          .dividedBy(totalSupply)
          .integerValue(BigNumber.ROUND_DOWN);

        const baseTokenAmountCalc = expectedBaseTokenAmount.dividedBy(Math.pow(10, baseToken.decimals));
        const quoteTokenAmountCalc = expectedQuoteTokenAmount.dividedBy(Math.pow(10, quoteToken.decimals));

        removeLiquidityTx = apiPromise.tx.xyk.removeLiquidity(
          token0.id.toString(),
          token1.id.toString(),
          userSharesToRemove.toString()
        );

        baseTokenAmountRemoved = baseTokenAmountCalc;
        quoteTokenAmountRemoved = quoteTokenAmountCalc;

        break;
      }

      case POOL_TYPE.STABLESWAP: {
        if (!pool.id) {
          throw new Error('Invalid stableswap pool ID');
        }

        shareTokenDecimals = 18; // Stableswap uses 18 decimals for LP tokens
        const shareTokenId = pool.id;

        const rawBalance = await apiPromise.query.tokens.accounts(walletAddress, shareTokenId);
        const freeBalance = rawBalance.free.toString();

        if (new BigNumber(freeBalance).lte(0)) {
          throw new Error(`User has no liquidity in this stableswap pool.`);
        }

        totalUserSharesInThePool = new BigNumber(freeBalance);
        const percentageToRemoveBN = BigNumber(percentageToRemove.toString());
        userSharesToRemove = percentageToRemoveBN.multipliedBy(totalUserSharesInThePool).dividedBy(100).integerValue(BigNumber.ROUND_DOWN);

        if (userSharesToRemove.lte(0)) {
          throw new Error(`Calculated liquidity to remove is zero.`);
        }

        const sdkContext = await this.getSdkContext();
        const pools = await this.sdkContextGetPools(sdkContext, []);
        const poolData = pools.find(p => p.id === shareTokenId);

        if (!poolData) {
          throw new Error(`Could not find pool data for ${shareTokenId}`);
        }

        const baseToken = this.polkadot.getToken(pool.baseTokenAddress);
        const quoteToken = this.polkadot.getToken(pool.quoteTokenAddress);

        if (!baseToken || !quoteToken) {
          throw new Error(`Token not found: ${!baseToken ? pool.baseTokenAddress : pool.quoteTokenAddress}`);
        }

        const baseTokenIndex = poolData.tokens.findIndex(t => t.id === pool.baseTokenAddress);
        const quoteTokenIndex = poolData.tokens.findIndex(t => t.id === pool.quoteTokenAddress);

        if (baseTokenIndex === -1 || quoteTokenIndex === -1) {
          throw new Error(`Token not found in pool`);
        }

        const baseTokenReserve = new BigNumber(poolData.tokens[baseTokenIndex].balance.toString());
        const quoteTokenReserve = new BigNumber(poolData.tokens[quoteTokenIndex].balance.toString());

        const poolTotalSupply = await apiPromise.query.tokens.totalIssuance(shareTokenId);
        const totalSupply = new BigNumber(poolTotalSupply.toString());

        const expectedBaseTokenAmount = baseTokenReserve
          .multipliedBy(userSharesToRemove)
          .dividedBy(totalSupply)
          .integerValue(BigNumber.ROUND_DOWN);

        const expectedQuoteTokenAmount = quoteTokenReserve
          .multipliedBy(userSharesToRemove)
          .dividedBy(totalSupply)
          .integerValue(BigNumber.ROUND_DOWN);

        const baseTokenAmountCalc = expectedBaseTokenAmount.dividedBy(Math.pow(10, baseToken.decimals));
        const quoteTokenAmountCalc = expectedQuoteTokenAmount.dividedBy(Math.pow(10, quoteToken.decimals));

        removeLiquidityTx = apiPromise.tx.stableswap.removeLiquidity(
          shareTokenId,
          userSharesToRemove.toString(),
          [
            { assetId: pool.baseTokenAddress, amount: "0" },
            { assetId: pool.quoteTokenAddress, amount: "0" }
          ]
        );

        baseTokenAmountRemoved = baseTokenAmountCalc;
        quoteTokenAmountRemoved = quoteTokenAmountCalc;

        break;
      }

      case POOL_TYPE.OMNIPOOL: {
        try {
          if (!tokenId) {
            throw new Error('Token ID must be specified for omnipool liquidity removal');
          }

          // Get user positions
          const userPositions = await this.getPositionsOwned(walletAddress, tokenId.toString());

          if (userPositions.length === 0) {
            throw new Error(`No positions found for token ${tokenId} owned by ${walletAddress}`);
          }

          // Calculate total shares and amount to remove
          const { totalShares, totalAmount, totalSharesToRemove } = userPositions.reduce(
            (acc, pos) => {
              const shares = new BigNumber(pos.shares);
              const amount = new BigNumber(pos.amount);
              return {
                totalShares: acc.totalShares.plus(shares),
                totalAmount: acc.totalAmount.plus(amount),
                totalSharesToRemove: acc.totalSharesToRemove.plus(
                  shares.multipliedBy(percentageToRemove).dividedBy(100)
                )
              };
            },
            { totalShares: new BigNumber(0), totalAmount: new BigNumber(0), totalSharesToRemove: new BigNumber(0) }
          );

          userSharesToRemove = totalSharesToRemove.integerValue(BigNumber.ROUND_DOWN);

          // Calculate amount to remove based on user's total amount and shares
          const amountToRemove = totalAmount
            .multipliedBy(userSharesToRemove)
            .dividedBy(totalShares)
            .integerValue(BigNumber.ROUND_DOWN);

          // Convert to human readable format (divide by 10^18)
          baseTokenAmountRemoved = amountToRemove.dividedBy(Math.pow(10, 18));
          quoteTokenAmountRemoved = new BigNumber(0);

          const position = userPositions.find(pos =>
            new BigNumber(pos.shares).gte(userSharesToRemove)
          ) || userPositions[0];

          const positionId = BigInt(position.positionId);

          if (apiPromise.tx.omnipool.withdraw) {
            removeLiquidityTx = apiPromise.tx.omnipool.withdraw(
              positionId,
              userSharesToRemove.toString()
            );
          } else {
            removeLiquidityTx = apiPromise.tx.omnipool.removeLiquidity(
              positionId,
              userSharesToRemove.toString()
            );
          }

          break;
        } catch (error) {
          throw new Error(`Failed to remove liquidity: ${error.message}`);
        }
      }

      default:
        throw new Error(`Unsupported pool type: ${poolType}`);
    }

    if (typeof removeLiquidityTx === 'undefined') {
      throw new Error(`Failed to create transaction for pool ${poolAddress}, type ${poolType}`);
    }

    const { txHash, transaction } = await this.submitTransaction(apiPromise, removeLiquidityTx, wallet, poolType);

    const feePaymentToken = this.polkadot.getFeePaymentToken();
    let fee: BigNumber;
    try {
      fee = new BigNumber(transaction.events
        .map((it) => it.toHuman())
        .filter((it) => it.event.method == 'TransactionFeePaid')[0]
        .event.data.actualFee.toString()
        .replaceAll(',', ''))
        .dividedBy(Math.pow(10, feePaymentToken.decimals));
    } catch (error) {
      fee = new BigNumber(Number.NaN);
    }

    if (poolType === POOL_TYPE.OMNIPOOL) {
      shareTokenDecimals = 18;
    }

    const formattedSharesRemoved = userSharesToRemove.dividedBy(Math.pow(10, shareTokenDecimals));

    return {
      signature: txHash,
      fee: fee ? Number(fee.toString()) : 0,
      baseTokenAmountRemoved: baseTokenAmountRemoved.toNumber(),
      quoteTokenAmountRemoved: quoteTokenAmountRemoved.toNumber(),
      sharesPercentageRemoved: percentageToRemove,
      sharesAmountRemoved: formattedSharesRemoved.toNumber()
    };
  }

  /**
   * Get all positions owned by a wallet address for a specific pool
   * @param walletAddress The wallet address to check
   * @param poolAddress The pool address to filter positions by
   * @returns Array of positions owned by the wallet
   */
  async getPositionsOwned(walletAddress: string, poolAddress: string, omnipoolTokenAddress?: string, omnipoolToken?: string): Promise<HydrationPosition[]> {
    try {
      // Convert wallet address to Hydration format
      const hydraWalletAddress = encodeAddress(
        decodeAddress(walletAddress),
        HYDRA_ADDRESS_PREFIX
      );

      // Check alternate format - some Substrate chains have different address format encoding
      const alternateHydraAddresses = [
        hydraWalletAddress,
        // Try with SS58 format 42 (generic Substrate)
        encodeAddress(decodeAddress(walletAddress), 42),
        // Try with SS58 format 0 (Polkadot)
        encodeAddress(decodeAddress(walletAddress), 0)
      ];

      omnipoolTokenAddress = omnipoolTokenAddress || this.polkadot.getToken(omnipoolToken)?.address;
      omnipoolTokenAddress = omnipoolTokenAddress?.replace(/,/g, '');

      return await this.getPoolPositions(walletAddress, poolAddress, alternateHydraAddresses, omnipoolTokenAddress);
    } catch (error) {
      throw error;
    }
  }


  /**
   * Get pool-based positions (XYK, Stableswap, Omnipool.)
   */
  private async getPoolPositions(
    walletAddress: string, 
    poolAddress: string, 
    alternateAddresses: string[],
    omnipoolTokenAddress?: string
  ): Promise<HydrationPosition[]> {
    try {
      // Get pool info to determine pool type
      const poolInfo = await this.getPoolInfo(poolAddress);
      if (!poolInfo) {
        logger.warn(`Pool not found: ${poolAddress}`);
        return [];
      }

      // For XYK and Stableswap pools, we need to check LP token balances
      if (poolInfo.poolType.toString().toLowerCase() === 'xyk' || poolInfo.poolType.toString().toLowerCase() === 'stableswap') {
        if (!poolAddress) {
          throw Error('poolAddress is required for XYK/Stableswap/Ominipool pools');
        }

        return await this.getLPTokenPositions(walletAddress, poolAddress, poolInfo, alternateAddresses);
      } else if (poolInfo.poolType.toString().toLowerCase() === 'omnipool') {
        return await this.getOmnipoolPositions(alternateAddresses, omnipoolTokenAddress);
      }

      logger.info(`Pool type ${poolInfo.poolType} not yet supported for position tracking`);
      return [];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get LP token positions for XYK/Stableswap pools
   */
  private async getLPTokenPositions(
    walletAddress: string,
    poolAddress: string,
    poolInfo: any,
    _alternateAddresses: string[]
  ): Promise<HydrationPosition[]> {
    try {
      // For XYK pools, we need to check the pool's liquidity provider shares
      if (poolInfo.poolType === 'Xyk') {
        return await this.getXYKPoolPositions(walletAddress, poolAddress, poolInfo);
      }
      
      // For Stableswap pools, we need to check the pool's shares
      if (poolInfo.poolType === 'Stableswap') {
        return await this.getStableswapPoolPositions(walletAddress, poolAddress, poolInfo);
      }
      
      logger.info(`LP token positions not implemented for pool type: ${poolInfo.poolType}`);
      return [];
      
    } catch (error) {
      logger.error(`Error getting LP token positions: ${error.message}`);
      return [];
    }
  }

  /**
   * Get XYK pool positions by checking LP token balance
   */
  private async getXYKPoolPositions(
    walletAddress: string,
    poolAddress: string,
    _poolInfo: any
  ): Promise<HydrationPosition[]> {
    try {
      // Convert wallet address to Hydration format
      const hydraWalletAddress = encodeAddress(
        decodeAddress(walletAddress),
        HYDRA_ADDRESS_PREFIX
      );
      
      // Get pool details to get LP token address
      const poolDetails = await this.getPoolDetails(poolAddress);
      if (!poolDetails) {
        logger.warn(`Pool details not found for ${poolAddress}`);
        return [];
      }
      
      // Get user's LP token balance
      const api = await this.getApiPromise();
      const lpBalanceRaw = await api.query.tokens.accounts(
        hydraWalletAddress,
        poolDetails.lpMint.address
      );
      const userLpBalance = new BigNumber(lpBalanceRaw.free.toString());
      
      if (userLpBalance.lte(0)) {
        return [];
      }

      // Get total supply of LP tokens
      const totalLpSupply = new BigNumber((await api.query.tokens.totalIssuance(poolDetails.lpMint.address)).toString());
      
      // Normalize LP balances to human units
      const lpDecimals = poolDetails.lpMint.decimals || LP_DECIMALS;
      const userLpHuman = userLpBalance.dividedBy(new BigNumber(10).pow(lpDecimals));
      const totalLpHuman = totalLpSupply.dividedBy(new BigNumber(10).pow(lpDecimals));
      
      // Calculate user's share percentage
      const userShare = userLpHuman.dividedBy(totalLpHuman);
      
      // Get pool reserves from pool details
      const baseTokenReserve = new BigNumber(poolDetails.baseTokenAmount || 0);
      const quoteTokenReserve = new BigNumber(poolDetails.quoteTokenAmount || 0);
      
      // Calculate user's position in each token
      const userBaseAmount = baseTokenReserve.multipliedBy(userShare);
      const userQuoteAmount = quoteTokenReserve.multipliedBy(userShare);
      
      // Calculate price as quoteTokenAmount / baseTokenAmount (USDT per HDX)
      const price = userQuoteAmount.dividedBy(userBaseAmount);
      
      // Calculate total position value (base + quote amounts)
      const totalPositionValue = userBaseAmount.plus(userQuoteAmount);
      
      // Create position entry
      const position: HydrationPosition = {
        positionId: `xyk-${poolAddress}`,
        assetId: poolAddress,
        owner: walletAddress,
        shares: userLpHuman.toString(),
        amount: totalPositionValue.toString(),
        price: price.toNumber()
      };

      return [position];
      
    } catch (error) {
      logger.error(`Error getting XYK pool positions: ${error.message}`);
      return [];
    }
  }

  /**
   * Get Stableswap pool positions by checking LP token balance
   */
  private async getStableswapPoolPositions(
    walletAddress: string,
    poolAddress: string,
    _poolInfo: any
  ): Promise<HydrationPosition[]> {
    try {
      // Convert wallet address to Hydration format
      const hydraWalletAddress = encodeAddress(
        decodeAddress(walletAddress),
        HYDRA_ADDRESS_PREFIX
      );
      
      // Get pool details to get LP token address
      const poolDetails = await this.getPoolDetails(poolAddress);
      if (!poolDetails) {
        logger.warn(`Pool details not found for ${poolAddress}`);
        return [];
      }
      
      // Get user's LP token balance
      const api = await this.getApiPromise();
      const lpBalanceRaw = await api.query.tokens.accounts(
        hydraWalletAddress,
        poolDetails.lpMint.address
      );
      const userLpBalance = new BigNumber(lpBalanceRaw.free.toString());
      
      if (userLpBalance.lte(0)) {
        return [];
      }

      // Get total supply of LP tokens
      const totalLpSupply = new BigNumber((await api.query.tokens.totalIssuance(poolDetails.lpMint.address)).toString());
      
      // Normalize LP balances to human units
      const lpDecimals = poolDetails.lpMint.decimals || LP_DECIMALS;
      const userLpHuman = userLpBalance.dividedBy(new BigNumber(10).pow(lpDecimals));
      const totalLpHuman = totalLpSupply.dividedBy(new BigNumber(10).pow(lpDecimals));
      
      // Calculate user's share percentage
      const userShare = userLpHuman.dividedBy(totalLpHuman);
      
      // Get pool reserves from pool details
      const baseTokenReserve = new BigNumber(poolDetails.baseTokenAmount || 0);
      const quoteTokenReserve = new BigNumber(poolDetails.quoteTokenAmount || 0);
      
      // Calculate user's position in each token
      const userBaseAmount = baseTokenReserve.multipliedBy(userShare);
      const userQuoteAmount = quoteTokenReserve.multipliedBy(userShare);
      
      // Calculate price as quoteTokenAmount / baseTokenAmount (USDT per USDC)
      const price = userQuoteAmount.dividedBy(userBaseAmount);
      
      // Calculate total position value (base + quote amounts)
      const totalPositionValue = userBaseAmount.plus(userQuoteAmount);
      
      // Create position entry
      const position: HydrationPosition = {
        positionId: `stableswap-${poolAddress}`,
        assetId: poolAddress,
        owner: walletAddress,
        shares: userLpHuman.toString(),
        amount: totalPositionValue.toString(),
        price: price.toNumber()
      };

      return [position];
      
    } catch (error) {
      logger.error(`Error getting Stableswap pool positions: ${error.message}`);
      return [];
    }
  }

  /**
   * Get Omnipool positions by checking NFT balances
   * @param walletAddress 
   * @param omnipoolTokenAddress 
   * @returns Array of positions
   */
  private async getOmnipoolPositions(
    alternateHydraAddresses: string[],
    omnipoolTokenAddress?: string,
  ): Promise<HydrationPosition[]> {
    const apiPromise = await this.getApiPromise();

    const collectionId = await apiPromise.consts.omnipool.nftCollectionId;

    const [positions, uniques] = await Promise.all([
      apiPromise.query.omnipool.positions.entries(),
      apiPromise.query.uniques.asset.entries(collectionId.toString())
    ]);

    const nftOwners = new Map(
      uniques.map(([key, value]) => {
        const [, itemId] = key.args;
        const owner = value.unwrap()?.owner.toString();

        return [itemId.toString(), owner];
      })
    );

    const result = positions
      .map(([idRaw, dataRaw]) => {
        const positionId = idRaw.args[0].toString();
        const positionData = dataRaw.toHuman() as Record<string, any>;
        const nftOwner = nftOwners.get(positionId);

        const isMatchingToken = omnipoolTokenAddress ? Number(positionData?.assetId.replace(/,/g, '')) === Number(omnipoolTokenAddress) : true;
        const isMatchingOwner = alternateHydraAddresses.some(addr => nftOwner === addr);

        if (!nftOwner) {
          return null;
        }

        if (!isMatchingOwner) {
          return null;
        }

        if (!isMatchingToken) {
          return null;
        }

        const shares = positionData?.shares?.toString().replace(/,/g, '') || '0';
        if (new BigNumber(shares).lte(0)) {
          return null;
        }

        return {
          positionId,
          assetId: positionData.assetId,
          owner: nftOwner,
          shares,
          amount: positionData?.amount?.toString().replace(/,/g, '') || '0',
          price: positionData?.price
        };
      })
      .filter((pos): pos is NonNullable<typeof pos> => pos !== null);

    return result;
  }

  /**
   * Get all positions owned by a wallet across all supported pool types (XYK, Stableswap)
   * @param walletAddress The wallet address to check
   * @returns Array of all positions with summary information
   */
  async getAllPositions(walletAddress: string): Promise<HydrationAllPositionsResponse> {
    try {
      const allPositions: HydrationPosition[] = [];
      let xykPositions = 0;
      let stableswapPositions = 0;
      let totalValue = new BigNumber(0);

      // Get all pools to check for positions
      const sdkContext = await this.getSdkContext();
      const allPools = await this.sdkContextGetPools(sdkContext, []);
      
      // Filter for XYK and Stableswap pools only
      const supportedPools = allPools.filter(pool => 
        pool.type === 'Xyk' || pool.type === 'Stableswap'
      );

      logger.info(`Checking ${supportedPools.length} supported pools for positions`);

      // Check each pool for user positions
      for (const pool of supportedPools) {
        try {
          const positions = await this.getPositionsOwned(walletAddress, pool.address);
          
          if (positions.length > 0) {
            // Add pool type to each position
            const positionsWithType = positions.map(pos => ({
              ...pos,
              poolType: pool.type
            }));
            
            allPositions.push(...positionsWithType);
            
            // Count by pool type
            if (pool.type === 'Xyk') {
              xykPositions += positions.length;
            } else if (pool.type === 'Stableswap') {
              stableswapPositions += positions.length;
            }
            
            // Add to total value
            positions.forEach(pos => {
              totalValue = totalValue.plus(new BigNumber(pos.amount));
            });
          }
        } catch (error) {
          logger.warn(`Error checking positions for pool ${pool.address}: ${error.message}`);
          // Continue with other pools even if one fails
        }
      }

      return {
        positions: allPositions,
        summary: {
          totalPositions: allPositions.length,
          xykPositions,
          stableswapPositions,
          omnipoolPositions: 0, // Not implemented yet
          totalValue: totalValue.toString()
        }
      };

    } catch (error) {
      logger.error(`Error getting all positions: ${error.message}`);
      return {
        positions: [],
        summary: {
          totalPositions: 0,
          xykPositions: 0,
          stableswapPositions: 0,
          omnipoolPositions: 0,
          totalValue: '0'
        }
      };
    }
  }

  /**
     * Get information about a user's position in a Hydration pool
     * @param walletAddress - The user's wallet address
     * @param poolAddress - Optional pool address for specific pool
     * @param baseToken - Optional base token symbol
     * @param quoteToken - Optional quote token symbol
     * @returns Position information including LP token amount and token amounts
     */
  async getPositionInfo(
    walletAddress: string,
    poolAddress?: string,
    baseToken?: string,
    quoteToken?: string,
    omnipoolToken?: string,
    omnipoolTokenAddress?: string,
    positionId?: string,
  ): Promise<HydrationPositionInfo> {
    if (!walletAddress) {
      throw new Error('Wallet address parameter is required');
    }
    validatePolkadotAddress(walletAddress);

    // Convert wallet address to Hydration format
    const hydraWalletAddress = encodeAddress(
      decodeAddress(walletAddress),
      HYDRA_ADDRESS_PREFIX
    );

    // Check alternate format - some Substrate chains have different address format encoding
    const alternateHydraAddresses = [
      hydraWalletAddress,
      // Try with SS58 format 42 (generic Substrate)
      encodeAddress(decodeAddress(walletAddress), 42),
      // Try with SS58 format 0 (Polkadot)
      encodeAddress(decodeAddress(walletAddress), 0)
    ];

    const sdkContext = await this.getSdkContext();
    const allPools = await this.sdkContextGetPools(sdkContext, []);

    let poolAddressToUse = poolAddress;
    if (!poolAddress && ((baseToken && !quoteToken) || (!baseToken && quoteToken)) && !omnipoolToken) {
      throw new Error(
        'Either poolAddress or both baseToken and quoteToken must be provided. For Omnipool, use omnipoolToken without poolAddress.',
      );
    } else if (!poolAddress && omnipoolToken) {
      // Assumes the user wants the information for the Omnipool
      poolAddressToUse = allPools.find(pool => pool.type.toLowerCase() === POOL_TYPE.OMNIPOOL.toLowerCase())?.address;
    } else {
      // Resolve pool address
      if (!poolAddressToUse) {
        const pools = await this.listPools([], [baseToken, quoteToken]);
        if (pools.length === 0) {
          throw new Error(`No AMM pool found for pair ${baseToken}-${quoteToken}`);
        }
        poolAddressToUse = pools[0].address;
      }
    }

    // Fetch pool data
    const poolData = allPools.find(p => p.address === poolAddressToUse);
    if (!poolData) {
      throw new Error(`Pool not found: ${poolAddressToUse}`);
    }

    const poolInfo = await this.getPoolDetails(poolAddressToUse);
    if (!poolInfo) {
      throw new Error(`Pool not found: ${poolAddressToUse}`);
    }

    if (poolData.type.toLowerCase() === POOL_TYPE.OMNIPOOL.toLowerCase()) {
      omnipoolTokenAddress = omnipoolTokenAddress || this.polkadot.getToken(omnipoolToken)?.address;

      let omnipoolPositions = await this.getOmnipoolPositions(alternateHydraAddresses, omnipoolTokenAddress);
      if (positionId) {
        omnipoolPositions = omnipoolPositions.filter(pos => pos.positionId === positionId);
      }

      let totalShares = new BigNumber(0);
      let totalAmount = new BigNumber(0);
      for (const position of omnipoolPositions) {
        totalShares = totalShares.plus(new BigNumber(position.shares));
        totalAmount = totalAmount.plus(new BigNumber(position.amount));
      }

      return {
        poolAddress: poolAddressToUse,
        walletAddress: hydraWalletAddress,
        baseTokenAddress: omnipoolTokenAddress,
        quoteTokenAddress: undefined,
        lpTokenAmount: totalShares.toNumber(),
        baseTokenAmount: totalAmount.toNumber(),
        quoteTokenAmount: undefined,
        price: new BigNumber(poolInfo.price).toNumber(),
      };
    } else {
      // Ensure valid quote token
      if (
        !poolInfo.quoteTokenAddress ||
        poolInfo.quoteTokenAddress === this.polkadot.getNativeToken().address
      ) {
        if (poolData.tokens.length > 1) {
          poolInfo.quoteTokenAddress = poolData.tokens[1].id.toString();
        } else {
          throw new Error('Invalid pool configuration: missing quote token');
        }
      }

      const api = await this.getApiPromise();
      let lpTokenAmount = new BigNumber(0);
      let baseTokenAmount = new BigNumber(0);
      let quoteTokenAmount = new BigNumber(0);

      // Get LP token balance
      const lpBalanceRaw = await api.query.tokens.accounts(
        hydraWalletAddress,
        poolInfo.lpMint.address
      );
      const userLpBalance = new BigNumber(lpBalanceRaw.free.toString());
      const totalLpSupply = new BigNumber((await api.query.tokens.totalIssuance(poolInfo.lpMint.address)).toString());

      if (userLpBalance.gt(0) && totalLpSupply.gt(0)) {
        // Normalize LP balances to human units
        const lpDecimals = poolInfo.lpMint.decimals || LP_DECIMALS;
        const userLpHuman = userLpBalance.dividedBy(
          new BigNumber(10).pow(lpDecimals)
        );
        const totalLpHuman = totalLpSupply.dividedBy(
          new BigNumber(10).pow(lpDecimals)
        );
        const userShareHuman = userLpHuman.dividedBy(totalLpHuman);

        lpTokenAmount = userLpHuman;

        // Pool reserves in human units from poolInfo
        const poolBaseHuman = new BigNumber(poolInfo.baseTokenAmount);
        const poolQuoteHuman = new BigNumber(poolInfo.quoteTokenAmount);

        // Calculate user's share of pool reserves
        const rawBaseHuman = poolBaseHuman.multipliedBy(userShareHuman);
        const rawQuoteHuman = poolQuoteHuman.multipliedBy(userShareHuman);

        // Round according to token decimals
        baseTokenAmount = rawBaseHuman.decimalPlaces(
          poolData.tokens[0].decimals,
          BigNumber.ROUND_DOWN
        );
        quoteTokenAmount = rawQuoteHuman.decimalPlaces(
          poolData.tokens[1].decimals,
          BigNumber.ROUND_DOWN
        );
      }

      await api.disconnect();

      return {
        poolAddress: poolAddressToUse,
        walletAddress: hydraWalletAddress,
        baseTokenAddress: poolInfo.baseTokenAddress,
        quoteTokenAddress: poolInfo.quoteTokenAddress,
        lpTokenAmount: lpTokenAmount.toNumber(),
        baseTokenAmount: baseTokenAmount.toNumber(),
        quoteTokenAmount: quoteTokenAmount.toNumber(),
        price: new BigNumber(poolInfo.price).toNumber(),
      };
    }
  }
}
