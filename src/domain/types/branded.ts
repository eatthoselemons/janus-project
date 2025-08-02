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
 * Content Node ID - Identifies a unified content container
 */
export const ContentNodeId = makeIdType('ContentNodeId');
export type ContentNodeId = typeof ContentNodeId.Type;

/**
 * Content Node Version ID - Identifies a specific version of a content node
 */
export const ContentNodeVersionId = makeIdType('ContentNodeVersionId');
export type ContentNodeVersionId = typeof ContentNodeVersionId.Type;

/**
 * Test Case ID - Identifies a test case
 */
export const TestCaseId = makeIdType('TestCaseId');
export type TestCaseId = typeof TestCaseId.Type;

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
 * Union of all ID types in the system
 * Useful for error types and generic ID handling
 */
export const AnyId = Schema.Union(
  TestRunId,
  DataPointId,
  TagId,
  ContentNodeId,
  ContentNodeVersionId,
  TestCaseId,
);
export type AnyId = typeof AnyId.Type;
