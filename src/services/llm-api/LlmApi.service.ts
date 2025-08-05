import { Effect, Context } from 'effect';
import { Conversation } from '../../domain/types/testCase';
import { LlmApiError } from '../../domain/types/errors';

/**
 * LlmApiService provides a unified interface for interacting with multiple LLM providers
 *
 * @example
 * ```ts
 * // Generate text from a conversation
 * const response = yield* llmApi.generate(
 *   Chunk.of(
 *     { role: 'user', content: 'Hello, how are you?' }
 *   ),
 *   'gpt-4'
 * )
 * ```
 */
export interface LlmApiImpl {
  /**
   * Generate a text response from a conversation using a specific model
   * @param conversation The conversation history as a Chunk of Messages
   * @param model The model identifier (e.g., 'gpt-4', 'claude-3-opus')
   * @returns Effect containing the generated text response
   */
  readonly generate: (
    conversation: Conversation,
    model: string,
  ) => Effect.Effect<string, LlmApiError, never>;
}

export class LlmApi extends Context.Tag('LlmApi')<LlmApi, LlmApiImpl>() {}
