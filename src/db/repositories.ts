import { Context, Effect, Layer } from "effect"
import { Neo4jDriver, Neo4jDriverLayer, Neo4jError, runCypher } from "./neo4j"
import {
  Snippet,
  SnippetId,
  SnippetVersion,
  SnippetVersionId,
  Composition,
  CompositionId,
  CompositionVersion,
  CompositionVersionId,
  Parameter,
  ParameterId,
  ParameterOption,
  ParameterOptionId,
  TestRun,
  TestRunId,
  DataPoint,
  DataPointId,
  Tag,
  TagId,
  Slug
} from "../core/domain"

export class RepositoryError extends Error {
  readonly _tag = "RepositoryError"
  constructor(message: string, readonly cause?: unknown) {
    super(message)
  }
}

// Snippet Repository Service Interface
export interface SnippetRepositoryService {
  readonly create: (snippet: Snippet) => Effect.Effect<void, RepositoryError>
  readonly findById: (id: SnippetId) => Effect.Effect<Snippet | null, RepositoryError>
  readonly findByName: (name: Slug) => Effect.Effect<Snippet | null, RepositoryError>
  readonly list: () => Effect.Effect<readonly Snippet[], RepositoryError>
  readonly addVersion: (
    snippetId: SnippetId,
    version: SnippetVersion,
    previousVersionId?: SnippetVersionId
  ) => Effect.Effect<void, RepositoryError>
  readonly getVersions: (snippetId: SnippetId) => Effect.Effect<readonly SnippetVersion[], RepositoryError>
  readonly getLatestVersion: (snippetId: SnippetId) => Effect.Effect<SnippetVersion | null, RepositoryError>
}

export class SnippetRepository extends Context.Tag("SnippetRepository")<
  SnippetRepository,
  SnippetRepositoryService
>() {}

export const SnippetRepositoryLive = Layer.effect(
  SnippetRepository,
  Effect.gen(function* () {
    const neo4jDriver = yield* Neo4jDriver
    
    // Helper to run queries with provided Neo4jDriver
    const runQuery = <T = any>(cypher: string, params?: Record<string, any>) =>
      runCypher<T>(cypher, params).pipe(
        Effect.provideService(Neo4jDriver, neo4jDriver)
      )
    
    return {
      create: (snippet: Snippet) =>
        runQuery(
          `CREATE (s:Snippet {id: $id, name: $name, description: $description})`,
          {
            id: snippet.id,
            name: snippet.name,
            description: snippet.description
          }
        ).pipe(
          Effect.map(() => void 0),
          Effect.mapError((error) => new RepositoryError("Failed to create snippet", error))
        ),

      findById: (id: SnippetId) =>
        runQuery<{s: Snippet}>(
          `MATCH (s:Snippet {id: $id}) RETURN s`,
          { id }
        ).pipe(
          Effect.map((records) => records.length > 0 ? records[0].s : null),
          Effect.mapError((error) => new RepositoryError("Failed to find snippet by ID", error))
        ),

      findByName: (name: Slug) =>
        runQuery<{s: Snippet}>(
          `MATCH (s:Snippet {name: $name}) RETURN s`,
          { name }
        ).pipe(
          Effect.map((records) => records.length > 0 ? records[0].s : null),
          Effect.mapError((error) => new RepositoryError("Failed to find snippet by name", error))
        ),

      list: () =>
        runQuery<{s: Snippet}>(
          `MATCH (s:Snippet) RETURN s ORDER BY s.name`
        ).pipe(
          Effect.map((records) => records.map(record => record.s)),
          Effect.mapError((error) => new RepositoryError("Failed to list snippets", error))
        ),

      addVersion: (snippetId: SnippetId, version: SnippetVersion, previousVersionId?: SnippetVersionId) =>
        Effect.gen(function* () {
          // Create the version node
          yield* runQuery(
            `CREATE (sv:SnippetVersion {id: $id, content: $content, createdAt: $createdAt, commit_message: $commit_message})`,
            {
              id: version.id,
              content: version.content,
              createdAt: version.createdAt.toISOString(),
              commit_message: version.commit_message
            }
          )

          // Link to snippet
          yield* runQuery(
            `MATCH (s:Snippet {id: $snippetId}), (sv:SnippetVersion {id: $versionId})
             CREATE (sv)-[:VERSION_OF]->(s)`,
            { snippetId, versionId: version.id }
          )

          // Link to previous version if specified
          if (previousVersionId) {
            yield* runQuery(
              `MATCH (prev:SnippetVersion {id: $prevId}), (curr:SnippetVersion {id: $currId})
               CREATE (curr)-[:PREVIOUS_VERSION]->(prev)`,
              { prevId: previousVersionId, currId: version.id }
            )
          }
        }).pipe(
          Effect.mapError((error) => new RepositoryError("Failed to add snippet version", error))
        ),

      getVersions: (snippetId: SnippetId) =>
        runQuery<{sv: SnippetVersion}>(
          `MATCH (sv:SnippetVersion)-[:VERSION_OF]->(s:Snippet {id: $snippetId})
           RETURN sv ORDER BY sv.createdAt DESC`,
          { snippetId }
        ).pipe(
          Effect.map((records) => records.map(record => ({
            ...record.sv,
            createdAt: new Date(record.sv.createdAt)
          }))),
          Effect.mapError((error) => new RepositoryError("Failed to get snippet versions", error))
        ),

      getLatestVersion: (snippetId: SnippetId) =>
        runQuery<{sv: SnippetVersion}>(
          `MATCH (sv:SnippetVersion)-[:VERSION_OF]->(s:Snippet {id: $snippetId})
           RETURN sv ORDER BY sv.createdAt DESC LIMIT 1`,
          { snippetId }
        ).pipe(
          Effect.map((records) => records.length > 0 ? {
            ...records[0].sv,
            createdAt: new Date(records[0].sv.createdAt)
          } : null),
          Effect.mapError((error) => new RepositoryError("Failed to get latest snippet version", error))
        )
    }
  })
)

