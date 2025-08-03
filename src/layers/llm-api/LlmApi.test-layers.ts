import { Effect, Layer, Chunk } from 'effect';
import { LlmApi, type LlmApiImpl } from '../../services/llm-api';
import { makeTestLayerFor } from '../../lib/test-utils';

/**
 * Creates a test layer with mock responses based on conversation and model
 *
 * @param mockData Map where keys are formatted as "conversation:model" and values are responses
 *
 * @example
 * ```ts
 * const mockData = new Map([
 *   ['Hello:gpt-4', 'Hi there! How can I help you?'],
 *   ['What is 2+2?:claude-3-opus', 'The answer is 4'],
 * ])
 * const testLayer = LlmApiTest(mockData)
 * ```
 */
export const LlmApiTest = (mockData: Map<string, string> = new Map()) =>
  Layer.succeed(
    LlmApi,
    LlmApi.of({
      generate: (conversation, model) =>
        Effect.gen(function* () {
          // Create a key from conversation content and model
          const conversationText = Chunk.toArray(conversation)
            .map((m) => m.content)
            .join(':');
          const key = `${conversationText}:${model}`;

          // Get mock response or generate a default one
          const response = mockData.get(key) || `Mock response for ${model}`;

          // Log for debugging
          yield* Effect.logDebug(`Mock LLM API: ${key} -> ${response}`);

          return response;
        }),
    }),
  );

/**
 * Creates a partial test layer with only the methods you need
 * Unimplemented methods will throw descriptive errors if called
 *
 * @example
 * ```ts
 * const testLayer = LlmApiTestPartial({
 *   generate: () => Effect.succeed("Fixed response")
 * })
 * ```
 */
export const LlmApiTestPartial = (impl: Partial<LlmApiImpl>) =>
  makeTestLayerFor(LlmApi)(impl);
