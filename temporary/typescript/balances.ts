import { ApiPromise, WsProvider } from '@polkadot/api';
import { BN } from 'bn.js';

const walletAdress = '5HKTQCEWuuA9bJEqFbAEsbwFQfEe5tXrbZXWj7yQpuxVSHKt';
// DOT (5) = 0.3651

async function main() {
  const wsProvider = new WsProvider('wss://rpc.hydradx.cloud');
  const api = await ApiPromise.create({ provider: wsProvider });
  const { data: hdxBalance } = await api.query.system.account(walletAdress);
  console.log(`HDX: ${formatBalanceValue(hdxBalance.free)}`);
  // const assetBalance = await api.query.tokens.accounts(walletAdress, "5");
  // console.log(`DOT: ${assetBalance.free}`);
}

export function formatBalanceValue(
  value: typeof BN,
  decimals = 12,
  fractionDigits = 3,
): string {
  // fator para reduzir os decimais
  const factor = new BN(10).pow(new BN(decimals - fractionDigits));

  const rounded = value.divRound(factor);
  // Separa a parte inteira e a parte fracionária
  const divisorForFraction = new BN(10).pow(new BN(fractionDigits));
  const whole = rounded.div(divisorForFraction);
  const fraction = rounded.mod(divisorForFraction);
  // Garante que a parte fracionária tenha o número correto de dígitos (com zeros à esquerda, se necessário)
  const fractionStr = fraction.toString().padStart(fractionDigits, '0');
  return `${whole.toString()}.${fractionStr}`;
}

main().catch(console.error);
