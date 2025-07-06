/**
 * Neo4j database service following Effect.Service pattern.
 * Provides proper resource management, dependency injection, and error handling.
 */

import { Effect, Layer, Schema, Scope } from "effect"
import neo4j, { Driver, Session } from "neo4j-driver"
import { Neo4jConfig, loadNeo4jConfig } from "../config"

// --- Tagged Errors ---

export class Neo4jConnectionError extends Schema.TaggedError<Neo4jConnectionError>()(
  "Neo4jConnectionError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}

export class Neo4jQueryError extends Schema.TaggedError<Neo4jQueryError>()(
  "Neo4jQueryError", 
  {
    query: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}

export class Neo4jSessionError extends Schema.TaggedError<Neo4jSessionError>()(
  "Neo4jSessionError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}

// --- Service Interface ---

export interface Neo4jDriver {
  readonly createSession: () => Effect.Effect<Session, Neo4jSessionError, Scope.Scope>
  readonly runQuery: <T = any>(
    query: string,
    params?: Record<string, any>
  ) => Effect.Effect<T[], Neo4jQueryError>
  readonly runTransaction: <T>(
    fn: (session: Session) => Effect.Effect<T, never>
  ) => Effect.Effect<T, Neo4jQueryError | Neo4jSessionError>
  readonly close: () => Effect.Effect<void, never>
}

// --- Service Implementation ---

export class Neo4jService extends Effect.Service<Neo4jService>()("Neo4jService", {
  effect: Effect.gen(function*() {
    const config = yield* loadNeo4jConfig()
    
    // Create driver with proper error handling
    const driver = yield* Effect.tryPromise({
      try: () => Promise.resolve(neo4j.driver(
        config.neo4j.uri,
        neo4j.auth.basic(config.neo4j.username, config.neo4j.password)
      )),
      catch: (cause) => new Neo4jConnectionError({
        message: "Failed to create Neo4j driver",
        cause
      })
    })

    // Verify connectivity
    yield* Effect.tryPromise({
      try: () => driver.verifyConnectivity(),
      catch: (cause) => new Neo4jConnectionError({
        message: "Failed to verify Neo4j connectivity", 
        cause
      })
    }).pipe(
      Effect.withSpan("Neo4jService.verifyConnectivity")
    )

    // Add finalizer to close driver when scope closes
    yield* Effect.addFinalizer(() =>
      Effect.tryPromise({
        try: () => driver.close(),
        catch: () => void 0 // Ignore close errors
      }).pipe(
        Effect.withSpan("Neo4jService.close")
      )
    )

    const createSession = (): Effect.Effect<Session, Neo4jSessionError, Scope.Scope> =>
      Effect.acquireRelease(
        Effect.try({
          try: () => driver.session({
            database: config.neo4j.database,
            defaultAccessMode: neo4j.session.WRITE
          }),
          catch: (cause) => new Neo4jSessionError({
            message: "Failed to create Neo4j session",
            cause
          })
        }),
        (session) => Effect.try({
          try: () => session.close(),
          catch: () => void 0 // Ignore close errors
        })
      ).pipe(
        Effect.withSpan("Neo4jService.createSession")
      )

    const runQuery = <T = any>(
      query: string,
      params: Record<string, any> = {}
    ): Effect.Effect<T[], Neo4jQueryError> =>
      Effect.scoped(
        Effect.gen(function*() {
          const session = yield* createSession()
          
          const result = yield* Effect.tryPromise({
            try: () => session.run(query, params),
            catch: (cause) => new Neo4jQueryError({
              query,
              message: "Failed to execute Neo4j query",
              cause
            })
          })

          return result.records.map(record => record.toObject() as T)
        })
      ).pipe(
        Effect.withSpan("Neo4jService.runQuery", {
          attributes: { query, paramCount: Object.keys(params).length }
        })
      )

    const runTransaction = <T>(
      fn: (session: Session) => Effect.Effect<T, never>
    ): Effect.Effect<T, Neo4jQueryError | Neo4jSessionError> =>
      Effect.scoped(
        Effect.gen(function*() {
          const session = yield* createSession()
          
          return yield* Effect.tryPromise({
            try: async () => {
              const tx = session.beginTransaction()
              try {
                const result = await Effect.runPromise(fn(session))
                await tx.commit()
                return result
              } catch (error) {
                await tx.rollback()
                throw error
              }
            },
            catch: (cause) => new Neo4jQueryError({
              query: "transaction",
              message: "Failed to execute Neo4j transaction",
              cause
            })
          })
        })
      ).pipe(
        Effect.withSpan("Neo4jService.runTransaction")
      )

    const close = (): Effect.Effect<void, never> =>
      Effect.try({
        try: () => driver.close(),
        catch: () => void 0 // Ignore close errors
      }).pipe(
        Effect.withSpan("Neo4jService.close")
      )

    return {
      createSession,
      runQuery,
      runTransaction,
      close
    } as const
  }),
  dependencies: []
}) {
  /**
   * Test layer for mocking Neo4j service in tests.
   */
  static Test = Layer.succeed(this, {
    createSession: () => Effect.dieMessage("Neo4jService.createSession not implemented in test"),
    runQuery: () => Effect.succeed([]),
    runTransaction: () => Effect.dieMessage("Neo4jService.runTransaction not implemented in test"),
    close: () => Effect.void
  })
}

// --- Convenience Functions ---

/**
 * Execute a single query with parameters.
 */
export const executeQuery = <T = any>(
  query: string,
  params: Record<string, any> = {}
): Effect.Effect<T[], Neo4jQueryError, Neo4jService> =>
  Effect.gen(function*() {
    const neo4j = yield* Neo4jService
    return yield* neo4j.runQuery<T>(query, params)
  })

/**
 * Execute multiple queries in a transaction.
 */
export const executeTransaction = <T>(
  fn: (session: Session) => Effect.Effect<T, never>
): Effect.Effect<T, Neo4jQueryError | Neo4jSessionError, Neo4jService> =>
  Effect.gen(function*() {
    const neo4j = yield* Neo4jService
    return yield* neo4j.runTransaction(fn)
  })

/**
 * Health check for Neo4j connectivity.
 */
export const healthCheck = (): Effect.Effect<boolean, Neo4jQueryError, Neo4jService> =>
  executeQuery("RETURN 1 as health").pipe(
    Effect.map((result) => result.length > 0 && result[0].health === 1),
    Effect.catchAll(() => Effect.succeed(false)),
    Effect.withSpan("Neo4jService.healthCheck")
  )