import { Effect, Layer, HashMap, Option, pipe, Redacted } from 'effect';
import { AiLanguageModel } from '@effect/ai/AiLanguageModel';
import * as OpenAi from '@effect/ai-openai/OpenAiLanguageModel';
import * as OpenAiClient from '@effect/ai-openai/OpenAiClient';
import * as Anthropic from '@effect/ai-anthropic/AnthropicLanguageModel';
import * as AnthropicClient from '@effect/ai-anthropic/AnthropicClient';
import * as Google from '@effect/ai-google/GoogleAiLanguageModel';
import * as GoogleClient from '@effect/ai-google/GoogleAiClient';
import * as NodeHttpClient from '@effect/platform-node/NodeHttpClient';
import { ConfigService } from '../../services/config';
import { ProviderRegistry } from '../../services/llm-api/ProviderRegistry.service';

/**
 * Creates an OpenAI language model layer
 */
const createOpenAiLayer = (
  apiKey: string,
  model: string,
): Layer.Layer<AiLanguageModel> =>
  pipe(
    OpenAi.layer({ model }),
    Layer.provide(OpenAiClient.layer({ apiKey: Redacted.make(apiKey) })),
    Layer.provide(NodeHttpClient.layer),
  );

/**
 * Creates an Anthropic language model layer
 */
const createAnthropicLayer = (
  apiKey: string,
  model: string,
): Layer.Layer<AiLanguageModel> =>
  pipe(
    Anthropic.layer({ model }),
    Layer.provide(AnthropicClient.layer({ apiKey: Redacted.make(apiKey) })),
    Layer.provide(NodeHttpClient.layer),
  );

/**
 * Creates a Google language model layer
 */
const createGoogleLayer = (
  apiKey: string,
  model: string,
): Layer.Layer<AiLanguageModel> =>
  pipe(
    Google.layer({ model }),
    Layer.provide(GoogleClient.layer({ apiKey: Redacted.make(apiKey) })),
    Layer.provide(NodeHttpClient.layer),
  );

/**
 * Creates the provider registry from configuration
 */
const make = Effect.gen(function* () {
  const config = yield* ConfigService;

  // Build a map of provider factories
  // We store functions that create layers so we can create them with the correct model
  const providerFactories = new Map<
    string,
    (model: string) => Layer.Layer<AiLanguageModel>
  >();

  // Add configured providers
  const providerEntries = Object.entries(config.llm.providers);

  for (const [providerName, providerConfig] of providerEntries) {
    const apiKey = Redacted.value(providerConfig.apiKey);

    if (providerName === 'openai') {
      providerFactories.set('openai', (model) =>
        createOpenAiLayer(apiKey, model),
      );
    } else if (providerName === 'anthropic') {
      providerFactories.set('anthropic', (model) =>
        createAnthropicLayer(apiKey, model),
      );
    } else if (providerName === 'google') {
      providerFactories.set('google', (model) =>
        createGoogleLayer(apiKey, model),
      );
    }
  }

  // Log available providers
  const availableProviders = Array.from(providerFactories.keys());
  yield* Effect.logInfo(
    `Initialized provider registry with: ${availableProviders.join(', ')}`,
  );

  return {
    getProviderLayer: (name: string, model: string) => {
      const factory = providerFactories.get(name);
      if (!factory) {
        return Option.none();
      }

      return Option.some(factory(model));
    },
    getAvailableProviders: () => availableProviders,
  };
});

/**
 * Live implementation of ProviderRegistry
 * Creates provider layers from configuration
 */
export const ProviderRegistryLive = Layer.effect(ProviderRegistry, make);

/**
 * Test implementation of ProviderRegistry
 * Allows injecting mock provider layers for testing
 */
export const ProviderRegistryTest = (
  providerLayers: Record<string, Layer.Layer<AiLanguageModel>>,
) =>
  Layer.succeed(ProviderRegistry, {
    getProviderLayer: (name: string, model: string) =>
      Option.fromNullable(providerLayers[name]),
    getAvailableProviders: () => Object.keys(providerLayers),
  });
