import { Schema } from 'effect';

/**
 * UUID v4 pattern for validating string UUIDs
 * Matches format: 8-4-4-4-12 hexadecimal characters
 */
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Factory function to create branded UUID types
 * @param brand - The brand name for the ID type
 * @returns A branded string schema that validates UUID format
 */
const makeIdType = <B extends string>(brand: B) =>
  Schema.String.pipe(
    Schema.pattern(uuidPattern, {
      message: () => `Invalid UUID format for ${brand}`,
    }),
    Schema.brand(brand),
  );

/**
 * Snippet ID - Identifies a snippet container
 */
export const SnippetId = makeIdType('SnippetId');
export type SnippetId = typeof SnippetId.Type;

/**
 * Snippet Version ID - Identifies a specific version of a snippet
 */
export const SnippetVersionId = makeIdType('SnippetVersionId');
export type SnippetVersionId = typeof SnippetVersionId.Type;

/**
 * Parameter ID - Identifies a parameter definition
 */
export const ParameterId = makeIdType('ParameterId');
export type ParameterId = typeof ParameterId.Type;

/**
 * Parameter Option ID - Identifies a specific value for a parameter
 */
export const ParameterOptionId = makeIdType('ParameterOptionId');
export type ParameterOptionId = typeof ParameterOptionId.Type;

/**
 * Composition ID - Identifies a composition container
 */
export const CompositionId = makeIdType('CompositionId');
export type CompositionId = typeof CompositionId.Type;

/**
 * Composition Version ID - Identifies a specific version of a composition
 */
export const CompositionVersionId = makeIdType('CompositionVersionId');
export type CompositionVersionId = typeof CompositionVersionId.Type;

/**
 * Test Run ID - Identifies a test execution
 */
export const TestRunId = makeIdType('TestRunId');
export type TestRunId = typeof TestRunId.Type;

/**
 * Data Point ID - Identifies a single test result
 */
export const DataPointId = makeIdType('DataPointId');
export type DataPointId = typeof DataPointId.Type;

/**
 * Tag ID - Identifies a tag for categorization
 */
export const TagId = makeIdType('TagId');
export type TagId = typeof TagId.Type;

/**
 * Slug - URL and command-line friendly string
 * Format: lowercase letters, numbers, and hyphens only
 * Must start and end with alphanumeric characters
 */
export const Slug = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: () =>
      "Slug must be lowercase letters, numbers, and hyphens only (e.g., 'my-snippet-name')",
  }),
  Schema.minLength(1),
  Schema.maxLength(100),
  Schema.brand('Slug'),
);
export type Slug = typeof Slug.Type;

/**
 * Relationship Strength - A value between 0 and 1 for Neo4j edge properties
 * Used to represent the strength or weight of relationships
 */
export const RelationshipStrength = Schema.Number.pipe(
  Schema.between(0, 1, {
    message: () => 'Relationship strength must be between 0 and 1',
  }),
  Schema.brand('RelationshipStrength'),
);
export type RelationshipStrength = typeof RelationshipStrength.Type;

/**
 * System Prompt - Defines the assistant's behavior
 * Non-empty string with maximum length constraint
 */
export const SystemPrompt = Schema.String.pipe(
  Schema.nonEmptyString({
    message: () => 'System prompt cannot be empty',
  }),
  Schema.maxLength(2000, {
    message: () => 'System prompt must be 2000 characters or less',
  }),
  Schema.brand('SystemPrompt'),
);
export type SystemPrompt = typeof SystemPrompt.Type;

/**
 * User Prompt - The actual query from the user
 * Non-empty string with higher maximum length than system prompt
 */
export const UserPrompt = Schema.String.pipe(
  Schema.nonEmptyString({
    message: () => 'User prompt cannot be empty',
  }),
  Schema.maxLength(10000, {
    message: () => 'User prompt must be 10000 characters or less',
  }),
  Schema.brand('UserPrompt'),
);
export type UserPrompt = typeof UserPrompt.Type;

/**
 * Union of all ID types in the system
 * Useful for error types and generic ID handling
 */
export const AnyId = Schema.Union(
  SnippetId,
  SnippetVersionId,
  ParameterId,
  ParameterOptionId,
  CompositionId,
  CompositionVersionId,
  TestRunId,
  DataPointId,
  TagId,
);
export type AnyId = typeof AnyId.Type;
