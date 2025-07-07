/**
 * Repository services following Effect.Service pattern.
 * Provides data access layer with proper dependency injection and error handling.
 */

import { Effect, Layer, Option, Schema } from "effect"
import { Neo4jService, Neo4jQueryError } from "./neo4j"
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
  TagNotFound,
  CreateSnippetData,
  CreateCompositionData
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
  readonly create: (snippet: Snippet) => Effect.Effect<Snippet, RepositoryError>
  readonly findById: (id: SnippetId) => Effect.Effect<Option.Option<Snippet>, RepositoryError>
  readonly findByName: (name: Slug) => Effect.Effect<Option.Option<Snippet>, RepositoryError>
  readonly list: () => Effect.Effect<readonly Snippet[], RepositoryError>
  readonly update: (id: SnippetId, updates: Partial<CreateSnippetData>) => Effect.Effect<Snippet, RepositoryError | SnippetNotFound>
  readonly delete: (id: SnippetId) => Effect.Effect<void, RepositoryError | SnippetNotFound>
}

export class SnippetRepository extends Effect.Service<SnippetRepository>()("SnippetRepository", {
  effect: Effect.gen(function*() {
    const neo4j = yield* Neo4jService

    const create = (snippet: Snippet): Effect.Effect<Snippet, RepositoryError> =>
      neo4j.runQuery<unknown>(
        `CREATE (s:Snippet $props) RETURN s`,
        { props: snippet }
      ).pipe(
        Effect.map(records => records[0]),
        Effect.flatMap(Schema.decodeUnknown(Snippet)),
        Effect.mapError(cause => new RepositoryError({
          operation: "create",
          entityType: "Snippet",
          message: "Failed to create snippet",
          cause
        })),
        Effect.withSpan("SnippetRepository.create")
      )

    const findById = (id: SnippetId): Effect.Effect<Option.Option<Snippet>, RepositoryError> =>
      neo4j.runQuery<unknown>(
        `MATCH (s:Snippet {id: $id}) RETURN s`,
        { id }
      ).pipe(
        Effect.map(records => Option.fromNullable(records[0])),
        Effect.flatMap(Option.match({
          onNone: () => Effect.succeed(Option.none()),
          onSome: (record) => Schema.decodeUnknown(Snippet)(record).pipe(Effect.map(Option.some))
        })),
        Effect.mapError(cause => new RepositoryError({
          operation: "findById",
          entityType: "Snippet",
          message: `Failed to find snippet by ID: ${id}`,
          cause
        })),
        Effect.withSpan("SnippetRepository.findById", { attributes: { id } })
      )

    const findByName = (name: Slug): Effect.Effect<Option.Option<Snippet>, RepositoryError> =>
      neo4j.runQuery<unknown>(
        `MATCH (s:Snippet {name: $name}) RETURN s`,
        { name }
      ).pipe(
        Effect.map(records => Option.fromNullable(records[0])),
        Effect.flatMap(Option.match({
          onNone: () => Effect.succeed(Option.none()),
          onSome: (record) => Schema.decodeUnknown(Snippet)(record).pipe(Effect.map(Option.some))
        })),
        Effect.mapError(cause => new RepositoryError({
          operation: "findByName", 
          entityType: "Snippet",
          message: `Failed to find snippet by name: ${name}`,
          cause
        })),
        Effect.withSpan("SnippetRepository.findByName", { attributes: { name } })
      )

    const list = (): Effect.Effect<readonly Snippet[], RepositoryError> =>
      neo4j.runQuery<unknown>(
        `MATCH (s:Snippet) RETURN s ORDER BY s.name`
      ).pipe(
        Effect.flatMap(Schema.decodeUnknown(Schema.Array(Snippet))),
        Effect.mapError(cause => new RepositoryError({
          operation: "list",
          entityType: "Snippet", 
          message: "Failed to list snippets",
          cause
        })),
        Effect.withSpan("SnippetRepository.list")
      )

    const update = (id: SnippetId, updates: Partial<CreateSnippetData>): Effect.Effect<Snippet, RepositoryError | SnippetNotFound> =>
      Effect.gen(function*() {
        const existing = yield* findById(id)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(new SnippetNotFound({ id }))
        }

        const now = new Date()
        const updateData = { ...updates, updatedAt: now }
        const records = yield* neo4j.runQuery<unknown>(
          `MATCH (s:Snippet {id: $id})
           SET s += $updates
           RETURN s`,
          { id, updates: updateData }
        ).pipe(
          Effect.map(records => records[0]),
          Effect.flatMap(Schema.decodeUnknown(Snippet)),
          Effect.mapError(cause => new RepositoryError({
            operation: "update",
            entityType: "Snippet",
            message: `Failed to update snippet: ${id}`,
            cause
          }))
        )

        return records
      }).pipe(
        Effect.withSpan("SnippetRepository.update", { attributes: { id } })
      )

    const deleteSnippet = (id: SnippetId): Effect.Effect<void, RepositoryError | SnippetNotFound> =>
      Effect.gen(function*() {
        const existing = yield* findById(id)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(new SnippetNotFound({ id }))
        }

        yield* neo4j.runQuery(
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
  static Test = Layer.succeed(this, (function() {
    const service: SnippetRepositoryService = {
      create: () => Effect.dieMessage("SnippetRepository.create not implemented in test"),
      findById: () => Effect.succeed(Option.none()),
      findByName: () => Effect.succeed(Option.none()),
      list: () => Effect.succeed([]),
      update: () => Effect.dieMessage("SnippetRepository.update not implemented in test"),
      delete: () => Effect.void
    }
    // Cast to include required runtime properties
    return Object.assign(Object.create(SnippetRepository.prototype), service)
  })())
}

// --- Composition Repository ---

export interface CompositionRepositoryService {
  readonly create: (composition: Composition) => Effect.Effect<Composition, RepositoryError>
  readonly findById: (id: CompositionId) => Effect.Effect<Option.Option<Composition>, RepositoryError>
  readonly findByName: (name: Slug) => Effect.Effect<Option.Option<Composition>, RepositoryError>
  readonly list: () => Effect.Effect<readonly Composition[], RepositoryError>
  readonly update: (id: CompositionId, updates: Partial<CreateCompositionData>) => Effect.Effect<Composition, RepositoryError | CompositionNotFound>
  readonly delete: (id: CompositionId) => Effect.Effect<void, RepositoryError | CompositionNotFound>
}

export class CompositionRepository extends Effect.Service<CompositionRepository>()("CompositionRepository", {
  effect: Effect.gen(function*() {
    const neo4j = yield* Neo4jService

    const create = (composition: Composition): Effect.Effect<Composition, RepositoryError> =>
      neo4j.runQuery<unknown>(
        `CREATE (c:Composition $props) RETURN c`,
        { props: composition }
      ).pipe(
        Effect.map(records => records[0]),
        Effect.flatMap(Schema.decodeUnknown(Composition)),
        Effect.mapError(cause => new RepositoryError({
          operation: "create",
          entityType: "Composition",
          message: "Failed to create composition",
          cause
        })),
        Effect.withSpan("CompositionRepository.create")
      )

    const findById = (id: CompositionId): Effect.Effect<Option.Option<Composition>, RepositoryError> =>
      neo4j.runQuery<unknown>(
        `MATCH (c:Composition {id: $id}) RETURN c`,
        { id }
      ).pipe(
        Effect.map(records => Option.fromNullable(records[0])),
        Effect.flatMap(Option.match({
          onNone: () => Effect.succeed(Option.none()),
          onSome: (record) => Schema.decodeUnknown(Composition)(record).pipe(Effect.map(Option.some))
        })),
        Effect.mapError(cause => new RepositoryError({
          operation: "findById",
          entityType: "Composition",
          message: `Failed to find composition by ID: ${id}`,
          cause
        })),
        Effect.withSpan("CompositionRepository.findById", { attributes: { id } })
      )

    const findByName = (name: Slug): Effect.Effect<Option.Option<Composition>, RepositoryError> =>
      neo4j.runQuery<unknown>(
        `MATCH (c:Composition {name: $name}) RETURN c`,
        { name }
      ).pipe(
        Effect.map(records => Option.fromNullable(records[0])),
        Effect.flatMap(Option.match({
          onNone: () => Effect.succeed(Option.none()),
          onSome: (record) => Schema.decodeUnknown(Composition)(record).pipe(Effect.map(Option.some))
        })),
        Effect.mapError(cause => new RepositoryError({
          operation: "findByName",
          entityType: "Composition", 
          message: `Failed to find composition by name: ${name}`,
          cause
        })),
        Effect.withSpan("CompositionRepository.findByName", { attributes: { name } })
      )

    const list = (): Effect.Effect<readonly Composition[], RepositoryError> =>
      neo4j.runQuery<unknown>(
        `MATCH (c:Composition) RETURN c ORDER BY c.name`
      ).pipe(
        Effect.flatMap(Schema.decodeUnknown(Schema.Array(Composition))),
        Effect.mapError(cause => new RepositoryError({
          operation: "list",
          entityType: "Composition",
          message: "Failed to list compositions",
          cause
        })),
        Effect.withSpan("CompositionRepository.list")
      )

    const update = (id: CompositionId, updates: Partial<CreateCompositionData>): Effect.Effect<Composition, RepositoryError | CompositionNotFound> =>
      Effect.gen(function*() {
        const existing = yield* findById(id)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(new CompositionNotFound({ id }))
        }

        const now = new Date()
        const updateData = { ...updates, updatedAt: now }
        const records = yield* neo4j.runQuery<unknown>(
          `MATCH (c:Composition {id: $id})
           SET c += $updates
           RETURN c`,
          { id, updates: updateData }
        ).pipe(
          Effect.map(records => records[0]),
          Effect.flatMap(Schema.decodeUnknown(Composition)),
          Effect.mapError(cause => new RepositoryError({
            operation: "update",
            entityType: "Composition",
            message: `Failed to update composition: ${id}`,
            cause
          }))
        )

        return records
      }).pipe(
        Effect.withSpan("CompositionRepository.update", { attributes: { id } })
      )

    const deleteComposition = (id: CompositionId): Effect.Effect<void, RepositoryError | CompositionNotFound> =>
      Effect.gen(function*() {
        const existing = yield* findById(id)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(new CompositionNotFound({ id }))
        }

        yield* neo4j.runQuery(
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
  static Test = Layer.succeed(this, (function() {
    const service: CompositionRepositoryService = {
      create: () => Effect.dieMessage("CompositionRepository.create not implemented in test"),
      findById: () => Effect.succeed(Option.none()),
      findByName: () => Effect.succeed(Option.none()),
      list: () => Effect.succeed([]),
      update: () => Effect.dieMessage("CompositionRepository.update not implemented in test"),
      delete: () => Effect.void
    }
    // Cast to include required runtime properties
    return Object.assign(Object.create(CompositionRepository.prototype), service)
  })())
}

// --- Test Helper ---

/**
 * Helper function to create test layers for repositories.
 * This is handled by the test-utils makeTestLayer function instead.
 */

// --- Repository Layer Composition ---

export const RepositoryLayer = Layer.mergeAll(
  SnippetRepository.Default,
  CompositionRepository.Default
)