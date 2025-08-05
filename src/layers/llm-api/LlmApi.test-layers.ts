import { Effect, Layer, Option } from 'effect';
import { AiLanguageModel } from '@effect/ai/AiLanguageModel';
import * as AiResponse from '@effect/ai/AiResponse';
import type { AiLanguageModel as AiLanguageModelService } from '@effect/ai/AiLanguageModel';
import { ProviderRegistry } from '../../services/llm-api/ProviderRegistry.service';

/**
 * Test utilities for LlmApi layer
 *
 * These utilities provide reusable mock implementations for testing
 * the LlmApi layer at different levels: ProviderRegistry mocks for
 * testing the layer logic, and AiLanguageModel mocks for lower-level testing.
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

/**
 * Helper to create a mock registry with controllable behavior
 */
export const createMockRegistry = (config: {
  availableProviders: string[];
  providerLayers?: Record<string, Layer.Layer<AiLanguageModel>>;
  shouldFailFor?: string[];
}) =>
  Layer.succeed(ProviderRegistry, {
    getAvailableProviders: () => config.availableProviders,
    getProviderLayer: (name: string, model: string) => {
      if (config.shouldFailFor?.includes(name)) {
        return Option.none();
      }
      const layer = config.providerLayers?.[name];
      return layer ? Option.some(layer) : Option.none();
    },
  });

/**
 * Helper to create a capturing mock for AiLanguageModel
 * Returns both the layer and an array to inspect captured calls
 */
export const createCapturingMock = (response?: string, error?: Error) => {
  const capturedCalls: any[] = [];

  const layer = Layer.succeed(AiLanguageModel, {
    generateText: (params: any) => {
      capturedCalls.push(params);
      if (error) {
        return Effect.fail(error);
      }
      const text = response ?? 'Mock response';
      return Effect.succeed({
        parts: text
          ? [new AiResponse.TextPart({ text })]
          : ([] as AiResponse.Part[]),
      });
    },
    generateObject: () => Effect.fail(new Error('Not implemented')),
    generateObjectArray: () => Effect.fail(new Error('Not implemented')),
  } as any);

  return { layer, capturedCalls };
};
