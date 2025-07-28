import { Effect, Option, Schema } from 'effect';
import { Neo4jService, TransactionContext } from '../neo4j';
import {
  NotFoundError,
  PersistenceError,
  Neo4jError,
} from '../../domain/types/errors';
import {
  cypher,
  queryParams,
  UndefinedQueryParameterError,
} from '../../domain/types/database';
import { Brand } from 'effect/Brand';
import { Slug } from '../../domain/types/branded';

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
    Effect.tap((_uuid) =>
      globalThis.crypto?.randomUUID !== undefined
        ? Effect.void
        : Effect.logInfo(
            'Using fallback UUID generation - crypto.randomUUID() not available',
          ),
    ),
  );

/**
 * Helper to map Neo4j and query parameter errors to PersistenceError
 */
const mapToPersistenceError =
  (
    operation: 'create' | 'read' | 'update' | 'delete' | 'connect',
    query?: string,
  ) =>
  <E, A>(effect: Effect.Effect<A, E, any>) =>
    effect.pipe(
      Effect.mapError((error) => {
        if (error instanceof PersistenceError) {
          return error;
        } else if (error instanceof Neo4jError) {
          return new PersistenceError({
            originalMessage: error.originalMessage,
            operation,
            query: query || error.query,
          });
        } else if (error instanceof UndefinedQueryParameterError) {
          return new PersistenceError({
            originalMessage: error.message,
            operation,
            query,
          });
        } else {
          return new PersistenceError({
            originalMessage: String(error),
            operation,
            query,
          });
        }
      }),
    );

/**
 * Find an entity by name (maybe pattern)
 * @param nodeLabel The Neo4j node label
 * @param schema The schema that must include a name field
 * @param name The slug name to search for
 * @returns Option of the entity (Some if found, None if not)
 */
export const findByName = <A, I, R>(
  nodeLabel: string,
  schema: Schema.Schema<A, I, R> & {
    Type: { name: Slug };
  },
  name: Slug,
): Effect.Effect<
  Option.Option<Schema.Schema.Type<typeof schema>>,
  PersistenceError,
  R | Neo4jService
> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`MATCH (n:${nodeLabel} {name: $name}) RETURN n`;
    const params = yield* queryParams({ name });
    const results = yield* neo4j.runQuery<{ n: unknown }>(query, params);

    if (results.length === 0) return Option.none();

    const entity = yield* Schema.decodeUnknown(schema)(results[0].n).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            originalMessage: `Schema validation failed: ${error.message}`,
            operation: 'read' as const,
            query: query,
          }),
      ),
    );
    return Option.some(entity);
  }).pipe(
    mapToPersistenceError(
      'read',
      `MATCH (n:${nodeLabel} {name: $name}) RETURN n`,
    ),
  );

/**
 * Find an entity by name (must pattern) - fails if not found
 * @param nodeLabel The Neo4j node label
 * @param entityType The entity type for error messages
 * @param schema The schema that must include a name field
 * @param name The slug name to search for
 * @returns The entity if found, fails with NotFoundError if not
 */
export const mustFindByName = <A, I, R>(
  nodeLabel: string,
  entityType:
    | 'snippet'
    | 'parameter'
    | 'composition'
    | 'tag'
    | 'test-run'
    | 'data-point',
  schema: Schema.Schema<A, I, R> & {
    Type: { name: Slug };
  },
  name: Slug,
): Effect.Effect<
  Schema.Schema.Type<typeof schema>,
  NotFoundError | PersistenceError,
  R | Neo4jService
> =>
  findByName(nodeLabel, schema, name).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          Effect.fail(new NotFoundError({ entityType, slug: name })),
        onSome: Effect.succeed,
      }),
    ),
  );

/**
 * Create a named entity with generated ID
 * @param nodeLabel The Neo4j node label
 * @param schema The schema that must include id, name, and description fields
 * @param entity The entity data without id
 * @returns The created entity with generated id
 */
