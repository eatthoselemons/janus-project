import { Command } from '@effect/cli';
import { Console, Effect, pipe } from 'effect';
import * as GenericPersistence from '../../../services/persistence/GenericPersistence';
import { Snippet } from '../../../domain/types/snippet';
import { formatNamedEntityList } from '../../utils/console';

const listHandler = () =>
  Effect.gen(function* () {
    const snippets = yield* GenericPersistence.listAll('Snippet', Snippet);

    const output = formatNamedEntityList(snippets, 'No snippets found.');
    yield* Console.log(output);
  }).pipe(
    Effect.catchTags({
      PersistenceError: (error) =>
        pipe(
          Console.error(`Failed to list snippets: ${error.originalMessage}`),
          Effect.zipRight(Effect.fail(error)),
        ),
    }),
  );

export const list = Command.make('list', {}, listHandler).pipe(
  Command.withDescription('List all snippets in the database'),
);
