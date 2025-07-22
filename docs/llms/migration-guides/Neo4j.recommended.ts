import { Context, Effect, Layer, Redacted, Schema } from 'effect';
import neo4j, { type Session, type Transaction } from 'neo4j-driver';
import { Neo4jError } from '../../../src/domain/types/errors';
import { ConfigService } from '../../../src/services/config';

/**
 * Recommended Neo4j Service Architecture for Janus Project
 *
 * This provides:
 * 1. Simple query interface for basic operations
 * 2. Transaction support for data integrity
 * 3. Batch operations for efficient test runs
 * 4. Session reuse for complex graph traversals
 */

// Types for better type safety
export interface QueryResult<T = any> {
  records: T[];
  summary: {
    queryType: string;
    counters: {
      nodesCreated: number;
      nodesDeleted: number;
      relationshipsCreated: number;
      relationshipsDeleted: number;
      propertiesSet: number;
    };
    executionTime: number;
  };
}

export interface Neo4jService {
  /**
   * Execute a single query - best for simple operations
   */
  readonly runQuery: <T = any>(
    query: string,
    params?: Record<string, any>,
  ) => Effect.Effect<T[], Neo4jError>;

  /**
   * Execute multiple operations in a transaction
   * Automatically rolls back on failure
   */
  readonly runInTransaction: <A>(
    operations: (tx: {
      run: <T = any>(
        query: string,
        params?: Record<string, any>,
      ) => Effect.Effect<T[], Neo4jError>;
    }) => Effect.Effect<A, Neo4jError>,
  ) => Effect.Effect<A, Neo4jError>;

  /**
   * Execute multiple queries with the same session
   * More efficient for related queries
   */
  readonly runBatch: <T = any>(
    queries: Array<{
      query: string;
      params?: Record<string, any>;
    }>,
  ) => Effect.Effect<T[][], Neo4jError>;

  /**
   * For complex graph operations that need full session control
   */
  readonly withSession: <A>(
    work: (session: Session) => Effect.Effect<A, Neo4jError>,
  ) => Effect.Effect<A, Neo4jError>;
}

export class Neo4jService extends Context.Tag('Neo4jService')<
  Neo4jService,
  Neo4jService
>() {}

// Helper functions to break up the implementation

const createDriver = (config: {
  uri: string;
  user: string;
  password: string;
}) =>
  Effect.try({
    try: () =>
      neo4j.driver(config.uri, neo4j.auth.basic(config.user, config.password), {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 60000,
        logging: {
          level: 'warn',
          logger: (level, message) => {
            if (level === 'error' || level === 'warn') {
              Effect.logWarning(`Neo4j ${level}: ${message}`).pipe(
                Effect.runSync,
              );
            }
          },
        },
      }),
    catch: (e) =>
      new Neo4jError({
        query: 'DRIVER_INIT',
        originalMessage: e instanceof Error ? e.message : String(e),
      }),
  });

const closeDriver = (driver: neo4j.Driver) =>
  Effect.tryPromise({
    try: () => driver.close(),
    catch: () =>
      new Neo4jError({
        query: 'DRIVER_CLOSE',
        originalMessage: 'Failed to close driver',
      }),
  }).pipe(Effect.orElse(() => Effect.void));

const verifyDriverConnectivity = (driver: neo4j.Driver) =>
  Effect.tryPromise({
    try: () => driver.verifyConnectivity(),
    catch: (e) =>
      new Neo4jError({
        query: 'VERIFY_CONNECTIVITY',
        originalMessage: e instanceof Error ? e.message : String(e),
      }),
  });

const runQueryWithSession =
  (driver: neo4j.Driver) =>
  (query: string, params: Record<string, any> = {}) =>
    Effect.gen(function* () {
      const session = driver.session();
      try {
        const result = yield* Effect.tryPromise({
          try: () => session.run(query, params),
          catch: (e) =>
            new Neo4jError({
              query,
              originalMessage: e instanceof Error ? e.message : String(e),
            }),
        });
        return result.records.map((r) => r.toObject());
      } finally {
        yield* Effect.promise(() => session.close()).pipe(
          Effect.catchAll(() => Effect.void),
        );
      }
    }).pipe(Effect.withLogSpan(`runQuery:${query.slice(0, 50)}...`));

