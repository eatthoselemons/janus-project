import { Schema } from 'effect';
import {
  Neo4jUri,
  Neo4jUser,
  ApiBaseUrl,
  LlmModel,
  ProviderName,
} from './database';

/**
 * Configuration schema for the Janus project
 * All sensitive fields (passwords, API keys) should be handled with Config.redacted
 * in the service implementation
 */

/**
 * Available storage backend types
 */
export type StorageBackend = 'neo4j' | 'git';

/**
 * Schema for storage backend selection
 */
export const StorageBackendSchema = Schema.Literal('neo4j', 'git');

// Neo4j configuration schema
export const Neo4jConfigSchema = Schema.Struct({
  uri: Neo4jUri,
  user: Neo4jUser,
  password: Schema.String, // Will be wrapped with Config.redacted in service
});

// LLM provider configuration schema
export const LlmProviderConfigSchema = Schema.Struct({
  apiKey: Schema.String, // Will be wrapped with Config.redacted in service
  baseUrl: ApiBaseUrl,
  model: LlmModel,
});

// Git storage configuration schema
export const GitConfigSchema = Schema.Struct({
  dataPath: Schema.optional(Schema.String).pipe(
    Schema.withDefaults({
      constructor: () => './data',
      decoding: () => './data',
    }),
  ),
  mode: Schema.optional(Schema.Literal('lossless', 'lossy')).pipe(
    Schema.withDefaults({
      constructor: () => 'lossy' as const,
      decoding: () => 'lossy' as const,
    }),
  ),
});

// Main configuration schema
export const ConfigSchema = Schema.Struct({
  storageBackend: Schema.optional(StorageBackendSchema).pipe(
    Schema.withDefaults({
      constructor: () => 'neo4j' as const,
      decoding: () => 'neo4j' as const,
    }),
  ),
  neo4j: Neo4jConfigSchema,
  git: Schema.optional(GitConfigSchema),
  llm: Schema.Struct({
    providers: Schema.Record({
      key: ProviderName,
      value: LlmProviderConfigSchema,
    }),
  }),
});

// Extract types from schemas
export type Neo4jConfig = typeof Neo4jConfigSchema.Type;
export type GitConfig = typeof GitConfigSchema.Type;
export type LlmProviderConfig = typeof LlmProviderConfigSchema.Type;
export type ConfigSchema = typeof ConfigSchema.Type;
