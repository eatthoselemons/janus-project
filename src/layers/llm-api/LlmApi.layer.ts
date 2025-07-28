import { Effect, Layer, pipe, Schema, Redacted } from 'effect';
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform';
import { NodeHttpClient } from '@effect/platform-node';
import { ConfigService } from '../../services/config';
import { LlmApiService, LlmApiImpl } from '../../services/llm-api';
import { SystemPrompt, UserPrompt } from '../../domain/types/branded';
import { LlmModel, ProviderName } from '../../domain/types/database';
import { LlmApiError } from '../../domain/types/errors';

/**
 * OpenAI API request body
 */
const OpenAIRequestBody = Schema.Struct({
  model: Schema.String,
  messages: Schema.Array(
    Schema.Struct({
      role: Schema.Literal('system', 'user', 'assistant'),
      content: Schema.String,
    }),
  ),
  temperature: Schema.optional(Schema.Number),
});

/**
 * OpenAI API response body
 */
const OpenAIResponseBody = Schema.Struct({
  choices: Schema.Array(
    Schema.Struct({
      message: Schema.Struct({
        content: Schema.String,
      }),
    }),
  ),
});

/**
 * Anthropic API request body
 */
const AnthropicRequestBody = Schema.Struct({
  model: Schema.String,
  system: Schema.String,
  messages: Schema.Array(
    Schema.Struct({
      role: Schema.Literal('user', 'assistant'),
      content: Schema.String,
    }),
  ),
  max_tokens: Schema.Number,
});

/**
 * Anthropic API response body
 */
const AnthropicResponseBody = Schema.Struct({
  content: Schema.Array(
    Schema.Struct({
      text: Schema.String,
    }),
  ),
});

/**
 * Google Gemini API request body
 */
const GoogleRequestBody = Schema.Struct({
  contents: Schema.Array(
    Schema.Struct({
      parts: Schema.Array(
        Schema.Struct({
          text: Schema.String,
        }),
      ),
    }),
  ),
  systemInstruction: Schema.optional(
    Schema.Struct({
      parts: Schema.Array(
        Schema.Struct({
          text: Schema.String,
        }),
      ),
    }),
  ),
});

/**
 * Google Gemini API response body
 */
const GoogleResponseBody = Schema.Struct({
  candidates: Schema.Array(
    Schema.Struct({
      content: Schema.Struct({
        parts: Schema.Array(
          Schema.Struct({
            text: Schema.String,
          }),
        ),
      }),
    }),
  ),
});

/**
 * Determine provider from model name
 */
const getProvider = (
  model: LlmModel,
): Effect.Effect<ProviderName, LlmApiError> => {
  const modelStr = model as string;
  if (modelStr.startsWith('gpt-')) {
    return Effect.succeed(Schema.decodeSync(ProviderName)('openai'));
  }
  if (modelStr.startsWith('claude-')) {
    return Effect.succeed(Schema.decodeSync(ProviderName)('anthropic'));
  }
  if (modelStr.startsWith('gemini-')) {
    return Effect.succeed(Schema.decodeSync(ProviderName)('google'));
  }
  // Add more providers as needed
  return Effect.fail(
    new LlmApiError({
      provider: 'unknown',
      originalMessage: `Unknown model: ${modelStr}`,
    }),
  );
};

/**
 * Build OpenAI API request
 */
const buildOpenAIRequest = (
  systemPrompt: SystemPrompt,
  prompt: UserPrompt,
  model: LlmModel,
  apiKey: Redacted.Redacted<string>,
  baseUrl: string,
) =>
  pipe(
    HttpClientRequest.post(`${baseUrl}/chat/completions`),
    HttpClientRequest.setHeader(
      'Authorization',
      `Bearer ${Redacted.value(apiKey)}`,
    ),
    HttpClientRequest.setHeader('Content-Type', 'application/json'),
    HttpClientRequest.schemaBodyJson(OpenAIRequestBody)({
      model: model as string,
      messages: [
        { role: 'system', content: systemPrompt as string },
        { role: 'user', content: prompt as string },
      ],
    }),
  );

/**
 * Build Anthropic API request
 */
const buildAnthropicRequest = (
  systemPrompt: SystemPrompt,
  prompt: UserPrompt,
  model: LlmModel,
  apiKey: Redacted.Redacted<string>,
  baseUrl: string,
) =>
  pipe(
    HttpClientRequest.post(`${baseUrl}/messages`),
    HttpClientRequest.setHeader('x-api-key', Redacted.value(apiKey)),
    HttpClientRequest.setHeader('Content-Type', 'application/json'),
    HttpClientRequest.setHeader('anthropic-version', '2023-06-01'),
    HttpClientRequest.schemaBodyJson(AnthropicRequestBody)({
      model: model as string,
      system: systemPrompt as string,
      messages: [{ role: 'user', content: prompt as string }],
      max_tokens: 4096,
    }),
  );

/**
 * Build Google Gemini API request
 */
