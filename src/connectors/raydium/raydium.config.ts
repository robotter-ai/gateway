import { ConfigManagerV2 } from '../../services/config-manager-v2';

interface AvailableNetworks {
  chain: string;
  networks: Array<string>;
}

export namespace RaydiumConfig {
  // Supported networks for Raydium
  export const chain = 'solana';
  export const networks = ['mainnet-beta', 'devnet'];

  export interface NetworkConfig {
    allowedSlippage: string;
    priorityLevel: string;
    tradingTypes: Array<string>;
    availableNetworks: Array<AvailableNetworks>;
  }

  export const config: NetworkConfig = {
    allowedSlippage: ConfigManagerV2.getInstance().get(
      'raydium.allowedSlippage',
    ),
    priorityLevel: ConfigManagerV2.getInstance().get('raydium.priorityLevel'),
    tradingTypes: ['amm', 'clmm', 'swap'],
    availableNetworks: [
      { chain: 'solana', networks: ['mainnet-beta', 'devnet'] },
    ],
  };
}