export const createNamedEntity = <
  S extends Schema.Schema<any, any, any> & {
    Type: { id: Brand<string>; name: Slug; description: string };
  },
>(
  nodeLabel: string,
  schema: S,
  entity: Omit<Schema.Schema.Type<S>, 'id'>,
): Effect.Effect<
  Schema.Schema.Type<S>,
  PersistenceError,
  Schema.Schema.Context<S> | Neo4jService
> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    // Get the name property from entity - we know it has it due to type constraints
    const entityName = (entity as unknown as { name: Slug }).name;

    // Check uniqueness first
    const existing = yield* findByName(nodeLabel, schema, entityName);
    if (Option.isSome(existing)) {
      return yield* Effect.fail(
        new PersistenceError({
          originalMessage: `${nodeLabel} with name '${entityName}' already exists`,
          operation: 'create' as const,
        }),
      );
    }

    // Generate ID and create
    const uuid = yield* generateId();

    // Create the full object
    const entityWithId = { ...entity, id: uuid };

    // Validate it through the schema to ensure type safety
    const validatedEntity = yield* Schema.decodeUnknown(schema)(
      entityWithId,
    ).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            originalMessage: `Schema validation failed: ${error.message}`,
            operation: 'create' as const,
          }),
      ),
    );

    const query = cypher`CREATE (n:${nodeLabel} $props) RETURN n`;
    const params = yield* queryParams({ props: validatedEntity });
    const results = yield* neo4j.runQuery<{ n: unknown }>(query, params);

    // Schema.decode validates the data from the database
    return yield* Schema.decodeUnknown(schema)(results[0].n).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            originalMessage: `Schema validation failed: ${error.message}`,
            operation: 'create' as const,
            query: query,
          }),
      ),
    );
  }).pipe(mapToPersistenceError('create'));

/**
 * List all entities of a given type, ordered by name
 * @param nodeLabel The Neo4j node label
 * @param schema The schema that must include a name field
 * @returns Array of all entities
 */
export const listAll = <A, I, R>(
  nodeLabel: string,
  schema: Schema.Schema<A, I, R> & {
    Type: { name: Slug };
  },
): Effect.Effect<
  readonly Schema.Schema.Type<typeof schema>[],
  PersistenceError,
  R | Neo4jService
> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`MATCH (n:${nodeLabel}) RETURN n ORDER BY n.name`;
    const results = yield* neo4j.runQuery<{ n: unknown }>(query);

    return yield* Effect.forEach(results, (result) =>
      Schema.decodeUnknown(schema)(result.n).pipe(
        Effect.mapError(
          (error) =>
            new PersistenceError({
              originalMessage: `Schema validation failed: ${error.message}`,
              operation: 'read' as const,
              query: query,
            }),
        ),
      ),
    );
  }).pipe(mapToPersistenceError('read'));

/**
 * Helper to verify parent entity exists
 */
const verifyParentExists = (
  tx: TransactionContext,
  parentLabel: string,
  parentId: Brand<string>,
): Effect.Effect<void, Neo4jError, never> =>
  Effect.gen(function* () {
    const parentQuery = cypher`MATCH (p:${parentLabel} {id: $id}) RETURN p`;
    const parentParams = yield* queryParams({ id: parentId }).pipe(
      Effect.mapError(
        (error) =>
          new Neo4jError({
            originalMessage: error.message,
            query: parentQuery,
          }),
      ),
    );
    const parentResults = yield* tx.run(parentQuery, parentParams);

    if (parentResults.length === 0) {
      return yield* Effect.fail(
        new Neo4jError({
          originalMessage: `Parent ${parentLabel} with id ${parentId} not found`,
          query: parentQuery,
        }),
      );
    }
  });

/**
 * Helper to find the previous version
 */
