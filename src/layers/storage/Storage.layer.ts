import { Layer, Effect } from 'effect';
import { StorageService, type StorageError } from '../../services/storage';
import { ConfigService } from '../../services/config';
import { Neo4jService } from '../../services/neo4j';
import { Neo4jStorageLive } from './Neo4jStorage.layer';
import { GitStorageLive } from './GitStorage.layer';

/**
 * Storage layer that selects the appropriate backend based on configuration
 * This layer depends on ConfigService and provides StorageService
 */
export const StorageLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* ConfigService;

    if (config.storageBackend === 'git') {
      return GitStorageLive as Layer.Layer<StorageService, StorageError, ConfigService>;
    } else {
      // Default to Neo4j backend
      return Neo4jStorageLive as Layer.Layer<StorageService, StorageError, ConfigService | Neo4jService>;
    }
  }),
);
