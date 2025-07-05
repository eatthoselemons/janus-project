import { Context, Effect, Layer } from "effect"
import neo4j, { Driver, Session } from "neo4j-driver"

export interface Neo4jConfig {
  readonly uri: string
  readonly username: string
  readonly password: string
  readonly database?: string
}

export class Neo4jConfig extends Context.Tag("Neo4jConfig")<
  Neo4jConfig,
  Neo4jConfig
>() {}

export interface Neo4jDriverService {
  readonly getSession: () => Effect.Effect<Session, Neo4jError>
  readonly close: () => Effect.Effect<void, Neo4jError>
}

export class Neo4jDriver extends Context.Tag("Neo4jDriver")<
  Neo4jDriver,
  Neo4jDriverService
>() {}

export class Neo4jError extends Error {
  readonly _tag = "Neo4jError"
  constructor(message: string, readonly cause?: unknown) {
    super(message)
  }
}

const createDriver = (config: Neo4jConfig): Effect.Effect<Driver, Neo4jError> =>
  Effect.try({
    try: () => neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password)),
    catch: (error) => new Neo4jError("Failed to create Neo4j driver", error)
  })

const Neo4jDriverLive = Layer.effect(
  Neo4jDriver,
  Effect.gen(function* () {
    const config = yield* Neo4jConfig
    const driver = yield* createDriver(config)

    const getSession = (): Effect.Effect<Session, Neo4jError> =>
      Effect.try({
        try: () => driver.session({ 
          database: config.database || "neo4j",
          defaultAccessMode: neo4j.session.WRITE
        }),
        catch: (error) => new Neo4jError("Failed to create Neo4j session", error)
      })

    const close = (): Effect.Effect<void, Neo4jError> =>
      Effect.tryPromise({
        try: () => driver.close(),
        catch: (error) => new Neo4jError("Failed to close Neo4j driver", error)
      })

    return { getSession, close }
  })
)

export const Neo4jDriverLayer = Neo4jDriverLive

// Internal session management helper - not exported
const withSession = <R, E, A>(
  fn: (session: Session) => Effect.Effect<A, E, R>
): Effect.Effect<A, E | Neo4jError, R | Neo4jDriver> =>
  Effect.gen(function* () {
    const neo4jDriver = yield* Neo4jDriver
    const session = yield* neo4jDriver.getSession()
    
    try {
      return yield* fn(session)
    } finally {
      yield* Effect.try({
        try: () => session.close(),
        catch: (error) => new Neo4jError("Failed to close Neo4j session", error)
      })
    }
  })

// Internal Cypher execution helper - not exported
export const runCypher = <T = any>(
  cypher: string,
  params?: Record<string, any>
): Effect.Effect<T[], Neo4jError, Neo4jDriver> =>
  withSession((session) =>
    Effect.tryPromise({
      try: async () => {
        const result = await session.run(cypher, params)
        return result.records.map(record => record.toObject() as T)
      },
      catch: (error) => new Neo4jError("Failed to execute Cypher query", error)
    })
  )