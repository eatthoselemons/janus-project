import { Args, Command } from '@effect/cli';
import { Console, Effect, Option, pipe, Schema } from 'effect';
import * as GenericPersistence from '../../../services/persistence/GenericPersistence';
import { Snippet, SnippetVersion } from '../../../domain/types/snippet';
import { Slug } from '../../../domain/types/branded';
import { NotFoundError } from '../../../domain/types/errors';
import { nameToFileName, writeFileContent } from '../../utils/file';
import { logSuccess } from '../../utils/console';

const SNIPPET_EXTENSION = '.snippet';

const pullHandler = ({ snippet }: { snippet: string }) =>
  Effect.gen(function* () {
    const slug = yield* Schema.decodeUnknown(Slug)(snippet);

    const snippetEntity = yield* GenericPersistence.mustFindByName(
      'Snippet',
      'snippet',
      Snippet,
      slug,
    );

    const latestVersion = yield* GenericPersistence.getLatestVersion(
      'SnippetVersion',
      'Snippet',
      snippetEntity.id,
      SnippetVersion as any,
    );

    const version = yield* Option.match(latestVersion, {
      onNone: () =>
        Effect.fail(
          new NotFoundError({
            entityType: 'snippet',
            id: snippetEntity.id,
          }),
        ),
      onSome: (v) => Effect.succeed(v),
    });

    const filename = nameToFileName(snippet, SNIPPET_EXTENSION);
    yield* writeFileContent(filename, (version as SnippetVersion).content);

    yield* logSuccess(`Pulled snippet '${snippet}' to ${filename}`);
  }).pipe(
    Effect.catchTags({
      NotFoundError: (error) =>
        pipe(
          Console.error(`Snippet '${snippet}' not found`),
          Effect.zipRight(Effect.fail(error)),
        ),
      PersistenceError: (error) =>
        pipe(
          Console.error(`Database error: ${error.originalMessage}`),
          Effect.zipRight(Effect.fail(error)),
        ),
    }),
  );

export const pull = Command.make(
  'pull',
  {
    snippet: Args.text({ name: 'snippet-name' }).pipe(
      Args.withDescription('Name of the snippet to pull'),
    ),
  },
  pullHandler,
).pipe(
  Command.withDescription(
    'Pull a snippet from the database and save it to a file',
  ),
);
