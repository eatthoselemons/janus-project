import { Effect, Queue, Pool, Duration, Ref, Scope } from 'effect';
import { Driver, Session } from 'neo4j-driver';
import { Neo4jError } from '../../src/domain/types/errors';

/**
 * Example: Different Session Management Patterns
 */

// ===========================================================================
// Pattern 1: Create Session Per Operation (What we're doing now)
// ===========================================================================
export const createSessionPerOperation = (driver: Driver) => ({
  runQuery: (query: string, params?: any) =>
    Effect.gen(function* () {
      // Create a new session for each query
      const session = driver.session();
      try {
        const result = yield* Effect.tryPromise({
          try: () => session.run(query, params),
          catch: (e) => new Neo4jError({ query, originalMessage: String(e) }),
        });
        return result.records.map((r) => r.toObject());
      } finally {
        yield* Effect.promise(() => session.close());
      }
    }),
});

// PROS: Simple, no session state issues
// CONS: Overhead of creating/closing sessions for each operation

// ===========================================================================
// Pattern 2: Session Reuse Within a Scope
// ===========================================================================
export const sessionReuseWithinScope = (driver: Driver) => ({
  withSession: <A>(work: (session: Session) => Effect.Effect<A, Neo4jError>) =>
    Effect.scoped(
      Effect.gen(function* () {
        const session = yield* Effect.acquireRelease(
          Effect.sync(() => driver.session()),
          (session) => Effect.promise(() => session.close()),
        );

        // Multiple operations can use the same session
        return yield* work(session);
      }),
    ),

  // Example: Batch operations with one session
  batchInsert: (users: Array<{ name: string; email: string }>) =>
    Effect.scoped(
      Effect.gen(function* () {
        const session = yield* Effect.acquireRelease(
          Effect.sync(() => driver.session()),
          (session) => Effect.promise(() => session.close()),
        );

        // All inserts use the same session
        const results = [];
        for (const user of users) {
          const result = yield* Effect.tryPromise({
            try: () =>
              session.run(
                'CREATE (u:User {name: $name, email: $email}) RETURN u',
                user,
              ),
            catch: (e) =>
              new Neo4jError({
                query: 'CREATE_USER',
                originalMessage: String(e),
              }),
          });
          results.push(result.records[0].toObject());
        }

        return results;
      }),
    ),
});

// PROS: Efficient for batch operations
// CONS: Session held open longer, need careful scope management

// ===========================================================================
// Pattern 3: Session Pool (Advanced - rarely needed with Neo4j)
// ===========================================================================
export const createSessionPool = (driver: Driver, poolSize: number = 10) =>
  Effect.gen(function* () {
    // Create a pool of pre-initialized sessions
    const pool = yield* Pool.make({
      acquire: Effect.gen(function* () {
        const session = driver.session();
        // Could warm up the session here if needed
        return session;
      }),
      size: poolSize,
    });

    return {
      runQueryWithPool: (query: string, params?: any) =>
        Pool.get(pool).pipe(
          Effect.flatMap((session) =>
            Effect.tryPromise({
              try: () => session.run(query, params),
              catch: (e) =>
                new Neo4jError({ query, originalMessage: String(e) }),
            }),
          ),
          Effect.map((result) => result.records.map((r) => r.toObject())),
        ),
    };
  });

// PROS: Reuses sessions, potentially lower latency
// CONS: Complex, sessions can become stale, Neo4j driver already pools connections

// ===========================================================================
// Pattern 4: Session per Request/Transaction Context
// ===========================================================================
export const sessionPerRequestContext = (driver: Driver) => {
  // Store session in fiber-local storage
  const SessionContext = Effect.Tag<Session>();

  return {
    // Provide a session for the entire request
    provideSessionForRequest: <R, E, A>(effect: Effect.Effect<A, E, R>) =>
      Effect.scoped(
        Effect.gen(function* () {
          const session = yield* Effect.acquireRelease(
            Effect.sync(() => driver.session()),
            (session) => Effect.promise(() => session.close()),
          );

          // All operations within this effect will use the same session
          return yield* Effect.provide(effect, SessionContext.of(session));
        }),
      ),

    // Use the session from context
    runQueryInContext: (query: string, params?: any) =>
      Effect.gen(function* () {
        const session = yield* SessionContext;
        const result = yield* Effect.tryPromise({
          try: () => session.run(query, params),
          catch: (e) => new Neo4jError({ query, originalMessage: String(e) }),
        });
        return result.records.map((r) => r.toObject());
      }),
  };
};

