import type { AvailabilityConnector } from '../connectors/availability.connector.js';
import type { DomainRequest, DomainResult } from './domain.types.js';

export type DomainConnector = AvailabilityConnector<DomainRequest, DomainResult>;
