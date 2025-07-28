import { describe, it, expect } from '@effect/vitest';
import { Effect, ConfigProvider, Layer, Schema, Redacted } from 'effect';
import {
  HttpClient,
  HttpClientResponse,
  HttpClientRequest,
} from '@effect/platform';
import { LlmApiService } from '../../services/llm-api';
import { LlmApiLayerService } from './LlmApi.layer';
import { ConfigService } from '../../services/config';
import { SystemPrompt, UserPrompt } from '../../domain/types/branded';
import { LlmModel } from '../../domain/types/database';

describe('LlmApiLive', () => {
  it.effect('should make correct OpenAI API request', () =>
    Effect.gen(function* () {
      const mockConfig = new Map([
        ['NEO4J_URI', 'bolt://localhost:7687'],
        ['NEO4J_USER', 'neo4j'],
        ['NEO4J_PASSWORD', 'test'],
        ['LLM_PROVIDERS', 'openai'],
        ['LLM_OPENAI_API_KEY', 'test-key'],
        ['LLM_OPENAI_BASE_URL', 'https://api.openai.com/v1'],
        ['LLM_OPENAI_MODEL', 'gpt-4'],
      ]);

      // Mock HTTP client that captures requests
      const capturedRequests: HttpClientRequest.HttpClientRequest[] = [];
      const mockHttpClient = HttpClient.HttpClient.of({
        execute: (request) => {
          capturedRequests.push(request);
          return Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              new Response(
                JSON.stringify({
                  choices: [{ message: { content: 'Test response' } }],
                }),
                { status: 200 },
              ),
            ),
          );
        },
      });

      // Create mock config service
      const mockConfigService = ConfigService.of({
        neo4j: {
          uri: 'bolt://localhost:7687' as any,
          user: 'neo4j' as any,
          password: Redacted.make('test'),
        },
        llm: {
          providers: {
            openai: {
              apiKey: Redacted.make('test-key'),
              baseUrl: 'https://api.openai.com/v1' as any,
              model: 'gpt-4' as any,
            },
          },
        },
      });

      const llmApi = yield* LlmApiService.pipe(
        Effect.provide(LlmApiLayerService),
        Effect.provide(Layer.succeed(ConfigService, mockConfigService)),
        Effect.provide(Layer.succeed(HttpClient.HttpClient, mockHttpClient)),
        Effect.withConfigProvider(ConfigProvider.fromMap(mockConfig)),
      );

      const systemPrompt = yield* Schema.decode(SystemPrompt)('Be helpful');
      const userPrompt = yield* Schema.decode(UserPrompt)('Hello');
      const model = yield* Schema.decode(LlmModel)('gpt-4');

      const result = yield* llmApi.generate(systemPrompt, userPrompt, model);

      expect(result).toBe('Test response');
      expect(capturedRequests).toHaveLength(1);
      expect(capturedRequests[0].url).toContain('api.openai.com');
      expect(capturedRequests[0].headers['authorization']).toContain('Bearer');
    }),
  );

  it.effect('should make correct Anthropic API request', () =>
    Effect.gen(function* () {
      // Mock HTTP client that captures requests
      const capturedRequests: HttpClientRequest.HttpClientRequest[] = [];
      const mockHttpClient = HttpClient.HttpClient.of({
        execute: (request) => {
          capturedRequests.push(request);
          return Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              new Response(
                JSON.stringify({
                  content: [{ text: 'Anthropic response' }],
                }),
                { status: 200 },
              ),
            ),
          );
        },
      });

      // Create mock config service
      const mockConfigService = ConfigService.of({
        neo4j: {
          uri: 'bolt://localhost:7687' as any,
          user: 'neo4j' as any,
          password: Redacted.make('test'),
        },
        llm: {
          providers: {
            anthropic: {
              apiKey: Redacted.make('test-anthropic-key'),
              baseUrl: 'https://api.anthropic.com/v1' as any,
              model: 'claude-3-opus' as any,
            },
          },
        },
      });

      const llmApi = yield* LlmApiService.pipe(
        Effect.provide(LlmApiLayerService),
        Effect.provide(Layer.succeed(ConfigService, mockConfigService)),
        Effect.provide(Layer.succeed(HttpClient.HttpClient, mockHttpClient)),
      );

      const systemPrompt = yield* Schema.decode(SystemPrompt)('Be creative');
      const userPrompt = yield* Schema.decode(UserPrompt)('Write a story');
      const model = yield* Schema.decode(LlmModel)('claude-3-opus');

      const result = yield* llmApi.generate(systemPrompt, userPrompt, model);

      expect(result).toBe('Anthropic response');
      expect(capturedRequests).toHaveLength(1);
      expect(capturedRequests[0].url).toContain('api.anthropic.com');
      expect(capturedRequests[0].headers['x-api-key']).toBeDefined();
      expect(capturedRequests[0].headers['anthropic-version']).toBe(
        '2023-06-01',
      );
    }),
  );

  it.effect('should handle HTTP errors correctly', () =>
    Effect.gen(function* () {
      // Mock HTTP client that returns errors
      const mockHttpClient = HttpClient.HttpClient.of({
        execute: () =>
          Effect.fail(
            new Error('Network error') as any, // Type assertion for simplicity
          ),
      });

      const mockConfigService = ConfigService.of({
        neo4j: {
          uri: 'bolt://localhost:7687' as any,
          user: 'neo4j' as any,
          password: Redacted.make('test'),
        },
        llm: {
          providers: {
            openai: {
              apiKey: Redacted.make('test-key'),
              baseUrl: 'https://api.openai.com/v1' as any,
              model: 'gpt-4' as any,
            },
          },
        },
      });

      const llmApi = yield* LlmApiService.pipe(
        Effect.provide(LlmApiLayerService),
        Effect.provide(Layer.succeed(ConfigService, mockConfigService)),
        Effect.provide(Layer.succeed(HttpClient.HttpClient, mockHttpClient)),
      );

      const systemPrompt = yield* Schema.decode(SystemPrompt)('Test');
      const userPrompt = yield* Schema.decode(UserPrompt)('Test');
      const model = yield* Schema.decode(LlmModel)('gpt-4');

      const exit = yield* Effect.exit(
        llmApi.generate(systemPrompt, userPrompt, model),
      );

      expect(exit._tag).toBe('Failure');
    }),
  );

  it.effect('should handle non-200 status codes', () =>
    Effect.gen(function* () {
      // Mock HTTP client that returns 401
      const mockHttpClient = HttpClient.HttpClient.of({
        execute: (request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
              }),
            ),
          ),
      });

      const mockConfigService = ConfigService.of({
        neo4j: {
          uri: 'bolt://localhost:7687' as any,
          user: 'neo4j' as any,
          password: Redacted.make('test'),
        },
        llm: {
          providers: {
            openai: {
              apiKey: Redacted.make('invalid-key'),
              baseUrl: 'https://api.openai.com/v1' as any,
              model: 'gpt-4' as any,
            },
          },
        },
      });

      const llmApi = yield* LlmApiService.pipe(
        Effect.provide(LlmApiLayerService),
        Effect.provide(Layer.succeed(ConfigService, mockConfigService)),
        Effect.provide(Layer.succeed(HttpClient.HttpClient, mockHttpClient)),
      );

      const systemPrompt = yield* Schema.decode(SystemPrompt)('Test');
      const userPrompt = yield* Schema.decode(UserPrompt)('Test');
      const model = yield* Schema.decode(LlmModel)('gpt-4');

      const exit = yield* Effect.exit(
        llmApi.generate(systemPrompt, userPrompt, model),
      );

      expect(exit._tag).toBe('Failure');
      if (exit._tag === 'Failure') {
        const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
        expect(error?.statusCode).toBe(401);
      }
    }),
  );

  it.effect('should fail for unknown model prefix', () =>
    Effect.gen(function* () {
      const mockConfigService = ConfigService.of({
        neo4j: {
          uri: 'bolt://localhost:7687' as any,
          user: 'neo4j' as any,
          password: Redacted.make('test'),
        },
        llm: {
          providers: {},
        },
      });

      const llmApi = yield* LlmApiService.pipe(
        Effect.provide(LlmApiLayerService),
        Effect.provide(Layer.succeed(ConfigService, mockConfigService)),
        Effect.provide(Layer.succeed(HttpClient.HttpClient, {} as any)),
      );

      const systemPrompt = yield* Schema.decode(SystemPrompt)('Test');
      const userPrompt = yield* Schema.decode(UserPrompt)('Test');
      const model = yield* Schema.decode(LlmModel)('unknown-model');

      const exit = yield* Effect.exit(
        llmApi.generate(systemPrompt, userPrompt, model),
      );

      expect(exit._tag).toBe('Failure');
      if (exit._tag === 'Failure') {
        const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
        expect(error?.originalMessage).toContain('Unknown model');
      }
    }),
  );

  it.effect('should fail when provider not configured', () =>
    Effect.gen(function* () {
      const mockConfigService = ConfigService.of({
        neo4j: {
          uri: 'bolt://localhost:7687' as any,
          user: 'neo4j' as any,
          password: Redacted.make('test'),
        },
        llm: {
          providers: {}, // No providers configured
        },
      });

      const llmApi = yield* LlmApiService.pipe(
        Effect.provide(LlmApiLayerService),
        Effect.provide(Layer.succeed(ConfigService, mockConfigService)),
        Effect.provide(Layer.succeed(HttpClient.HttpClient, {} as any)),
      );

      const systemPrompt = yield* Schema.decode(SystemPrompt)('Test');
      const userPrompt = yield* Schema.decode(UserPrompt)('Test');
      const model = yield* Schema.decode(LlmModel)('gpt-4');

      const exit = yield* Effect.exit(
        llmApi.generate(systemPrompt, userPrompt, model),
      );

      expect(exit._tag).toBe('Failure');
      if (exit._tag === 'Failure') {
        const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
        expect(error?.originalMessage).toContain('not configured');
      }
    }),
  );
});
