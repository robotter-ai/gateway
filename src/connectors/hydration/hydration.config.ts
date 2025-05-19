import {ConfigManagerV2} from '../../services/config-manager-v2';

interface AvailableNetworks {
  chain: string;
  networks: Array<string>;
}

/**
 * Configuration namespace for Hydration service.
 * Contains network configuration settings and initialization.
 */
export namespace HydrationConfig {
  /**
   * Network configuration interface for Hydration service.
   * Defines the structure of network-specific settings.
   */
  export interface NetworkConfig {
    /** Supported trading types (e.g., AMM) */
    tradingTypes: Array<string>;
    
    /** Available blockchain networks */
    availableNetworks: Array<AvailableNetworks>;
    
    /** Symbol of the currency used for fee payment */
    feePaymentCurrencySymbol: string;
    
    /** Default allowed slippage percentage */
    allowedSlippage: string;

    /** Gas price for the transaction */
    gasPrice: number;

    /** Gas limit for the transaction */
    gasLimit: number;

    /** Gas cost for the transaction */
    gasCost: number;
  }

  const configManager = ConfigManagerV2.getInstance();

  /**
   * Default configuration for Hydration service.
   * Contains network settings and default values.
   */
  export const config: NetworkConfig = {
    availableNetworks: [{ chain: 'polkadot', networks: ['mainnet'] }],
    tradingTypes: ['AMM'],
    feePaymentCurrencySymbol: configManager.get('hydration.feePaymentCurrencySymbol'),
    allowedSlippage: configManager.get('hydration.allowedSlippage'),
    gasPrice: 0.00000177,
    gasLimit: 338667,
    gasCost: 0.6, // in HDX
  };
}

