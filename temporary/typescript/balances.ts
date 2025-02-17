import { ApiPromise, WsProvider } from '@polkadot/api';
import { BN } from 'bn.js';

const walletAdress = '14aTCWw7Arqo5XSJjVgaEH6NhW5dFNTnXfu5XHJRBTk1rYvw';
const usdtTokenAdress = '7MB1V23WPBwavDvXo37523r9R569hv8aQvoMHLpPMLCjamZb'; // USDT (10) = 2.164
const dotTokenAdreess = '14aTCWw7Arqo5XSJjVgaEH6NhW5dFNTnXfu5XHJRBTk1rYvw'; // DOT (5) = 0.3651

async function main() {
  const wsProvider = new WsProvider('wss://rpc.hydradx.cloud');
  const api = await ApiPromise.create({ provider: wsProvider });
  const { data: hdxBalance } = await api.query.system.account(walletAdress);
  console.log(`HDX: ${formatBalanceValue(hdxBalance.free)}`);
  const assetBalance = await api.query.tokens.accounts(walletAdress, "5");
  console.log(`USDT: ${formatBalanceValue(assetBalance.free)}`);
}

function formatBalanceValue(
  value: BN,
  decimals = 12,
  fractionDigits = 3,
): string {
  // fator para reduzir os decimais
  const factor = new BN(10).pow(new BN(decimals - fractionDigits));
  // divide e arredonda para o inteiro mais próximo
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
