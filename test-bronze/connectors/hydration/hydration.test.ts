import { Hydration } from "../../../src/connectors/hydration/hydration";
import { price, trade } from '../../../src/connectors/hydration/hydration.controllers';
import { HydrationConfig } from '../../../src/connectors/hydration/hydration.config';
import { Polkadot } from "../../../src/chains/polkadot/polkadot";
import { ConfigManagerV2 } from '../../../src/services/config-manager-v2';
import { ApiPromise } from '@polkadot/api';
import { TradeRouter, PoolService, Trade } from '@galacticcouncil/sdk';
import { HttpException} from "../../../src/services/error-handler";
import { PriceRequest, TradeRequest} from "../../../src/amm/amm.requests";

jest.mock('@polkadot/api');
jest.mock('@galacticcouncil/sdk');
jest.mock('../../chains/polkadot/polkadot');
jest.mock('./hydration.config');
jest.mock('../../services/config-manager-v2');

describe('Hydration Module', () => {
    let mockPolkadot: jest.Mocked<Polkadot>;
    let hydrationInstance: Hydration;

    beforeEach(() => {
        jest.resetAllMocks();

        // Mock `Polkadot` instance
        mockPolkadot = {
            ready: jest.fn().mockReturnValue(true),
            getAccountFromAddress: jest.fn().mockResolvedValue({}),
            gasPrice: '1',
            nativeTokenSymbol: 'DOT',
            gasLimit: '1000',
            gasCost: 1,
            network: 'polkadot',
            init: jest.fn(),
        } as unknown as jest.Mocked<Polkadot>;

        (Polkadot.getInstance as jest.Mock).mockReturnValue(mockPolkadot);

        // Mock Hydration Config
        (ConfigManagerV2.getInstance().get as jest.Mock).mockReturnValue('0.5'); // allowedSlippage

        // Create instance of Hydration
        HydrationConfig.config = {
            allowedSlippage: '0.5',
            tradingTypes: ['AMM'],
            chainType: 'POLKADOT',
            availableNetworks: [{ chain: 'polkadot', networks: ['mainnet'] }],
        };

        hydrationInstance = Hydration.getInstance('testnet');
    });

    describe('hydration.config', () => {
        it('should return a valid config', () => {
            const config = HydrationConfig.config;
            expect(config.tradingTypes).toEqual(['AMM']);
            expect(config.allowedSlippage).toBe('0.5');
            expect(config.chainType).toBe('POLKADOT');
        });
    });

    describe('hydration.ts (class)', () => {
        it('should initialize Hydration instance and set as ready', async () => {
            await hydrationInstance.init();

            expect(mockPolkadot.init).toHaveBeenCalled();
            expect(hydrationInstance.ready()).toBe(true);
        });

        it('should fetch all tokens using the TradeRouter', async () => {
            const mockRouter = {
                getAllAssets: jest.fn().mockResolvedValue([
                    { id: '1', symbol: 'DOT' },
                    { id: '2', symbol: 'TOKEN_B' },
                ]),
            };
            (ApiPromise.create as jest.Mock).mockResolvedValue({});
            (PoolService as jest.Mock).mockImplementation(() => ({
                syncRegistry: jest.fn(),
            }));
            (TradeRouter as jest.Mock).mockImplementation(() => mockRouter);

            const tokens = await hydrationInstance.getAllTokens();
            expect(tokens).toEqual([
                { id: '1', symbol: 'DOT' },
                { id: '2', symbol: 'TOKEN_B' },
            ]);
        });

        it('should estimate a trade and return details', async () => {
            const mockRouter = {
                getAllAssets: jest.fn().mockResolvedValue([
                    { id: '1', symbol: 'DOT' },
                    { id: '2', symbol: 'USD' },
                ]),
                getBestBuy: jest.fn().mockResolvedValue({
                    expectedPrice: '100',
                    amountOut: '90',
                }),
            };

            (ApiPromise.create as jest.Mock).mockResolvedValue({});
            (PoolService as jest.Mock).mockImplementation(() => ({
                syncRegistry: jest.fn(),
            }));
            (TradeRouter as jest.Mock).mockImplementation(() => mockRouter);

            const fakeRequest: PriceRequest = {
                side: 'SELL',
                base: 'DOT',
                quote: 'USD',
                amount: '100',
            };

            const trade = await hydrationInstance.estimateTrade(fakeRequest);
            expect(trade.amountOut).toEqual('90');
            expect(mockRouter.getAllAssets).toHaveBeenCalled();
            expect(mockRouter.getBestBuy).toHaveBeenCalled();
        });

        it('should handle missing assets during trade estimation', async () => {
            const mockRouter = {
                getAllAssets: jest.fn().mockResolvedValue([]),
            };

            (ApiPromise.create as jest.Mock).mockResolvedValue({});
            (PoolService as jest.Mock).mockImplementation(() => ({
                syncRegistry: jest.fn(),
            }));
            (TradeRouter as jest.Mock).mockImplementation(() => mockRouter);

            const fakeRequest: PriceRequest = {
                side: 'SELL',
                base: 'DOT',
                quote: 'USD',
                amount: '100',
            };

            await expect(hydrationInstance.estimateTrade(fakeRequest)).rejects.toThrow(
                HttpException,
            );
            expect(mockRouter.getAllAssets).toHaveBeenCalled();
        });

        it('should execute a trade successfully', async () => {
            const mockRouter = {
                getAllAssets: jest.fn().mockResolvedValue([
                    { id: '1', symbol: 'DOT' },
                    { id: '2', symbol: 'USD' },
                ]),
                getBestBuy: jest.fn().mockResolvedValue({
                    toTx: jest.fn().mockReturnValue({
                        get: jest.fn().mockReturnValue({
                            signAndSend: jest.fn(),
                        }),
                    }),
                }),
            };

            (ApiPromise.create as jest.Mock).mockResolvedValue({});
            (PoolService as jest.Mock).mockImplementation(() => ({
                syncRegistry: jest.fn(),
            }));
            (TradeRouter as jest.Mock).mockImplementation(() => mockRouter);
            const fakeRequest: TradeRequest = {
                address: 'mock-address',
                side: 'SELL',
                base: 'DOT',
                quote: 'USD',
                amount: '100',
                limitPrice: '1.5',
            };

            await hydrationInstance.executeTrade('mock-address', mockRouter);
            expect(mockRouter.getAllAssets).toHaveBeenCalled();
        });
    });

    describe('hydration.controllers', () => {
        it('should return price response for a valid price request', async () => {
            const mockTrade = {
                side: 'BUY',
                toHuman: jest.fn().mockReturnValue({
                    amountOut: '100',
                }),
            };

            jest.spyOn(hydrationInstance, 'estimateTrade').mockResolvedValue(
                mockTrade as unknown as Trade,
            );

            const request: PriceRequest = {
                side: 'BUY',
                base: 'DOT',
                quote: 'USD',
                amount: '50',
            };

            const response = await price(mockPolkadot, hydrationInstance, request);
            expect(response).toEqual(
                expect.objectContaining({
                    network: 'polkadot',
                    base: 'DOT',
                    quote: 'USD',
                    amount: request.amount,
                    expectedAmount: mockTrade.toHuman().amountOut,
                }),
            );
        });

        it('should fail when trade execution throws an error', async () => {
            jest
                .spyOn(hydrationInstance, 'estimateTrade')
                .mockRejectedValue(new Error('Trade error'));

            const request: TradeRequest = {
                address: 'mock-address',
                side: 'SELL',
                base: 'DOT',
                quote: 'USD',
                amount: '50',
            };

            await expect(trade(mockPolkadot, hydrationInstance, request)).rejects.toThrow(
                HttpException,
            );
        });
    });
});