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

// Main configuration schema
export const ConfigSchema = Schema.Struct({
  neo4j: Neo4jConfigSchema,
  llm: Schema.Struct({
    providers: Schema.Record({
      key: ProviderName,
      value: LlmProviderConfigSchema,
    }),
  }),
});

// Extract types from schemas
export type Neo4jConfig = typeof Neo4jConfigSchema.Type;
export type LlmProviderConfig = typeof LlmProviderConfigSchema.Type;
export type ConfigSchema = typeof ConfigSchema.Type;
