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
          const entries = new Set<string>();

          Array.from(files.keys()).forEach((key) => {
            if (key.startsWith(prefix)) {
              const remaining = key.substring(prefix.length);
              const slashIndex = remaining.indexOf('/');

              if (slashIndex === -1) {
                // # Reason: It's a file in this directory
                entries.add(remaining);
              } else {
                // # Reason: It's a subdirectory - add the directory name
                const dirName = remaining.substring(0, slashIndex);
                entries.add(dirName);
              }
            }
          });

          return Array.from(entries);
        }),

      commit: (message: string) =>
        Effect.gen(function* () {
          commitHistory.push(message);
        }),
    }),
  );
};
