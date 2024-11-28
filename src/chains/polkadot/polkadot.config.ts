import { ConfigManagerV2 } from '../../services/config-manager-v2';

export function getPolkadotConfig(network: string) {
  return {
    nodeUrl: ConfigManagerV2.getInstance().get(`polkadot.networks.${network}.nodeUrl`),
  };
}
