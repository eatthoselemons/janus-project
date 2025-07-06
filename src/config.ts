/**
 * Application configuration using Effect Config system.
 * Following Effect best practices for configuration management.
 */

import { Config, Schema } from "effect"

// --- Configuration Errors ---

export class ConfigValidationError extends Schema.TaggedError<ConfigValidationError>()(
  "ConfigValidationError",
  {
    field: Schema.String,
    message: Schema.String
  }
) {}

// --- Configuration Types ---

export interface Neo4jConfig {
  readonly uri: string
  readonly username: string
  readonly password: string
  readonly database: string
}

export interface AppConfig {
  readonly neo4j: Neo4jConfig
  readonly logLevel: "debug" | "info" | "warn" | "error"
  readonly port: number
}

// --- Configuration Loading ---

const neo4jUri = Config.string("NEO4J_URI").pipe(
  Config.withDefault("bolt://localhost:7687")
)

const neo4jUsername = Config.string("NEO4J_USERNAME").pipe(
  Config.withDefault("neo4j")
)

const neo4jPassword = Config.string("NEO4J_PASSWORD").pipe(
  Config.withDefault("password")
)

const neo4jDatabase = Config.string("NEO4J_DATABASE").pipe(
  Config.withDefault("neo4j")
)

const logLevel = Config.string("LOG_LEVEL").pipe(
  Config.withDefault("info"),
  Config.validate({
    message: "LOG_LEVEL must be one of: debug, info, warn, error",
    validation: (value) => ["debug", "info", "warn", "error"].includes(value)
  })
) as Config.Config<"debug" | "info" | "warn" | "error">

const port = Config.integer("PORT").pipe(
  Config.withDefault(3000),
  Config.validate({
    message: "PORT must be a positive integer between 1 and 65535",
    validation: (port) => port > 0 && port < 65536
  })
)

// --- Main Configuration ---

export const loadConfig = () => Config.all({
  neo4j: Config.all({
    uri: neo4jUri,
    username: neo4jUsername,
    password: neo4jPassword,
    database: neo4jDatabase
  }),
  logLevel,
  port
})

export const loadNeo4jConfig = () => Config.all({
  neo4j: Config.all({
    uri: neo4jUri,
    username: neo4jUsername,
    password: neo4jPassword,
    database: neo4jDatabase
  })
})

// --- Individual Configuration Values ---

export const getLogLevel = () => logLevel

export const getPort = () => port

export const getNeo4jUri = () => neo4jUri

export const getNeo4jUsername = () => neo4jUsername

export const getNeo4jPassword = () => neo4jPassword

export const getNeo4jDatabase = () => neo4jDatabase

// --- Development Utilities ---

/**
 * Configuration for testing environments.
 */
export const testConfig = Config.all({
  neo4j: Config.all({
    uri: Config.succeed("bolt://localhost:7687"),
    username: Config.succeed("neo4j"),
    password: Config.succeed("test"),
    database: Config.succeed("test")
  }),
  logLevel: Config.succeed("debug" as const),
  port: Config.succeed(0) // Use random port for tests
})

/**
 * Minimal configuration for local development.
 */
export const devConfig = Config.all({
  neo4j: Config.all({
    uri: Config.succeed("bolt://localhost:7687"),
    username: Config.succeed("neo4j"),
    password: Config.succeed("password"),
    database: Config.succeed("neo4j")
  }),
  logLevel: Config.succeed("debug" as const),
  port: Config.succeed(3000)
})