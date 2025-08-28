import { ApiPromise, WsProvider } from "@polkadot/api";

const walletAdress = '5HKTQCEWuuA9bJEqFbAEsbwFQfEe5tXrbZXWj7yQpuxVSHKt';

async function main() {
    const wsProvider = new WsProvider('wss://rpc.hydradx.cloud');
    const api = await ApiPromise.create({ provider: wsProvider });
    const lastHdr = await api.rpc.chain.getHeader();


    const apiAt = await api.at(lastHdr.hash);
    //@ts-ignore
    const { data: { free } } = await apiAt.query.system.account(walletAdress);
    // query the balance at this point of the chain

    console.log(`Balances: ${free}`);


}

main();