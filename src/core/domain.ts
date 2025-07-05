/**
 * This file contains the core domain models for the Janus Project.
 * These types are based on the specifications in `docs/domain-model.md`.
 * 
 * Following functional programming principles:
 * - Data: Plain, immutable types
 * - Calculations: Pure functions for construction and validation
 * - Actions: Effect-TS integration for operations that can fail
 */

import { Effect } from "effect"

// --- Branded ID Types ---
// These are opaque types that prevent accidentally mixing up different kinds of IDs.

export type SnippetId = string & { readonly __brand: "SnippetId" };
export type SnippetVersionId = string & { readonly __brand: "SnippetVersionId" };
export type ParameterId = string & { readonly __brand: "ParameterId" };
export type ParameterOptionId = string & { readonly __brand: "ParameterOptionId" };
export type CompositionId = string & { readonly __brand: "CompositionId" };
export type CompositionVersionId = string & { readonly __brand: "CompositionVersionId" };
export type TestRunId = string & { readonly __brand: "TestRunId" };
export type DataPointId = string & { readonly __brand: "DataPointId" };
export type TagId = string & { readonly __brand: "TagId" };

/**
 * A URL- and command-line-friendly string.
 * It can only be created via a smart constructor that performs validation.
 */
export type Slug = string & { readonly __brand: "Slug" };

// --- Slug Validation (Smart Constructor) ---

export class InvalidSlugError extends Error {
  readonly _tag = "InvalidSlugError"
  constructor(message: string) {
    super(message)
  }
}

export const createSlug = (rawName: string): Effect.Effect<Slug, InvalidSlugError> =>
  Effect.gen(function* () {
    const trimmed = rawName.trim()
    
    if (trimmed.length === 0) {
      return yield* Effect.fail(new InvalidSlugError("Slug cannot be empty"))
    }
    
    if (trimmed.length > 100) {
      return yield* Effect.fail(new InvalidSlugError("Slug cannot be longer than 100 characters"))
    }
    
    // Check if it matches lowercase-with-hyphens pattern
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!slugPattern.test(trimmed)) {
      return yield* Effect.fail(new InvalidSlugError("Slug must contain only lowercase letters, numbers, and hyphens"))
    }
    
    return trimmed as Slug
  })

// --- ID Generators (Pure Functions) ---

export const generateSnippetId = (): SnippetId => crypto.randomUUID() as SnippetId
export const generateSnippetVersionId = (): SnippetVersionId => crypto.randomUUID() as SnippetVersionId
export const generateCompositionId = (): CompositionId => crypto.randomUUID() as CompositionId
export const generateCompositionVersionId = (): CompositionVersionId => crypto.randomUUID() as CompositionVersionId
export const generateParameterId = (): ParameterId => crypto.randomUUID() as ParameterId
export const generateParameterOptionId = (): ParameterOptionId => crypto.randomUUID() as ParameterOptionId
export const generateTestRunId = (): TestRunId => crypto.randomUUID() as TestRunId
export const generateDataPointId = (): DataPointId => crypto.randomUUID() as DataPointId
export const generateTagId = (): TagId => crypto.randomUUID() as TagId


// --- Entity Definitions ---

/**
 * The abstract container for a snippet and all its versions.
 */
export type Snippet = {
  readonly id: SnippetId;
  readonly name: Slug;
  readonly description: string;
};

/**
 * An immutable snapshot of a snippet's content at a specific point in time.
 */
export type SnippetVersion = {
  readonly id: SnippetVersionId;
  readonly content: string;
  readonly createdAt: Date;
  readonly commit_message: string;
};

/**
 * The abstract definition of a parameter.
 */
export type Parameter = {
  readonly id: ParameterId;
  readonly name: Slug;
  readonly description: string;
};

/**
 * A specific, versioned value for a `Parameter`.
 */
export type ParameterOption = {
  readonly id: ParameterOptionId;
  readonly value: string;
  readonly createdAt: Date;
  readonly commit_message: string;
};

/**
 * The abstract container for a composition and all its versions.
 */
export type Composition = {
  readonly id: CompositionId;
  readonly name: Slug;
  readonly description: string;
};

/**
 * The roles that snippets can play in a composition.
 */
export type CompositionRole = "system" | "user_prompt" | "model_response";

/**
 * An immutable snapshot of a composition, locking in specific `SnippetVersion`s
 * in a defined order and role.
 */
export type CompositionSnippet = {
  readonly snippetVersionId: SnippetVersionId;
  readonly role: CompositionRole;
  readonly sequence: number; // The order of the snippet within its role.
};

export type CompositionVersion = {
  readonly id: CompositionVersionId;
  readonly snippets: readonly CompositionSnippet[];
  readonly createdAt: Date;
  readonly commit_message: string;
};

/**
 * The parent container for a single execution of a test suite.
 */
export type TestRun = {
  readonly id: TestRunId;
  readonly name: string;
  readonly createdAt: Date;
  readonly llm_provider: string;
  readonly llm_model: string;
  readonly metadata: Record<string, unknown>; // A flexible JSON blob for user metadata.
};

/**
 * The result of a single LLM call within a `TestRun`.
 */
export type DataPoint = {
  readonly id: DataPointId;
  readonly final_prompt_text: string;
  readonly response_text: string;
  readonly metrics: Record<string, unknown>; // JSON blob for latency, token counts, etc.
};

/**
 * A simple label for organizing and querying entities.
 */
export type Tag = {
  readonly id: TagId;
  readonly name: Slug;
};

// --- Entity Constructors (Pure Functions) ---

export const createSnippet = (name: Slug, description: string): Snippet => ({
  id: generateSnippetId(),
  name,
  description
})

export const createSnippetVersion = (
  content: string,
  commit_message: string
): SnippetVersion => ({
  id: generateSnippetVersionId(),
  content,
  createdAt: new Date(),
  commit_message
})

export const createParameter = (name: Slug, description: string): Parameter => ({
  id: generateParameterId(),
  name,
  description
})

export const createParameterOption = (
  value: string,
  commit_message: string
): ParameterOption => ({
  id: generateParameterOptionId(),
  value,
  createdAt: new Date(),
  commit_message
})

export const createComposition = (name: Slug, description: string): Composition => ({
  id: generateCompositionId(),
  name,
  description
})

export const createCompositionVersion = (
  snippets: readonly CompositionSnippet[],
  commit_message: string
): CompositionVersion => ({
  id: generateCompositionVersionId(),
  snippets,
  createdAt: new Date(),
  commit_message
})

export const createTestRun = (
  name: string,
  llm_provider: string,
  llm_model: string,
  metadata: Record<string, unknown> = {}
): TestRun => ({
  id: generateTestRunId(),
  name,
  createdAt: new Date(),
  llm_provider,
  llm_model,
  metadata
})

export const createDataPoint = (
  final_prompt_text: string,
  response_text: string,
  metrics: Record<string, unknown> = {}
): DataPoint => ({
  id: generateDataPointId(),
  final_prompt_text,
  response_text,
  metrics
})

export const createTag = (name: Slug): Tag => ({
  id: generateTagId(),
  name
})