const findPreviousVersion = (
  tx: TransactionContext,
  parentLabel: string,
  versionLabel: string,
  parentId: Brand<string>,
): Effect.Effect<Option.Option<string>, Neo4jError, never> =>
  Effect.gen(function* () {
    const prevQuery = cypher`
      MATCH (p:${parentLabel} {id: $parentId})<-[:VERSION_OF]-(v:${versionLabel})
      RETURN v ORDER BY v.createdAt DESC LIMIT 1
    `;
    const parentParams = yield* queryParams({ id: parentId }).pipe(
      Effect.mapError(
        (error) =>
          new Neo4jError({
            originalMessage: error.message,
            query: prevQuery,
          }),
      ),
    );
    const prevResults = yield* tx.run(prevQuery, parentParams);

    if (prevResults.length === 0) return Option.none();

    const prevResult = prevResults[0] as { v: any };
    return Option.some(prevResult.v.id as string);
  });

/**
 * Helper to create a version with previous link
 */
const createVersionWithPrevious = <S extends Schema.Schema<any, any, any>>(
  tx: TransactionContext,
  parentLabel: string,
  versionLabel: string,
  parentId: Brand<string>,
  prevId: string,
  validatedVersion: Schema.Schema.Type<S>,
  schema: S,
): Effect.Effect<Schema.Schema.Type<S>, Neo4jError, Schema.Schema.Context<S>> =>
  Effect.gen(function* () {
    const createQuery = cypher`
      MATCH (p:${parentLabel} {id: $parentId})
      MATCH (prev:${versionLabel} {id: $prevId})
      CREATE (v:${versionLabel} $props)
      CREATE (v)-[:VERSION_OF]->(p)
      CREATE (v)-[:PREVIOUS_VERSION]->(prev)
      RETURN v
    `;
    const params = yield* queryParams({
      parentId,
      prevId,
      props: validatedVersion,
    }).pipe(
      Effect.mapError(
        (error) =>
          new Neo4jError({
            originalMessage: error.message,
            query: createQuery,
          }),
      ),
    );
    const results = yield* tx.run(createQuery, params);
    const result = results[0] as { v: unknown };
    return yield* Schema.decodeUnknown(schema)(result.v).pipe(
      Effect.mapError(
        (error) =>
          new Neo4jError({
            originalMessage: `Schema validation failed: ${error.message}`,
            query: createQuery,
          }),
      ),
    );
  });

/**
 * Helper to create a version without previous link
 */
const createVersionWithoutPrevious = <S extends Schema.Schema<any, any, any>>(
  tx: TransactionContext,
  parentLabel: string,
  versionLabel: string,
  parentId: Brand<string>,
  validatedVersion: Schema.Schema.Type<S>,
  schema: S,
): Effect.Effect<Schema.Schema.Type<S>, Neo4jError, Schema.Schema.Context<S>> =>
  Effect.gen(function* () {
    const createQuery = cypher`
      MATCH (p:${parentLabel} {id: $parentId})
      CREATE (v:${versionLabel} $props)
      CREATE (v)-[:VERSION_OF]->(p)
      RETURN v
    `;
    const params = yield* queryParams({
      parentId,
      props: validatedVersion,
    }).pipe(
      Effect.mapError(
        (error) =>
          new Neo4jError({
            originalMessage: error.message,
            query: createQuery,
          }),
      ),
    );
    const results = yield* tx.run(createQuery, params);
    const result = results[0] as { v: unknown };
    return yield* Schema.decodeUnknown(schema)(result.v).pipe(
      Effect.mapError(
        (error) =>
          new Neo4jError({
            originalMessage: `Schema validation failed: ${error.message}`,
            query: createQuery,
          }),
      ),
    );
  });

/**
 * Create a version for a versioned entity
 * @param versionLabel The Neo4j node label for the version
 * @param parentLabel The Neo4j node label for the parent entity
 * @param parentId The ID of the parent entity
 * @param schema The schema that must include id, createdAt, and commit_message fields
 * @param versionData The version data without id and createdAt
 * @returns The created version with generated id and timestamp
 */
export const createVersion = <
  S extends Schema.Schema<any, any, any> & {
    Type: { id: Brand<string>; createdAt: Date; commit_message: string };
  },
