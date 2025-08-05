import { Effect, Layer, Chunk, pipe, Match, Option } from 'effect';
import * as AiInput from '@effect/ai/AiInput';
import * as AiResponse from '@effect/ai/AiResponse';
import { AiLanguageModel } from '@effect/ai/AiLanguageModel';
import { LlmApi } from '../../services/llm-api';
import { ProviderRegistry } from '../../services/llm-api/ProviderRegistry.service';
import { LlmApiError } from '../../domain/types/errors';
import { Conversation } from '../../domain/types/testCase';

/**
 * Determines the provider name from the model string
 */
export const getProviderFromModel = (model: string): string =>
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
export const processConversation = (
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
 * Creates the LLM API service using the provider registry
 * This follows the proper Effect pattern where dependencies are yielded
 */
const make = Effect.gen(function* () {
  const registry = yield* ProviderRegistry;

  // Log available providers for debugging
  const availableProviders = registry.getAvailableProviders();
  yield* Effect.logInfo(
    `Available LLM providers: ${availableProviders.join(', ')}`,
  );

  const generate = (conversation: Conversation, model: string) =>
    Effect.gen(function* () {
      // Determine provider from model name
      const providerName = getProviderFromModel(model);

      // Get provider layer from registry
      const providerLayerOption = registry.getProviderLayer(
        providerName,
        model,
      );

      if (Option.isNone(providerLayerOption)) {
        return yield* Effect.fail(
          new LlmApiError({
            provider: providerName,
            originalMessage:
              providerName === 'unknown'
                ? `Unknown model: ${model}`
                : `Provider ${providerName} is not configured. Available providers: ${availableProviders.join(', ')}`,
          }),
        );
      }

      const providerLayer = providerLayerOption.value;

      // Process conversation to extract system message and convert messages
      const { system, messages } = processConversation(conversation);

      // Create an effect that uses AiLanguageModel and provide the layer
      const response = yield* pipe(
        Effect.gen(function* () {
          const aiModel = yield* AiLanguageModel;
          return yield* aiModel.generateText({
            prompt: messages,
            system,
          });
        }),
        Effect.provide(providerLayer),
        Effect.scoped,
        Effect.mapError(
          (error): LlmApiError =>
            new LlmApiError({
              provider: providerName,
              originalMessage:
                error instanceof Error ? error.message : String(error),
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

  return { generate };
});

/**
 * LLM API layer that uses the ProviderRegistry for dynamic provider selection
 * This follows the proper Effect pattern while supporting runtime provider selection
 */
export const LlmApiLive = Layer.effect(LlmApi, make);