const createTransactionContext = (tx: Transaction) => ({
  run: <T = any>(query: string, params?: Record<string, any>) =>
    Effect.tryPromise({
      try: async () => {
        const result = await tx.run(query, params);
        return result.records.map((r) => r.toObject()) as T[];
      },
      catch: (e) =>
        new Neo4jError({
          query,
          originalMessage: e instanceof Error ? e.message : String(e),
        }),
    }),
});

const runInTransactionWithSession =
  (driver: neo4j.Driver) =>
  <A>(
    operations: (tx: {
      run: <T = any>(
        query: string,
        params?: Record<string, any>,
      ) => Effect.Effect<T[], Neo4jError>;
    }) => Effect.Effect<A, Neo4jError>,
  ) =>
    Effect.gen(function* () {
      const session = driver.session();
      const tx = session.beginTransaction();

      try {
        const txContext = createTransactionContext(tx);
        const result = yield* operations(txContext);

        yield* Effect.tryPromise({
          try: () => tx.commit(),
          catch: (e) =>
            new Neo4jError({
              query: 'TRANSACTION_COMMIT',
              originalMessage: e instanceof Error ? e.message : String(e),
            }),
        });

        return result;
      } catch (error) {
        yield* Effect.tryPromise({
          try: () => tx.rollback(),
          catch: (e) =>
            new Neo4jError({
              query: 'TRANSACTION_ROLLBACK',
              originalMessage: e instanceof Error ? e.message : String(e),
            }),
        }).pipe(Effect.catchAll(() => Effect.void));

        throw error;
      } finally {
        yield* Effect.promise(() => session.close()).pipe(
          Effect.catchAll(() => Effect.void),
        );
      }
    }).pipe(Effect.withLogSpan('runInTransaction'));

const runBatchWithSession =
  (driver: neo4j.Driver) =>
  <T = any>(
    queries: Array<{
      query: string;
      params?: Record<string, any>;
    }>,
  ) =>
    Effect.gen(function* () {
      const session = driver.session();
      try {
        const results = [];

        for (const { query, params } of queries) {
          const result = yield* Effect.tryPromise({
            try: () => session.run(query, params || {}),
            catch: (e) =>
              new Neo4jError({
                query,
                originalMessage: e instanceof Error ? e.message : String(e),
              }),
          });
          results.push(result.records.map((r) => r.toObject()));
        }

        return results as T[][];
      } finally {
        yield* Effect.promise(() => session.close()).pipe(
          Effect.catchAll(() => Effect.void),
        );
      }
    }).pipe(Effect.withLogSpan(`runBatch:${queries.length} queries`));

const withSessionScoped =
  (driver: neo4j.Driver) =>
  <A>(work: (session: Session) => Effect.Effect<A, Neo4jError>) =>
    Effect.gen(function* () {
      const session = driver.session();
      try {
        return yield* work(session);
      } finally {
        yield* Effect.promise(() => session.close()).pipe(
          Effect.catchAll(() => Effect.void),
        );
      }
    }).pipe(Effect.withLogSpan('withSession'));

// Main implementation using the helper functions
const make = (config: { uri: string; user: string; password: string }) =>
  Effect.gen(function* () {
    // Create and verify driver
    const driver = yield* Effect.acquireRelease(
      createDriver(config),
      closeDriver,
    );

    yield* verifyDriverConnectivity(driver);
    yield* Effect.logInfo(`Connected to Neo4j at ${config.uri}`);

    // Create service implementation with all methods
    return Neo4jService.of({
      runQuery: runQueryWithSession(driver),
      runInTransaction: runInTransactionWithSession(driver),
      runBatch: runBatchWithSession(driver),
      withSession: withSessionScoped(driver),
    });
  });

/**
 * Live layer that depends on ConfigService
 */
export const Neo4jServiceLive = Layer.scoped(
  Neo4jService,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    return yield* make({
      uri: config.neo4j.uri,
      user: config.neo4j.user,
      password: Redacted.value(config.neo4j.password),
    });
  }),
);

// Example usage patterns for Janus domain

/**
 * Example: Creating a new snippet version with proper relationships
 */
