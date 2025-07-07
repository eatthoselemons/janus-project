/**
 * Domain model operations with proper separation of concerns:
 * - Pure functions (Calculations) for data transformation
 * - Effectful functions (Actions) for operations with side effects
 * Following Eric Normand's paradigm and Effect-TS best practices.
 */

import { Effect, Schema } from "effect"
import { Clock } from "effect"
import { UuidServiceTag, type Uuid } from "./services"
import {
  Slug,
  Snippet,
  SnippetId,
  SnippetVersion,
  SnippetVersionId,
  Parameter,
  ParameterId,
  ParameterOption,
  ParameterOptionId,
  Composition,
  CompositionId,
  CompositionVersion,
  CompositionVersionId,
  CompositionSnippet,
  TestRun,
  TestRunId,
  DataPoint,
  DataPointId,
  Tag,
  TagId,
  InvalidSlugError,
  createSlug,
  CreateSnippetData,
  CreateSnippetVersionData,
  CreateParameterData,
  CreateParameterOptionData,
  CreateCompositionData,
  CreateCompositionVersionData,
  CreateTestRunData,
  CreateDataPointData,
  CreateTagData
} from "./domain"

// --- Slug Utilities ---

/**
 * Converts a raw string to a URL-friendly slug format.
 * Pure calculation function that normalizes strings for slug creation.
 */
export const normalizeSlugInput = (input: string): string => {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Creates a slug from raw input with normalization.
 */
export const createSlugFromInput = (input: string): Effect.Effect<Slug, InvalidSlugError> => {
  const normalized = normalizeSlugInput(input)
  return createSlug(normalized)
}

// --- Pure Creation Functions (Calculations) ---

/**
 * Creates a Snippet from complete data. Pure function.
 */
export const createSnippet = (data: CreateSnippetData & { id: SnippetId; createdAt: Date; updatedAt: Date }): Snippet => {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  }
}

/**
 * Creates a SnippetVersion from complete data. Pure function.
 */
export const createSnippetVersion = (data: CreateSnippetVersionData & { id: SnippetVersionId; createdAt: Date }): SnippetVersion => {
  return {
    id: data.id,
    content: data.content,
    commit_message: data.commit_message,
    createdAt: data.createdAt
  }
}

/**
 * Creates a Parameter from complete data. Pure function.
 */
export const createParameter = (data: CreateParameterData & { id: ParameterId; createdAt: Date; updatedAt: Date }): Parameter => {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  }
}

/**
 * Creates a ParameterOption from complete data. Pure function.
 */
export const createParameterOption = (data: CreateParameterOptionData & { id: ParameterOptionId; createdAt: Date }): ParameterOption => {
  return {
    id: data.id,
    value: data.value,
    commit_message: data.commit_message,
    createdAt: data.createdAt
  }
}

/**
 * Creates a Composition from complete data. Pure function.
 */
export const createComposition = (data: CreateCompositionData & { id: CompositionId; createdAt: Date; updatedAt: Date }): Composition => {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  }
}

/**
 * Creates a CompositionVersion from complete data. Pure function.
 */
export const createCompositionVersion = (data: CreateCompositionVersionData & { id: CompositionVersionId; createdAt: Date }): CompositionVersion => {
  return {
    id: data.id,
    snippets: data.snippets,
    commit_message: data.commit_message,
    createdAt: data.createdAt
  }
}

/**
 * Creates a TestRun from complete data. Pure function.
 */
export const createTestRun = (data: CreateTestRunData & { id: TestRunId; createdAt: Date }): TestRun => {
  return {
    id: data.id,
    name: data.name,
    llm_provider: data.llm_provider,
    llm_model: data.llm_model,
    metadata: data.metadata || {},
    createdAt: data.createdAt
  }
}

/**
 * Creates a DataPoint from complete data. Pure function.
 */
export const createDataPoint = (data: CreateDataPointData & { id: DataPointId; createdAt: Date }): DataPoint => {
  return {
    id: data.id,
    final_prompt_text: data.final_prompt_text,
    response_text: data.response_text,
    metrics: data.metrics || {},
    createdAt: data.createdAt
  }
}

