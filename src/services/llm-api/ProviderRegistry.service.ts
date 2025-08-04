import { Context, Option, Layer } from 'effect';
import { AiLanguageModel } from '@effect/ai/AiLanguageModel';

/**
 * Registry service that holds all configured AI language model provider layers
 * This allows dynamic provider selection at runtime while following Effect patterns
 */
export class ProviderRegistry extends Context.Tag('ProviderRegistry')<
  ProviderRegistry,
  {
    /**
     * Get a provider layer by name and model
     * @param name - The provider name (e.g., 'openai', 'anthropic', 'google')
     * @param model - The model name (e.g., 'gpt-4', 'claude-3-opus')
     * @returns Option of the AI language model layer, None if provider not found
     */
    getProviderLayer: (
      name: string,
      model: string,
    ) => Option.Option<Layer.Layer<AiLanguageModel>>;

    /**
     * Get all available provider names
     * @returns Array of configured provider names
     */
    getAvailableProviders: () => readonly string[];
  }
>() {}
