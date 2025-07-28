import { FileSystem } from '@effect/platform';
import { Effect, pipe } from 'effect';
import * as path from 'node:path';
import { PersistenceError } from '../../domain/types/errors';

export const readFileContent = (
  filePath: string,
): Effect.Effect<string, PersistenceError, FileSystem.FileSystem> =>
  pipe(
    FileSystem.FileSystem,
    Effect.flatMap((fs) => fs.readFileString(filePath)),
    Effect.mapError(
      (error) =>
        new PersistenceError({
          originalMessage: `Failed to read file: ${error.message}`,
          operation: 'read',
          query: `file: ${filePath}`,
        }),
    ),
  );

export const writeFileContent = (
  filePath: string,
  content: string,
): Effect.Effect<void, PersistenceError, FileSystem.FileSystem> =>
  pipe(
    FileSystem.FileSystem,
    Effect.flatMap((fs) => fs.writeFileString(filePath, content)),
    Effect.mapError(
      (error) =>
        new PersistenceError({
          originalMessage: `Failed to write file: ${error.message}`,
          operation: 'create',
          query: `file: ${filePath}`,
        }),
    ),
  );

// Generic file name conversion functions
export const nameToFileName = (name: string, extension: string): string =>
  `${name}${extension}`;

export const fileNameToName = (fileName: string, extension: string): string => {
  const baseName = path.basename(fileName);
  return baseName.endsWith(extension)
    ? baseName.slice(0, -extension.length)
    : baseName;
};
