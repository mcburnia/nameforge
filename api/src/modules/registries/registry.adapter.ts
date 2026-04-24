import type { AvailabilityConnector } from '../connectors/availability.connector.js';
import type { RegistryRequest, RegistryResult } from './registry.types.js';

export type RegistryConnector = AvailabilityConnector<RegistryRequest, RegistryResult>;
