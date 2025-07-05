/**
 * This file contains the core domain models for the Janus Project.
 * These types are based on the specifications in `docs/domain-model.md`.
 * 
 * Following functional programming principles and Effect-TS best practices:
 * - Data: Schema-validated, immutable data structures
 * - Calculations: Pure functions for validation and transformation
 * - Actions: Effect-TS integration for operations that can fail
 */

import { Schema, Effect } from "effect"

// --- Branded ID Types ---
// Using Schema.brand() for proper Effect-TS integration

export const SnippetId = Schema.String.pipe(Schema.brand("SnippetId"))
export type SnippetId = typeof SnippetId.Type

export const SnippetVersionId = Schema.String.pipe(Schema.brand("SnippetVersionId"))
export type SnippetVersionId = typeof SnippetVersionId.Type

export const ParameterId = Schema.String.pipe(Schema.brand("ParameterId"))
export type ParameterId = typeof ParameterId.Type

export const ParameterOptionId = Schema.String.pipe(Schema.brand("ParameterOptionId"))
export type ParameterOptionId = typeof ParameterOptionId.Type

export const CompositionId = Schema.String.pipe(Schema.brand("CompositionId"))
export type CompositionId = typeof CompositionId.Type

export const CompositionVersionId = Schema.String.pipe(Schema.brand("CompositionVersionId"))
export type CompositionVersionId = typeof CompositionVersionId.Type

export const TestRunId = Schema.String.pipe(Schema.brand("TestRunId"))
export type TestRunId = typeof TestRunId.Type

export const DataPointId = Schema.String.pipe(Schema.brand("DataPointId"))
export type DataPointId = typeof DataPointId.Type

export const TagId = Schema.String.pipe(Schema.brand("TagId"))
export type TagId = typeof TagId.Type

// --- Slug Type with Validation ---

export const Slug = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  Schema.maxLength(100),
  Schema.minLength(1),
  Schema.brand("Slug")
)
export type Slug = typeof Slug.Type

// --- Tagged Errors ---

export class InvalidSlugError extends Schema.TaggedError<InvalidSlugError>()(
  "InvalidSlugError",
  { message: Schema.String }
) {}

export class EntityNotFoundError extends Schema.TaggedError<EntityNotFoundError>()(
  "EntityNotFoundError",
  {
    entityType: Schema.String,
    id: Schema.String
  }
) {}

// --- Entity Schemas ---

export const Snippet = Schema.Struct({
  id: SnippetId,
  name: Slug,
  description: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date
})
export type Snippet = typeof Snippet.Type

export const SnippetVersion = Schema.Struct({
  id: SnippetVersionId,
  content: Schema.String,
  commit_message: Schema.String,
  createdAt: Schema.Date
})
export type SnippetVersion = typeof SnippetVersion.Type

export const Parameter = Schema.Struct({
  id: ParameterId,
  name: Slug,
  description: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date
})
export type Parameter = typeof Parameter.Type

export const ParameterOption = Schema.Struct({
  id: ParameterOptionId,
  value: Schema.String,
  commit_message: Schema.String,
  createdAt: Schema.Date
})
export type ParameterOption = typeof ParameterOption.Type

export const Composition = Schema.Struct({
  id: CompositionId,
  name: Slug,
  description: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date
})
export type Composition = typeof Composition.Type

export const CompositionRole = Schema.Literal("system", "user_prompt", "model_response")
export type CompositionRole = typeof CompositionRole.Type

export const CompositionSnippet = Schema.Struct({
  snippetVersionId: SnippetVersionId,
  role: CompositionRole,
  sequence: Schema.Number.pipe(Schema.int(), Schema.nonNegative())
})
export type CompositionSnippet = typeof CompositionSnippet.Type

export const CompositionVersion = Schema.Struct({
  id: CompositionVersionId,
  snippets: Schema.Array(CompositionSnippet),
  commit_message: Schema.String,
  createdAt: Schema.Date
})
export type CompositionVersion = typeof CompositionVersion.Type

