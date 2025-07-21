import { describe, expect, it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import {
  Neo4jConfigSchema,
  LlmProviderConfigSchema,
  ConfigSchema,
} from '../config';

describe('Neo4jConfigSchema', () => {
  // Test successful validation
  it.effect('should accept valid Neo4j configuration', () =>
    Effect.gen(function* () {
      const validConfig = {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'test-password',
      };

      const result = yield* Schema.decode(Neo4jConfigSchema)(validConfig);
      expect(result).toEqual(validConfig);
    }),
  );

  // Test missing required fields
  it.effect('should reject configuration with missing uri', () =>
    Effect.gen(function* () {
      const invalidConfig = {
        user: 'neo4j',
        password: 'test-password',
        // missing uri
      };

      const result = yield* Effect.either(
        Schema.decode(Neo4jConfigSchema)(invalidConfig),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  it.effect('should reject configuration with missing user', () =>
    Effect.gen(function* () {
      const invalidConfig = {
        uri: 'bolt://localhost:7687',
        password: 'test-password',
        // missing user
      };

      const result = yield* Effect.either(
        Schema.decode(Neo4jConfigSchema)(invalidConfig),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  it.effect('should reject configuration with missing password', () =>
    Effect.gen(function* () {
      const invalidConfig = {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        // missing password
      };

      const result = yield* Effect.either(
        Schema.decode(Neo4jConfigSchema)(invalidConfig),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  // Test different Neo4j URI formats
  const validUris = [
    'bolt://localhost:7687',
    'neo4j://example.com:7687',
    'neo4j+s://example.com:7687',
    'bolt+s://secure.example.com:7687',
    'neo4j+ssc://cluster.example.com:7687',
  ];

  validUris.forEach((uri) => {
    it.effect(`should accept URI format: ${uri}`, () =>
      Effect.gen(function* () {
        const config = {
          uri,
          user: 'neo4j',
          password: 'test',
        };

        const result = yield* Schema.decode(Neo4jConfigSchema)(config);
        expect(result.uri).toBe(uri);
      }),
    );
  });
});

describe('LlmProviderConfigSchema', () => {
  // Test successful validation with all fields
  it.effect('should accept complete LLM provider configuration', () =>
    Effect.gen(function* () {
      const validConfig = {
        apiKey: 'sk-test-key-123',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
      };

      const result = yield* Schema.decode(LlmProviderConfigSchema)(validConfig);
      expect(result).toEqual(validConfig);
    }),
  );

  // Test all required fields
  it.effect('should require all fields (apiKey, baseUrl, model)', () =>
    Effect.gen(function* () {
      const validConfig = {
        apiKey: 'sk-test-key-123',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      };

      const result = yield* Schema.decode(LlmProviderConfigSchema)(validConfig);
      expect(result.apiKey).toBe('sk-test-key-123');
      expect(result.baseUrl).toBe('https://api.example.com/v1');
      expect(result.model).toBe('test-model');
    }),
  );

  // Test missing baseUrl
  it.effect('should reject configuration missing baseUrl', () =>
    Effect.gen(function* () {
      const invalidConfig = {
        apiKey: 'sk-test-key-123',
        model: 'test-model',
        // missing baseUrl
      };

      const result = yield* Effect.either(
        Schema.decode(LlmProviderConfigSchema)(invalidConfig),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  // Test missing model
  it.effect('should reject configuration missing model', () =>
    Effect.gen(function* () {
      const invalidConfig = {
        apiKey: 'sk-test-key-123',
        baseUrl: 'https://api.example.com/v1',
        // missing model
      };

      const result = yield* Effect.either(
        Schema.decode(LlmProviderConfigSchema)(invalidConfig),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  // Test missing apiKey
  it.effect('should reject configuration without apiKey', () =>
    Effect.gen(function* () {
      const invalidConfig = {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
        // missing apiKey
      };

      const result = yield* Effect.either(
        Schema.decode(LlmProviderConfigSchema)(invalidConfig),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  // Test different API key formats
  const validApiKeys = [
    'sk-1234567890abcdef1234567890abcdef1234567890abcdef',
    'sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef',
    'azure-api-key-12345',
    'google-vertex-ai-key-67890',
    'custom-provider-key-xyz',
  ];

  validApiKeys.forEach((apiKey) => {
    it.effect(
      `should accept API key format: ${apiKey.substring(0, 20)}...`,
      () =>
        Effect.gen(function* () {
          const config = {
            apiKey,
            baseUrl: 'https://api.example.com/v1',
            model: 'test-model',
          };

          const result = yield* Schema.decode(LlmProviderConfigSchema)(config);
          expect(result.apiKey).toBe(apiKey);
        }),
    );
  });
});

describe('ConfigSchema', () => {
  // Test complete valid configuration
  it.effect('should accept complete configuration', () =>
    Effect.gen(function* () {
      const validConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'test-password',
        },
        llm: {
          providers: {
            openai: {
              apiKey: 'sk-openai-key',
              baseUrl: 'https://api.openai.com/v1',
              model: 'gpt-4',
            },
            anthropic: {
              apiKey: 'sk-ant-key',
              baseUrl: 'https://api.anthropic.com',
              model: 'claude-3',
            },
          },
        },
      };

      const result = yield* Schema.decode(ConfigSchema)(validConfig);
      expect(result).toEqual(validConfig);
    }),
  );

  // Test configuration with empty providers
  it.effect('should accept configuration with empty providers', () =>
    Effect.gen(function* () {
      const validConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'test-password',
        },
        llm: {
          providers: {},
        },
      };

      const result = yield* Schema.decode(ConfigSchema)(validConfig);
      expect(result.neo4j).toEqual(validConfig.neo4j);
      expect(result.llm.providers).toEqual({});
    }),
  );

  // Test missing neo4j section
  it.effect('should reject configuration without neo4j section', () =>
    Effect.gen(function* () {
      const invalidConfig = {
        llm: {
          providers: {
            openai: {
              apiKey: 'sk-openai-key',
              baseUrl: 'https://api.openai.com/v1',
              model: 'gpt-4',
            },
          },
        },
        // missing neo4j
      };

      const result = yield* Effect.either(
        Schema.decode(ConfigSchema)(invalidConfig),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  // Test missing llm section
  it.effect('should reject configuration without llm section', () =>
    Effect.gen(function* () {
      const invalidConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'test-password',
        },
        // missing llm
      };

      const result = yield* Effect.either(
        Schema.decode(ConfigSchema)(invalidConfig),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  // Test invalid provider configuration
  it.effect('should reject configuration with invalid provider', () =>
    Effect.gen(function* () {
      const invalidConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'test-password',
        },
        llm: {
          providers: {
            openai: {
              // missing required apiKey
              baseUrl: 'https://api.openai.com/v1',
              model: 'gpt-4',
            },
          },
        },
      };

      const result = yield* Effect.either(
        Schema.decode(ConfigSchema)(invalidConfig),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  // Test multiple provider configurations
  it.effect('should accept multiple valid providers', () =>
    Effect.gen(function* () {
      const validConfig = {
        neo4j: {
          uri: 'neo4j+s://production.example.com:7687',
          user: 'production-user',
          password: 'secure-password-123',
        },
        llm: {
          providers: {
            openai: {
              apiKey: 'sk-openai-production-key',
              baseUrl: 'https://api.openai.com/v1',
              model: 'gpt-4',
            },
            anthropic: {
              apiKey: 'sk-ant-production-key',
              baseUrl: 'https://api.anthropic.com',
              model: 'claude-3-opus',
            },
            azure: {
              apiKey: 'azure-openai-key',
              baseUrl: 'https://mycompany.openai.azure.com',
              model: 'gpt-4-turbo',
            },
            google: {
              apiKey: 'google-vertex-key',
              baseUrl: 'https://vertex-ai.googleapis.com',
              model: 'gemini-pro',
            },
          },
        },
      };

      const result = yield* Schema.decode(ConfigSchema)(validConfig);
      expect(result).toEqual(validConfig);
      expect(Object.keys(result.llm.providers)).toHaveLength(4);
    }),
  );
});
