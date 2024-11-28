import { EstimateGasResponse } from '../../amm/amm.requests';
import { validateEstimateGasRequest, validatePolkadotBalanceRequest,  } from './polkadot.validators';
import {
    BalanceRequest,
   
    PollRequest,
    PollResponse,
  } from '../../network/network.requests';
  import { Polkadot } from './polkadot';
import { EstimateGasRequest } from './polkadot.types';
 
  
  async function getInitializedPolkadot(network: string): Promise<Polkadot> {
    const polkadot = await Polkadot.getInstance(network);
  
    if (!polkadot.ready()) {
      await polkadot.init();
    }
  
    return polkadot;
  }
  
  export class PolkadotController {
    // static async poll(chain: Polkadot, req: PollRequest): Promise<PollResponse> {
    //   validatePollRequest(req);
  
    //   return await chain.getBalance(req.txHash);
    // }
  
    static async balances(chain: Polkadot, request: BalanceRequest) {
        validatePolkadotBalanceRequest(request);
  
      const balances: Record<string, string> = {};
      balances['DOT'] = await chain.getBalance(request.address);
  
      return {
        balances,
      };
    }
  
    static async estimateGas(chain: Polkadot, request: EstimateGasRequest): Promise<EstimateGasResponse> {
      validateEstimateGasRequest(request);
  
      const gas = await chain.estimateGas(request.tokenIn, request.tokenOut);
  
      return {
        network: "wss://rpc.polkadot.io",
        gasLimit: gas,
        gasCost: `${gas / 10 ** 12} DOT`,
        timestamp: Date.now(),
        gasPrice: 0,
        gasPriceToken: 'DOT',
      };
    }
  }
  