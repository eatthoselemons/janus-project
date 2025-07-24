import { Effect, Layer, Config, Redacted, Schema } from 'effect';
import { ConfigService } from '../../services/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  Neo4jUri,
  Neo4jUser,
  ProviderName,
  ApiBaseUrl,
  LlmModel,
} from '../../domain/types';

// Helper function to load a provider configuration
const loadProviderConfig = (providerName: string) =>
  Effect.gen(function* () {
    const prefix = `LLM_${providerName.toUpperCase()}`;

    // Check if the provider is configured by looking for the API key
    const maybeApiKey = yield* Config.option(
      Config.redacted(`${prefix}_API_KEY`),
    );

    // If no API key, provider is not configured (not an error)
    if (maybeApiKey._tag === 'None') {
      return null;
    }

    // If API key exists, the other fields are required
    // These will fail with ConfigError if missing, which is what we want
    const baseUrlStr = yield* Config.string(`${prefix}_BASE_URL`);
    const modelStr = yield* Config.string(`${prefix}_MODEL`);

    // Validate and convert to branded types
    const baseUrl = yield* Schema.decode(ApiBaseUrl)(baseUrlStr);
    const model = yield* Schema.decode(LlmModel)(modelStr);

    return {
      apiKey: maybeApiKey.value,
      baseUrl,
      model,
    };
  });

// Read providers from configuration file
const readProvidersFromFile = Effect.sync(() => {
  const configPath = path.join(process.cwd(), 'config', 'llm-providers.txt');

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const providers = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')) // Remove empty lines and comments
      .map((p) => p.toLowerCase());

    return providers;
  } catch {
    // If file doesn't exist or can't be read, return empty array
    return [];
  }
});

// Get configured providers from config file or environment variable
const getConfiguredProviders = Effect.gen(function* () {
  // Option 1: Check environment variable first (for override)
  const envProviders = yield* Config.string('LLM_PROVIDERS').pipe(
    Config.withDefault(''),
  );

  if (envProviders !== '') {
    // Environment variable takes precedence
    return envProviders
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p !== '');
  }

  // Option 2: Read from configuration file
  const fileProviders = yield* readProvidersFromFile;

  return fileProviders;
});

// Implementation using Effect Config module
const configProgram = Effect.gen(function* () {
  // Neo4j configuration
  const neo4jUriStr = yield* Config.string('NEO4J_URI');
  const neo4jUserStr = yield* Config.string('NEO4J_USER');
  const neo4jPassword = yield* Config.redacted('NEO4J_PASSWORD');

  // Validate and convert to branded types
  const neo4jUri = yield* Schema.decode(Neo4jUri)(neo4jUriStr);
  const neo4jUser = yield* Schema.decode(Neo4jUser)(neo4jUserStr);

  // Get configured LLM providers
  const providerNames = yield* getConfiguredProviders;

  // Load all provider configurations
  const providerConfigs = yield* Effect.all(
    providerNames.map((name) =>
      loadProviderConfig(name).pipe(Effect.map((config) => ({ name, config }))),
    ),
    { concurrency: 'unbounded' },
  );

  // Build the providers object, filtering out null configs
  type ProviderConfig = {
    apiKey: Redacted.Redacted<string>;
    baseUrl: ApiBaseUrl;
    model: LlmModel;
  };
  const providers: Record<ProviderName, ProviderConfig> = {};

  for (const { name, config } of providerConfigs) {
    if (config !== null) {
      const providerName = yield* Schema.decode(ProviderName)(name);
      providers[providerName] = config;
    }
  }

  return {
    neo4j: {
      uri: neo4jUri,
      user: neo4jUser,
      password: neo4jPassword,
    },
    llm: {
      providers,
    },
  };
});

// Create the live layer
export const ConfigServiceLive = Layer.effect(ConfigService, configProgram);

/**
 * Alias for ConfigServiceLive for consistency with other services
 */
export const fromEnv = ConfigServiceLive;
