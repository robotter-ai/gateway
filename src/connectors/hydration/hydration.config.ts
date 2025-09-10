import { ConfigManagerV2 } from '../../services/config-manager-v2';

// Network constants matching core-2.6
export const hydrationNetworks = ['mainnet'];

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

    /** Address of the Omnipool pool */
    omniPoolAddress: string;

    /** Gas price for the transaction */
    gasPrice: number;

    /** Gas limit for the transaction */
    gasLimit: number;

    /** Gas cost for the transaction */
    gasCost: number;

    /** Priority level for the transaction */
    priorityLevel: string;
  }

  const configManager = ConfigManagerV2.getInstance();

  /**
   * Default configuration for Hydration service.
   * Contains network settings and default values.
   */
  export const config: NetworkConfig = {
    allowedSlippage: configManager.get('hydration.allowedSlippage'),
    omniPoolAddress: configManager.get('hydration.omniPoolAddress'),
    priorityLevel: configManager.get('hydration.priorityLevel'),
    tradingTypes: ['amm', 'swap'],
    availableNetworks: [{ chain: 'polkadot', networks: ['mainnet'] }],
    feePaymentCurrencySymbol: configManager.get(
      'hydration.feePaymentCurrencySymbol',
    ),
    gasPrice: 0.00000177,
    gasLimit: 338667,
    gasCost: 0.6, // in HDX
  };

  // Direct properties matching core-2.6
  export const chain = 'polkadot';
  export const networks = ['mainnet'];
}
