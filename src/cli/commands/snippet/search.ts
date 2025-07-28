import { Args, Command } from '@effect/cli';
import { Console, Effect, pipe, Schema } from 'effect';
import { Neo4jService } from '../../../services/neo4j';
import { Snippet } from '../../../domain/types/snippet';
import { formatNamedEntityList } from '../../utils/console';
import { cypher, queryParams } from '../../../domain/types/database';
import { PersistenceError } from '../../../domain/types/errors';

const searchHandler = ({ query }: { query: string }) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    const searchQuery = cypher`
        MATCH (s:Snippet)
        WHERE toLower(s.name) CONTAINS toLower($query) 
           OR toLower(s.description) CONTAINS toLower($query)
        RETURN s
        ORDER BY s.name
      `;

    const params = yield* queryParams({ query }).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            originalMessage: error.message,
            operation: 'read',
            query: searchQuery,
          }),
      ),
    );

    const results = yield* neo4j
      .runQuery<{ s: unknown }>(searchQuery, params)
      .pipe(
        Effect.mapError(
          (error) =>
            new PersistenceError({
              originalMessage: error.originalMessage,
              operation: 'read',
              query: searchQuery,
            }),
        ),
      );

    const snippets = yield* Effect.forEach(results, (result) =>
      Schema.decodeUnknown(Snippet)(result.s).pipe(
        Effect.mapError(
          (error) =>
            new PersistenceError({
              originalMessage: `Schema validation failed: ${error.message}`,
              operation: 'read',
              query: searchQuery,
            }),
        ),
      ),
    );

    const output = formatNamedEntityList(snippets, 'No snippets found.');
    yield* Console.log(output);
  }).pipe(
    Effect.catchTags({
      PersistenceError: (error) =>
        pipe(
          Console.error(`Search failed: ${error.originalMessage}`),
          Effect.zipRight(Effect.fail(error)),
        ),
    }),
  );

export const search = Command.make(
  'search',
  {
    query: Args.text({ name: 'query' }).pipe(
      Args.withDescription('Search query for snippet names and descriptions'),
    ),
  },
  searchHandler,
).pipe(Command.withDescription('Search for snippets by name or description'));
