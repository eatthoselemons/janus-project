import { Config, Effect, Layer, Redacted } from 'effect';
import neo4j, {
  type Driver,
  type Session,
  type Transaction,
  type Result,
  type ResultSummary,
} from 'neo4j-driver';
import {
  Neo4jService,
  type Neo4jImpl,
  type TransactionContext,
} from '../../services/neo4j';
import { ConfigService } from '../../services/config';
import { Neo4jError } from '../../domain/types/errors';
import { makeTestLayerFor } from '../../lib/test-utils';
import {
  CypherQuery,
  QueryParameters,
  QueryParameterName,
} from '../../domain/types/database';

// ===========================
// DRIVER CONFIGURATION
// ===========================

const driverConfig = {
  maxConnectionPoolSize: 100,
  connectionAcquisitionTimeout: 60000,
  logging: {
    level: 'info' as const,
    logger: (level: string, message: string) => {
      if (level === 'error') {
        Effect.logError(message).pipe(Effect.runSync);
      } else {
        Effect.logInfo(message).pipe(Effect.runSync);
      }
    },
  },
};

// ===========================
// DRIVER LIFECYCLE
// ===========================

/**
 * Creates a Neo4j driver with proper error handling
 */
const createDriver = (config: {
  uri: string;
  user: string;
  password: string;
}) =>
  Effect.try({
    try: () =>
      neo4j.driver(
        config.uri,
        neo4j.auth.basic(config.user, config.password),
        driverConfig,
      ),
    catch: (e) =>
      new Neo4jError({
        query: 'DRIVER_INIT',
        originalMessage: e instanceof Error ? e.message : String(e),
      }),
  });

/**
 * Safely closes a Neo4j driver, logging warnings on failure
 */
const closeDriver = (driver: Driver) =>
  Effect.tryPromise({
    try: () => driver.close(),
    catch: (e) =>
      new Neo4jError({
        query: 'DRIVER_CLOSE',
        originalMessage: e instanceof Error ? e.message : String(e),
      }),
  }).pipe(
    Effect.catchAll(() =>
      Effect.sync(() => {
        Effect.logWarning('Failed to close Neo4j driver').pipe(Effect.runSync);
      }),
    ),
  );

/**
 * Verifies Neo4j connectivity
 */
const verifyConnectivity = (driver: Driver) =>
  Effect.tryPromise({
    try: () => driver.verifyConnectivity(),
    catch: (e) =>
      new Neo4jError({
        query: 'VERIFY_CONNECTIVITY',
        originalMessage: e instanceof Error ? e.message : String(e),
      }),
  });

// ===========================
// SESSION MANAGEMENT
// ===========================

/**
 * Safely closes a Neo4j session, logging warnings on failure
 */
const closeSession = (session: Session) =>
  Effect.tryPromise({
    try: () => session.close(),
    catch: (e) =>
      new Neo4jError({
        query: 'SESSION_CLOSE',
        originalMessage: e instanceof Error ? e.message : String(e),
      }),
  }).pipe(
    Effect.catchAll(() => Effect.logWarning('Failed to close Neo4j session')),
  );

/**
 * Creates a transaction context that wraps Neo4j transaction methods
 */
