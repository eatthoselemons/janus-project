/**
 * Repository services following Effect.Service pattern.
 * Provides data access layer with proper dependency injection and error handling.
 */

import { Effect, Layer, Option, Schema } from "effect"
import { Neo4jService, Neo4jQueryError, executeQuery } from "./neo4j"
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
  Slug,
  SnippetNotFound,
  CompositionNotFound,
  ParameterNotFound,
  TestRunNotFound,
  TagNotFound
} from "../core/domain"

// --- Repository Errors ---

export class RepositoryError extends Schema.TaggedError<RepositoryError>()(
  "RepositoryError",
  {
    operation: Schema.String,
    entityType: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}

export class EntityValidationError extends Schema.TaggedError<EntityValidationError>()(
  "EntityValidationError",
  {
    entityType: Schema.String,
    field: Schema.String,
    message: Schema.String
  }
) {}

// --- Snippet Repository ---

export interface SnippetRepositoryService {
  readonly create: (snippet: typeof Snippet.insert.Type) => Effect.Effect<Snippet, RepositoryError>
  readonly findById: (id: SnippetId) => Effect.Effect<Option.Option<Snippet>, RepositoryError>
  readonly findByName: (name: Slug) => Effect.Effect<Option.Option<Snippet>, RepositoryError>
  readonly list: () => Effect.Effect<readonly Snippet[], RepositoryError>
  readonly update: (id: SnippetId, updates: Partial<typeof Snippet.update.Type>) => Effect.Effect<Snippet, RepositoryError | SnippetNotFound>
  readonly delete: (id: SnippetId) => Effect.Effect<void, RepositoryError | SnippetNotFound>
}

export class SnippetRepository extends Effect.Service<SnippetRepository>()("SnippetRepository", {
  effect: Effect.gen(function*() {
    const neo4j = yield* Neo4jService

    const create = (snippet: typeof Snippet.insert.Type): Effect.Effect<Snippet, RepositoryError> =>
      Effect.gen(function*() {
        const insertData = Snippet.insert.make(snippet)
        const createdSnippet = yield* executeQuery<Snippet>(
          `CREATE (s:Snippet {id: randomUUID(), name: $name, description: $description, createdAt: datetime(), updatedAt: datetime()})
           RETURN s`,
          {
            name: insertData.name,
            description: insertData.description
          }
        ).pipe(
          Effect.map(records => records[0]),
          Effect.mapError(cause => new RepositoryError({
            operation: "create",
            entityType: "Snippet",
            message: "Failed to create snippet",
            cause
          }))
        )
        
        return Snippet.make(createdSnippet)
      }).pipe(
        Effect.withSpan("SnippetRepository.create")
      )

    const findById = (id: SnippetId): Effect.Effect<Option.Option<Snippet>, RepositoryError> =>
      executeQuery<Snippet>(
        `MATCH (s:Snippet {id: $id}) RETURN s`,
        { id }
      ).pipe(
        Effect.map(records => records.length > 0 ? Option.some(Snippet.make(records[0])) : Option.none()),
        Effect.mapError(cause => new RepositoryError({
          operation: "findById",
          entityType: "Snippet",
          message: `Failed to find snippet by ID: ${id}`,
          cause
        })),
        Effect.withSpan("SnippetRepository.findById", { attributes: { id } })
      )

    const findByName = (name: Slug): Effect.Effect<Option.Option<Snippet>, RepositoryError> =>
      executeQuery<Snippet>(
        `MATCH (s:Snippet {name: $name}) RETURN s`,
        { name }
      ).pipe(
        Effect.map(records => records.length > 0 ? Option.some(Snippet.make(records[0])) : Option.none()),
        Effect.mapError(cause => new RepositoryError({
          operation: "findByName", 
          entityType: "Snippet",
          message: `Failed to find snippet by name: ${name}`,
          cause
        })),
        Effect.withSpan("SnippetRepository.findByName", { attributes: { name } })
      )

    const list = (): Effect.Effect<readonly Snippet[], RepositoryError> =>
      executeQuery<Snippet>(
        `MATCH (s:Snippet) RETURN s ORDER BY s.name`
      ).pipe(
        Effect.map(records => records.map(record => Snippet.make(record))),
        Effect.mapError(cause => new RepositoryError({
          operation: "list",
          entityType: "Snippet", 
          message: "Failed to list snippets",
          cause
        })),
        Effect.withSpan("SnippetRepository.list")
      )

    const update = (id: SnippetId, updates: Partial<typeof Snippet.update.Type>): Effect.Effect<Snippet, RepositoryError | SnippetNotFound> =>
      Effect.gen(function*() {
        const existing = yield* findById(id)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(new SnippetNotFound({ id }))
        }

        const updateData = Snippet.update.make(updates)
        const updatedSnippet = yield* executeQuery<Snippet>(
          `MATCH (s:Snippet {id: $id})
           SET s += $updates, s.updatedAt = datetime()
           RETURN s`,
          { id, updates: updateData }
        ).pipe(
          Effect.map(records => Snippet.make(records[0])),
          Effect.mapError(cause => new RepositoryError({
            operation: "update",
            entityType: "Snippet",
            message: `Failed to update snippet: ${id}`,
            cause
          }))
        )

        return updatedSnippet
      }).pipe(
        Effect.withSpan("SnippetRepository.update", { attributes: { id } })
      )

    const deleteSnippet = (id: SnippetId): Effect.Effect<void, RepositoryError | SnippetNotFound> =>
      Effect.gen(function*() {
        const existing = yield* findById(id)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(new SnippetNotFound({ id }))
        }

        yield* executeQuery(
          `MATCH (s:Snippet {id: $id}) DETACH DELETE s`,
          { id }
        ).pipe(
          Effect.mapError(cause => new RepositoryError({
            operation: "delete",
            entityType: "Snippet",
            message: `Failed to delete snippet: ${id}`,
            cause
          }))
        )
      }).pipe(
        Effect.withSpan("SnippetRepository.delete", { attributes: { id } })
      )

    return {
      create,
      findById,
      findByName,
      list,
      update,
      delete: deleteSnippet
    } as const
  }),
  dependencies: [Neo4jService.Default]
}) {
  static Test = Layer.succeed(this, {
    create: () => Effect.dieMessage("SnippetRepository.create not implemented in test"),
    findById: () => Effect.succeed(Option.none()),
    findByName: () => Effect.succeed(Option.none()),
    list: () => Effect.succeed([]),
    update: () => Effect.dieMessage("SnippetRepository.update not implemented in test"),
    delete: () => Effect.void
  })
}