>(
  versionLabel: string,
  parentLabel: string,
  parentId: Brand<string>,
  schema: S,
  versionData: Omit<Schema.Schema.Type<S>, 'id' | 'createdAt'>,
): Effect.Effect<
  Schema.Schema.Type<S>,
  NotFoundError | PersistenceError,
  Schema.Schema.Context<S> | Neo4jService
> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    return yield* neo4j
      .runInTransaction(
        (tx): Effect.Effect<Schema.Schema.Type<S>, Neo4jError, never> =>
          Effect.gen(function* () {
            // Verify parent exists
            yield* verifyParentExists(tx, parentLabel, parentId);

            // Find previous version
            const previousVersionId = yield* findPreviousVersion(
              tx,
              parentLabel,
              versionLabel,
              parentId,
            );

            // Create new version with generated ID and timestamp
            const uuid = yield* generateId();
            const versionWithIdAndDate = {
              ...versionData,
              id: uuid,
              createdAt: new Date().toISOString(),
            };

            // Validate through schema to ensure type safety
            const validatedVersion = yield* Schema.decodeUnknown(schema)(
              versionWithIdAndDate,
            ).pipe(
              Effect.mapError(
                (error) =>
                  new Neo4jError({
                    originalMessage: `Schema validation failed: ${error.message}`,
                    query: '',
                  }),
              ),
            );

            // Create version with or without previous link
            return yield* Option.match(previousVersionId, {
              onNone: () =>
                createVersionWithoutPrevious(
                  tx,
                  parentLabel,
                  versionLabel,
                  parentId,
                  validatedVersion,
                  schema,
                ),
              onSome: (prevId) =>
                createVersionWithPrevious(
                  tx,
                  parentLabel,
                  versionLabel,
                  parentId,
                  prevId,
                  validatedVersion,
                  schema,
                ),
            });
          }) as Effect.Effect<Schema.Schema.Type<S>, Neo4jError, never>,
      )
      .pipe(
        Effect.mapError((error: Neo4jError) => {
          // Check if this is a parent not found error
          if (
            error.originalMessage.includes('Parent') &&
            error.originalMessage.includes('not found')
          ) {
            const entityTypeMap: Record<
              string,
              'snippet' | 'parameter' | 'composition' | 'tag'
            > = {
              Snippet: 'snippet',
              Parameter: 'parameter',
              Composition: 'composition',
              Tag: 'tag',
            };
            const entityType = entityTypeMap[parentLabel] || 'snippet';
            return new NotFoundError({
              entityType,
              id: parentId as any,
            });
          }

          return new PersistenceError({
            originalMessage: error.originalMessage,
            operation: 'create' as const,
            query: error.query,
          });
        }),
      );
  });

/**
 * Get the latest version of a versioned entity
 * @param versionLabel The Neo4j node label for the version
 * @param parentLabel The Neo4j node label for the parent entity
 * @param parentId The ID of the parent entity
 * @param schema The schema that must include createdAt field
 * @returns Option of the latest version (Some if exists, None if no versions)
 */
export const getLatestVersion = <A, I, R>(
  versionLabel: string,
  parentLabel: string,
  parentId: Brand<string>,
  schema: Schema.Schema<A, I, R> & {
    Type: { createdAt: Date };
  },
): Effect.Effect<
  Option.Option<Schema.Schema.Type<typeof schema>>,
  PersistenceError,
  R | Neo4jService
> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`
      MATCH (p:${parentLabel} {id: $parentId})<-[:VERSION_OF]-(v:${versionLabel})
      RETURN v ORDER BY v.createdAt DESC LIMIT 1
    `;
    const params = yield* queryParams({ parentId });
    const results = yield* neo4j.runQuery<{ v: unknown }>(query, params);

    if (results.length === 0) return Option.none();

    const version = yield* Schema.decodeUnknown(schema)(results[0].v).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            originalMessage: `Schema validation failed: ${error.message}`,
            operation: 'read' as const,
            query: query,
          }),
      ),
    );
    return Option.some(version);
  }).pipe(mapToPersistenceError('read'));
