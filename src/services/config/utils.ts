import { Effect, Redacted, Schema } from 'effect';
import { ConfigService } from './index';
import { JanusError } from '../../domain/types/errors';
import { ProviderName } from '../../domain/types';

/**
 * Get a specific LLM provider configuration
 */
export const getLlmProvider = (providerName: string) =>
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const providerKey = Schema.decodeSync(ProviderName)(providerName);
    const provider = config.llm.providers[providerKey];

    if (!provider) {
      return yield* Effect.fail(
        new JanusError({
          message: `LLM provider '${providerName}' not configured. Available providers: ${Object.keys(config.llm.providers).join(', ') || 'none'}`,
        }),
      );
    }

    return provider;
  });

/**
 * Get all configured LLM provider names
 */
export const getConfiguredProviders = Effect.gen(function* () {
  const config = yield* ConfigService;
  return Object.keys(config.llm.providers);
});

/**
 * Check if a specific LLM provider is configured
 */
export const hasProvider = (providerName: string) =>
  Effect.gen(function* () {
    const config = yield* ConfigService;
    return providerName in config.llm.providers;
  });

/**
 * Get Neo4j connection string for display (password redacted)
 */
export const getNeo4jConnectionInfo = Effect.gen(function* () {
  const config = yield* ConfigService;
  return {
    uri: config.neo4j.uri,
    user: config.neo4j.user,
    password: '<redacted>',
  };
});

/**
 * Get the first available LLM provider, useful for default selection
 */
export const getDefaultLlmProvider = Effect.gen(function* () {
  const providers = yield* getConfiguredProviders;

  if (providers.length === 0) {
    return yield* Effect.fail(
      new JanusError({ message: 'No LLM providers configured' }),
    );
  }

  // Prefer certain providers as defaults
  const preferredOrder = ['openai', 'anthropic'];
  const defaultProvider =
    preferredOrder.find((p) => providers.includes(p)) ?? providers[0];

  return yield* getLlmProvider(defaultProvider);
});

/**
 * Extract sensitive values for internal use (be careful with this!)
 * Only use when you need to pass credentials to external libraries
 */
export const extractCredentials = Effect.gen(function* () {
  const config = yield* ConfigService;

  return {
    neo4j: {
      uri: config.neo4j.uri,
      user: config.neo4j.user,
      password: Redacted.value(config.neo4j.password),
    },
    llm: Object.entries(config.llm.providers).reduce(
      (acc, [name, provider]) => {
        acc[name] = {
          apiKey: Redacted.value(provider.apiKey),
          baseUrl: provider.baseUrl,
        };
        return acc;
      },
      {} as Record<string, { apiKey: string; baseUrl: string }>,
    ),
  };
});
