import { ConfigManagerV2 } from '../../services/config-manager-v2';
export interface NetworkConfig {
  name: string;
  nodeURL: string;
  tokenPriceApi: string;
  maxLRUCacheInstances: number,
  assetListType: string;
  assetListSource: string;
}
export interface Config {
  network: NetworkConfig;
  nativeCurrencySymbol: string;

}

export function getPolkadotConfig(network: string): Config {
  return {
    network: {
      name: network,
      nodeURL: ConfigManagerV2.getInstance().get(
        `polkadot.networks.${network}.nodeURL`
      ),
      tokenPriceApi: ConfigManagerV2.getInstance().get(
        `polkadot.networks.${network}.tokenPriceApi`
      ),
      assetListType: ConfigManagerV2.getInstance().get(
        `polkadot.networks.${network}.assetListType`
      ),
      assetListSource: ConfigManagerV2.getInstance().get(
        `polkadot.networks.${network}.assetListSource`
      ),
      maxLRUCacheInstances: 10,
    },
    nativeCurrencySymbol: ConfigManagerV2.getInstance().get(
      `polkadot.nativeCurrencySymbol`
    ),
  };
}
