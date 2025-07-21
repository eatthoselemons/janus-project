import { Schema } from 'effect';

/**
 * Configuration schema for the Janus project
 * All sensitive fields (passwords, API keys) should be handled with Config.redacted
 * in the service implementation
 */

// Neo4j configuration schema
export const Neo4jConfigSchema = Schema.Struct({
  uri: Schema.String,
  user: Schema.String,
  password: Schema.String, // Will be wrapped with Config.redacted in service
});

// LLM provider configuration schema
export const LlmProviderConfigSchema = Schema.Struct({
  apiKey: Schema.String, // Will be wrapped with Config.redacted in service
  baseUrl: Schema.String,
  model: Schema.String,
});

// Main configuration schema
export const ConfigSchema = Schema.Struct({
  neo4j: Neo4jConfigSchema,
  llm: Schema.Struct({
    providers: Schema.Record({
      key: Schema.String,
      value: LlmProviderConfigSchema,
    }),
  }),
});

// Extract types from schemas
export type Neo4jConfig = typeof Neo4jConfigSchema.Type;
export type LlmProviderConfig = typeof LlmProviderConfigSchema.Type;
export type ConfigSchema = typeof ConfigSchema.Type;
