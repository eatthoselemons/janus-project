import { Effect, Layer, Schema } from 'effect';
import { LlmApiService } from '../../services/llm-api';
import { SystemPrompt, UserPrompt } from '../../domain/types/branded';
import { LlmModel } from '../../domain/types/database';
import { LlmApiError } from '../../domain/types/errors';

/**
 * Test data structure for LLM API mocking
 */
export interface LlmApiTestData {
  responses: Map<
    string,
    {
      systemPrompt: SystemPrompt;
      prompt: UserPrompt;
      model: LlmModel;
      response: string | Error;
    }
  >;
}

/**
 * Helper to create test data entries
 */
const makeTestEntry = (
  systemPrompt: string,
  prompt: string,
  model: string,
  response: string | Error,
) => ({
  systemPrompt: Schema.decodeSync(SystemPrompt)(systemPrompt),
  prompt: Schema.decodeSync(UserPrompt)(prompt),
  model: Schema.decodeSync(LlmModel)(model),
  response,
});

/**
 * Default test data for common scenarios
 */
export const defaultLlmApiTestData: LlmApiTestData = {
  responses: new Map([
    [
      'test-success',
      makeTestEntry(
        'You are a helpful assistant',
        'Hello world',
        'gpt-4',
        'Generated response for: Hello world',
      ),
    ],
    [
      'test-error',
      makeTestEntry(
        'You are a helpful assistant',
        'trigger error',
        'gpt-4',
        new LlmApiError({
          provider: 'openai',
          statusCode: 500,
          originalMessage: 'Internal server error',
        }),
      ),
    ],
    [
      'test-anthropic',
      makeTestEntry(
        'You are a helpful assistant',
        'test prompt',
        'claude-3-opus',
        'Generated response from Claude: test prompt',
      ),
    ],
    [
      'test-rate-limit',
      makeTestEntry(
        'System prompt',
        'rate limit test',
        'gpt-3.5-turbo',
        new LlmApiError({
          provider: 'openai',
          statusCode: 429,
          originalMessage: 'Rate limit exceeded',
        }),
      ),
    ],
    [
      'test-invalid-key',
      makeTestEntry(
        'System prompt',
        'invalid key test',
        'gpt-4',
        new LlmApiError({
          provider: 'openai',
          statusCode: 401,
          originalMessage: 'Invalid API key',
        }),
      ),
    ],
  ]),
};

/**
 * Test layer for LlmApi service with mock data
 * @param testData Custom test data or defaults to defaultLlmApiTestData
 */
export const LlmApiTest = (
  testData: LlmApiTestData = defaultLlmApiTestData,
) => {
  const mockService = LlmApiService.of({
    generate: (systemPrompt, prompt, model) => {
      // Find matching test case
      for (const [_, data] of testData.responses) {
        if (
          data.systemPrompt === systemPrompt &&
          data.prompt === prompt &&
          data.model === model
        ) {
          if (data.response instanceof Error) {
            return Effect.fail(data.response as LlmApiError);
          }
          return Effect.succeed(data.response);
        }
      }
      // Default response if no match found
      return Effect.succeed(
        `Generated: ${systemPrompt} | ${prompt} | ${model}`,
      );
    },
  });

  return Layer.succeed(LlmApiService, mockService);
};
