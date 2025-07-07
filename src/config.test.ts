import { describe, it, expect, beforeEach, afterEach } from "@effect/vitest"
import { Effect, Config as EffectConfig, ConfigProvider, Layer } from "effect"
import * as Config from "./config"

describe("Config", () => {
  // --- Configuration Error Tests ---
  
  describe("ConfigValidationError", () => {
    it("creates error with all fields", () => {
      const error = new Config.ConfigValidationError({
        field: "port",
        message: "Invalid port number"
      })
      expect(error._tag).toBe("ConfigValidationError")
      expect(error.field).toBe("port")
      expect(error.message).toBe("Invalid port number")
    })

    it("handles nested field names (edge case)", () => {
      const error = new Config.ConfigValidationError({
        field: "neo4j.uri",
        message: "Invalid URI format"
      })
      expect(error.field).toBe("neo4j.uri")
    })

    it("handles empty field name (edge case)", () => {
      const error = new Config.ConfigValidationError({
        field: "",
        message: "Configuration error"
      })
      expect(error.field).toBe("")
    })
  })

  // --- Configuration Loading Tests ---

  describe("loadConfig", () => {
    it.effect("loads configuration with environment variables", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["NEO4J_URI", "bolt://db.example.com:7687"],
        ["NEO4J_USERNAME", "testuser"],
        ["NEO4J_PASSWORD", "testpass"],
        ["NEO4J_DATABASE", "testdb"],
        ["LOG_LEVEL", "debug"],
        ["PORT", "8080"]
      ]))

      return Effect.gen(function* () {
        const config = yield* Config.loadConfig().pipe(
          Effect.withConfigProvider(provider)
        )
        
        expect(config.neo4j.uri).toBe("bolt://db.example.com:7687")
        expect(config.neo4j.username).toBe("testuser")
        expect(config.neo4j.password).toBe("testpass")
        expect(config.neo4j.database).toBe("testdb")
        expect(config.logLevel).toBe("debug")
        expect(config.port).toBe(8080)
      })
    })

    it.effect("uses default values when environment variables not set", () => {
      const provider = ConfigProvider.fromMap(new Map())

      return Effect.gen(function* () {
        const config = yield* Config.loadConfig().pipe(
          Effect.withConfigProvider(provider)
        )
        
        expect(config.neo4j.uri).toBe("bolt://localhost:7687")
        expect(config.neo4j.username).toBe("neo4j")
        expect(config.neo4j.password).toBe("password")
        expect(config.neo4j.database).toBe("neo4j")
        expect(config.logLevel).toBe("info")
        expect(config.port).toBe(3000)
      })
    })

    it.effect("validates log level", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["LOG_LEVEL", "invalid"]
      ]))

      return Effect.gen(function* () {
        const result = yield* Effect.exit(
          Config.loadConfig().pipe(
            Effect.withConfigProvider(provider)
          )
        )
        
        expect(result._tag).toBe("Failure")
      })
    })

    it.effect("validates port range", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["PORT", "70000"] // > 65535
      ]))

      return Effect.gen(function* () {
        const result = yield* Effect.exit(
          Config.loadConfig().pipe(
            Effect.withConfigProvider(provider)
          )
        )
        
        expect(result._tag).toBe("Failure")
      })
    })

    it.effect("handles negative port (edge case)", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["PORT", "-1"]
      ]))

      return Effect.gen(function* () {
        const result = yield* Effect.exit(
          Config.loadConfig().pipe(
            Effect.withConfigProvider(provider)
          )
        )
        
        expect(result._tag).toBe("Failure")
      })
    })

    it.effect("handles non-integer port (edge case)", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["PORT", "abc"]
      ]))

      return Effect.gen(function* () {
        const result = yield* Effect.exit(
          Config.loadConfig().pipe(
            Effect.withConfigProvider(provider)
          )
        )
        
        expect(result._tag).toBe("Failure")
      })
    })

    it.effect("handles port at boundary values (edge case)", () => {
      const provider1 = ConfigProvider.fromMap(new Map([
        ["PORT", "1"] // minimum valid
      ]))

      const provider65535 = ConfigProvider.fromMap(new Map([
        ["PORT", "65535"] // maximum valid
      ]))

      return Effect.gen(function* () {
        const config1 = yield* Config.loadConfig().pipe(
          Effect.withConfigProvider(provider1)
        )
        expect(config1.port).toBe(1)

        const config65535 = yield* Config.loadConfig().pipe(
          Effect.withConfigProvider(provider65535)
        )
        expect(config65535.port).toBe(65535)
      })
    })
  })

  describe("loadNeo4jConfig", () => {
    it.effect("loads only Neo4j configuration", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["NEO4J_URI", "bolt://neo4j.test:7687"],
        ["NEO4J_USERNAME", "neo4juser"],
        ["NEO4J_PASSWORD", "neo4jpass"],
        ["NEO4J_DATABASE", "graphdb"]
      ]))

      return Effect.gen(function* () {
        const config = yield* Config.loadNeo4jConfig().pipe(
          Effect.withConfigProvider(provider)
        )
        
        expect(config.neo4j.uri).toBe("bolt://neo4j.test:7687")
        expect(config.neo4j.username).toBe("neo4juser")
        expect(config.neo4j.password).toBe("neo4jpass")
        expect(config.neo4j.database).toBe("graphdb")
      })
    })

    it.effect("uses Neo4j defaults", () => {
      const provider = ConfigProvider.fromMap(new Map())

      return Effect.gen(function* () {
        const config = yield* Config.loadNeo4jConfig().pipe(
          Effect.withConfigProvider(provider)
        )
        
        expect(config.neo4j.uri).toBe("bolt://localhost:7687")
        expect(config.neo4j.username).toBe("neo4j")
        expect(config.neo4j.password).toBe("password")
        expect(config.neo4j.database).toBe("neo4j")
      })
    })

    it.effect("handles partial Neo4j config (edge case)", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["NEO4J_URI", "bolt://custom:7687"],
        // Other values use defaults
      ]))

      return Effect.gen(function* () {
        const config = yield* Config.loadNeo4jConfig().pipe(
          Effect.withConfigProvider(provider)
        )
        
        expect(config.neo4j.uri).toBe("bolt://custom:7687")
        expect(config.neo4j.username).toBe("neo4j") // default
        expect(config.neo4j.password).toBe("password") // default
        expect(config.neo4j.database).toBe("neo4j") // default
      })
    })
  })

  // --- Individual Configuration Value Tests ---

  describe("Individual getters", () => {
    it.effect("getLogLevel returns log level", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["LOG_LEVEL", "warn"]
      ]))

      return Effect.gen(function* () {
        const logLevel = yield* Config.getLogLevel().pipe(
          Effect.withConfigProvider(provider)
        )
        
        expect(logLevel).toBe("warn")
      })
    })

    it.effect("getPort returns port", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["PORT", "4000"]
      ]))

      return Effect.gen(function* () {
        const port = yield* Config.getPort().pipe(
          Effect.withConfigProvider(provider)
        )
        
        expect(port).toBe(4000)
      })
    })

    it.effect("getNeo4jUri returns URI", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["NEO4J_URI", "bolt://example.com:7687"]
      ]))

      return Effect.gen(function* () {
        const uri = yield* Config.getNeo4jUri().pipe(
          Effect.withConfigProvider(provider)
        )
        
        expect(uri).toBe("bolt://example.com:7687")
      })
    })

    it.effect("getNeo4jUsername returns username", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["NEO4J_USERNAME", "dbuser"]
      ]))

      return Effect.gen(function* () {
        const username = yield* Config.getNeo4jUsername().pipe(
          Effect.withConfigProvider(provider)
        )
        
        expect(username).toBe("dbuser")
      })
    })

    it.effect("getNeo4jPassword returns password", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["NEO4J_PASSWORD", "secret123"]
      ]))

      return Effect.gen(function* () {
        const password = yield* Config.getNeo4jPassword().pipe(
          Effect.withConfigProvider(provider)
        )
        
        expect(password).toBe("secret123")
      })
    })

    it.effect("getNeo4jDatabase returns database", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["NEO4J_DATABASE", "mydb"]
      ]))

      return Effect.gen(function* () {
        const database = yield* Config.getNeo4jDatabase().pipe(
          Effect.withConfigProvider(provider)
        )
        
        expect(database).toBe("mydb")
      })
    })
  })

  // --- Development Utilities Tests ---

  describe("testConfig", () => {
    it.effect("provides test configuration", () => {
      return Effect.gen(function* () {
        const config = yield* Config.testConfig
        
        expect(config.neo4j.uri).toBe("bolt://localhost:7687")
        expect(config.neo4j.username).toBe("neo4j")
        expect(config.neo4j.password).toBe("test")
        expect(config.neo4j.database).toBe("test")
        expect(config.logLevel).toBe("debug")
        expect(config.port).toBe(0) // Random port for tests
      })
    })

    it.effect("test config ignores environment variables", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["NEO4J_URI", "bolt://production:7687"],
        ["PORT", "5000"]
      ]))

      return Effect.gen(function* () {
        const config = yield* Config.testConfig.pipe(
          Effect.withConfigProvider(provider)
        )
        
        // Should still use test values, not env vars
        expect(config.neo4j.uri).toBe("bolt://localhost:7687")
        expect(config.port).toBe(0)
      })
    })

    it.effect("test config always succeeds (edge case)", () => {
      // Even with invalid provider, test config should work
      const provider = ConfigProvider.fromMap(new Map([
        ["LOG_LEVEL", "INVALID_LEVEL"]
      ]))

      return Effect.gen(function* () {
        const config = yield* Config.testConfig.pipe(
          Effect.withConfigProvider(provider)
        )
        
        expect(config.logLevel).toBe("debug")
      })
    })
  })

  describe("devConfig", () => {
    it.effect("provides development configuration", () => {
      return Effect.gen(function* () {
        const config = yield* Config.devConfig
        
        expect(config.neo4j.uri).toBe("bolt://localhost:7687")
        expect(config.neo4j.username).toBe("neo4j")
        expect(config.neo4j.password).toBe("password")
        expect(config.neo4j.database).toBe("neo4j")
        expect(config.logLevel).toBe("debug")
        expect(config.port).toBe(3000)
      })
    })

    it.effect("dev config differs from test config", () => {
      return Effect.gen(function* () {
        const devConf = yield* Config.devConfig
        const testConf = yield* Config.testConfig
        
        // Different passwords
        expect(devConf.neo4j.password).toBe("password")
        expect(testConf.neo4j.password).toBe("test")
        
        // Different databases
        expect(devConf.neo4j.database).toBe("neo4j")
        expect(testConf.neo4j.database).toBe("test")
        
        // Different ports
        expect(devConf.port).toBe(3000)
        expect(testConf.port).toBe(0)
      })
    })

    it.effect("dev config is immutable (edge case)", () => {
      return Effect.gen(function* () {
        const config1 = yield* Config.devConfig
        const config2 = yield* Config.devConfig
        
        // Should be the same values
        expect(config1).toEqual(config2)
      })
    })
  })

  // --- Log Level Validation Tests ---

  describe("Log level validation", () => {
    it.effect("accepts valid log levels", () => {
      const validLevels = ["debug", "info", "warn", "error"]
      
      return Effect.gen(function* () {
        for (const level of validLevels) {
          const provider = ConfigProvider.fromMap(new Map([
            ["LOG_LEVEL", level]
          ]))
          
          const config = yield* Config.loadConfig().pipe(
            Effect.withConfigProvider(provider)
          )
          
          expect(config.logLevel).toBe(level)
        }
      })
    })

    it.effect("rejects invalid log levels", () => {
      const invalidLevels = ["trace", "DEBUG", "Info", "warning", "fatal", ""]
      
      return Effect.gen(function* () {
        for (const level of invalidLevels) {
          const provider = ConfigProvider.fromMap(new Map([
            ["LOG_LEVEL", level]
          ]))
          
          const result = yield* Effect.exit(
            Config.loadConfig().pipe(
              Effect.withConfigProvider(provider)
            )
          )
          
          expect(result._tag).toBe("Failure")
        }
      })
    })

    it.effect("log level is case-sensitive (edge case)", () => {
      const provider = ConfigProvider.fromMap(new Map([
        ["LOG_LEVEL", "INFO"] // uppercase
      ]))

      return Effect.gen(function* () {
        const result = yield* Effect.exit(
          Config.loadConfig().pipe(
            Effect.withConfigProvider(provider)
          )
        )
        
        expect(result._tag).toBe("Failure")
      })
    })
  })
})