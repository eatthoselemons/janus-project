import { Effect, Context } from 'effect';
import { SystemPrompt, UserPrompt } from '../../domain/types/branded';
import { LlmModel } from '../../domain/types/database';
import { LlmApiError } from '../../domain/types/errors';

/**
 * LlmApiService provides a unified interface for generating text completions
 * from various LLM providers (OpenAI, Anthropic, Google, etc.)
 *
 * @example
 * ```ts
 * const llmApi = yield* LlmApiService
 * const response = yield* llmApi.generate(
 *   'You are a helpful assistant',
 *   'What is the capital of France?',
 *   'gpt-4'
 * )
 * ```
 */
export interface LlmApiImpl {
  /**
   * Generate a text completion from an LLM provider
   * @param systemPrompt - Defines the assistant's behavior
   * @param prompt - The user's query
   * @param model - The model to use (determines provider)
   * @returns Effect containing the generated text response
   */
  readonly generate: (
    systemPrompt: SystemPrompt,
    prompt: UserPrompt,
    model: LlmModel,
  ) => Effect.Effect<string, LlmApiError, never>;
}

export class LlmApiService extends Context.Tag('LlmApiService')<
  LlmApiService,
  LlmApiImpl
>() {}
