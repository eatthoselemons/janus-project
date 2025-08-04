import { Layer, Effect } from 'effect';
import { StorageService } from '../../services/storage';
import { ConfigService } from '../../services/config';
import { createGitStorage } from '../../services/storage/git/GitStorage';
import { GitPersistenceError } from '../../domain/types/errors';

/**
 * Git storage layer that provides StorageService using Git backend
 * This layer depends on ConfigService
 */
export const GitStorageLive = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const config = yield* ConfigService;

    // Validate Git configuration exists
    if (!config.git) {
      return yield* Effect.fail(
        new GitPersistenceError({
          path: '',
          operation: 'read',
          originalMessage: 'Git configuration is missing',
        }),
      );
    }

    const gitConfig = {
      dataPath: config.git.dataPath || './data',
      mode: config.git.mode || ('lossy' as const),
    };

    return yield* createGitStorage(gitConfig);
  }),
);
