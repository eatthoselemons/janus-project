import { describe, expect, it } from '@effect/vitest';
import { Effect, Chunk, ConfigProvider, Layer, Option } from 'effect';
import * as AiInput from '@effect/ai/AiInput';
import { AiLanguageModel } from '@effect/ai/AiLanguageModel';
import * as AiResponse from '@effect/ai/AiResponse';
import { LlmApi } from '../../services/llm-api';
import { ProviderRegistry } from '../../services/llm-api/ProviderRegistry.service';
import { LlmApiLive } from './LlmApi.layer';
import { ConfigServiceLive } from '../configuration/Configuration.layer';
import { LlmApiError } from '../../domain/types/errors';
import type { Message } from '../../domain/types/testCase';
import { getProviderFromModel, processConversation } from './LlmApi.layer';

describe('LlmApi', () => {
  describe('unit tests for exported functions', () => {
    describe('getProviderFromModel', () => {
      it('should correctly identify providers from model names', () => {
        const testCases = [
          { model: 'gpt-4', expected: 'openai' },
          { model: 'gpt-3.5-turbo', expected: 'openai' },
          { model: 'claude-3-opus', expected: 'anthropic' },
          { model: 'claude-4-sonnet', expected: 'anthropic' },
          { model: 'gemini-2.5-pro', expected: 'google' },
          { model: 'gemini-1.5-flash', expected: 'google' },
          { model: 'unknown-model', expected: 'unknown' },
          { model: 'llama-2', expected: 'unknown' },
        ];

        testCases.forEach(({ model, expected }) => {
          expect(getProviderFromModel(model)).toBe(expected);
        });
      });
    });

    describe('processConversation', () => {
      it('should extract system messages', () => {
        const conversation = Chunk.fromIterable<Message>([
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ]);

        const { system, messages } = processConversation(conversation);

        expect(system).toBe('You are helpful.');
        expect(messages).toHaveLength(1);
        expect(messages[0]).toBeInstanceOf(AiInput.UserMessage);
      });

      it('should combine multiple system messages', () => {
        const conversation = Chunk.fromIterable<Message>([
          { role: 'system', content: 'You are helpful.' },
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'Hello' },
        ]);

        const { system, messages } = processConversation(conversation);

        expect(system).toBe('You are helpful.\nBe concise.');
        expect(messages).toHaveLength(1);
      });

      it('should handle conversations without system messages', () => {
        const conversation = Chunk.fromIterable<Message>([
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ]);

        const { system, messages } = processConversation(conversation);

        expect(system).toBeUndefined();
        expect(messages).toHaveLength(2);
        expect(messages[0]).toBeInstanceOf(AiInput.UserMessage);
        expect(messages[1]).toBeInstanceOf(AiInput.AssistantMessage);
      });

      it('should convert message roles correctly', () => {
        const conversation = Chunk.fromIterable<Message>([
          { role: 'user', content: 'Question?' },
          { role: 'assistant', content: 'Answer.' },
          { role: 'user', content: 'Follow-up?' },
        ]);

        const { messages } = processConversation(conversation);

        expect(messages[0]).toBeInstanceOf(AiInput.UserMessage);
        expect(messages[1]).toBeInstanceOf(AiInput.AssistantMessage);
        expect(messages[2]).toBeInstanceOf(AiInput.UserMessage);
      });

      it('should handle empty conversations', () => {
        const conversation = Chunk.empty<Message>();

        const { system, messages } = processConversation(conversation);

        expect(system).toBeUndefined();
        expect(messages).toHaveLength(0);
      });

      it('should handle unknown roles as user messages', () => {
        const conversation = Chunk.fromIterable<Message>([
          { role: 'unknown' as any, content: 'Test message' },
        ]);

        const { messages } = processConversation(conversation);

        expect(messages).toHaveLength(1);
        expect(messages[0]).toBeInstanceOf(AiInput.UserMessage);
      });
    });
  });

  describe('LlmApi layer integration tests', () => {
    // Helper to create a mock registry with controllable behavior
    const createMockRegistry = (config: {
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

    // Helper to create a capturing mock for AiLanguageModel
    const createCapturingMock = (response?: string, error?: Error) => {
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

    it.effect('should process messages correctly and call AI model', () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      const { layer: openaiLayer, capturedCalls } =
        createCapturingMock('Test response');

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const conversation = Chunk.fromIterable<Message>([
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello!' },
        ]);

        const result = yield* llmApi.generate(conversation, 'gpt-4');

        // Verify the response
        expect(result).toBe('Test response');

        // Verify the AI model was called with correct parameters
        expect(capturedCalls).toHaveLength(1);
        const [call] = capturedCalls;
        expect(call.system).toBe('You are helpful.');
        expect(call.prompt).toHaveLength(1);
        expect(call.prompt[0]).toBeInstanceOf(AiInput.UserMessage);
        expect(call.prompt[0].parts[0].text).toBe('Hello!');
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(
          createMockRegistry({
            availableProviders: ['openai'],
            providerLayers: { openai: openaiLayer },
          }),
        ),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );
    });

    it.effect('should handle multi-turn conversations', () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      const { layer: anthropicLayer, capturedCalls } =
        createCapturingMock('Claude response');

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const conversation = Chunk.fromIterable<Message>([
          { role: 'user', content: 'What is 2+2?' },
          { role: 'assistant', content: 'The answer is 4.' },
          { role: 'user', content: 'Are you sure?' },
        ]);

        const result = yield* llmApi.generate(conversation, 'claude-3-opus');

        expect(result).toBe('Claude response');

        // Verify conversation was processed correctly
        expect(capturedCalls).toHaveLength(1);
        const [call] = capturedCalls;
        expect(call.system).toBeUndefined();
        expect(call.prompt).toHaveLength(3);
        expect(call.prompt[0]).toBeInstanceOf(AiInput.UserMessage);
        expect(call.prompt[0].parts[0].text).toBe('What is 2+2?');
        expect(call.prompt[1]).toBeInstanceOf(AiInput.AssistantMessage);
        expect(call.prompt[1].parts[0].text).toBe('The answer is 4.');
        expect(call.prompt[2]).toBeInstanceOf(AiInput.UserMessage);
        expect(call.prompt[2].parts[0].text).toBe('Are you sure?');
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(
          createMockRegistry({
            availableProviders: ['anthropic'],
            providerLayers: { anthropic: anthropicLayer },
          }),
        ),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );
    });

    it.effect('should handle empty response parts', () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      const { layer: googleLayer } = createCapturingMock('');

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const result = yield* llmApi.generate(
          Chunk.of<Message>({ role: 'user', content: 'test' }),
          'gemini-1.5-flash',
        );

        expect(result).toBe('');
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(
          createMockRegistry({
            availableProviders: ['google'],
            providerLayers: { google: googleLayer },
          }),
        ),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );
    });

    it.effect('should join multiple text parts in response', () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      const multiPartLayer = Layer.succeed(AiLanguageModel, {
        generateText: () =>
          Effect.succeed({
            parts: [
              new AiResponse.TextPart({ text: 'Part 1' }),
              new AiResponse.TextPart({ text: ' Part 2' }),
              new AiResponse.TextPart({ text: ' Part 3' }),
            ],
          }),
        generateObject: () => Effect.fail(new Error('Not implemented')),
        generateObjectArray: () => Effect.fail(new Error('Not implemented')),
      } as any);

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const result = yield* llmApi.generate(
          Chunk.of<Message>({ role: 'user', content: 'test' }),
          'gpt-4',
        );

        expect(result).toBe('Part 1 Part 2 Part 3');
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(
          createMockRegistry({
            availableProviders: ['openai'],
            providerLayers: { openai: multiPartLayer },
          }),
        ),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );
    });

    it.effect('should handle non-text parts in response', () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      const mixedPartsLayer = Layer.succeed(AiLanguageModel, {
        generateText: () =>
          Effect.succeed({
            parts: [
              new AiResponse.TextPart({ text: 'Text part' }),
              {
                _tag: 'ToolCallPart',
                toolCallId: '123',
                toolName: 'test',
              } as any,
              new AiResponse.TextPart({ text: ' Another text' }),
            ],
          }),
        generateObject: () => Effect.fail(new Error('Not implemented')),
        generateObjectArray: () => Effect.fail(new Error('Not implemented')),
      } as any);

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const result = yield* llmApi.generate(
          Chunk.of<Message>({ role: 'user', content: 'test' }),
          'gpt-4',
        );

        // Should only join text parts
        expect(result).toBe('Text part Another text');
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(
          createMockRegistry({
            availableProviders: ['openai'],
            providerLayers: { openai: mixedPartsLayer },
          }),
        ),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );
    });
  });

  describe('error handling', () => {
    const createMockRegistry = (config: {
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

    it.effect('should wrap provider errors in LlmApiError', () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      const errorLayer = Layer.succeed(AiLanguageModel, {
        generateText: () => Effect.fail(new Error('Rate limit exceeded')),
        generateObject: () => Effect.fail(new Error('Not implemented')),
        generateObjectArray: () => Effect.fail(new Error('Not implemented')),
      } as any);

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const exit = yield* Effect.exit(
          llmApi.generate(
            Chunk.of<Message>({ role: 'user', content: 'test' }),
            'gpt-4',
          ),
        );

        expect(exit._tag).toBe('Failure');
        if (exit._tag === 'Failure') {
          const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
          expect(error).toBeInstanceOf(LlmApiError);
          expect(error?.provider).toBe('openai');
          expect(error?.originalMessage).toContain('Rate limit exceeded');
        }
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(
          createMockRegistry({
            availableProviders: ['openai'],
            providerLayers: { openai: errorLayer },
          }),
        ),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );
    });

    it.effect('should handle errors with status codes', () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      const errorWithStatus = Object.assign(new Error('API Error'), {
        statusCode: 429,
      });

      const errorLayer = Layer.succeed(AiLanguageModel, {
        generateText: () => Effect.fail(errorWithStatus),
        generateObject: () => Effect.fail(new Error('Not implemented')),
        generateObjectArray: () => Effect.fail(new Error('Not implemented')),
      } as any);

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const exit = yield* Effect.exit(
          llmApi.generate(
            Chunk.of<Message>({ role: 'user', content: 'test' }),
            'gpt-4',
          ),
        );

        expect(exit._tag).toBe('Failure');
        if (exit._tag === 'Failure') {
          const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
          expect(error).toBeInstanceOf(LlmApiError);
          expect(error?.statusCode).toBe(429);
        }
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(
          createMockRegistry({
            availableProviders: ['openai'],
            providerLayers: { openai: errorLayer },
          }),
        ),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );
    });

    it.effect('should handle unknown models', () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const exit = yield* Effect.exit(
          llmApi.generate(
            Chunk.of<Message>({ role: 'user', content: 'test' }),
            'unknown-model-xyz',
          ),
        );

        expect(exit._tag).toBe('Failure');
        if (exit._tag === 'Failure') {
          const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
          expect(error).toBeInstanceOf(LlmApiError);
          expect(error?.provider).toBe('unknown');
          expect(error?.originalMessage).toContain('Unknown model');
        }
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(
          createMockRegistry({
            availableProviders: ['openai', 'anthropic'],
            providerLayers: {},
          }),
        ),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );
    });

    it.effect('should fail when provider not configured', () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const exit = yield* Effect.exit(
          llmApi.generate(
            Chunk.of<Message>({ role: 'user', content: 'test' }),
            'claude-3-opus', // Anthropic model but not configured
          ),
        );

        expect(exit._tag).toBe('Failure');
        if (exit._tag === 'Failure') {
          const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
          expect(error).toBeInstanceOf(LlmApiError);
          expect(error?.provider).toBe('anthropic');
          expect(error?.originalMessage).toContain('not configured');
          expect(error?.originalMessage).toContain(
            'Available providers: openai',
          );
        }
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(
          createMockRegistry({
            availableProviders: ['openai'],
            shouldFailFor: ['anthropic'],
          }),
        ),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );
    });

    it.effect('should handle non-Error objects in catch', () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      const stringErrorLayer = Layer.succeed(AiLanguageModel, {
        generateText: () => Effect.fail('String error message' as any),
        generateObject: () => Effect.fail(new Error('Not implemented')),
        generateObjectArray: () => Effect.fail(new Error('Not implemented')),
      } as any);

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const exit = yield* Effect.exit(
          llmApi.generate(
            Chunk.of<Message>({ role: 'user', content: 'test' }),
            'gpt-4',
          ),
        );

        expect(exit._tag).toBe('Failure');
        if (exit._tag === 'Failure') {
          const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
          expect(error).toBeInstanceOf(LlmApiError);
          expect(error?.originalMessage).toBe('String error message');
        }
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(
          createMockRegistry({
            availableProviders: ['openai'],
            providerLayers: { openai: stringErrorLayer },
          }),
        ),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );
    });
  });

  describe('provider registry integration', () => {
    it.effect(
      'should provide correct error message with available providers',
      () => {
        const mockConfig = {
          NEO4J_URI: 'bolt://localhost:7687',
          NEO4J_USER: 'neo4j',
          NEO4J_PASSWORD: 'password',
        };

        const mockRegistry = Layer.succeed(ProviderRegistry, {
          getAvailableProviders: () => ['openai', 'anthropic', 'google'],
          getProviderLayer: (name: string) => {
            // Only openai is configured
            return name === 'openai'
              ? Option.some(Layer.succeed(AiLanguageModel, {} as any))
              : Option.none();
          },
        });

        return Effect.gen(function* () {
          const llmApi = yield* LlmApi;

          // Try to use an unconfigured provider
          const exit = yield* Effect.exit(
            llmApi.generate(
              Chunk.of<Message>({ role: 'user', content: 'test' }),
              'claude-3-opus',
            ),
          );

          expect(exit._tag).toBe('Failure');
          if (exit._tag === 'Failure') {
            const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
            expect(error).toBeInstanceOf(LlmApiError);
            expect(error?.originalMessage).toContain('not configured');
            expect(error?.originalMessage).toContain(
              'Available providers: openai, anthropic, google',
            );
          }
        }).pipe(
          Effect.provide(LlmApiLive),
          Effect.provide(mockRegistry),
          Effect.provide(ConfigServiceLive),
          Effect.withConfigProvider(
            ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
          ),
        );
      },
    );
  });
});
