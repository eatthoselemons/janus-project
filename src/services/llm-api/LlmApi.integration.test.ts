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
describe.skipIf(process.env.INTEGRATION_TEST !== 'true')(
  'LlmApi Integration Tests',
  { timeout: 60000 }, // 60 second timeout for all tests in this suite
  () => {
    it.effect('should generate text using OpenAI API', () =>
      Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const conversation = Chunk.of<Message>({
          role: 'user',
          content: 'Say hello in one word',
        });

        const result = yield* llmApi.generate(conversation, 'gpt-3.5-turbo');

        // Check that we got a response
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);

        // The response should contain something like "Hello" or "Hi"
        expect(result.toLowerCase()).toMatch(/hello|hi|hey|greetings/);
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.timeout('30 seconds'),
      ),
    );

    it.effect('should generate text using Anthropic API', () =>
      Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const conversation = Chunk.of<Message>({
          role: 'user',
          content: 'What is 2 + 2? Answer with just the number.',
        });

        const result = yield* llmApi.generate(
          conversation,
          'claude-3-haiku-20240307',
        );

        // Check that we got a response
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result).toContain('4');
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.timeout('30 seconds'),
      ),
    );

    it.effect('should generate text using Google API', () =>
      Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const conversation = Chunk.of<Message>({
          role: 'user',
          content: 'Complete this sentence: The sky is',
        });

        const result = yield* llmApi.generate(conversation, 'gemini-1.5-flash');

        // Check that we got a response
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);

        // The response should contain something about the sky
        expect(result.toLowerCase()).toMatch(/blue|clear|cloudy|dark|bright/);
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.timeout('30 seconds'),
      ),
    );

    it.effect('should handle multi-turn conversations with OpenAI', () =>
      Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const conversation = Chunk.of<Message>(
          {
            role: 'user',
            content: 'My favorite color is blue.',
          },
          {
            role: 'assistant',
            content:
              "That's a nice choice! Blue is often associated with calmness and serenity.",
          },
          {
            role: 'user',
            content: 'What was my favorite color?',
          },
        );

        const result = yield* llmApi.generate(conversation, 'gpt-3.5-turbo');

        // Check that the model remembers the context
        expect(result).toBeDefined();
        expect(result.toLowerCase()).toContain('blue');
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.timeout('30 seconds'),
      ),
    );

    it.effect('should handle multi-turn conversations with Anthropic', () =>
      Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const conversation = Chunk.of<Message>(
          {
            role: 'user',
            content: 'My favorite animal is a dolphin.',
          },
          {
            role: 'assistant',
            content:
              "Dolphins are fascinating creatures! They're known for their intelligence and playful nature.",
          },
          {
            role: 'user',
            content: 'What was my favorite animal?',
          },
        );

        const result = yield* llmApi.generate(conversation, 'claude-3-haiku-20240307');

        // Check that the model remembers the context
        expect(result).toBeDefined();
        expect(result.toLowerCase()).toContain('dolphin');
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.timeout('30 seconds'),
      ),
    );

    it.effect('should handle multi-turn conversations with Google', () =>
      Effect.gen(function* () {
        const llmApi = yield* LlmApi;
        const conversation = Chunk.of<Message>(
          {
            role: 'user',
            content: 'My favorite food is pizza.',
          },
          {
            role: 'assistant',
            content:
              "Pizza is a popular choice! It's versatile with so many topping options.",
          },
          {
            role: 'user',
            content: 'What was my favorite food?',
          },
        );

        const result = yield* llmApi.generate(conversation, 'gemini-1.5-flash');

        // Check that the model remembers the context
        expect(result).toBeDefined();
        expect(result.toLowerCase()).toContain('pizza');
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.timeout('30 seconds'),
      ),
    );

    it.effect('should handle errors gracefully', () =>
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
      }).pipe(
        Effect.provide(LlmApiLive),
        Effect.provide(ConfigServiceLive),
        Effect.timeout('10 seconds'),
      ),
    );
  },
);
