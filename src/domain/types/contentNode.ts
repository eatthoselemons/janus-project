import { Schema, Chunk, HashMap } from 'effect';
import { Slug, TagId, ContentNodeId, ContentNodeVersionId } from './branded';

// Re-export ContentNodeId and ContentNodeVersionId for convenience
export { ContentNodeId, ContentNodeVersionId };

// Individual role types - explicit and type-safe
export const SystemRole = Schema.Literal('system');
export type SystemRole = typeof SystemRole.Type;

export const UserRole = Schema.Literal('user');
export type UserRole = typeof UserRole.Type;

export const AssistantRole = Schema.Literal('assistant');
export type AssistantRole = typeof AssistantRole.Type;

// Composed role type
export const ContentRole = Schema.Union(SystemRole, UserRole, AssistantRole);
export type ContentRole = typeof ContentRole.Type;

// ContentNode - unified container type
export const ContentNode = Schema.Struct({
  id: ContentNodeId,
  name: Slug,
  description: Schema.String,
});
export type ContentNode = typeof ContentNode.Type;

// ContentNodeVersion - unified version type
export const ContentNodeVersion = Schema.Struct({
  id: ContentNodeVersionId,
  content: Schema.optional(Schema.String), // Optional - branches may not have content
  createdAt: Schema.DateTimeUtc,
  commitMessage: Schema.String, // Align with existing convention
});
export type ContentNodeVersion = typeof ContentNodeVersion.Type;

// Operation types for edges
export const InsertOperation = Schema.Literal('insert');
export type InsertOperation = typeof InsertOperation.Type;

export const ConcatenateOperation = Schema.Literal('concatenate');
export type ConcatenateOperation = typeof ConcatenateOperation.Type;

export const EdgeOperation = Schema.Union(
  InsertOperation,
  ConcatenateOperation,
);
export type EdgeOperation = typeof EdgeOperation.Type;

// Edge properties schema for type safety
export const IncludesEdgeProperties = Schema.Struct({
  operation: EdgeOperation,
  key: Schema.optional(Schema.String), // Only for insert operations
});
export type IncludesEdgeProperties = typeof IncludesEdgeProperties.Type;

// Insert parameter types to avoid primitive obsession
export const InsertKey = Schema.String.pipe(
  Schema.pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  Schema.brand('InsertKey'),
);
export type InsertKey = typeof InsertKey.Type;

export const InsertValue = Schema.String.pipe(
  Schema.brand('InsertValue'),
);
export type InsertValue = typeof InsertValue.Type;

// Using type alias instead of Schema for HashMap since it's used with HashMap functions
export type InsertHashMap = HashMap.HashMap<InsertKey, InsertValue>;

// Processing options for filtering
export const ProcessingOptions = Schema.Struct({
  includeTags: Schema.optional(Schema.Array(Schema.String)),
  excludeVersionIds: Schema.optional(Schema.Array(ContentNodeVersionId)),
});
export type ProcessingOptions = typeof ProcessingOptions.Type;

// Type-safe child node structure
export type ChildNode = {
  node: ContentNodeVersion;
  edge: IncludesEdgeProperties;
};
