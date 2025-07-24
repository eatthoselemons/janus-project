import { Effect, Option, Schema } from 'effect';
import { Neo4jService } from '../neo4j';
import { Snippet, SnippetVersion } from '../../domain/types/snippet';
import { SnippetId, SnippetVersionId, Slug } from '../../domain/types/branded';
import {
  NotFoundError,
  PersistenceError,
  Neo4jError,
} from '../../domain/types/errors';
import { cypher, queryParams } from '../../domain/types/database';

/**
 * UUID generation as an Effect
 */
const generateId = () =>
  Effect.sync(() => {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    } else {
      // Fallback UUID v4 generation for environments without crypto API
      let dt = new Date().getTime();
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function (c) {
          const r = (dt + Math.random() * 16) % 16 | 0;
          dt = Math.floor(dt / 16);
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        },
      );
      return uuid;
    }
  }).pipe(
    Effect.tap((uuid) =>
      globalThis.crypto?.randomUUID
        ? Effect.void
        : Effect.logInfo('Using fallback UUID generation - crypto.randomUUID() not available')
    )
  );

/**
 * Get a snippet by its unique name - fails if not found
 * @param name - The slug name to search for
 * @returns Effect containing Snippet or NotFoundError
 */
export const mustGetSnippetByName = (name: Slug) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`MATCH (s:Snippet {name: $name}) RETURN s`;
    const params = yield* queryParams({ name });
    const results = yield* neo4j.runQuery<{ s: unknown }>(query, params);

    if (results.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({
          entityType: 'snippet' as const,
          slug: name,
        }),
      );
    }

    return yield* Schema.decode(Snippet)(results[0].s as any).pipe(
      Effect.mapError(
        () =>
          new PersistenceError({
            originalMessage: 'Failed to decode snippet from database',
            operation: 'read' as const,
          }),
      ),
    );
  });

/**
 * Find a snippet by its unique name - returns None if not found
 * @param name - The slug name to search for
 * @returns Effect containing Option of Snippet
 */
export const maybeGetSnippetByName = (name: Slug) =>
  mustGetSnippetByName(name).pipe(
    Effect.map(Option.some),
    Effect.catchTag('NotFoundError', () => Effect.succeed(Option.none())),
  );

/**
 * Get the latest version of a snippet - fails if not found
 * @param snippetId - ID of the snippet
 * @returns Effect containing SnippetVersion or NotFoundError
 */
export const mustGetLatestSnippetVersion = (snippetId: SnippetId) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`
      MATCH (s:Snippet {id: $snippetId})<-[:VERSION_OF]-(sv:SnippetVersion)
      RETURN sv
      ORDER BY sv.createdAt DESC
      LIMIT 1
    `;
    const params = yield* queryParams({ snippetId });
    const results = yield* neo4j.runQuery<{ sv: unknown }>(query, params);

    if (results.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({
          entityType: 'snippet' as const,
          id: snippetId,
        }),
      );
    }

    const version = results[0].sv as any;

    return yield* Schema.decode(SnippetVersion)(version).pipe(
      Effect.mapError(
        () =>
          new PersistenceError({
            originalMessage: 'Failed to decode snippet version from database',
            operation: 'read' as const,
          }),
      ),
    );
  });

/**
 * Find the latest version of a snippet - returns None if not found
 * @param snippetId - ID of the snippet
 * @returns Effect containing Option of SnippetVersion
 */
export const maybeGetLatestSnippetVersion = (snippetId: SnippetId) =>
  mustGetLatestSnippetVersion(snippetId).pipe(
    Effect.map(Option.some),
    Effect.catchTag('NotFoundError', () => Effect.succeed(Option.none())),
  );

/**
 * Create a new snippet with a unique name
 * @param name - The unique slug identifier for the snippet
 * @param description - Human-readable description of the snippet
 * @returns Effect containing the created Snippet
 */
export const createSnippet = (name: Slug, description: string) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    // # Reason: Check if name already exists before creating
    const existing = yield* maybeGetSnippetByName(name);

    if (Option.isSome(existing)) {
      return yield* Effect.fail(
        new PersistenceError({
          originalMessage: `Snippet with name '${name}' already exists`,
          operation: 'create' as const,
        }),
      );
    }

    // # Reason: Create new snippet with generated UUID
    const uuid = yield* generateId();
    const id = Schema.decodeSync(SnippetId)(uuid);
    const createQuery = cypher`
      CREATE (s:Snippet {id: $id, name: $name, description: $description})
      RETURN s
    `;
    const createParams = yield* queryParams({ id, name, description });
    const results = yield* neo4j.runQuery<{ s: unknown }>(
      createQuery,
      createParams,
    );

    return yield* Schema.decode(Snippet)(results[0].s as any).pipe(
      Effect.mapError(
        () =>
          new PersistenceError({
            originalMessage: 'Failed to decode snippet from database',
            operation: 'read' as const,
          }),
      ),
    );
  });

/**
 * Create a new version of an existing snippet
 * @param snippetId - ID of the snippet to version
 * @param content - The template content for this version
 * @param commitMessage - Message explaining the changes
 * @returns Effect containing the created SnippetVersion
 */
