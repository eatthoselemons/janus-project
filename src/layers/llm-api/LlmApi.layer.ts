import { Effect, Layer, Chunk, Redacted, pipe, Match } from 'effect';
import * as AiLanguageModel from '@effect/ai/AiLanguageModel';
import * as AiInput from '@effect/ai/AiInput';
import * as AiResponse from '@effect/ai/AiResponse';
import * as OpenAi from '@effect/ai-openai/OpenAiLanguageModel';
import * as OpenAiClient from '@effect/ai-openai/OpenAiClient';
import * as Anthropic from '@effect/ai-anthropic/AnthropicLanguageModel';
import * as AnthropicClient from '@effect/ai-anthropic/AnthropicClient';
import * as Google from '@effect/ai-google/GoogleAiLanguageModel';
import * as GoogleClient from '@effect/ai-google/GoogleAiClient';
import { NodeHttpClient } from '@effect/platform-node';
import { ConfigService } from '../../services/config';
import { LlmApi, type LlmApiImpl } from '../../services/llm-api';
import { LlmApiError } from '../../domain/types/errors';
import { Conversation } from '../../domain/types/testCase';

/**
 * Determines the provider name from the model string
 */
const getProviderFromModel = (model: string): string =>
  pipe(
    Match.value(model),
    Match.when(
      (m) => m.startsWith('gpt'),
      () => 'openai',
    ),
    Match.when(
      (m) => m.startsWith('claude'),
      () => 'anthropic',
    ),
    Match.when(
      (m) => m.startsWith('gemini'),
      () => 'google',
    ),
    Match.orElse(() => 'unknown'),
  );

/**
 * Extracts system messages and converts remaining messages to AI package format
 */
const processConversation = (
  conversation: Conversation,
): {
  system: string | undefined;
  messages: AiInput.Raw;
} => {
  const messages = Chunk.toArray(conversation);

  // Extract system messages and combine them
  const systemMessages = messages
    .filter((msg) => msg.role === 'system')
    .map((msg) => msg.content);

  const system =
    systemMessages.length > 0 ? systemMessages.join('\n') : undefined;

  // Convert non-system messages
  const conversationMessages = messages
    .filter((msg) => msg.role !== 'system')
    .map((msg) =>
      pipe(
        Match.value(msg.role),
        Match.when(
          'user',
          () =>
            new AiInput.UserMessage({
              parts: [new AiInput.TextPart({ text: msg.content })],
            }),
        ),
        Match.when(
          'assistant',
          () =>
            new AiInput.AssistantMessage({
              parts: [new AiInput.TextPart({ text: msg.content })],
            }),
        ),
        Match.orElse(
          () =>
            new AiInput.UserMessage({
              parts: [new AiInput.TextPart({ text: msg.content })],
            }),
        ),
      ),
    );

  return { system, messages: conversationMessages };
};

/**
 * Creates a language model layer for a specific provider
 */
const createProviderLayer = (
  provider: string,
  apiKey: string,
  model: string,
): Layer.Layer<AiLanguageModel.AiLanguageModel, never, NodeHttpClient.HttpClient> => {
  const createClientAndLayer = <A, E, R>(
    clientLayer: Layer.Layer<A, E, never>,
    modelLayer: Layer.Layer<AiLanguageModel.AiLanguageModel, never, A>,
  ): Layer.Layer<AiLanguageModel.AiLanguageModel, E, R> => 
    pipe(modelLayer, Layer.provide(clientLayer));

  return pipe(
    Match.value(provider),
    Match.when('openai', () =>
      createClientAndLayer(
        OpenAiClient.layer({ apiKey: Redacted.make(apiKey) }),
        OpenAi.layer({ model }),
      ),
    ),
    Match.when('anthropic', () =>
      createClientAndLayer(
        AnthropicClient.layer({ apiKey: Redacted.make(apiKey) }),
        Anthropic.layer({ model }),
      ),
    ),
    Match.when('google', () =>
      createClientAndLayer(
        GoogleClient.layer({ apiKey: Redacted.make(apiKey) }),
        Google.layer({ model }),
      ),
    ),
    Match.orElse(() => {
      throw new Error(`Unsupported provider: ${provider}`);
    }),
  );
};

/**
 * Creates the LLM API service
 */
const make = Effect.gen(function* () {
  const config = yield* ConfigService;
  // Get list of actually configured providers
  const configuredProviders = Object.keys(config.llm.providers);

  // Log available providers for debugging
  yield* Effect.logInfo(
    `Available LLM providers: ${configuredProviders.join(', ')}`,
  );

  const generate = (conversation: Conversation, model: string) =>
    Effect.gen(function* () {
      // Determine provider from model name
      const providerName = getProviderFromModel(model);

      // Check if provider is configured
      if (!configuredProviders.includes(providerName)) {
        return yield* Effect.fail(
          new LlmApiError({
            provider: providerName,
            originalMessage:
              providerName === 'unknown'
                ? `Unknown model: ${model}`
                : `Provider ${providerName} is not configured. Available providers: ${configuredProviders.join(', ')}`,
          }),
        );
      }

      // Get provider configuration
      const providerConfig =
        config.llm.providers[providerName as keyof typeof config.llm.providers];
      const apiKey = Redacted.value(providerConfig.apiKey);
      const baseUrl = providerConfig.baseUrl;

      // Create provider-specific language model layer
      const languageModelLayer = yield* Effect.try({
        try: () => createProviderLayer(providerName, apiKey, model),
        catch: (error) =>
          new LlmApiError({
            provider: providerName,
            originalMessage:
              error instanceof Error ? error.message : String(error),
          }),
      });

      // Process conversation to extract system message and convert messages
      const { system, messages } = processConversation(conversation);

      // Generate text using the language model
      const response = yield* pipe(
        Effect.gen(function* () {
          const languageModel = yield* AiLanguageModel.AiLanguageModel;
          return yield* languageModel.generateText({
            prompt: messages,
            system,
          });
        }),
        Effect.provide(languageModelLayer),
        Effect.provide(NodeHttpClient.layer),
        Effect.scoped,
        Effect.mapError(
          (error): LlmApiError =>
            new LlmApiError({
              provider: providerName,
              originalMessage: error.message || String(error),
              statusCode:
                error && typeof error === 'object' && 'statusCode' in error
                  ? (error.statusCode as number)
                  : undefined,
            }),
        ),
      );

      // Extract text from response parts
      const textParts = response.parts.filter(
        (part): part is AiResponse.TextPart => part._tag === 'TextPart',
      );

      return textParts.map((part) => part.text).join('');
    }).pipe(Effect.withLogSpan(`generate:${model}`));

  return LlmApi.of({ generate });
});

export const LlmApiLive = Layer.effect(LlmApi, make);
