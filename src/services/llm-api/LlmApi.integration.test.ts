import { describe, expect, it } from '@effect/vitest';
import { Effect, Chunk } from 'effect';
import { LlmApi } from './LlmApi.service';
import { LlmApiLive } from '../../layers/llm-api/LlmApi.layer';
import { ConfigServiceLive } from '../../layers/configuration/Configuration.layer';
import type { Message } from '../../domain/types/testCase';

/**
 * Integration tests for LLM API
 *
 * To run these tests, you need to set up environment variables:
 *
 * Required:
 * - INTEGRATION_TEST=true
 * - NEO4J_URI=bolt://localhost:7687
 * - NEO4J_USER=neo4j
 * - NEO4J_PASSWORD=password
 *
 * For OpenAI tests:
 * - LLM_OPENAI_API_KEY=your-api-key
 * - LLM_OPENAI_BASE_URL=https://api.openai.com/v1
 *
 * For Anthropic tests:
 * - LLM_ANTHROPIC_API_KEY=your-api-key
 * - LLM_ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
 *
 * For Google tests:
 * - LLM_GOOGLE_API_KEY=your-api-key
 * - LLM_GOOGLE_BASE_URL=https://generativelanguage.googleapis.com/v1beta
 *
 * Example:
 * INTEGRATION_TEST=true NEO4J_URI="bolt://localhost:7687" NEO4J_USER="neo4j" NEO4J_PASSWORD="test" LLM_ANTHROPIC_BASE_URL="https://api.anthropic.com/v1" LLM_ANTHROPIC_API_KEY="your-key" LLM_GOOGLE_BASE_URL="https://generativelanguage.googleapis.com/v1beta" LLM_GOOGLE_API_KEY="your-key" pnpm test src/services/llm-api/LlmApi.integration.test.ts
 */

// Provider configurations
const providers = [
  {
    name: 'OpenAI',
    model: 'gpt-3.5-turbo',
    simplePrompt: 'Say the word "hello" and nothing else.',
    expectedPattern: /hello/i,
  },
  {
    name: 'Anthropic',
    model: 'claude-3-haiku-20240307',
    simplePrompt: 'Complete this sentence with one word: The sky is',
    expectedPattern: /blue|clear|cloudy|dark|bright/i,
  },
  {
    name: 'Google',
    model: 'gemini-1.5-flash',
    simplePrompt: 'Complete this sentence: The sky is',
    expectedPattern: /blue|clear|cloudy|dark|bright/i,
  },
];

// Multi-turn conversation test data
const multiTurnTests = [
  {
    provider: 'OpenAI',
    model: 'gpt-3.5-turbo',
    topic: 'color',
    value: 'blue',
    messages: [
      { role: 'user' as const, content: 'My favorite color is blue.' },
      {
        role: 'assistant' as const,
        content:
          "That's a nice choice! Blue is often associated with calmness and serenity.",
      },
      { role: 'user' as const, content: 'What was my favorite color?' },
    ],
  },
  {
    provider: 'Anthropic',
    model: 'claude-3-haiku-20240307',
    topic: 'animal',
    value: 'dolphin',
    messages: [
      { role: 'user' as const, content: 'My favorite animal is a dolphin.' },
      {
        role: 'assistant' as const,
        content:
          "Dolphins are fascinating creatures! They're known for their intelligence and playful nature.",
      },
      { role: 'user' as const, content: 'What was my favorite animal?' },
    ],
  },
  {
    provider: 'Google',
    model: 'gemini-1.5-flash',
    topic: 'food',
    value: 'pizza',
    messages: [
      { role: 'user' as const, content: 'My favorite food is pizza.' },
      {
        role: 'assistant' as const,
        content:
          "Pizza is a popular choice! It's versatile with so many topping options.",
      },
      { role: 'user' as const, content: 'What was my favorite food?' },
    ],
  },
];

