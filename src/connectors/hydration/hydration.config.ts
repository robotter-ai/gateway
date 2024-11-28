import { AvailableNetworks } from '../../services/config-manager-types';
import { ConfigManagerV2 } from '../../services/config-manager-v2';


export namespace HydrationConfig {
    export interface NetworkConfig {
      allowedSlippage: string;
      tradingTypes: Array<string>;
      chainType: string;
      availableNetworks: Array<AvailableNetworks>;
    }
  
    export const config: NetworkConfig = {
      allowedSlippage: ConfigManagerV2.getInstance().get(
        'hydration.allowedSlippage'
      ),
      tradingTypes: ['HDX'],
      chainType: 'POLKADOT',
      availableNetworks: [
        { chain: 'polkadot', networks: ['mainnet'] },
      ],
    };
}