const createTransactionContext = (tx: Transaction): TransactionContext => ({
  run: <T = unknown>(query: CypherQuery, params?: QueryParameters) =>
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

/**
 * Executes multiple operations in a transaction with automatic commit/rollback
 */
const runInTransactionWithDriver =
  (driver: Driver) =>
  <A>(
    operations: (tx: TransactionContext) => Effect.Effect<A, Neo4jError, never>,
  ): Effect.Effect<A, Neo4jError, never> =>
    Effect.scoped(
      Effect.gen(function* () {
        const session = yield* Effect.acquireRelease(
          Effect.sync(() => driver.session()),
          (session) => closeSession(session),
        );

        const tx = session.beginTransaction();

        const result = yield* Effect.tryPromise({
          try: async () => {
            try {
              const txContext = createTransactionContext(tx);
              const res = await Effect.runPromise(operations(txContext));
              await tx.commit();
              return res;
            } catch (error) {
              await tx.rollback();
              throw error;
            }
          },
          catch: (e) =>
            new Neo4jError({
              query: 'TRANSACTION',
              originalMessage: e instanceof Error ? e.message : String(e),
            }),
        });

        return result;
      }),
    ).pipe(Effect.withLogSpan('runInTransaction'));

/**
 * Executes multiple queries efficiently with session reuse
 */
const runBatchWithDriver =
  (driver: Driver) =>
  <T = unknown>(
    queries: Array<{
      query: CypherQuery;
      params?: QueryParameters;
    }>,
  ): Effect.Effect<T[][], Neo4jError, never> =>
    Effect.scoped(
      Effect.gen(function* () {
        const session = yield* Effect.acquireRelease(
          Effect.sync(() => driver.session()),
          (session) => closeSession(session),
        );

        const results: T[][] = [];

        for (const { query, params } of queries) {
          const result = yield* Effect.tryPromise({
            try: () => session.run(query, params || {}),
            catch: (e) =>
              new Neo4jError({
                query,
                originalMessage: e instanceof Error ? e.message : String(e),
              }),
          });
          results.push(result.records.map((r) => r.toObject()) as T[]);
        }

        return results;
      }),
    ).pipe(Effect.withLogSpan(`runBatch:${queries.length} queries`));

/**
 * Provides full session control for complex operations
 */
const withSessionScoped =
  (driver: Driver) =>
  <A>(
    work: (session: Session) => Effect.Effect<A, Neo4jError, never>,
  ): Effect.Effect<A, Neo4jError, never> =>
    Effect.scoped(
      Effect.gen(function* () {
        const session = yield* Effect.acquireRelease(
          Effect.sync(() => driver.session()),
          (session) => closeSession(session),
        );

        return yield* work(session);
      }),
    ).pipe(Effect.withLogSpan('withSession'));

/**
 * Runs a Cypher query and returns the results as plain objects
 */
const runQueryWithDriver =
  (driver: Driver) =>
  (query: CypherQuery, params: QueryParameters = {}) =>
    Effect.scoped(
      Effect.gen(function* () {
        const session = yield* Effect.acquireRelease(
          // Acquire: Create a session
          Effect.sync(() => driver.session()),
          // Release: Close the session
          (session) => closeSession(session),
        );

        // Run the query
        const result = yield* Effect.tryPromise({
          try: () => session.run(query, params),
          catch: (e) =>
            new Neo4jError({
              query,
              originalMessage: e instanceof Error ? e.message : String(e),
            }),
        });

        // Convert Neo4j records to plain objects
        return result.records.map((record) => record.toObject());
      }),
    ).pipe(Effect.withLogSpan('runQuery'));

// ===========================
// SERVICE IMPLEMENTATION
// ===========================

/**
 * Creates a Neo4j service instance with the given configuration
 */
export const make = (config: { uri: string; user: string; password: string }) =>
  Effect.gen(function* () {
    // Create and manage driver lifecycle
    const driver = yield* Effect.acquireRelease(
      createDriver(config),
      (driver) => closeDriver(driver),
    );

    // Verify we can connect
    yield* verifyConnectivity(driver);
    yield* Effect.logInfo(`Connected to Neo4j at ${config.uri}`);

    // Return the service implementation with all methods
    return Neo4jService.of({
      runQuery: runQueryWithDriver(driver),
      runInTransaction: runInTransactionWithDriver(driver),
      runBatch: runBatchWithDriver(driver),
      withSession: withSessionScoped(driver),
    });
  });

// ===========================
// LAYER IMPLEMENTATIONS
// ===========================

/**
 * Production layer that creates Neo4j service from ConfigService
 */
export const Neo4jLive = Layer.scoped(
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

/**
 * Alternative layer that creates Neo4j service from environment variables
 * Useful when you want to bypass ConfigService
 */
export const fromEnv = Layer.scoped(
  Neo4jService,
  Effect.gen(function* () {
    const uri = yield* Config.string('NEO4J_URI');
    const user = yield* Config.string('NEO4J_USER');
    const password = yield* Config.redacted('NEO4J_PASSWORD');

    return yield* make({
      uri,
      user,
      password: Redacted.value(password),
    });
  }),
);

// ===========================
// TEST IMPLEMENTATIONS
// ===========================

/**
 * Creates a mock session for testing
 */
const createMockSession = (mockData: Map<string, unknown[]>): Session => {
  const mockSession = {
    run: (query: string, _params?: unknown) => {
      const mockRecords = (mockData.get(query) || []).map((obj) => ({
        toObject: () => obj,
        keys: typeof obj === 'object' && obj !== null ? Object.keys(obj) : [],
        get: (key: string) =>
          typeof obj === 'object' && obj !== null
            ? (obj as Record<string, unknown>)[key]
            : undefined,
      }));

      // Return a mock result compatible with neo4j-driver
      // We return just the structure that our code actually uses
      return Promise.resolve({
        records: mockRecords,
        summary: {},
      });
    },
    close: () => Promise.resolve(),
  } as unknown as Session;

  return mockSession;
};

/**
 * Test layer with in-memory mock implementation
 */
export const Neo4jTest = (mockData: Map<string, unknown[]> = new Map()) =>
  Layer.succeed(
    Neo4jService,
    Neo4jService.of({
      runQuery: <T = unknown>(
        query: CypherQuery,
        _params: QueryParameters = {},
      ) =>
        Effect.gen(function* () {
          const data = mockData.get(query) || [];
          yield* Effect.logDebug(`Mock query: ${query}`);
          return data as T[];
        }),

      runInTransaction: (operations) =>
        Effect.gen(function* () {
          // Simple mock transaction context
          const txContext: TransactionContext = {
            run: <T = unknown>(
              query: CypherQuery,
              _params: QueryParameters = {},
            ) =>
              Effect.gen(function* () {
                const data = mockData.get(query) || [];
                yield* Effect.logDebug(`Mock transaction query: ${query}`);
                return data as T[];
              }),
          };
          return yield* operations(txContext);
        }),

      runBatch: <T = unknown>(
        queries: Array<{ query: CypherQuery; params?: QueryParameters }>,
      ) =>
        Effect.gen(function* () {
          const results: T[][] = [];
          for (const { query } of queries) {
            const data = mockData.get(query) || [];
            yield* Effect.logDebug(`Mock batch query: ${query}`);
            results.push(data as T[]);
          }
          return results;
        }),

      withSession: (work) =>
        Effect.gen(function* () {
          const mockSession = createMockSession(mockData);
          return yield* work(mockSession);
        }),
    }),
  );

/**
 * Create a partial test layer using makeTestLayer pattern
 * This is useful for unit tests where you only need specific methods
 *
 * @example
 * ```ts
 * const layer = Neo4jTestPartial({
 *   runQuery: () => Effect.succeed([{ id: 1 }])
 * });
 * ```
 */
export const Neo4jTestPartial = (impl: Partial<Neo4jImpl>) => {
  return makeTestLayerFor(Neo4jService)(impl);
};
