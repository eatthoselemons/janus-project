import { Effect } from "effect"

export class ConfigError extends Error {
  readonly _tag = "ConfigError"
  constructor(message: string) {
    super(message)
  }
}

export interface Neo4jConfigData {
  readonly uri: string
  readonly username: string
  readonly password: string
  readonly database?: string
}

export interface AppConfig {
  readonly neo4j: Neo4jConfigData
}

export const loadConfig = (): Effect.Effect<AppConfig, ConfigError> =>
  Effect.gen(function* () {
    const neo4jUri = process.env.NEO4J_URI || "bolt://localhost:7687"
    const neo4jUsername = process.env.NEO4J_USERNAME || "neo4j"
    const neo4jPassword = process.env.NEO4J_PASSWORD || "password"
    const neo4jDatabase = process.env.NEO4J_DATABASE || "neo4j"

    return {
      neo4j: {
        uri: neo4jUri,
        username: neo4jUsername,
        password: neo4jPassword,
        database: neo4jDatabase
      }
    }
  })