// Composition Repository Service Interface  
export interface CompositionRepositoryService {
  readonly create: (composition: Composition) => Effect.Effect<void, RepositoryError>
  readonly findById: (id: CompositionId) => Effect.Effect<Composition | null, RepositoryError>
  readonly findByName: (name: Slug) => Effect.Effect<Composition | null, RepositoryError>
  readonly list: () => Effect.Effect<readonly Composition[], RepositoryError>
  readonly addVersion: (
    compositionId: CompositionId,
    version: CompositionVersion,
    previousVersionId?: CompositionVersionId
  ) => Effect.Effect<void, RepositoryError>
  readonly getVersions: (compositionId: CompositionId) => Effect.Effect<readonly CompositionVersion[], RepositoryError>
  readonly getLatestVersion: (compositionId: CompositionId) => Effect.Effect<CompositionVersion | null, RepositoryError>
}

export class CompositionRepository extends Context.Tag("CompositionRepository")<
  CompositionRepository,
  CompositionRepositoryService
>() {}

export const CompositionRepositoryLive = Layer.effect(
  CompositionRepository,
  Effect.gen(function* () {
    const neo4jDriver = yield* Neo4jDriver
    
    // Helper to run queries with provided Neo4jDriver
    const runQuery = <T = any>(cypher: string, params?: Record<string, any>) =>
      runCypher<T>(cypher, params).pipe(
        Effect.provideService(Neo4jDriver, neo4jDriver)
      )
    
    return {
      create: (composition: Composition) =>
        runQuery(
          `CREATE (c:Composition {id: $id, name: $name, description: $description})`,
          {
            id: composition.id,
            name: composition.name,
            description: composition.description
          }
        ).pipe(
          Effect.map(() => void 0),
          Effect.mapError((error) => new RepositoryError("Failed to create composition", error))
        ),

      findById: (id: CompositionId) =>
        runQuery<{c: Composition}>(
          `MATCH (c:Composition {id: $id}) RETURN c`,
          { id }
        ).pipe(
          Effect.map((records) => records.length > 0 ? records[0].c : null),
          Effect.mapError((error) => new RepositoryError("Failed to find composition by ID", error))
        ),

      findByName: (name: Slug) =>
        runQuery<{c: Composition}>(
          `MATCH (c:Composition {name: $name}) RETURN c`,
          { name }
        ).pipe(
          Effect.map((records) => records.length > 0 ? records[0].c : null),
          Effect.mapError((error) => new RepositoryError("Failed to find composition by name", error))
        ),

      list: () =>
        runQuery<{c: Composition}>(
          `MATCH (c:Composition) RETURN c ORDER BY c.name`
        ).pipe(
          Effect.map((records) => records.map(record => record.c)),
          Effect.mapError((error) => new RepositoryError("Failed to list compositions", error))
        ),

      addVersion: (compositionId: CompositionId, version: CompositionVersion, previousVersionId?: CompositionVersionId) =>
        Effect.gen(function* () {
          // Create the version node
          yield* runQuery(
            `CREATE (cv:CompositionVersion {id: $id, createdAt: $createdAt, commit_message: $commit_message})`,
            {
              id: version.id,
              createdAt: version.createdAt.toISOString(),
              commit_message: version.commit_message
            }
          )

          // Link to composition
          yield* runQuery(
            `MATCH (c:Composition {id: $compositionId}), (cv:CompositionVersion {id: $versionId})
             CREATE (cv)-[:VERSION_OF]->(c)`,
            { compositionId, versionId: version.id }
          )

          // Link to previous version if specified
          if (previousVersionId) {
            yield* runQuery(
              `MATCH (prev:CompositionVersion {id: $prevId}), (curr:CompositionVersion {id: $currId})
               CREATE (curr)-[:PREVIOUS_VERSION]->(prev)`,
              { prevId: previousVersionId, currId: version.id }
            )
          }

          // Create relationships to snippet versions
          for (const snippet of version.snippets) {
            yield* runQuery(
              `MATCH (cv:CompositionVersion {id: $versionId}), (sv:SnippetVersion {id: $snippetVersionId})
               CREATE (cv)-[:INCLUDES {role: $role, sequence: $sequence}]->(sv)`,
              {
                versionId: version.id,
                snippetVersionId: snippet.snippetVersionId,
                role: snippet.role,
                sequence: snippet.sequence
              }
            )
          }
        }).pipe(
          Effect.mapError((error) => new RepositoryError("Failed to add composition version", error))
        ),

      getVersions: (compositionId: CompositionId) =>
        runQuery<{cv: CompositionVersion}>(
          `MATCH (cv:CompositionVersion)-[:VERSION_OF]->(c:Composition {id: $compositionId})
           RETURN cv ORDER BY cv.createdAt DESC`,
          { compositionId }
        ).pipe(
          Effect.map((records) => records.map(record => ({
            ...record.cv,
            createdAt: new Date(record.cv.createdAt),
            snippets: [] // TODO: Load composition snippets in separate query
          }))),
          Effect.mapError((error) => new RepositoryError("Failed to get composition versions", error))
        ),

      getLatestVersion: (compositionId: CompositionId) =>
        runQuery<{cv: CompositionVersion}>(
          `MATCH (cv:CompositionVersion)-[:VERSION_OF]->(c:Composition {id: $compositionId})
           RETURN cv ORDER BY cv.createdAt DESC LIMIT 1`,
          { compositionId }
        ).pipe(
          Effect.map((records) => records.length > 0 ? {
            ...records[0].cv,
            createdAt: new Date(records[0].cv.createdAt),
            snippets: [] // TODO: Load composition snippets in separate query
          } : null),
          Effect.mapError((error) => new RepositoryError("Failed to get latest composition version", error))
        )
    }
  })
)

// Repository Layer - requires Neo4jDriver
export const RepositoryLayer = Layer.mergeAll(
  SnippetRepositoryLive,
  CompositionRepositoryLive
).pipe(
  Layer.provide(Neo4jDriverLayer)
)