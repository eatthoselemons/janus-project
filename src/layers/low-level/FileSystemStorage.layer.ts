import { Effect, Layer } from 'effect';
import fs from 'fs';
import git from 'isomorphic-git';
import { FileSystemStorageService } from '../../services/low-level/FileSystemStorage.service';
import { GitPersistenceError } from '../../domain/types/errors';
import { ConfigService } from '../../services/config';

export const FileSystemStorageLive = Layer.effect(
  FileSystemStorageService,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const dir = config.git.dataPath;

    const readFile = (path: string) =>
      Effect.tryPromise({
        try: () => fs.promises.readFile(`${dir}/${path}`, 'utf-8'),
        catch: (e) =>
          new GitPersistenceError({
            path,
            operation: 'read',
            originalMessage: e instanceof Error ? e.message : String(e),
          }),
      });

    const writeFile = (path: string, content: string) =>
      Effect.tryPromise({
        try: () => fs.promises.writeFile(`${dir}/${path}`, content, 'utf-8'),
        catch: (e) =>
          new GitPersistenceError({
            path,
            operation: 'write',
            originalMessage: e instanceof Error ? e.message : String(e),
          }),
      });

    const listFiles = (path: string) =>
      Effect.tryPromise({
        try: () => fs.promises.readdir(`${dir}/${path}`),
        catch: (e) =>
          new GitPersistenceError({
            path,
            operation: 'list',
            originalMessage: e instanceof Error ? e.message : String(e),
          }),
      });

    const commit = (message: string) =>
      Effect.tryPromise({
        try: async () => {
          await git.add({ fs, dir, filepath: '.' });
          await git.commit({ fs, dir, message, author: { name: 'Janus' } });
        },
        catch: (e) =>
          new GitPersistenceError({
            path: dir,
            operation: 'commit',
            originalMessage: e instanceof Error ? e.message : String(e),
          }),
      });

    return FileSystemStorageService.of({
      readFile,
      writeFile,
      listFiles,
      commit,
    });
  }),
);
