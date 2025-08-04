import { Layer } from 'effect';
import { ConfigServiceLive } from './configuration';
import { Neo4jLive } from './neo4j';
import { StorageLive } from './storage/Storage.layer';

/**
 * Main application layer that combines all service layers
 * This provides ConfigService, Neo4jService (for backward compatibility), and StorageService
 */
export const MainLive = Layer.mergeAll(Neo4jLive, StorageLive).pipe(
  Layer.provide(ConfigServiceLive),
);

/**
 * All services layer - alias for MainLive
 * Use this when you need all application services
 */
export const AllServices = MainLive;

/**
 * Test layer that combines all test service implementations
 */
export const AllServicesTest = (config?: {
  neo4j?: {
    uri?: string;
    user?: string;
    password?: string;
  };
  llm?: {
    providers?: Record<
      string,
      {
        apiKey: string;
        baseUrl: string;
        model: string;
      }
    >;
  };
  neo4jMockData?: Map<string, unknown[]>;
}) => {
  const { ConfigServiceTest } = require('./configuration');
  const { Neo4jTest } = require('./neo4j');

  return Layer.mergeAll(
    ConfigServiceTest(config),
    Neo4jTest(config?.neo4jMockData),
  );
};

// Re-export individual layers for convenience
export {
  ConfigServiceLive,
  ConfigServiceTest,
  ConfigServiceTestPartial,
  fromEnv as ConfigFromEnv,
} from './configuration';
export {
  Neo4jLive,
  Neo4jTest,
  Neo4jTestPartial,
  fromEnv as Neo4jFromEnv,
} from './neo4j';

// Re-export test utilities
export {
  makeTestLayerFor,
  makeStubLayer,
  type ServiceOf,
} from '../lib/test-utils';
