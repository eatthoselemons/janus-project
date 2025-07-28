import { it, expect } from '@effect/vitest';
import { Effect, Exit, Schema } from 'effect';
import { LlmApiService } from './index';
import { LlmApiTest } from '../../layers/llm-api';
import { LlmApiError } from '../../domain/types/errors';
import { SystemPrompt, UserPrompt } from '../../domain/types/branded';
import { LlmModel } from '../../domain/types/database';

it.effect('should generate text successfully', () =>
  Effect.gen(function* () {
    const llmApi = yield* LlmApiService;

    // Decode inputs to branded types
    const systemPrompt = yield* Schema.decode(SystemPrompt)(
      'You are a helpful assistant',
    );
    const userPrompt = yield* Schema.decode(UserPrompt)('Hello world');
    const model = yield* Schema.decode(LlmModel)('gpt-4');

    const result = yield* llmApi.generate(systemPrompt, userPrompt, model);
    expect(result).toContain('Generated response');
  }).pipe(Effect.provide(LlmApiTest())),
);

it.effect('should handle API errors', () =>
  Effect.gen(function* () {
    const llmApi = yield* LlmApiService;

    // Create branded types for error test
    const systemPrompt = yield* Schema.decode(SystemPrompt)(
      'You are a helpful assistant',
    );
    const userPrompt = yield* Schema.decode(UserPrompt)('trigger error');
    const model = yield* Schema.decode(LlmModel)('gpt-4');

    const exit = yield* Effect.exit(
      llmApi.generate(systemPrompt, userPrompt, model),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
      expect(error).toBeInstanceOf(LlmApiError);
      expect(error?.provider).toBe('openai');
      expect(error?.statusCode).toBe(500);
    }
  }).pipe(Effect.provide(LlmApiTest())),
);

it.effect('should select correct provider based on model', () =>
  Effect.gen(function* () {
    const llmApi = yield* LlmApiService;

    // Test OpenAI model
    const systemPrompt = yield* Schema.decode(SystemPrompt)('System prompt');
    const userPrompt1 = yield* Schema.decode(UserPrompt)('test prompt');
    const gptModel = yield* Schema.decode(LlmModel)('gpt-4');

    const gptResult = yield* llmApi.generate(
      systemPrompt,
      userPrompt1,
      gptModel,
    );
    expect(gptResult).toContain('gpt-4');

    // Test Anthropic model
    const systemPrompt2 = yield* Schema.decode(SystemPrompt)(
      'You are a helpful assistant',
    );
    const userPrompt2 = yield* Schema.decode(UserPrompt)('test prompt');
    const claudeModel = yield* Schema.decode(LlmModel)('claude-3-opus');

    const claudeResult = yield* llmApi.generate(
      systemPrompt2,
      userPrompt2,
      claudeModel,
    );
    expect(claudeResult).toContain('Claude');

    // Test Google model
    const systemPrompt3 = yield* Schema.decode(SystemPrompt)('System prompt');
    const userPrompt3 = yield* Schema.decode(UserPrompt)('test prompt');
    const geminiModel = yield* Schema.decode(LlmModel)('gemini-1.5-flash');

    const geminiResult = yield* llmApi.generate(
      systemPrompt3,
      userPrompt3,
      geminiModel,
    );
    expect(geminiResult).toContain('gemini-1.5-flash');
  }).pipe(Effect.provide(LlmApiTest())),
);

it.effect('should handle rate limit errors', () =>
  Effect.gen(function* () {
    const llmApi = yield* LlmApiService;

    const systemPrompt = yield* Schema.decode(SystemPrompt)('System prompt');
    const userPrompt = yield* Schema.decode(UserPrompt)('rate limit test');
    const model = yield* Schema.decode(LlmModel)('gpt-3.5-turbo');

    const exit = yield* Effect.exit(
      llmApi.generate(systemPrompt, userPrompt, model),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
      expect(error).toBeInstanceOf(LlmApiError);
      expect(error?.statusCode).toBe(429);
      expect(error?.originalMessage).toContain('Rate limit');
    }
  }).pipe(Effect.provide(LlmApiTest())),
);

it.effect('should handle invalid API key errors', () =>
  Effect.gen(function* () {
    const llmApi = yield* LlmApiService;

    const systemPrompt = yield* Schema.decode(SystemPrompt)('System prompt');
    const userPrompt = yield* Schema.decode(UserPrompt)('invalid key test');
    const model = yield* Schema.decode(LlmModel)('gpt-4');

    const exit = yield* Effect.exit(
      llmApi.generate(systemPrompt, userPrompt, model),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
      expect(error).toBeInstanceOf(LlmApiError);
      expect(error?.statusCode).toBe(401);
      expect(error?.originalMessage).toContain('Invalid API key');
    }
  }).pipe(Effect.provide(LlmApiTest())),
);

it.effect('should use custom test data', () => {
  // Create custom test data outside the Effect
  const customTestData = {
    responses: new Map([
      [
        'custom',
        {
          systemPrompt: Schema.decodeSync(SystemPrompt)('Be creative'),
          prompt: Schema.decodeSync(UserPrompt)('Write a poem'),
          model: Schema.decodeSync(LlmModel)('gpt-3.5-turbo'),
          response: 'Roses are red, violets are blue',
        },
      ],
    ]),
  };

  return Effect.gen(function* () {
    const llmApi = yield* LlmApiService;

    const systemPrompt = yield* Schema.decode(SystemPrompt)('Be creative');
    const userPrompt = yield* Schema.decode(UserPrompt)('Write a poem');
    const model = yield* Schema.decode(LlmModel)('gpt-3.5-turbo');

    const result = yield* llmApi.generate(systemPrompt, userPrompt, model);
    expect(result).toBe('Roses are red, violets are blue');
  }).pipe(Effect.provide(LlmApiTest(customTestData)));
});

it.effect('should return default response for unmatched prompts', () =>
  Effect.gen(function* () {
    const llmApi = yield* LlmApiService;

    const systemPrompt = yield* Schema.decode(SystemPrompt)(
      'Unmatched system prompt',
    );
    const userPrompt = yield* Schema.decode(UserPrompt)('Unmatched prompt');
    const model = yield* Schema.decode(LlmModel)('gpt-4-turbo');

    const result = yield* llmApi.generate(systemPrompt, userPrompt, model);
    expect(result).toContain('Generated:');
    expect(result).toContain('Unmatched system prompt');
    expect(result).toContain('Unmatched prompt');
    expect(result).toContain('gpt-4-turbo');
  }).pipe(Effect.provide(LlmApiTest())),
);
