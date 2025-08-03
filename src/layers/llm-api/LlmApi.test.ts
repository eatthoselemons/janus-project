import { describe, expect, it } from '@effect/vitest';
import { Effect, Chunk, Redacted, ConfigProvider } from 'effect';
import { LlmApi } from '../../services/llm-api';
import { LlmApiLive } from './LlmApi.layer';
import { LlmApiTest, LlmApiTestPartial } from './LlmApi.test-layers';
import { ConfigServiceLive } from '../configuration/Configuration.layer';
import { LlmApiError } from '../../domain/types/errors';
import type { Message } from '../../domain/types/testCase';

describe('LlmApi', () => {
  describe('with test layer', () => {
    it.effect('should generate response for valid conversation', () => {
      const mockResponse = 'Hello! How can I help you?';
      const testData = new Map([['Hello:gpt-4', mockResponse]]);
      const testLayer = LlmApiTest(testData);

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const result = yield* llmApi.generate(
          Chunk.of<Message>({ role: 'user', content: 'Hello' }),
          'gpt-4',
        );
        expect(result).toBe(mockResponse);
      }).pipe(Effect.provide(testLayer));
    });

    it.effect('should generate default response when no mock data', () => {
      const testLayer = LlmApiTest();

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const result = yield* llmApi.generate(
          Chunk.of<Message>({ role: 'user', content: 'Hello' }),
          'gpt-4',
        );
        expect(result).toBe('Mock response for gpt-4');
      }).pipe(Effect.provide(testLayer));
    });

    it.effect('should handle multi-message conversations', () => {
      const mockResponse = 'The answer is 4';
      const testData = new Map([
        ['What is 2+2?:Can you explain?:claude-3', mockResponse],
      ]);
      const testLayer = LlmApiTest(testData);

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const conversation = Chunk.fromIterable([
          { role: 'user', content: 'What is 2+2?' },
          { role: 'assistant', content: 'Can you explain?' },
        ]);

        const result = yield* llmApi.generate(conversation, 'claude-3');
        expect(result).toBe(mockResponse);
      }).pipe(Effect.provide(testLayer));
    });
  });

  describe('with partial test layer', () => {
    it.effect('should handle provider errors', () => {
      const testLayer = LlmApiTestPartial({
        generate: () =>
          Effect.fail(
            new LlmApiError({
              provider: 'test',
              statusCode: 429,
              originalMessage: 'Rate limit exceeded',
            }),
          ),
      });

      return Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const exit = yield* Effect.exit(
          llmApi.generate(Chunk.empty(), 'test-model'),
        );
        expect(exit._tag).toBe('Failure');
        if (exit._tag === 'Failure') {
          const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
          expect(error).toBeInstanceOf(LlmApiError);
          expect(error?.provider).toBe('test');
          expect(error?.statusCode).toBe(429);
        }
      }).pipe(Effect.provide(testLayer));
    });
  });

  describe('with live layer', () => {
    // Create a test config with minimal providers
    const mockConfig = {
      NEO4J_URI: 'bolt://localhost:7687',
      NEO4J_USER: 'neo4j',
      NEO4J_PASSWORD: 'password',
      LLM_PROVIDERS: 'openai',
      LLM_OPENAI_API_KEY: 'sk-test',
      LLM_OPENAI_BASE_URL: 'https://api.openai.com/v1',
    };

    const testConfigProvider = ConfigProvider.fromMap(
      new Map(Object.entries(mockConfig)),
    );

    it.effect('should handle unknown models', () =>
      Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const exit = yield* Effect.exit(
          llmApi.generate(
            Chunk.of<Message>({ role: 'user', content: 'test' }),
            'unknown-model',
          ),
        );
        expect(exit._tag).toBe('Failure');
        if (exit._tag === 'Failure') {
          const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
          expect(error).toBeInstanceOf(LlmApiError);
          expect(error?.originalMessage).toContain('Unknown model');
        }
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(testConfigProvider),
      ),
    );

    it.effect('should fail when provider not configured', () =>
      Effect.gen(function* () {
        // Only openai is configured in test
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
          expect(error?.originalMessage).toContain('not configured');
          expect(error?.originalMessage).toContain(
            'Available providers: openai',
          );
        }
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(testConfigProvider),
      ),
    );

    it.effect('should correctly identify provider from model name', () =>
      Effect.gen(function* () {
        const testData = [
          { model: 'gpt-4', expectedProvider: 'openai' },
          { model: 'gpt-3.5-turbo', expectedProvider: 'openai' },
          { model: 'claude-3-opus', expectedProvider: 'anthropic' },
          { model: 'claude-3-sonnet', expectedProvider: 'anthropic' },
          { model: 'gemini-pro', expectedProvider: 'google' },
          { model: 'gemini-1.5-flash', expectedProvider: 'google' },
        ];

        for (const { model, expectedProvider } of testData) {
          const llmApi = yield* LlmApi;
          const exit = yield* Effect.exit(
            llmApi.generate(
              Chunk.of<Message>({ role: 'user', content: 'test' }),
              model,
            ),
          );
          expect(exit._tag).toBe('Failure');
          if (exit._tag === 'Failure') {
            const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
            expect(error?.provider).toBe(expectedProvider);
          }
        }
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(testConfigProvider),
      ),
    );
  });
});
