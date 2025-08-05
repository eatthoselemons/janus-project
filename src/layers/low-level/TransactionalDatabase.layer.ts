import { Config, Effect, Layer, Redacted } from 'effect';
import neo4j, {
  type Driver,
  type Session,
  type Transaction,
} from 'neo4j-driver';
import {
  TransactionalDatabaseService,
  type TransactionContext,
} from '../../services/low-level/TransactionalDatabase.service';
import { ConfigService } from '../../services/config';
import { Neo4jError } from '../../domain/types/errors';
import { makeTestLayerFor } from '../../lib/test-utils';
import { CypherQuery, QueryParameters } from '../../domain/types/database';

/**
 * TransactionalDatabase Layer
 * 
 * This layer provides low-level database operations for Neo4j.
 * It handles connection management, session lifecycle, and transaction control.
 * 
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
 * ⚠️ INTERNAL - DO NOT USE DIRECTLY
 * 
 * Creates a Neo4j driver instance with the provided configuration.
 * The driver manages the connection pool to the database.
 * 
 * @internal - This is internal to the layer implementation.
 * @private
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
 * ⚠️ INTERNAL - DO NOT USE DIRECTLY
 * 
 * Safely closes a Neo4j driver and its connection pool.
 * Handles errors gracefully to ensure cleanup always succeeds.
 * 
 * @internal - This is internal to the layer implementation.
 * @private
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
 * ⚠️ INTERNAL - DO NOT USE DIRECTLY
 * 
 * Creates a transaction context wrapper around a Neo4j transaction.
 * This provides a type-safe interface for running queries within a transaction.
 * 
 * @internal - This is internal to the layer implementation.
 * @private - Only used by runInTransactionWithDriver
 * @param tx - An open Neo4j transaction
 * @returns TransactionContext with a run method for executing queries
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
 * ⚠️ INTERNAL - DO NOT USE DIRECTLY
 * Use TransactionalDatabaseService.runInTransaction instead.
 * 
 * Executes multiple operations within a single database transaction.
 * 
 * @internal - This is wrapped by the service layer.
 * @private
 * 
 * Features:
 * - Automatically commits on success, rolls back on failure
 * - All operations share the same transaction context
 * - Session is automatically closed after completion
 */
const runInTransactionWithDriver =
  (driver: Driver) =>
  <A, E>(
    operations: (tx: TransactionContext) => Effect.Effect<A, E | Neo4jError>,
  ): Effect.Effect<A, E | Neo4jError> =>
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
 * ⚠️ INTERNAL - DO NOT USE DIRECTLY
 * Use TransactionalDatabaseService.runBatch instead.
 * 
 * Executes multiple queries in sequence within a single session.
 * 
 * @internal - This is wrapped by the service layer.
 * @private
 * 
 * Note: Unlike runInTransaction, these queries are NOT in a transaction.
 * Each query auto-commits independently.
 */
const runBatchWithDriver =
  (driver: Driver) =>
  <T = unknown>(
    queries: Array<{
      query: CypherQuery;
      params?: QueryParameters;
    }>,
  ): Effect.Effect<T[][], Neo4jError> =>
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

const withSessionScoped =
  (driver: Driver) =>
  <A, E>(
    work: (session: Session) => Effect.Effect<A, E | Neo4jError>,
  ): Effect.Effect<A, E | Neo4jError> =>
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
 * ⚠️ INTERNAL - DO NOT USE DIRECTLY
 * Use TransactionalDatabaseService.runQuery instead.
 * 
 * Executes a single query with automatic session management.
 * 
 * @internal - This is wrapped by the service layer.
 * @private
 * 
 * Features:
 * - Opens a session, runs the query, closes the session
 * - Query auto-commits (not in a transaction)
 */
const runQueryWithDriver =
  (driver: Driver) =>
  (query: CypherQuery, params: QueryParameters = {}) =>
    Effect.scoped(
      Effect.gen(function* () {
        const session = yield* Effect.acquireRelease(
          Effect.sync(() => driver.session()),
          (session) => closeSession(session),
        );

        const result = yield* Effect.tryPromise({
          try: () => session.run(query, params),
          catch: (e) =>
            new Neo4jError({
              query,
              originalMessage: e instanceof Error ? e.message : String(e),
            }),
        });

        return result.records.map((record) => record.toObject());
      }),
    ).pipe(Effect.withLogSpan('runQuery'));

// ===========================
// SERVICE IMPLEMENTATION
// ===========================

/**
 * ⚠️ INTERNAL - DO NOT USE DIRECTLY
 * Use Layer.provide(TransactionalDatabaseLive) instead.
 * 
 * Creates a TransactionalDatabaseService instance.
 * 
 * @internal - This factory is only for layer construction.
 * @private
 * 
 * This factory function:
 * 1. Creates and verifies the Neo4j driver connection
 * 2. Returns a service with all database operations
 * 3. Ensures proper cleanup when the service is disposed
 */
export const make = (config: { uri: string; user: string; password: string }) =>
  Effect.gen(function* () {
    const driver = yield* Effect.acquireRelease(
      createDriver(config),
      (driver) => closeDriver(driver),
    );

    yield* verifyConnectivity(driver);
    yield* Effect.logInfo(`Connected to Neo4j at ${config.uri}`);

    return TransactionalDatabaseService.of({
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
 * ✅ PUBLIC - USE THIS FOR PRODUCTION
 * 
 * Production layer that creates TransactionalDatabaseService from ConfigService.
 * 
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const db = yield* TransactionalDatabaseService;
 *   return yield* db.runQuery('MATCH (n) RETURN n');
 * });
 * 
 * // Provide the layer
 * program.pipe(Effect.provide(TransactionalDatabaseLive))
 * ```
 * 
 * @public
 */
export const TransactionalDatabaseLive = Layer.scoped(
  TransactionalDatabaseService,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    return yield* make({
      uri: config.neo4j.uri,
      user: config.neo4j.user,
      password: Redacted.value(config.neo4j.password),
    });
  }),
);

export const fromEnv = Layer.scoped(
  TransactionalDatabaseService,
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
 * ✅ PUBLIC - USE THIS FOR TESTING
 * 
 * Test layer that mocks database operations using in-memory data.
 * 
 * Features:
 * - Query results are looked up by exact query string match
 * - No actual database connection required
 * - Useful for unit testing
 * 
 * @example
 * ```typescript
 * const testLayer = Neo4jTest(new Map([
 *   ['MATCH (n:User) RETURN n', [{ n: { id: 1, name: 'Alice' } }]]
 * ]));
 * ```
 * 
 * @param mockData - Map of query strings to their mock results
 * @public
 */
export const Neo4jTest = (mockData: Map<string, unknown[]> = new Map()) =>
  Layer.succeed(
    TransactionalDatabaseService,
    TransactionalDatabaseService.of({
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

export const Neo4jTestPartial = (
  impl: Partial<TransactionalDatabaseService['Type']>,
) => {
  return makeTestLayerFor(TransactionalDatabaseService)(impl);
};
