import { describe, it, expect } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import { LlmApiService } from './index';
import { LlmApiLive } from '../../layers/llm-api';
import { ConfigServiceLive } from '../../layers/configuration';
import { ConfigService } from '../../services/config';
import { NodeHttpClient } from '@effect/platform-node';
import { SystemPrompt, UserPrompt } from '../../domain/types/branded';
import { LlmModel } from '../../domain/types/database';

// Skip unless explicitly running integration tests
const shouldRunIntegration =
  process.env.INTEGRATION_TEST === 'true' ||
  process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!shouldRunIntegration)('LlmApi Integration Tests', () => {
  it.effect(
    'should make real API call to Anthropic Claude',
    () =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        const llmApi = yield* LlmApiService;

        const systemPrompt = yield* Schema.decode(SystemPrompt)(
          'You are a helpful assistant. Respond in exactly one sentence.',
        );
        const userPrompt = yield* Schema.decode(UserPrompt)('What is 2+2?');
        // Use configured model from environment
        const model = config.llm.providers.anthropic?.model || 
                     (yield* Schema.decode(LlmModel)('claude-3-haiku-20240307'));

        const result = yield* llmApi.generate(systemPrompt, userPrompt, model);

        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);
        expect(result.toLowerCase()).toMatch(/four|4/);
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.provide(NodeHttpClient.layer),
      ),
    { timeout: 30000 }, // 30 second timeout for API calls
  );

  it.effect(
    'should make real API call to Google Gemini',
    () =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        const llmApi = yield* LlmApiService;

        const systemPrompt = yield* Schema.decode(SystemPrompt)(
          'You are a helpful assistant. Answer with just the color name.',
        );
        const userPrompt = yield* Schema.decode(UserPrompt)(
          'What color is the sky on a clear day?',
        );
        // Use configured model from environment
        const model = config.llm.providers.google?.model || 
                     (yield* Schema.decode(LlmModel)('gemini-1.5-flash'));

        const result = yield* llmApi.generate(systemPrompt, userPrompt, model);

        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);
        expect(result.toLowerCase()).toMatch(/blue/);
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.provide(NodeHttpClient.layer),
      ),
    { timeout: 30000 }, // 30 second timeout for API calls
  );

  it.effect(
    'should handle missing API key gracefully',
    () =>
      Effect.gen(function* () {
        // This test assumes the API key is not set or invalid
        const llmApi = yield* LlmApiService;

        const systemPrompt = yield* Schema.decode(SystemPrompt)('Test');
        const userPrompt = yield* Schema.decode(UserPrompt)('Test');
        const model = yield* Schema.decode(LlmModel)('gpt-4');

        const exit = yield* Effect.exit(
          llmApi.generate(systemPrompt, userPrompt, model),
        );

        // Should fail with an appropriate error
        expect(exit._tag).toBe('Failure');
        if (exit._tag === 'Failure') {
          const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
          // Should be an authentication error or provider not configured error
          expect(
            error?.statusCode === 401 ||
              error?.originalMessage.includes('not configured'),
          ).toBe(true);
        }
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.provide(NodeHttpClient.layer),
      ),
    { timeout: 10000 },
  );
});

/*
 * To run integration tests:
 *
 * 1. Copy .env.example to .env and fill in your API keys:
 *    cp .env.example .env
 *    # Edit .env with your actual API keys
 *
 * 2. Run tests:
 *    INTEGRATION_TEST=true pnpm test src/services/llm-api/LlmApi.integration.test.ts
 *
 * Or set environment variables manually:
 *    INTEGRATION_TEST=true \
 *    NEO4J_URI="bolt://localhost:7687" \
 *    NEO4J_USER="neo4j" \
 *    NEO4J_PASSWORD="test" \
 *    LLM_PROVIDERS="anthropic,google" \
 *    LLM_ANTHROPIC_API_KEY="your-key" \
 *    LLM_ANTHROPIC_BASE_URL="https://api.anthropic.com/v1" \
 *    LLM_ANTHROPIC_MODEL="claude-3-haiku-20240307" \
 *    LLM_GOOGLE_API_KEY="your-key" \
 *    LLM_GOOGLE_BASE_URL="https://generativelanguage.googleapis.com/v1beta" \
 *    LLM_GOOGLE_MODEL="gemini-1.5-flash" \
 *    pnpm test src/services/llm-api/LlmApi.integration.test.ts
 *
 * Note: These tests will NOT run during normal `pnpm test` or `pnpm preflight`
 * Tests use models configured in environment variables (see .env.example)
 */