export const createSnippetVersion = (
  snippetId: string,
  content: string,
  commitMessage: string,
  previousVersionId?: string,
) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    return yield* neo4j.runInTransaction((tx) =>
      Effect.gen(function* () {
        // Create the new version
        const [newVersion] = yield* tx.run(
          `
          CREATE (sv:SnippetVersion {
            id: randomUUID(),
            content: $content,
            createdAt: datetime(),
            commit_message: $commitMessage
          })
          RETURN sv
          `,
          { content, commitMessage },
        );

        // Link to parent snippet
        yield* tx.run(
          `
          MATCH (s:Snippet {id: $snippetId})
          MATCH (sv:SnippetVersion {id: $versionId})
          CREATE (sv)-[:VERSION_OF]->(s)
          `,
          { snippetId, versionId: newVersion.sv.id },
        );

        // Link to previous version if exists
        if (previousVersionId) {
          yield* tx.run(
            `
            MATCH (current:SnippetVersion {id: $currentId})
            MATCH (previous:SnippetVersion {id: $previousId})
            CREATE (current)-[:PREVIOUS_VERSION]->(previous)
            `,
            { currentId: newVersion.sv.id, previousId: previousVersionId },
          );
        }

        return newVersion.sv;
      }),
    );
  });

/**
 * Example: Running a test suite with multiple parameter combinations
 */
export const runTestSuite = (
  compositionId: string,
  parameterSets: Array<Record<string, string>>,
  llmConfig: { provider: string; model: string },
) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    // Get composition details first
    const [composition] = yield* neo4j.runQuery(
      `
      MATCH (cv:CompositionVersion {id: $compositionId})
      MATCH (cv)-[:INCLUDES]->(sv:SnippetVersion)
      RETURN cv, collect(sv) as snippets
      `,
      { compositionId },
    );

    // Create test run and all data points in a transaction
    return yield* neo4j.runInTransaction((tx) =>
      Effect.gen(function* () {
        // Create test run
        const [testRun] = yield* tx.run(
          `
          CREATE (tr:TestRun {
            id: randomUUID(),
            name: $name,
            createdAt: datetime(),
            llm_provider: $provider,
            llm_model: $model,
            metadata: $metadata
          })
          RETURN tr
          `,
          {
            name: `Test suite for ${composition.cv.name}`,
            provider: llmConfig.provider,
            model: llmConfig.model,
            metadata: { parameterSetCount: parameterSets.length },
          },
        );

        // Create data points for each parameter set
        const dataPoints = [];
        for (const params of parameterSets) {
          const [dataPoint] = yield* tx.run(
            `
            CREATE (dp:DataPoint {
              id: randomUUID(),
              final_prompt_text: $prompt,
              response_text: $response,
              metrics: $metrics
            })
            RETURN dp
            `,
            {
              prompt: 'Generated prompt here...', // Would be generated from composition
              response: 'LLM response here...', // Would come from LLM call
              metrics: { tokens: 100, latency: 1.5 },
            },
          );

          // Link data point to test run and composition
          yield* tx.run(
            `
            MATCH (tr:TestRun {id: $testRunId})
            MATCH (dp:DataPoint {id: $dataPointId})
            MATCH (cv:CompositionVersion {id: $compositionId})
            CREATE (tr)-[:GENERATED]->(dp)
            CREATE (dp)-[:USING_COMPOSITION]->(cv)
            `,
            {
              testRunId: testRun.tr.id,
              dataPointId: dataPoint.dp.id,
              compositionId,
            },
          );

          dataPoints.push(dataPoint.dp);
        }

        return { testRun: testRun.tr, dataPoints };
      }),
    );
  });

/**
 * Example: Complex graph traversal for version history
 */
export const getSnippetVersionHistory = (snippetId: string) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    // This benefits from session reuse for the graph traversal
    return yield* neo4j.withSession((session) =>
      Effect.gen(function* () {
        // Get all versions with their relationships
        const result = yield* Effect.tryPromise({
          try: () =>
            session.run(
              `
              MATCH (s:Snippet {id: $snippetId})
              MATCH (s)<-[:VERSION_OF]-(sv:SnippetVersion)
              OPTIONAL MATCH (sv)-[:PREVIOUS_VERSION*]->(prev:SnippetVersion)
              WITH sv, collect(prev) as history
              RETURN sv, history
              ORDER BY sv.createdAt DESC
              `,
              { snippetId },
            ),
          catch: (e) =>
            new Neo4jError({
              query: 'GET_VERSION_HISTORY',
              originalMessage: String(e),
            }),
        });

        return result.records.map((r) => ({
          version: r.get('sv'),
          history: r.get('history'),
        }));
      }),
    );
  });
