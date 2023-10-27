import { OrderType, Side } from '../../amm/amm.requests';
import { PerpOrderSide, PerpOrderType } from '@blockworks-foundation/mango-v4';

export function translateOrderSide(side: Side) {
  switch (side) {
    case 'BUY':
      return PerpOrderSide.bid;
    case 'SELL':
      return PerpOrderSide.ask;
    default:
      throw new Error('Invalid order side');
  }
}

export function translateOrderType(type: OrderType) {
  switch (type) {
    case 'LIMIT':
      return PerpOrderType.limit;
    case 'MARKET':
      return PerpOrderType.market;
    case 'IOC':
      return PerpOrderType.immediateOrCancel;
    case 'POST_ONLY':
      return PerpOrderType.postOnly;
    default:
      throw new Error('Invalid order type');
  }
}

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export enum OrderStatus {
  CREATED = 'CREATED',
  OPEN = 'OPEN',
  FILLED = 'FILLED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export type OrderTrackingInfo = {
  clientOrderId: number;
  exchangeOrderId?: string;
  status: OrderStatus;
  orderAmount: string;
  filledAmount?: string;
};

export class OrderTracker {
  private clientOrderIdToTrackingInfo: Map<number, OrderTrackingInfo> =
    new Map();

  public addOrder(clientOrderId: number, orderAmount: string) {
    this.clientOrderIdToTrackingInfo.set(clientOrderId, {
      clientOrderId,
      status: OrderStatus.CREATED,
      orderAmount,
    });
  }

  public updateOrderExchangeOrderId(
    clientOrderId: number,
    exchangeOrderId: string
  ) {
    const trackingInfo = this.clientOrderIdToTrackingInfo.get(clientOrderId);
    if (trackingInfo) {
      trackingInfo.exchangeOrderId = exchangeOrderId;
    }
  }

  public updateOrderStatus(
    clientOrderId: number,
    status: OrderStatus,
    filledAmount?: string
  ) {
    const trackingInfo = this.clientOrderIdToTrackingInfo.get(clientOrderId);
    if (trackingInfo) {
      trackingInfo.status = status;

      if (filledAmount) {
        trackingInfo.filledAmount = filledAmount;
      }
    }
  }

  public updateOrderStatusByExchangeOrderId(
    exchangeOrderId: string,
    status: OrderStatus,
    filledAmount?: string
  ) {
    const trackingInfo = Array.from(
      this.clientOrderIdToTrackingInfo.values()
    ).find((info) => info.exchangeOrderId === exchangeOrderId);
    if (trackingInfo) {
      trackingInfo.status = status;

      if (filledAmount) {
        trackingInfo.filledAmount = filledAmount;
      }
    }
  }

  public getExchangeOrderId(clientOrderId: number) {
    const trackingInfo = this.clientOrderIdToTrackingInfo.get(clientOrderId);
    if (trackingInfo) {
      return trackingInfo.exchangeOrderId;
    }

    return undefined;
  }

  public getClientOrderId(exchangeOrderId: string) {
    const trackingInfo = Array.from(
      this.clientOrderIdToTrackingInfo.values()
    ).find((info) => info.exchangeOrderId === exchangeOrderId);
    if (trackingInfo) {
      return trackingInfo.clientOrderId;
    }

    return undefined;
  }

  public getOrderTrackingInfo(clientOrderId: number) {
    const trackingInfo = this.clientOrderIdToTrackingInfo.get(clientOrderId);
    if (trackingInfo) {
      return trackingInfo;
    }

    return undefined;
  }

  public getOrderTrackingInfoByExchangeOrderId(exchangeOrderId: string) {
    const trackingInfo = Array.from(
      this.clientOrderIdToTrackingInfo.values()
    ).find((info) => info.exchangeOrderId === exchangeOrderId);
    if (trackingInfo) {
      return trackingInfo;
    }

    return undefined;
  }

  public getAllOrderTrackingInfo() {
    return Array.from(this.clientOrderIdToTrackingInfo.values());
  }
}
