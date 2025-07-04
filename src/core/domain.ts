/**
 * This file contains the core domain models for the Janus Project.
 * These types are based on the specifications in `docs/domain-model.md`.
 */

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
 * An immutable snapshot of a composition, locking in specific `SnippetVersion`s
 * in a defined order and role.
 */
export type CompositionSnippet = {
  readonly snippetVersionId: SnippetVersionId;
  readonly role: "system" | "user_prompt" | "model_response";
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