// --- Composition Repository ---

export interface CompositionRepositoryService {
  readonly create: (composition: typeof Composition.insert.Type) => Effect.Effect<Composition, RepositoryError>
  readonly findById: (id: CompositionId) => Effect.Effect<Option.Option<Composition>, RepositoryError>
  readonly findByName: (name: Slug) => Effect.Effect<Option.Option<Composition>, RepositoryError>
  readonly list: () => Effect.Effect<readonly Composition[], RepositoryError>
  readonly update: (id: CompositionId, updates: Partial<typeof Composition.update.Type>) => Effect.Effect<Composition, RepositoryError | CompositionNotFound>
  readonly delete: (id: CompositionId) => Effect.Effect<void, RepositoryError | CompositionNotFound>
}

export class CompositionRepository extends Effect.Service<CompositionRepository>()("CompositionRepository", {
  effect: Effect.gen(function*() {
    const neo4j = yield* Neo4jService

    const create = (composition: typeof Composition.insert.Type): Effect.Effect<Composition, RepositoryError> =>
      Effect.gen(function*() {
        const insertData = Composition.insert.make(composition)
        const createdComposition = yield* executeQuery<Composition>(
          `CREATE (c:Composition {id: randomUUID(), name: $name, description: $description, createdAt: datetime(), updatedAt: datetime()})
           RETURN c`,
          {
            name: insertData.name,
            description: insertData.description
          }
        ).pipe(
          Effect.map(records => records[0]),
          Effect.mapError(cause => new RepositoryError({
            operation: "create",
            entityType: "Composition",
            message: "Failed to create composition",
            cause
          }))
        )

        return Composition.make(createdComposition)
      }).pipe(
        Effect.withSpan("CompositionRepository.create")
      )

    const findById = (id: CompositionId): Effect.Effect<Option.Option<Composition>, RepositoryError> =>
      executeQuery<Composition>(
        `MATCH (c:Composition {id: $id}) RETURN c`,
        { id }
      ).pipe(
        Effect.map(records => records.length > 0 ? Option.some(Composition.make(records[0])) : Option.none()),
        Effect.mapError(cause => new RepositoryError({
          operation: "findById",
          entityType: "Composition",
          message: `Failed to find composition by ID: ${id}`,
          cause
        })),
        Effect.withSpan("CompositionRepository.findById", { attributes: { id } })
      )

    const findByName = (name: Slug): Effect.Effect<Option.Option<Composition>, RepositoryError> =>
      executeQuery<Composition>(
        `MATCH (c:Composition {name: $name}) RETURN c`,
        { name }
      ).pipe(
        Effect.map(records => records.length > 0 ? Option.some(Composition.make(records[0])) : Option.none()),
        Effect.mapError(cause => new RepositoryError({
          operation: "findByName",
          entityType: "Composition", 
          message: `Failed to find composition by name: ${name}`,
          cause
        })),
        Effect.withSpan("CompositionRepository.findByName", { attributes: { name } })
      )

    const list = (): Effect.Effect<readonly Composition[], RepositoryError> =>
      executeQuery<Composition>(
        `MATCH (c:Composition) RETURN c ORDER BY c.name`
      ).pipe(
        Effect.map(records => records.map(record => Composition.make(record))),
        Effect.mapError(cause => new RepositoryError({
          operation: "list",
          entityType: "Composition",
          message: "Failed to list compositions",
          cause
        })),
        Effect.withSpan("CompositionRepository.list")
      )

    const update = (id: CompositionId, updates: Partial<typeof Composition.update.Type>): Effect.Effect<Composition, RepositoryError | CompositionNotFound> =>
      Effect.gen(function*() {
        const existing = yield* findById(id)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(new CompositionNotFound({ id }))
        }

        const updateData = Composition.update.make(updates)
        const updatedComposition = yield* executeQuery<Composition>(
          `MATCH (c:Composition {id: $id})
           SET c += $updates, c.updatedAt = datetime()
           RETURN c`,
          { id, updates: updateData }
        ).pipe(
          Effect.map(records => Composition.make(records[0])),
          Effect.mapError(cause => new RepositoryError({
            operation: "update",
            entityType: "Composition",
            message: `Failed to update composition: ${id}`,
            cause
          }))
        )

        return updatedComposition
      }).pipe(
        Effect.withSpan("CompositionRepository.update", { attributes: { id } })
      )

    const deleteComposition = (id: CompositionId): Effect.Effect<void, RepositoryError | CompositionNotFound> =>
      Effect.gen(function*() {
        const existing = yield* findById(id)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(new CompositionNotFound({ id }))
        }

        yield* executeQuery(
          `MATCH (c:Composition {id: $id}) DETACH DELETE c`,
          { id }
        ).pipe(
          Effect.mapError(cause => new RepositoryError({
            operation: "delete",
            entityType: "Composition",
            message: `Failed to delete composition: ${id}`,
            cause
          }))
        )
      }).pipe(
        Effect.withSpan("CompositionRepository.delete", { attributes: { id } })
      )

    return {
      create,
      findById,
      findByName,
      list,
      update,
      delete: deleteComposition
    } as const
  }),
  dependencies: [Neo4jService.Default]
}) {
  static Test = Layer.succeed(this, {
    create: () => Effect.dieMessage("CompositionRepository.create not implemented in test"),
    findById: () => Effect.succeed(Option.none()),
    findByName: () => Effect.succeed(Option.none()),
    list: () => Effect.succeed([]),
    update: () => Effect.dieMessage("CompositionRepository.update not implemented in test"),
    delete: () => Effect.void
  })
}

// --- Test Helper ---

/**
 * Helper function to create test layers for repositories.
 */
export const makeTestRepository = <T extends Record<string, any>>(
  service: new() => T,
  implementation: Partial<T[keyof T]>
) => Layer.succeed(service, implementation as T[keyof T])

// --- Repository Layer Composition ---

export const RepositoryLayer = Layer.mergeAll(
  SnippetRepository.Default,
  CompositionRepository.Default
)