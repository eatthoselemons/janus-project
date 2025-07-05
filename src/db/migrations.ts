import { Effect } from "effect"
import { Neo4jDriver, Neo4jError, runCypher } from "./neo4j"

export class MigrationError extends Error {
  readonly _tag = "MigrationError"
  constructor(message: string, readonly cause?: unknown) {
    super(message)
  }
}

export interface Migration {
  readonly id: string
  readonly description: string
  readonly up: () => Effect.Effect<void, Neo4jError | MigrationError, Neo4jDriver>
  readonly down?: () => Effect.Effect<void, Neo4jError | MigrationError, Neo4jDriver>
}

// Migration to create constraints and indexes
const migration_001_constraints: Migration = {
  id: "001",
  description: "Create constraints and indexes for domain entities",
  up: () =>
    Effect.gen(function* () {
      // Create constraints for unique IDs
      yield* runCypher(`CREATE CONSTRAINT snippet_id_unique IF NOT EXISTS FOR (s:Snippet) REQUIRE s.id IS UNIQUE`)
      yield* runCypher(`CREATE CONSTRAINT snippet_name_unique IF NOT EXISTS FOR (s:Snippet) REQUIRE s.name IS UNIQUE`)
      yield* runCypher(`CREATE CONSTRAINT snippet_version_id_unique IF NOT EXISTS FOR (sv:SnippetVersion) REQUIRE sv.id IS UNIQUE`)

      yield* runCypher(`CREATE CONSTRAINT composition_id_unique IF NOT EXISTS FOR (c:Composition) REQUIRE c.id IS UNIQUE`)
      yield* runCypher(`CREATE CONSTRAINT composition_name_unique IF NOT EXISTS FOR (c:Composition) REQUIRE c.name IS UNIQUE`)
      yield* runCypher(`CREATE CONSTRAINT composition_version_id_unique IF NOT EXISTS FOR (cv:CompositionVersion) REQUIRE cv.id IS UNIQUE`)

      yield* runCypher(`CREATE CONSTRAINT parameter_id_unique IF NOT EXISTS FOR (p:Parameter) REQUIRE p.id IS UNIQUE`)
      yield* runCypher(`CREATE CONSTRAINT parameter_name_unique IF NOT EXISTS FOR (p:Parameter) REQUIRE p.name IS UNIQUE`)
      yield* runCypher(`CREATE CONSTRAINT parameter_option_id_unique IF NOT EXISTS FOR (po:ParameterOption) REQUIRE po.id IS UNIQUE`)

      yield* runCypher(`CREATE CONSTRAINT test_run_id_unique IF NOT EXISTS FOR (tr:TestRun) REQUIRE tr.id IS UNIQUE`)
      yield* runCypher(`CREATE CONSTRAINT data_point_id_unique IF NOT EXISTS FOR (dp:DataPoint) REQUIRE dp.id IS UNIQUE`)

      yield* runCypher(`CREATE CONSTRAINT tag_id_unique IF NOT EXISTS FOR (t:Tag) REQUIRE t.id IS UNIQUE`)
      yield* runCypher(`CREATE CONSTRAINT tag_name_unique IF NOT EXISTS FOR (t:Tag) REQUIRE t.name IS UNIQUE`)

      // Create indexes for performance
      yield* runCypher(`CREATE INDEX snippet_name_index IF NOT EXISTS FOR (s:Snippet) ON (s.name)`)
      yield* runCypher(`CREATE INDEX composition_name_index IF NOT EXISTS FOR (c:Composition) ON (c.name)`)
      yield* runCypher(`CREATE INDEX parameter_name_index IF NOT EXISTS FOR (p:Parameter) ON (p.name)`)
      yield* runCypher(`CREATE INDEX tag_name_index IF NOT EXISTS FOR (t:Tag) ON (t.name)`)

      // Create indexes for temporal queries
      yield* runCypher(`CREATE INDEX snippet_version_created_at_index IF NOT EXISTS FOR (sv:SnippetVersion) ON (sv.createdAt)`)
      yield* runCypher(`CREATE INDEX composition_version_created_at_index IF NOT EXISTS FOR (cv:CompositionVersion) ON (cv.createdAt)`)
      yield* runCypher(`CREATE INDEX parameter_option_created_at_index IF NOT EXISTS FOR (po:ParameterOption) ON (po.createdAt)`)
      yield* runCypher(`CREATE INDEX test_run_created_at_index IF NOT EXISTS FOR (tr:TestRun) ON (tr.createdAt)`)

      // Create indexes for provider/model queries
      yield* runCypher(`CREATE INDEX test_run_provider_index IF NOT EXISTS FOR (tr:TestRun) ON (tr.llm_provider)`)
      yield* runCypher(`CREATE INDEX test_run_model_index IF NOT EXISTS FOR (tr:TestRun) ON (tr.llm_model)`)
    }).pipe(
      Effect.mapError((error) => new MigrationError("Failed to create constraints and indexes", error))
    ),

  down: () =>
    Effect.gen(function* () {
      // Drop constraints (in reverse order)
      yield* runCypher(`DROP CONSTRAINT tag_name_unique IF EXISTS`)
      yield* runCypher(`DROP CONSTRAINT tag_id_unique IF EXISTS`)
      yield* runCypher(`DROP CONSTRAINT data_point_id_unique IF EXISTS`)
      yield* runCypher(`DROP CONSTRAINT test_run_id_unique IF EXISTS`)
      yield* runCypher(`DROP CONSTRAINT parameter_option_id_unique IF EXISTS`)
      yield* runCypher(`DROP CONSTRAINT parameter_name_unique IF EXISTS`)
      yield* runCypher(`DROP CONSTRAINT parameter_id_unique IF EXISTS`)
      yield* runCypher(`DROP CONSTRAINT composition_version_id_unique IF EXISTS`)
      yield* runCypher(`DROP CONSTRAINT composition_name_unique IF EXISTS`)
      yield* runCypher(`DROP CONSTRAINT composition_id_unique IF EXISTS`)
      yield* runCypher(`DROP CONSTRAINT snippet_version_id_unique IF EXISTS`)
      yield* runCypher(`DROP CONSTRAINT snippet_name_unique IF EXISTS`)
      yield* runCypher(`DROP CONSTRAINT snippet_id_unique IF EXISTS`)

      // Drop indexes
      yield* runCypher(`DROP INDEX test_run_model_index IF EXISTS`)
      yield* runCypher(`DROP INDEX test_run_provider_index IF EXISTS`)
      yield* runCypher(`DROP INDEX test_run_created_at_index IF EXISTS`)
      yield* runCypher(`DROP INDEX parameter_option_created_at_index IF EXISTS`)
      yield* runCypher(`DROP INDEX composition_version_created_at_index IF EXISTS`)
      yield* runCypher(`DROP INDEX snippet_version_created_at_index IF EXISTS`)
      yield* runCypher(`DROP INDEX tag_name_index IF EXISTS`)
      yield* runCypher(`DROP INDEX parameter_name_index IF EXISTS`)
      yield* runCypher(`DROP INDEX composition_name_index IF EXISTS`)
      yield* runCypher(`DROP INDEX snippet_name_index IF EXISTS`)
    })
}

export const migrations: readonly Migration[] = [
  migration_001_constraints
]

export const runMigrations = (): Effect.Effect<void, MigrationError | Neo4jError, Neo4jDriver> =>
  Effect.gen(function* () {
    console.log("Running database migrations...")
    
    for (const migration of migrations) {
      console.log(`Running migration ${migration.id}: ${migration.description}`)
      yield* migration.up()
      console.log(`Migration ${migration.id} completed successfully`)
    }
    
    console.log("All migrations completed successfully")
  })

export const rollbackMigrations = (): Effect.Effect<void, MigrationError | Neo4jError, Neo4jDriver> =>
  Effect.gen(function* () {
    console.log("Rolling back database migrations...")
    
    // Run rollbacks in reverse order
    for (const migration of migrations.slice().reverse()) {
      if (migration.down) {
        console.log(`Rolling back migration ${migration.id}: ${migration.description}`)
        yield* migration.down()
        console.log(`Migration ${migration.id} rolled back successfully`)
      } else {
        console.log(`Migration ${migration.id} has no rollback - skipping`)
      }
    }
    
    console.log("All migrations rolled back successfully")
  })