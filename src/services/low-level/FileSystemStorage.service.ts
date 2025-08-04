import { Effect, Context } from 'effect';
import { GitPersistenceError } from '../../domain/types/errors';

/**
 * A service that provides an abstraction over a file system.
 * This contract is designed for key-value like storage where the key is a file path.
 */
export interface FileSystemStorageServiceImpl {
  readonly readFile: (
    path: string,
  ) => Effect.Effect<string, GitPersistenceError>;

  readonly writeFile: (
    path: string,
    content: string,
  ) => Effect.Effect<void, GitPersistenceError>;

  readonly listFiles: (
    path: string,
  ) => Effect.Effect<string[], GitPersistenceError>;

  /**
   * Commits changes to the underlying storage, providing a message for the commit.
   */
  readonly commit: (
    message: string,
  ) => Effect.Effect<void, GitPersistenceError>;
}

export class FileSystemStorageService extends Context.Tag(
  'FileSystemStorageService',
)<FileSystemStorageService, FileSystemStorageServiceImpl>() {}