// PROS: Automatic session sharing within a request
// CONS: Implicit dependency on context

// ===========================================================================
// Pattern 5: Smart Session Management (Recommended for complex apps)
// ===========================================================================
export const smartSessionManagement = (driver: Driver) => {
  // Track session usage
  const sessionMetrics = {
    created: 0,
    active: 0,
    totalQueries: 0,
  };

  return {
    // Single query: create new session
    runQuery: (query: string, params?: any) =>
      Effect.gen(function* () {
        sessionMetrics.created++;
        sessionMetrics.active++;

        const session = driver.session();
        try {
          sessionMetrics.totalQueries++;
          const result = yield* Effect.tryPromise({
            try: () => session.run(query, params),
            catch: (e) => new Neo4jError({ query, originalMessage: String(e) }),
          });
          return result.records.map((r) => r.toObject());
        } finally {
          yield* Effect.promise(() => session.close());
          sessionMetrics.active--;
        }
      }),

    // Batch operations: reuse session
    runBatch: <A>(
      operations: Array<(session: Session) => Effect.Effect<A, Neo4jError>>,
    ) =>
      Effect.scoped(
        Effect.gen(function* () {
          sessionMetrics.created++;
          sessionMetrics.active++;

          const session = yield* Effect.acquireRelease(
            Effect.sync(() => driver.session()),
            (session) =>
              Effect.promise(() => session.close()).pipe(
                Effect.tap(() =>
                  Effect.sync(() => {
                    sessionMetrics.active--;
                  }),
                ),
              ),
          );

          const results = [];
          for (const op of operations) {
            sessionMetrics.totalQueries++;
            const result = yield* op(session);
            results.push(result);
          }

          return results;
        }),
      ),

    // Get metrics
    getMetrics: () => Effect.succeed(sessionMetrics),
  };
};

// ===========================================================================
// Real-world Example: API Request Handler
// ===========================================================================
export const apiRequestExample = (driver: Driver) => {
  const sessionManager = sessionPerRequestContext(driver);

  // Simulated API endpoint that needs multiple queries
  const handleUserRequest = (userId: string) =>
    sessionManager.provideSessionForRequest(
      Effect.gen(function* () {
        // All these queries use the same session automatically
        const user = yield* sessionManager.runQueryInContext(
          'MATCH (u:User {id: $id}) RETURN u',
          { id: userId },
        );

        const posts = yield* sessionManager.runQueryInContext(
          'MATCH (u:User {id: $id})-[:WROTE]->(p:Post) RETURN p',
          { id: userId },
        );

        const friends = yield* sessionManager.runQueryInContext(
          'MATCH (u:User {id: $id})-[:FRIEND]->(f:User) RETURN f',
          { id: userId },
        );

        return { user, posts, friends };
      }),
    );

  return { handleUserRequest };
};

// ===========================================================================
// Performance Comparison Example
// ===========================================================================
export const performanceComparison = (driver: Driver) =>
  Effect.gen(function* () {
    const queries = Array.from({ length: 100 }, (_, i) => ({
      query: 'MATCH (n) RETURN count(n) as count',
      params: {},
    }));

    // Approach 1: New session per query
    const approach1Start = Date.now();
    for (const { query, params } of queries) {
      const session = driver.session();
      try {
        yield* Effect.tryPromise({
          try: () => session.run(query, params),
          catch: () => new Neo4jError({ query, originalMessage: 'Failed' }),
        });
      } finally {
        yield* Effect.promise(() => session.close());
      }
    }
    const approach1Time = Date.now() - approach1Start;

    // Approach 2: Reuse session
    const approach2Start = Date.now();
    const session = driver.session();
    try {
      for (const { query, params } of queries) {
        yield* Effect.tryPromise({
          try: () => session.run(query, params),
          catch: () => new Neo4jError({ query, originalMessage: 'Failed' }),
        });
      }
    } finally {
      yield* Effect.promise(() => session.close());
    }
    const approach2Time = Date.now() - approach2Start;

    return {
      newSessionPerQuery: `${approach1Time}ms`,
      reuseSession: `${approach2Time}ms`,
      improvement: `${Math.round((1 - approach2Time / approach1Time) * 100)}% faster`,
    };
  });
