// noinspection ES6PreferShortImport
import { ConfigManagerV2 } from '../../services/config-manager-v2';

export interface NetworkConfiguration {
  name: string;
  nodeURL: string;
  maximumLRUCacheInstances: number;
  assetListType: string;
  assetListSource: string;
}

export interface HydrationChainConfiguration {
  network: NetworkConfiguration;
  nativeCurrencySymbol: string;
}

const DEFAULT_MAX_LRU_CACHE_INSTANCES = 10;

export function getHydrationChainConfiguration(
  network: string,
): HydrationChainConfiguration {
  const configManager = ConfigManagerV2.getInstance();

  const nodeURL = configManager.get(`hydrationChain.networks.${network}.nodeURL`);
  const assetListType = configManager.get(
    `hydrationChain.networks.${network}.assetListType`,
  );
  const assetListSource = configManager.get(
    `hydrationChain.networks.${network}.assetListSource`,
  );
  const nativeCurrencySymbol = configManager.get(
    `hydrationChain.nativeCurrencySymbol`,
  );

  return {
    network: {
      name: network,
      nodeURL,
      assetListType,
      assetListSource,
      maximumLRUCacheInstances: DEFAULT_MAX_LRU_CACHE_INSTANCES,
    },
    nativeCurrencySymbol,
  };
}
