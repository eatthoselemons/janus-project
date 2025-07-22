import { Effect, Layer, Config, Redacted } from 'effect';
import { ConfigService } from '../../services/config';
import { makeTestLayerFor } from '../../lib/test-utils';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
    const baseUrl = yield* Config.string(`${prefix}_BASE_URL`);
    const model = yield* Config.string(`${prefix}_MODEL`);

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
  const neo4jUri = yield* Config.string('NEO4J_URI');
  const neo4jUser = yield* Config.string('NEO4J_USER');
  const neo4jPassword = yield* Config.redacted('NEO4J_PASSWORD');

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
  const providers = providerConfigs.reduce(
    (acc, { name, config }) => {
      if (config !== null) {
        acc[name] = config;
      }
      return acc;
    },
    {} as Record<
      string,
      {
        apiKey: Redacted.Redacted<string>;
        baseUrl: string;
        model: string;
      }
    >,
  );

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

/**
 * Test layer with mock configuration
 */
export const ConfigServiceTest = (
  config: {
    neo4j?: {
      uri?: string;
      user?: string;
      password?: string;
    };
    llm?: {
      providers?: Record<
        string,
        {
          apiKey: string;
          baseUrl: string;
          model: string;
        }
      >;
    };
  } = {},
) =>
  Layer.succeed(ConfigService, {
    neo4j: {
      uri: config.neo4j?.uri ?? 'bolt://localhost:7687',
      user: config.neo4j?.user ?? 'test-user',
      password: Redacted.make(config.neo4j?.password ?? 'test-password'),
    },
    llm: {
      providers: Object.entries(config.llm?.providers ?? {}).reduce(
        (acc, [name, provider]) => {
          acc[name] = {
            apiKey: Redacted.make(provider.apiKey),
            baseUrl: provider.baseUrl,
            model: provider.model,
          };
          return acc;
        },
        {} as Record<
          string,
          { apiKey: Redacted.Redacted<string>; baseUrl: string; model: string }
        >,
      ),
    },
  });

/**
 * Create a partial test layer using makeTestLayer pattern
 * Useful for tests that only need specific config values
 *
 * @example
 * ```ts
 * const layer = ConfigServiceTestPartial({
 *   neo4j: { uri: 'bolt://test:7687' }
 * });
 * ```
 */
export const ConfigServiceTestPartial = (
  impl: Partial<{
    neo4j: {
      uri: string;
      user: string;
      password: Redacted.Redacted<string>;
    };
    llm: {
      providers: Record<
        string,
        {
          apiKey: Redacted.Redacted<string>;
          baseUrl: string;
          model: string;
        }
      >;
    };
  }>,
) => {
  return makeTestLayerFor(ConfigService)(impl);
};
