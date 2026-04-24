import type { AvailabilityConnector } from '../connectors/availability.connector.js';
import type { TrademarkRequest, TrademarkResult } from './trademark.types.js';

export type TrademarkConnector = AvailabilityConnector<TrademarkRequest, TrademarkResult>;