const buildGoogleRequest = (
  systemPrompt: SystemPrompt,
  prompt: UserPrompt,
  model: LlmModel,
  apiKey: Redacted.Redacted<string>,
  baseUrl: string,
) =>
  pipe(
    HttpClientRequest.post(
      `${baseUrl}/models/${model}:generateContent?key=${Redacted.value(apiKey)}`,
    ),
    HttpClientRequest.setHeader('Content-Type', 'application/json'),
    HttpClientRequest.schemaBodyJson(GoogleRequestBody)({
      contents: [
        {
          parts: [{ text: prompt as string }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt as string }],
      },
    }),
  );

/**
 * Extract content from provider response
 */
const extractContent = (
  body: unknown,
  provider: ProviderName,
): Effect.Effect<string, LlmApiError> =>
  Effect.gen(function* () {
    if (provider === 'openai') {
      const parsed = yield* Schema.decodeUnknown(OpenAIResponseBody)(body).pipe(
        Effect.mapError(
          (error) =>
            new LlmApiError({
              provider: provider as string,
              originalMessage: `Failed to parse OpenAI response: ${error.message}`,
            }),
        ),
      );
      const content = parsed.choices[0]?.message.content;
      if (!content) {
        return yield* Effect.fail(
          new LlmApiError({
            provider: provider as string,
            originalMessage: 'No content in OpenAI response',
          }),
        );
      }
      return content;
    }

    if (provider === 'anthropic') {
      const parsed = yield* Schema.decodeUnknown(AnthropicResponseBody)(
        body,
      ).pipe(
        Effect.mapError(
          (error) =>
            new LlmApiError({
              provider: provider as string,
              originalMessage: `Failed to parse Anthropic response: ${error.message}`,
            }),
        ),
      );
      const content = parsed.content[0]?.text;
      if (!content) {
        return yield* Effect.fail(
          new LlmApiError({
            provider: provider as string,
            originalMessage: 'No content in Anthropic response',
          }),
        );
      }
      return content;
    }

    if (provider === 'google') {
      const parsed = yield* Schema.decodeUnknown(GoogleResponseBody)(
        body,
      ).pipe(
        Effect.mapError(
          (error) =>
            new LlmApiError({
              provider: provider as string,
              originalMessage: `Failed to parse Google response: ${error.message}`,
            }),
        ),
      );
      const content = parsed.candidates[0]?.content.parts[0]?.text;
      if (!content) {
        return yield* Effect.fail(
          new LlmApiError({
            provider: provider as string,
            originalMessage: 'No content in Google response',
          }),
        );
      }
      return content;
    }

    return yield* Effect.fail(
      new LlmApiError({
        provider: provider as string,
        originalMessage: `Unknown provider: ${provider}`,
      }),
    );
  });

/**
 * Create the LlmApi service implementation
 */
const makeService = Effect.gen(function* () {
  const config = yield* ConfigService;
  const defaultClient = yield* HttpClient.HttpClient;

  // Configure client with status filtering
  const httpClient = pipe(defaultClient, HttpClient.filterStatusOk);

  const generate: LlmApiImpl['generate'] = (systemPrompt, prompt, model) =>
    Effect.gen(function* () {
      const provider = yield* getProvider(model);

      // Access provider config safely
      const providerKey = provider as keyof typeof config.llm.providers;
      const providerConfig = config.llm.providers[providerKey];

      if (!providerConfig) {
        return yield* Effect.fail(
          new LlmApiError({
            provider: provider as string,
            originalMessage: `Provider ${provider} not configured`,
          }),
        );
      }

      // Build request based on provider
      const request =
        provider === 'openai'
          ? yield* buildOpenAIRequest(
              systemPrompt,
              prompt,
              model,
              providerConfig.apiKey,
              providerConfig.baseUrl as string,
            )
          : provider === 'anthropic'
            ? yield* buildAnthropicRequest(
                systemPrompt,
                prompt,
                model,
                providerConfig.apiKey,
                providerConfig.baseUrl as string,
              )
            : yield* buildGoogleRequest(
                systemPrompt,
                prompt,
                model,
                providerConfig.apiKey,
                providerConfig.baseUrl as string,
              );

      // Execute with error handling and parse response
      const body = yield* pipe(
        httpClient.execute(request),
        Effect.flatMap((response) => response.json),
        Effect.scoped,
        Effect.mapError((error: any) => {
          // Extract status code from error if available
          const statusCode =
            error._tag === 'ResponseError' ? error.response?.status : undefined;
          return new LlmApiError({
            provider: provider as string,
            statusCode,
            originalMessage: error.message || String(error),
          });
        }),
      );

      const result = yield* extractContent(body, provider);
      return result;
    }).pipe(
      Effect.mapError((error: any) => {
        // Final catch-all to ensure all errors are converted to LlmApiError
        if (error instanceof LlmApiError) {
          return error;
        }
        return new LlmApiError({
          provider: 'unknown',
          originalMessage: error.message || String(error),
        });
      }),
    );

  return LlmApiService.of({ generate });
});

/**
 * Live layer for LlmApi service (requires HttpClient to be provided separately)
 */
export const LlmApiLayerService = Layer.effect(LlmApiService, makeService);

/**
 * Live layer for LlmApi service with Node HTTP client
 */
export const LlmApiLive = LlmApiLayerService.pipe(
  Layer.provide(NodeHttpClient.layer),
);
