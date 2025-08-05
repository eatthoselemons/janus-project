import { Effect, Layer } from 'effect';
import { AiLanguageModel } from '@effect/ai/AiLanguageModel';
import * as AiResponse from '@effect/ai/AiResponse';
import type { AiLanguageModel as AiLanguageModelService } from '@effect/ai/AiLanguageModel';

/**
 * Test utilities for LlmApi layer
 *
 * These utilities are kept for potential future use in integration tests
 * or for other test files that might need to mock the entire LLM stack.
 *
 * The main LlmApi.test.ts file now uses more granular mocks at the
 * ProviderRegistry level for better test coverage.
 */

/**
 * Creates a simple mock AI language model for testing
 */
export const createMockAiLanguageModel = (
  config: {
    response?: string;
    error?: Error;
    onCall?: (params: any) => void;
  } = {},
): AiLanguageModelService =>
  ({
    generateText: (params: any) => {
      if (config.onCall) {
        config.onCall(params);
      }

      if (config.error) {
        return Effect.fail(config.error);
      }

      const text = config.response ?? 'Mock response';
      return Effect.succeed({
        parts: text ? [new AiResponse.TextPart({ text })] : [],
      });
    },
    generateObject: () => Effect.fail(new Error('Not implemented in test')),
    generateObjectArray: () =>
      Effect.fail(new Error('Not implemented in test')),
  }) as any;

/**
 * Creates a layer for a mock AI language model
 */
export const createMockAiLanguageModelLayer = (
  config: Parameters<typeof createMockAiLanguageModel>[0] = {},
): Layer.Layer<AiLanguageModel> =>
  Layer.succeed(AiLanguageModel, createMockAiLanguageModel(config) as any);