// System message test data
const systemMessageTests = [
  {
    provider: 'OpenAI',
    model: 'gpt-3.5-turbo',
    systemMessage:
      'You are a helpful assistant who always responds in exactly 5 words.',
    userMessage: 'What is the capital of France?',
    // We expect exactly 5 words in response
    validateResponse: (response: string) => {
      const wordCount = response.trim().split(/\s+/).length;
      return wordCount === 5;
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-3-haiku-20240307',
    systemMessage:
      'You are a helpful assistant who always responds with a haiku poem.',
    userMessage: 'Tell me about the ocean.',
    // Haikus have 3 lines, so we expect at least 2 newlines
    validateResponse: (response: string) => {
      const lines = response
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      return lines.length >= 3;
    },
  },
  {
    provider: 'Google',
    model: 'gemini-1.5-flash',
    systemMessage:
      'You are a helpful assistant who always includes the word "certainly" in your responses.',
    userMessage: 'What is 2 + 2?',
    // We expect the word "certainly" somewhere in the response
    validateResponse: (response: string) => {
      return response.toLowerCase().includes('certainly');
    },
  },
];

describe.skipIf(process.env.INTEGRATION_TEST !== 'true')(
  'LlmApi Integration Tests',
  { timeout: 60000 }, // 60 second timeout for all tests in this suite
  () => {
    // Common test effect with layers
    const runTest = <A>(effect: Effect.Effect<A, unknown, LlmApi>) =>
      effect.pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.timeout('30 seconds'),
      );

    // Generate basic API tests for each provider
    providers.forEach(({ name, model, simplePrompt, expectedPattern }) => {
      it.effect(`should generate text using ${name} API`, () =>
        runTest(
          Effect.gen(function* () {
            const llmApi = yield* LlmApi;
            const conversation = Chunk.of<Message>({
              role: 'user',
              content: simplePrompt,
            });

            const result = yield* llmApi.generate(conversation, model);

            // Check that we got a response
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);

            // Check response content
            expect(result.toLowerCase()).toMatch(expectedPattern);
          }),
        ),
      );
    });

    // Generate multi-turn conversation tests
    multiTurnTests.forEach(({ provider, model, value, messages }) => {
      it.effect(`should handle multi-turn conversations with ${provider}`, () =>
        runTest(
          Effect.gen(function* () {
            const llmApi = yield* LlmApi;
            const conversation = Chunk.fromIterable(messages);

            const result = yield* llmApi.generate(conversation, model);

            // Check that the model remembers the context
            expect(result).toBeDefined();
            expect(result.toLowerCase()).toContain(value);
          }),
        ),
      );
    });

    // Generate system message tests
    systemMessageTests.forEach(
      ({ provider, model, systemMessage, userMessage, validateResponse }) => {
        it.effect(`should handle system messages with ${provider}`, () =>
          runTest(
            Effect.gen(function* () {
              const llmApi = yield* LlmApi;
              const conversation = Chunk.fromIterable<Message>([
                { role: 'system', content: systemMessage },
                { role: 'user', content: userMessage },
              ]);

              const result = yield* llmApi.generate(conversation, model);

              // Check that we got a response
              expect(result).toBeDefined();
              expect(typeof result).toBe('string');
              expect(result.length).toBeGreaterThan(0);

              // Validate that the system message was respected
              const isValid = validateResponse(result);
              expect(isValid).toBe(true);
            }),
          ),
        );
      },
    );

    // Error handling test
    it.effect('should handle errors gracefully', () =>
      runTest(
        Effect.gen(function* () {
          const llmApi = yield* LlmApi;
          const conversation = Chunk.of<Message>({
            role: 'user',
            content: 'Test message',
          });

          // Use an invalid model name to trigger an error
          const exit = yield* Effect.exit(
            llmApi.generate(conversation, 'invalid-model-xyz'),
          );

          expect(exit._tag).toBe('Failure');
        }),
      ),
    );
  },
);