export const TestRun = Schema.Struct({
  id: TestRunId,
  name: Schema.String,
  llm_provider: Schema.String,
  llm_model: Schema.String,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  createdAt: Schema.Date
})
export type TestRun = typeof TestRun.Type

export const DataPoint = Schema.Struct({
  id: DataPointId,
  final_prompt_text: Schema.String,
  response_text: Schema.String,
  metrics: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  createdAt: Schema.Date
})
export type DataPoint = typeof DataPoint.Type

export const Tag = Schema.Struct({
  id: TagId,
  name: Slug,
  createdAt: Schema.Date
})
export type Tag = typeof Tag.Type

// --- Slug Creation Function ---

export const createSlug = (rawName: string): Effect.Effect<Slug, InvalidSlugError> =>
  Schema.decodeUnknown(Slug)(rawName.trim()).pipe(
    Effect.mapError(() => new InvalidSlugError({ message: "Invalid slug format" }))
  )

// --- Entity Creation Schemas ---

export const CreateSnippetData = Schema.Struct({
  name: Slug,
  description: Schema.String
})
export type CreateSnippetData = typeof CreateSnippetData.Type

export const CreateSnippetVersionData = Schema.Struct({
  content: Schema.String,
  commit_message: Schema.String
})
export type CreateSnippetVersionData = typeof CreateSnippetVersionData.Type

export const CreateParameterData = Schema.Struct({
  name: Slug,
  description: Schema.String
})
export type CreateParameterData = typeof CreateParameterData.Type

export const CreateParameterOptionData = Schema.Struct({
  value: Schema.String,
  commit_message: Schema.String
})
export type CreateParameterOptionData = typeof CreateParameterOptionData.Type

export const CreateCompositionData = Schema.Struct({
  name: Slug,
  description: Schema.String
})
export type CreateCompositionData = typeof CreateCompositionData.Type

export const CreateCompositionVersionData = Schema.Struct({
  snippets: Schema.Array(CompositionSnippet),
  commit_message: Schema.String
})
export type CreateCompositionVersionData = typeof CreateCompositionVersionData.Type

export const CreateTestRunData = Schema.Struct({
  name: Schema.String,
  llm_provider: Schema.String,
  llm_model: Schema.String,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
})
export type CreateTestRunData = typeof CreateTestRunData.Type

export const CreateDataPointData = Schema.Struct({
  final_prompt_text: Schema.String,
  response_text: Schema.String,
  metrics: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
})
export type CreateDataPointData = typeof CreateDataPointData.Type

export const CreateTagData = Schema.Struct({
  name: Slug
})
export type CreateTagData = typeof CreateTagData.Type

// --- Entity-specific Tagged Errors ---

export class SnippetNotFound extends Schema.TaggedError<SnippetNotFound>()(
  "SnippetNotFound",
  { id: SnippetId }
) {}

export class ParameterNotFound extends Schema.TaggedError<ParameterNotFound>()(
  "ParameterNotFound",
  { id: ParameterId }
) {}

export class CompositionNotFound extends Schema.TaggedError<CompositionNotFound>()(
  "CompositionNotFound",
  { id: CompositionId }
) {}

export class TestRunNotFound extends Schema.TaggedError<TestRunNotFound>()(
  "TestRunNotFound",
  { id: TestRunId }
) {}

export class TagNotFound extends Schema.TaggedError<TagNotFound>()(
  "TagNotFound",
  { id: TagId }
) {}

// --- Validation Helpers ---

export const validateSnippetData = (data: unknown) =>
  Schema.decodeUnknown(CreateSnippetData)(data)

export const validateParameterData = (data: unknown) =>
  Schema.decodeUnknown(CreateParameterData)(data)

export const validateCompositionData = (data: unknown) =>
  Schema.decodeUnknown(CreateCompositionData)(data)

export const validateTestRunData = (data: unknown) =>
  Schema.decodeUnknown(CreateTestRunData)(data)

export const validateCompositionSnippets = (snippets: unknown) =>
  Schema.decodeUnknown(Schema.Array(CompositionSnippet))(snippets)