import { Config, Effect, Layer, Redacted } from 'effect';
import neo4j, { type Driver, type Session } from 'neo4j-driver';
import { Neo4jService, type Neo4jImpl } from '../../services/neo4j';
import { ConfigService } from '../../services/config';
import { Neo4jError } from '../../domain/types/errors';
import { makeTestLayerFor } from '../../lib/test-utils';

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
 * Executes a function with a Neo4j session, ensuring proper cleanup
 */
const withSession = <T>(
  driver: Driver,
  fn: (session: Session) => T,
): Effect.Effect<Awaited<T>, Neo4jError, never> =>
  Effect.scoped(
    Effect.gen(function* () {
      const session = yield* Effect.acquireRelease(
        // Acquire: Create a session synchronously
        Effect.sync(() => driver.session()),
        // Release: Close the session
        (session) => closeSession(session),
      );

      // Use the session
      const result = yield* Effect.try({
        try: () => fn(session),
        catch: (e) =>
          new Neo4jError({
            query: 'SESSION_OPERATION',
            originalMessage: e instanceof Error ? e.message : String(e),
          }),
      });

      // Handle both sync and async results
      if (result instanceof Promise) {
        return yield* Effect.tryPromise({
          try: () => result,
          catch: (e) =>
            new Neo4jError({
              query: 'ASYNC_SESSION_OPERATION',
              originalMessage: e instanceof Error ? e.message : String(e),
            }),
        });
      }
      return result;
    }),
  );

/**
 * Runs a Cypher query and returns the results as plain objects
 */
const runQueryWithDriver =
  (driver: Driver) =>
  (query: string, params = {}) =>
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

    // Return the service implementation
    return Neo4jService.of({
      use: (fn) => withSession(driver, fn),
      runQuery: runQueryWithDriver(driver),
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
const createMockSession = (mockData: Map<string, any[]>): Session => {
  const mockSession = {
    run: (query: string, _params?: any) => {
      const mockRecords = (mockData.get(query) || []).map((obj) => ({
        toObject: () => obj,
        keys: Object.keys(obj),
        get: (key: string) => obj[key],
      }));

      // Create a minimal mock Result that satisfies the neo4j-driver interface
      const mockResult = {
        records: mockRecords,
        summary: {} as any,
        then: (onfulfilled?: any, onrejected?: any) =>
          Promise.resolve({ records: mockRecords, summary: {} }).then(
            onfulfilled,
            onrejected,
          ),
        catch: (onrejected: any) =>
          Promise.resolve({ records: mockRecords, summary: {} }).catch(
            onrejected,
          ),
        finally: (onfinally?: any) =>
          Promise.resolve({ records: mockRecords, summary: {} }).finally(
            onfinally,
          ),
        [Symbol.toStringTag]: 'Promise' as const,
        subscribe: () => ({ unsubscribe: () => {} }),
      } as any;

      return mockResult;
    },
    close: () => Promise.resolve(),
  } as Session;

  return mockSession;
};

/**
 * Test layer with in-memory mock implementation
 */
export const Neo4jTest = (mockData: Map<string, any[]> = new Map()) =>
  Layer.succeed(
    Neo4jService,
    Neo4jService.of({
      use: (fn) =>
        Effect.gen(function* () {
          const mockSession = createMockSession(mockData);

          const result = yield* Effect.try({
            try: () => fn(mockSession),
            catch: (e) =>
              new Neo4jError({
                query: 'TEST_SESSION_OPERATION',
                originalMessage: e instanceof Error ? e.message : String(e),
              }),
          });

          if (result instanceof Promise) {
            return yield* Effect.tryPromise({
              try: () => result,
              catch: (e) =>
                new Neo4jError({
                  query: 'TEST_ASYNC_OPERATION',
                  originalMessage: e instanceof Error ? e.message : String(e),
                }),
            });
          }
          return result;
        }),

      runQuery: (query, _params = {}) =>
        Effect.gen(function* () {
          const data = mockData.get(query) || [];
          yield* Effect.logDebug(`Mock query: ${query}`);
          return data;
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
