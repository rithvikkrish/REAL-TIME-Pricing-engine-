import { NormalizedPriceUpdate, Symbol24hSnapshot } from './market';

export type DownstreamAction = 'subscribe' | 'unsubscribe' | 'ping';

export interface DownstreamClientMessage {
  action: DownstreamAction;
  symbols?: string[];
  requestId?: string;
}

export type DownstreamMessageType =
  | 'price_update'
  | 'snapshot'
  | 'subscribed'
  | 'unsubscribed'
  | 'pong'
  | 'error';

export interface DownstreamBaseMessage {
  type: DownstreamMessageType;
  timestamp: number;
}

export interface DownstreamPriceUpdateMessage extends DownstreamBaseMessage {
  type: 'price_update';
  data: {
    symbol: string;
    buy: number;
    sell: number;
    midpoint: number;
    high_24h: number;
    low_24h: number;
    change_24h: number;
    timestamp: number;
  };
}

export interface DownstreamSnapshotMessage extends DownstreamBaseMessage {
  type: 'snapshot';
  data: Symbol24hSnapshot[];
}

export interface DownstreamAckMessage extends DownstreamBaseMessage {
  type: 'subscribed' | 'unsubscribed' | 'pong';
  symbols?: string[];
  requestId?: string;
}

export interface DownstreamErrorMessage extends DownstreamBaseMessage {
  type: 'error';
  message: string;
  code?: string;
  requestId?: string;
}

export type DownstreamServerMessage =
  | DownstreamPriceUpdateMessage
  | DownstreamSnapshotMessage
  | DownstreamAckMessage
  | DownstreamErrorMessage;