/**
 * Creates a Tag from complete data. Pure function.
 */
export const createTag = (data: CreateTagData & { id: TagId; createdAt: Date }): Tag => {
  return {
    id: data.id,
    name: data.name,
    createdAt: data.createdAt
  }
}

// --- Effectful Build Functions (Actions) ---

/**
 * Builds a new Snippet with generated ID and timestamps.
 */
export const buildSnippet = (data: CreateSnippetData): Effect.Effect<Snippet, never, Clock.Clock | UuidServiceTag> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const uuidService = yield* UuidServiceTag
    const id = yield* uuidService.v4
    return createSnippet({
      ...data,
      id: id as unknown as SnippetId,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    })
  })

/**
 * Builds a new SnippetVersion with generated ID and timestamp.
 */
export const buildSnippetVersion = (data: CreateSnippetVersionData): Effect.Effect<SnippetVersion, never, Clock.Clock | UuidServiceTag> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const uuidService = yield* UuidServiceTag
    const id = yield* uuidService.v4
    return createSnippetVersion({
      ...data,
      id: id as unknown as SnippetVersionId,
      createdAt: new Date(now)
    })
  })

/**
 * Builds a new Parameter with generated ID and timestamps.
 */
export const buildParameter = (data: CreateParameterData): Effect.Effect<Parameter, never, Clock.Clock | UuidServiceTag> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const uuidService = yield* UuidServiceTag
    const id = yield* uuidService.v4
    return createParameter({
      ...data,
      id: id as unknown as ParameterId,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    })
  })

/**
 * Builds a new ParameterOption with generated ID and timestamp.
 */
export const buildParameterOption = (data: CreateParameterOptionData): Effect.Effect<ParameterOption, never, Clock.Clock | UuidServiceTag> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const uuidService = yield* UuidServiceTag
    const id = yield* uuidService.v4
    return createParameterOption({
      ...data,
      id: id as unknown as ParameterOptionId,
      createdAt: new Date(now)
    })
  })

/**
 * Builds a new Composition with generated ID and timestamps.
 */
export const buildComposition = (data: CreateCompositionData): Effect.Effect<Composition, never, Clock.Clock | UuidServiceTag> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const uuidService = yield* UuidServiceTag
    const id = yield* uuidService.v4
    return createComposition({
      ...data,
      id: id as unknown as CompositionId,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    })
  })

/**
 * Builds a new CompositionVersion with generated ID and timestamp.
 */
export const buildCompositionVersion = (data: CreateCompositionVersionData): Effect.Effect<CompositionVersion, never, Clock.Clock | UuidServiceTag> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const uuidService = yield* UuidServiceTag
    const id = yield* uuidService.v4
    return createCompositionVersion({
      ...data,
      id: id as unknown as CompositionVersionId,
      createdAt: new Date(now)
    })
  })

/**
 * Builds a new TestRun with generated ID and timestamp.
 */
export const buildTestRun = (data: CreateTestRunData): Effect.Effect<TestRun, never, Clock.Clock | UuidServiceTag> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const uuidService = yield* UuidServiceTag
    const id = yield* uuidService.v4
    return createTestRun({
      ...data,
      id: id as unknown as TestRunId,
      createdAt: new Date(now)
    })
  })

/**
 * Builds a new DataPoint with generated ID and timestamp.
 */
export const buildDataPoint = (data: CreateDataPointData): Effect.Effect<DataPoint, never, Clock.Clock | UuidServiceTag> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const uuidService = yield* UuidServiceTag
    const id = yield* uuidService.v4
    return createDataPoint({
      ...data,
      id: id as unknown as DataPointId,
      createdAt: new Date(now)
    })
  })

/**
 * Builds a new Tag with generated ID and timestamp.
 */
export const buildTag = (data: CreateTagData): Effect.Effect<Tag, never, Clock.Clock | UuidServiceTag> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const uuidService = yield* UuidServiceTag
    const id = yield* uuidService.v4
    return createTag({
      ...data,
      id: id as unknown as TagId,
      createdAt: new Date(now)
    })
  })



