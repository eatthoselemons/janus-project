import { Args, Command, Options } from '@effect/cli';
import { Console, Effect, Option, pipe, Schema } from 'effect';
import * as GenericPersistence from '../../../services/persistence/GenericPersistence';
import { Snippet, SnippetVersion } from '../../../domain/types/snippet';
import { Slug } from '../../../domain/types/branded';
import { fileNameToName, readFileContent } from '../../utils/file';
import { logSuccess } from '../../utils/console';

const SNIPPET_EXTENSION = '.snippet';

const pushHandler = ({ file, message }: { file: string; message: string }) =>
  Effect.gen(function* () {
    const content = yield* readFileContent(file);

    const name = fileNameToName(file, SNIPPET_EXTENSION);
    const slug = yield* Schema.decodeUnknown(Slug)(name);

    const existingSnippet = yield* GenericPersistence.findByName(
      'Snippet',
      Snippet,
      slug,
    );

    const snippetId = yield* Option.match(existingSnippet, {
      onNone: () =>
        GenericPersistence.createNamedEntity('Snippet', Snippet, {
          name: slug,
          description: `Snippet imported from ${file}`,
        }).pipe(Effect.map((s) => s.id)),
      onSome: (s) => Effect.succeed(s.id),
    });

    yield* GenericPersistence.createVersion(
      'SnippetVersion',
      'Snippet',
      snippetId,
      SnippetVersion as any,
      {
        content,
        commit_message: message,
      },
    );

    yield* logSuccess(`Pushed ${file} as new version of '${name}'`);
  }).pipe(
    Effect.catchTags({
      PersistenceError: (error) =>
        pipe(
          Console.error(`Failed to push snippet: ${error.originalMessage}`),
          Effect.zipRight(Effect.fail(error)),
        ),
      ParseError: (error) =>
        pipe(
          Console.error(`Invalid snippet name: ${error.message}`),
          Effect.zipRight(Effect.fail(error)),
        ),
    }),
  );

export const push = Command.make(
  'push',
  {
    file: Args.file({ name: 'file-path', exists: 'yes' }).pipe(
      Args.withDescription('Path to the snippet file to push'),
    ),
    message: Options.text('message').pipe(
      Options.withAlias('m'),
      Options.withDescription('Commit message for this version'),
    ),
  },
  pushHandler,
).pipe(Command.withDescription('Push a file as a new snippet version'));
