import { Layer, Effect } from 'effect';
import { StorageService } from '../../services/storage';
import { ConfigService } from '../../services/config';
import { Neo4jStorageLive } from './Neo4jStorage.layer';
// TODO: Import GitStorageLive when implemented
// import { GitStorageLive } from './GitStorage.layer';

/**
 * Storage layer that selects the appropriate backend based on configuration
 * This layer depends on ConfigService and provides StorageService
 */
export const StorageLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* ConfigService;

    if (config.storageBackend === 'git') {
      // TODO: Return GitStorageLive when implemented
      // For now, throw an error to indicate Git backend is not yet implemented
      return yield* Effect.fail(
        new Error('Git storage backend is not yet implemented'),
      );
      // return GitStorageLive;
    } else {
      // Default to Neo4j backend
      return Neo4jStorageLive;
    }
  }),
);