export const createSnippetVersion = (
  snippetId: SnippetId,
  content: string,
  commitMessage: string,
) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    return yield* neo4j.runInTransaction((tx) =>
      Effect.gen(function* () {
        // # Reason: Find the snippet to ensure it exists
        const snippetQuery = cypher`MATCH (s:Snippet {id: $id}) RETURN s`;
        const snippetParams = yield* queryParams({ id: snippetId }).pipe(
          Effect.mapError(
            (e) =>
              new Neo4jError({
                query: snippetQuery,
                originalMessage: e.message,
              }),
          ),
        );
        const snippetResults = yield* tx.run<{ s: unknown }>(
          snippetQuery,
          snippetParams,
        );

        if (snippetResults.length === 0) {
          return yield* Effect.fail(
            new Neo4jError({
              query: snippetQuery,
              originalMessage: `Snippet with id ${snippetId} not found`,
            }),
          );
        }

        // # Reason: Find latest version to link as previous
        const latestQuery = cypher`
          MATCH (s:Snippet {id: $snippetId})<-[:VERSION_OF]-(sv:SnippetVersion)
          RETURN sv
          ORDER BY sv.createdAt DESC
          LIMIT 1
        `;
        const latestParams = yield* queryParams({ snippetId }).pipe(
          Effect.mapError(
            (e) =>
              new Neo4jError({
                query: latestQuery,
                originalMessage: e.message,
              }),
          ),
        );
        const latestResults = yield* tx.run<{ sv: unknown }>(
          latestQuery,
          latestParams,
        );

        const uuid = yield* generateId();
        const versionId = Schema.decodeSync(SnippetVersionId)(uuid);

        // # Reason: Create query differently based on whether previous version exists
        if (latestResults.length > 0) {
          const prevVersion = latestResults[0].sv as any;
          const prevId = Schema.decodeSync(SnippetVersionId)(prevVersion.id);

          const createQuery = cypher`
            MATCH (s:Snippet {id: $snippetId})
            MATCH (prev:SnippetVersion {id: $prevId})
            CREATE (sv:SnippetVersion {
              id: $versionId,
              content: $content,
              createdAt: datetime(),
              commit_message: $commitMessage
            })
            CREATE (sv)-[:VERSION_OF]->(s)
            CREATE (sv)-[:PREVIOUS_VERSION]->(prev)
            RETURN sv
          `;

          const params = yield* queryParams({
            snippetId,
            prevId,
            versionId,
            content,
            commitMessage,
          }).pipe(
            Effect.mapError(
              (e) =>
                new Neo4jError({
                  query: createQuery,
                  originalMessage: e.message,
                }),
            ),
          );

          const results = yield* tx.run<{ sv: unknown }>(createQuery, params);
          const created = results[0].sv as any;

          return yield* Schema.decode(SnippetVersion)(created).pipe(
            Effect.mapError(
              () =>
                new Neo4jError({
                  query: createQuery,
                  originalMessage:
                    'Failed to decode snippet version from database',
                }),
            ),
          );
        } else {
          // # Reason: First version, no previous to link
          const createQuery = cypher`
            MATCH (s:Snippet {id: $snippetId})
            CREATE (sv:SnippetVersion {
              id: $versionId,
              content: $content,
              createdAt: datetime(),
              commit_message: $commitMessage
            })
            CREATE (sv)-[:VERSION_OF]->(s)
            RETURN sv
          `;

          const params = yield* queryParams({
            snippetId,
            versionId,
            content,
            commitMessage,
          }).pipe(
            Effect.mapError(
              (e) =>
                new Neo4jError({
                  query: createQuery,
                  originalMessage: e.message,
                }),
            ),
          );

          const results = yield* tx.run<{ sv: unknown }>(createQuery, params);
          const created = results[0].sv as any;

          return yield* Schema.decode(SnippetVersion)(created).pipe(
            Effect.mapError(
              () =>
                new Neo4jError({
                  query: createQuery,
                  originalMessage:
                    'Failed to decode snippet version from database',
                }),
            ),
          );
        }
      }),
    );
  });

/**
 * List all snippets in the system
 * @returns Effect containing array of Snippets
 */
export const listSnippets = () =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`
      MATCH (s:Snippet)
      RETURN s
      ORDER BY s.name
    `;
    const results = yield* neo4j.runQuery<{ s: unknown }>(query);

    return yield* Effect.forEach(results, (r) =>
      Schema.decode(Snippet)(r.s as any).pipe(
        Effect.mapError(
          () =>
            new PersistenceError({
              originalMessage: 'Failed to decode snippet from database',
              operation: 'read' as const,
            }),
        ),
      ),
    );
  });

/**
 * Search snippets by name or description
 * @param searchQuery - The search term
 * @returns Effect containing array of matching Snippets
 */
export const searchSnippets = (searchQuery: string) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    // # Reason: Use case-insensitive CONTAINS for simple search
    const query = cypher`
      MATCH (s:Snippet)
      WHERE toLower(s.name) CONTAINS toLower($query) 
         OR toLower(s.description) CONTAINS toLower($query)
      RETURN s
      ORDER BY s.name
    `;
    const params = yield* queryParams({ query: searchQuery });
    const results = yield* neo4j.runQuery<{ s: unknown }>(query, params);

    return yield* Effect.forEach(results, (r) =>
      Schema.decode(Snippet)(r.s as any).pipe(
        Effect.mapError(
          () =>
            new PersistenceError({
              originalMessage: 'Failed to decode snippet from database',
              operation: 'read' as const,
            }),
        ),
      ),
    );
  });
