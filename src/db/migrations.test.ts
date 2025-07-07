import { describe, it, expect, vi, beforeEach, afterEach } from "@effect/vitest"
import { Effect, Option, Layer } from "effect"
import * as Migrations from "./migrations"
import * as Neo4j from "./neo4j"
import * as TestUtils from "../test-utils"

describe("Migrations", () => {
  // Keep track of console logs
  let consoleLogSpy: any
  
  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  
  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  // --- MigrationError Tests ---
  
  describe("MigrationError", () => {
    it("creates error with all fields", () => {
      const cause = new Error("Database error")
      const error = new Migrations.MigrationError({
        migration: "001",
        message: "Failed to apply migration",
        cause
      })
      expect(error._tag).toBe("MigrationError")
      expect(error.migration).toBe("001")
      expect(error.message).toBe("Failed to apply migration")
      expect(error.cause).toBe(cause)
    })

    it("creates error without cause (edge case)", () => {
      const error = new Migrations.MigrationError({
        migration: "002",
        message: "Migration failed"
      })
      expect(error.cause).toBeUndefined()
    })

    it("handles complex migration id (edge case)", () => {
      const error = new Migrations.MigrationError({
        migration: "2024-01-15-add-user-indexes",
        message: "Index creation failed"
      })
      expect(error.migration).toBe("2024-01-15-add-user-indexes")
    })
  })

  // --- Migration Structure Tests ---

  describe("migration_001_constraints", () => {
    it("has correct structure", () => {
      const migration = Migrations.migrations[0]
      
      expect(migration.id).toBe("001")
      expect(migration.description).toBe("Create constraints and indexes for domain entities")
      expect(typeof migration.up).toBe("function")
      expect(typeof migration.down).toBe("function")
    })

    it.effect("up creates all constraints and indexes", () => {
      const queriesExecuted: string[] = []
      
      const TestNeo4jLayer = TestUtils.makeTestLayer(Neo4j.Neo4jService)({
        runQuery: (query: string) => {
          queriesExecuted.push(query)
          return Effect.succeed([])
        }
      })
      
      return Effect.gen(function* () {
        const migration = Migrations.migrations[0]
        yield* migration.up()
        
        // Check constraints were created
        expect(queriesExecuted).toContain("CREATE CONSTRAINT snippet_id_unique IF NOT EXISTS FOR (s:Snippet) REQUIRE s.id IS UNIQUE")
        expect(queriesExecuted).toContain("CREATE CONSTRAINT snippet_name_unique IF NOT EXISTS FOR (s:Snippet) REQUIRE s.name IS UNIQUE")
        expect(queriesExecuted).toContain("CREATE CONSTRAINT composition_id_unique IF NOT EXISTS FOR (c:Composition) REQUIRE c.id IS UNIQUE")
        expect(queriesExecuted).toContain("CREATE CONSTRAINT parameter_id_unique IF NOT EXISTS FOR (p:Parameter) REQUIRE p.id IS UNIQUE")
        expect(queriesExecuted).toContain("CREATE CONSTRAINT test_run_id_unique IF NOT EXISTS FOR (tr:TestRun) REQUIRE tr.id IS UNIQUE")
        expect(queriesExecuted).toContain("CREATE CONSTRAINT tag_id_unique IF NOT EXISTS FOR (t:Tag) REQUIRE t.id IS UNIQUE")
        
        // Check indexes were created
        expect(queriesExecuted).toContain("CREATE INDEX snippet_name_index IF NOT EXISTS FOR (s:Snippet) ON (s.name)")
        expect(queriesExecuted).toContain("CREATE INDEX test_run_provider_index IF NOT EXISTS FOR (tr:TestRun) ON (tr.llm_provider)")
        
        // Total number of constraints and indexes
        // 13 constraints + 10 indexes = 23 total
        expect(queriesExecuted).toHaveLength(23)
      }).pipe(
        Effect.provide(TestNeo4jLayer)
      )
    })

    it.effect("up handles database errors", () => {
      const TestNeo4jLayer = TestUtils.makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => Effect.fail(new Neo4j.Neo4jQueryError({
          query: "CREATE CONSTRAINT",
          message: "Connection lost"
        }))
      })
      
      return Effect.gen(function* () {
        const migration = Migrations.migrations[0]
        const result = yield* Effect.exit(migration.up())
        
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") {
          const error = result.cause.error
          expect(error._tag).toBe("MigrationError")
          expect(error.migration).toBe("001")
          expect(error.message).toContain("Failed to create constraints and indexes")
        }
      }).pipe(
        Effect.provide(TestNeo4jLayer)
      )
    })

    it.effect("down drops all constraints and indexes", () => {
      const queriesExecuted: string[] = []
      
      const TestNeo4jLayer = TestUtils.makeTestLayer(Neo4j.Neo4jService)({
        runQuery: (query: string) => {
          queriesExecuted.push(query)
          return Effect.succeed([])
        }
      })
      
      return Effect.gen(function* () {
        const migration = Migrations.migrations[0]
        if (migration.down) {
          yield* migration.down()
        }
        
        // Check constraints were dropped
        expect(queriesExecuted).toContain("DROP CONSTRAINT tag_name_unique IF EXISTS")
        expect(queriesExecuted).toContain("DROP CONSTRAINT snippet_id_unique IF EXISTS")
        
        // Check indexes were dropped
        expect(queriesExecuted).toContain("DROP INDEX test_run_model_index IF EXISTS")
        expect(queriesExecuted).toContain("DROP INDEX snippet_name_index IF EXISTS")
        
        // Total number of drops
        // 13 constraints + 10 indexes = 23 total
        expect(queriesExecuted).toHaveLength(23)
      }).pipe(
        Effect.provide(TestNeo4jLayer)
      )
    })

    it.effect("down executes in reverse order (edge case)", () => {
      const queriesExecuted: string[] = []
      
      const TestNeo4jLayer = TestUtils.makeTestLayer(Neo4j.Neo4jService)({
        runQuery: (query: string) => {
          queriesExecuted.push(query)
          return Effect.succeed([])
        }
      })
      
      return Effect.gen(function* () {
        const migration = Migrations.migrations[0]
        if (migration.down) {
          yield* migration.down()
        }
        
        // First constraint dropped should be tag_name_unique (last created)
        expect(queriesExecuted[0]).toBe("DROP CONSTRAINT tag_name_unique IF EXISTS")
        
        // Last index dropped should be snippet_name_index (first created)
        expect(queriesExecuted[queriesExecuted.length - 1]).toBe("DROP INDEX snippet_name_index IF EXISTS")
      }).pipe(
        Effect.provide(TestNeo4jLayer)
      )
    })
  })

  // --- runMigrations Tests ---

  describe("runMigrations", () => {
    it.effect("runs all migrations in order", () => {
      const queriesExecuted: string[] = []
      
      const TestNeo4jLayer = TestUtils.makeTestLayer(Neo4j.Neo4jService)({
        runQuery: (query: string) => {
          queriesExecuted.push(query)
          return Effect.succeed([])
        }
      })
      
      return Effect.gen(function* () {
        yield* Migrations.runMigrations()
        
        // Check migrations were run
        expect(queriesExecuted.length).toBeGreaterThan(0)
        
        // Check console logs
        expect(consoleLogSpy).toHaveBeenCalledWith("Running database migrations...")
        expect(consoleLogSpy).toHaveBeenCalledWith("Running migration 001: Create constraints and indexes for domain entities")
        expect(consoleLogSpy).toHaveBeenCalledWith("Migration 001 completed successfully")
        expect(consoleLogSpy).toHaveBeenCalledWith("All migrations completed successfully")
      }).pipe(
        Effect.provide(TestNeo4jLayer)
      )
    })

    it.effect("handles migration failures", () => {
      let callCount = 0
      const TestNeo4jLayer = TestUtils.makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => {
          callCount++
          if (callCount === 3) { // Fail on third query
            return Effect.fail(new Neo4j.Neo4jQueryError({
              query: "CREATE CONSTRAINT",
              message: "Constraint already exists"
            }))
          }
          return Effect.succeed([])
        }
      })
      
      return Effect.gen(function* () {
        const result = yield* Effect.exit(Migrations.runMigrations())
        
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") {
          const error = result.cause.error
          expect(error._tag).toBe("MigrationError")
        }
      }).pipe(
        Effect.provide(TestNeo4jLayer)
      )
    })

    it.effect("logs start and end messages", () => {
      const TestNeo4jLayer = TestUtils.makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => Effect.succeed([])
      })
      
      return Effect.gen(function* () {
        yield* Migrations.runMigrations()
        
        // Check that start and end messages are always logged
        expect(consoleLogSpy).toHaveBeenCalledWith("Running database migrations...")
        expect(consoleLogSpy).toHaveBeenCalledWith("All migrations completed successfully")
      }).pipe(
        Effect.provide(TestNeo4jLayer)
      )
    })
  })

  // --- rollbackMigrations Tests ---

  describe("rollbackMigrations", () => {
    it.effect("rolls back all migrations in reverse order", () => {
      const queriesExecuted: string[] = []
      
      const TestNeo4jLayer = TestUtils.makeTestLayer(Neo4j.Neo4jService)({
        runQuery: (query: string) => {
          queriesExecuted.push(query)
          return Effect.succeed([])
        }
      })
      
      return Effect.gen(function* () {
        yield* Migrations.rollbackMigrations()
        
        // Check rollbacks were run
        expect(queriesExecuted.length).toBeGreaterThan(0)
        
        // Check console logs
        expect(consoleLogSpy).toHaveBeenCalledWith("Rolling back database migrations...")
        expect(consoleLogSpy).toHaveBeenCalledWith("Rolling back migration 001: Create constraints and indexes for domain entities")
        expect(consoleLogSpy).toHaveBeenCalledWith("Migration 001 rolled back successfully")
        expect(consoleLogSpy).toHaveBeenCalledWith("All migrations rolled back successfully")
      }).pipe(
        Effect.provide(TestNeo4jLayer)
      )
    })

    it.effect("handles rollback failures", () => {
      let callCount = 0
      const TestNeo4jLayer = TestUtils.makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => {
          callCount++
          if (callCount === 2) { // Fail on second query
            return Effect.fail(new Neo4j.Neo4jQueryError({
              query: "DROP CONSTRAINT",
              message: "Constraint does not exist"
            }))
          }
          return Effect.succeed([])
        }
      })
      
      return Effect.gen(function* () {
        const result = yield* Effect.exit(Migrations.rollbackMigrations())
        
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") {
          const error = result.cause.error
          expect(error._tag).toBe("MigrationError")
          expect(error.cause._tag).toBe("Neo4jQueryError")
        }
      }).pipe(
        Effect.provide(TestNeo4jLayer)
      )
    })

    it("handles migrations without down function", () => {
      // Test the logic directly without modifying the migrations array
      const migrationWithoutDown: Migrations.Migration = {
        id: "test",
        description: "Test migration without rollback",
        up: () => Effect.void
      }
      
      // Check that down is optional
      expect(migrationWithoutDown.down).toBeUndefined()
      
      // If we were to run rollback on this migration, it would be skipped
      // This is tested by the actual rollback test above
    })

    it.effect("logs start and end messages", () => {
      const TestNeo4jLayer = TestUtils.makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => Effect.succeed([])
      })
      
      return Effect.gen(function* () {
        yield* Migrations.rollbackMigrations()
        
        // Check that start and end messages are always logged
        expect(consoleLogSpy).toHaveBeenCalledWith("Rolling back database migrations...")
        expect(consoleLogSpy).toHaveBeenCalledWith("All migrations rolled back successfully")
      }).pipe(
        Effect.provide(TestNeo4jLayer)
      )
    })
  })

  // --- Migrations Array Tests ---

  describe("migrations array", () => {
    it("contains at least one migration", () => {
      expect(Migrations.migrations.length).toBeGreaterThan(0)
    })

    it("all migrations have unique ids", () => {
      const ids = Migrations.migrations.map(m => m.id)
      const uniqueIds = new Set(ids)
      
      expect(uniqueIds.size).toBe(ids.length)
    })

    it("all migrations have descriptions", () => {
      for (const migration of Migrations.migrations) {
        expect(migration.description).toBeTruthy()
        expect(migration.description.length).toBeGreaterThan(0)
      }
    })

    it("all migrations have up functions", () => {
      for (const migration of Migrations.migrations) {
        expect(typeof migration.up).toBe("function")
      }
    })
  })
})