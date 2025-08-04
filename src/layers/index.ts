import { Layer, Effect } from 'effect';
import { ConfigService } from '../services/config';
import { Neo4jPersistenceLive } from './persistence/Neo4jPersistence.layer';
import { GitPersistenceLive } from './persistence/GitPersistence.layer';
import { TransactionalDatabaseLive } from './low-level/TransactionalDatabase.layer';
import { FileSystemStorageLive } from './low-level/FileSystemStorage.layer';
import { PersistenceService } from '../services/persistence/Persistence.service';

export const AppLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* ConfigService;

    if (config.storageBackend === 'git') {
      return GitPersistenceLive.pipe(Layer.provide(FileSystemStorageLive));
    } else {
      return Neo4jPersistenceLive.pipe(
        Layer.provide(TransactionalDatabaseLive),
      );
    }
  }),
);
