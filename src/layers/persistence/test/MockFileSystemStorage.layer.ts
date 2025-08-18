import { Effect, Layer } from 'effect';
import { FileSystemStorageService } from '../../../services/low-level/FileSystemStorage.service';
import { GitPersistenceError } from '../../../domain/types/errors';

/**
 * Mock implementation of FileSystemStorageService for testing
 * Uses closures to maintain state following project patterns
 */
export const createMockFileSystemStorageLayer = (
  initialFiles?: Map<string, string>,
) => {
  // # Reason: Use closure to maintain state instead of Ref
  const files = new Map<string, string>(initialFiles || []);
  const commitHistory: string[] = [];

  return Layer.succeed(
    FileSystemStorageService,
    FileSystemStorageService.of({
      readFile: (path: string) =>
        Effect.gen(function* () {
          const content = files.get(path);
          if (!content) {
            return yield* Effect.fail(
              new GitPersistenceError({
                operation: 'read',
                path,
                originalMessage: 'File not found',
              }),
            );
          }
          return content;
        }),

      writeFile: (path: string, content: string) =>
        Effect.gen(function* () {
          files.set(path, content);
        }),

      listFiles: (path: string) =>
        Effect.gen(function* () {
          const prefix = path.endsWith('/') ? path : path + '/';
          const filesInPath = Array.from(files.keys())
            .filter((key) => key.startsWith(prefix))
            .map((key) => key.substring(prefix.length))
            .filter((name) => !name.includes('/'));
          return filesInPath;
        }),

      commit: (message: string) =>
        Effect.gen(function* () {
          commitHistory.push(message);
        }),
    }),
  );
};