import { describe, expect, it, beforeEach, afterEach } from '@effect/vitest';
import { Effect, ConfigProvider, Redacted } from 'effect';
import { ConfigService } from '../../services/config';
import { ConfigServiceLive } from './Configuration.layer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('ConfigService', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Save original working directory
    originalCwd = process.cwd();

    // Create temporary directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'janus-config-test-'));

    // Create config directory
    fs.mkdirSync(path.join(tempDir, 'config'));

    // Change working directory to temp dir
    process.chdir(tempDir);
  });

  afterEach(() => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  // Test with valid configuration
  it.effect('should load configuration from environment variables', () =>
    Effect.gen(function* () {
      // Write providers to config file
      fs.writeFileSync(
        path.join(tempDir, 'config', 'llm-providers.txt'),
        'openai\n',
      );

      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'test-password',
        LLM_OPENAI_API_KEY: 'sk-test-key',
        LLM_OPENAI_BASE_URL: 'https://api.openai.com/v1',
        LLM_OPENAI_MODEL: 'gpt-4',
      };

      const config = yield* ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      expect(config.neo4j.uri).toBe('bolt://localhost:7687');
      expect(config.neo4j.user).toBe('neo4j');
      expect(Redacted.value(config.neo4j.password)).toBe('test-password');
      expect(config.llm.providers.openai).toBeDefined();
      expect(Redacted.value(config.llm.providers.openai!.apiKey)).toBe(
        'sk-test-key',
      );
      expect(config.llm.providers.openai!.baseUrl).toBe(
        'https://api.openai.com/v1',
      );
      expect(config.llm.providers.openai!.model).toBe('gpt-4');
    }),
  );

  // Test missing required configuration
  it.effect('should fail when required Neo4j configuration is missing', () =>
    Effect.gen(function* () {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        // Missing NEO4J_USER and NEO4J_PASSWORD
      };

      const result = yield* Effect.either(
        ConfigService.pipe(
          Effect.provide(ConfigServiceLive),
          Effect.withConfigProvider(
            ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
          ),
        ),
      );

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('ConfigError');
      }
    }),
  );

  // Test redacted values don't leak in logs
  it.effect('should not expose redacted values in logs', () =>
    Effect.gen(function* () {
      // Write providers to config file
      fs.writeFileSync(
        path.join(tempDir, 'config', 'llm-providers.txt'),
        'openai\n',
      );

      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'super-secret',
        LLM_OPENAI_API_KEY: 'sk-secret-key',
        LLM_OPENAI_BASE_URL: 'https://api.openai.com/v1',
        LLM_OPENAI_MODEL: 'gpt-4',
      };

      const config = yield* ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      // Simulating console.log behavior
      const passwordString = config.neo4j.password.toString();
      const apiKeyString = config.llm.providers.openai!.apiKey.toString();

      expect(passwordString).not.toContain('super-secret');
      expect(apiKeyString).not.toContain('sk-secret-key');
      expect(passwordString).toContain('<redacted>');
      expect(apiKeyString).toContain('<redacted>');
    }),
  );

  // Test multiple LLM providers
  it.effect('should load multiple LLM provider configurations', () =>
    Effect.gen(function* () {
      // Write providers to config file
      fs.writeFileSync(
        path.join(tempDir, 'config', 'llm-providers.txt'),
        'openai\nanthropic\nazure\n',
      );

      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'test-password',
        LLM_OPENAI_API_KEY: 'sk-openai-key',
        LLM_OPENAI_BASE_URL: 'https://api.openai.com/v1',
        LLM_OPENAI_MODEL: 'gpt-4',
        LLM_ANTHROPIC_API_KEY: 'sk-anthropic-key',
        LLM_ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
        LLM_ANTHROPIC_MODEL: 'claude-3',
        LLM_AZURE_API_KEY: 'azure-key',
        LLM_AZURE_BASE_URL: 'https://myazure.openai.azure.com',
        LLM_AZURE_MODEL: 'gpt-4-turbo',
      };

      const config = yield* ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      // Check OpenAI provider
      expect(config.llm.providers.openai).toBeDefined();
      expect(Redacted.value(config.llm.providers.openai!.apiKey)).toBe(
        'sk-openai-key',
      );
      expect(config.llm.providers.openai!.baseUrl).toBe(
        'https://api.openai.com/v1',
      );
      expect(config.llm.providers.openai!.model).toBe('gpt-4');

      // Check Anthropic provider
      expect(config.llm.providers.anthropic).toBeDefined();
      expect(Redacted.value(config.llm.providers.anthropic!.apiKey)).toBe(
        'sk-anthropic-key',
      );
      expect(config.llm.providers.anthropic!.model).toBe('claude-3');

      // Check Azure provider
      expect(config.llm.providers.azure).toBeDefined();
      expect(Redacted.value(config.llm.providers.azure!.apiKey)).toBe(
        'azure-key',
      );
      expect(config.llm.providers.azure!.baseUrl).toBe(
        'https://myazure.openai.azure.com',
      );
      expect(config.llm.providers.azure!.model).toBe('gpt-4-turbo');
    }),
  );

  // Test optional LLM providers
  it.effect('should work with no LLM providers configured', () =>
    Effect.gen(function* () {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'test-password',
        // No LLM providers configured
      };

      const config = yield* ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      expect(config.neo4j.uri).toBe('bolt://localhost:7687');
      expect(Object.keys(config.llm.providers)).toHaveLength(0);
    }),
  );

  // Edge case: partial provider configuration
  it.effect('should handle partial LLM provider configuration gracefully', () =>
    Effect.gen(function* () {
      // Write providers to config file
      fs.writeFileSync(
        path.join(tempDir, 'config', 'llm-providers.txt'),
        'openai\nanthropic\n',
      );

      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'test-password',
        LLM_OPENAI_API_KEY: 'sk-openai-key',
        LLM_OPENAI_BASE_URL: 'https://api.openai.com/v1',
        LLM_OPENAI_MODEL: 'gpt-4',
        // Anthropic missing API key, so it shouldn't be included
      };

      const config = yield* ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      // OpenAI should be present
      expect(config.llm.providers.openai).toBeDefined();
      expect(config.llm.providers.openai!.baseUrl).toBe(
        'https://api.openai.com/v1',
      );
      expect(config.llm.providers.openai!.model).toBe('gpt-4');

      // Anthropic should NOT be present (no API key)
      expect(config.llm.providers.anthropic).toBeUndefined();
    }),
  );

  // Test Neo4j URI validation edge cases
  it.effect('should accept various Neo4j URI formats', () =>
    Effect.gen(function* () {
      const mockConfig = {
        NEO4J_URI: 'neo4j+s://example.com:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'test-password',
      };

      const config = yield* ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      expect(config.neo4j.uri).toBe('neo4j+s://example.com:7687');
    }),
  );

  // Test empty string handling
  it.effect('should fail on empty required configuration values', () =>
    Effect.gen(function* () {
      const mockConfig = {
        // Missing NEO4J_URI entirely
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'test-password',
      };

      const result = yield* Effect.either(
        ConfigService.pipe(
          Effect.provide(ConfigServiceLive),
          Effect.withConfigProvider(
            ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
          ),
        ),
      );

      expect(result._tag).toBe('Left');
    }),
  );

  // Test incomplete provider configuration
  it.effect(
    'should fail when provider has API key but missing required fields',
    () =>
      Effect.gen(function* () {
        // Write providers to config file
        fs.writeFileSync(
          path.join(tempDir, 'config', 'llm-providers.txt'),
          'openai\n',
        );

        const mockConfig = {
          NEO4J_URI: 'bolt://localhost:7687',
          NEO4J_USER: 'neo4j',
          NEO4J_PASSWORD: 'test-password',
          LLM_OPENAI_API_KEY: 'sk-test-key',
          // Missing LLM_OPENAI_BASE_URL and LLM_OPENAI_MODEL
        };

        const result = yield* Effect.either(
          ConfigService.pipe(
            Effect.provide(ConfigServiceLive),
            Effect.withConfigProvider(
              ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
            ),
          ),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('ConfigError');
        }
      }),
  );

  // Test explicit provider list configuration via environment variable
  it.effect('should respect LLM_PROVIDERS environment variable', () =>
    Effect.gen(function* () {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'test-password',
        LLM_PROVIDERS: 'custom,mycorp',
        LLM_CUSTOM_API_KEY: 'custom-key',
        LLM_CUSTOM_BASE_URL: 'https://custom.api.com',
        LLM_CUSTOM_MODEL: 'custom-model',
        LLM_MYCORP_API_KEY: 'mycorp-key',
        LLM_MYCORP_BASE_URL: 'https://api.mycorp.com',
        LLM_MYCORP_MODEL: 'mycorp-model',
      };

      const config = yield* ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      // Should only have custom and mycorp providers
      expect(Object.keys(config.llm.providers).sort()).toEqual([
        'custom',
        'mycorp',
      ]);
      expect(config.llm.providers.custom).toBeDefined();
      expect(config.llm.providers.mycorp).toBeDefined();
    }),
  );

  // Test Redacted value extraction helper
  it.effect('should safely extract redacted values for internal use', () =>
    Effect.gen(function* () {
      // Write providers to config file
      fs.writeFileSync(
        path.join(tempDir, 'config', 'llm-providers.txt'),
        'google\n',
      );

      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'secure-password',
        LLM_GOOGLE_API_KEY: 'google-api-key-123',
        LLM_GOOGLE_BASE_URL: 'https://vertex-ai.googleapis.com',
        LLM_GOOGLE_MODEL: 'gemini-pro',
      };

      const config = yield* ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      // Demonstrate safe extraction for internal use
      const password = Redacted.value(config.neo4j.password);
      const googleApiKey = Redacted.value(config.llm.providers.google!.apiKey);

      expect(password).toBe('secure-password');
      expect(googleApiKey).toBe('google-api-key-123');

      // But string representation should still be redacted
      expect(`${config.neo4j.password}`).toContain('<redacted>');
    }),
  );

  // Test configuration file reading with comments
  it.effect('should read providers from config file ignoring comments', () =>
    Effect.gen(function* () {
      // Write providers to config file with comments
      fs.writeFileSync(
        path.join(tempDir, 'config', 'llm-providers.txt'),
        '# This is a comment\nopenai\n# Another comment\n\nanthropic\n',
      );

      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'test-password',
        LLM_OPENAI_API_KEY: 'sk-openai-key',
        LLM_OPENAI_BASE_URL: 'https://api.openai.com/v1',
        LLM_OPENAI_MODEL: 'gpt-4',
        LLM_ANTHROPIC_API_KEY: 'sk-anthropic-key',
        LLM_ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
        LLM_ANTHROPIC_MODEL: 'claude-3',
      };

      const config = yield* ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      // Should have both providers
      expect(Object.keys(config.llm.providers).sort()).toEqual([
        'anthropic',
        'openai',
      ]);
    }),
  );

  // Test missing config file
  it.effect('should handle missing config file gracefully', () =>
    Effect.gen(function* () {
      // Don't create config file

      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'test-password',
      };

      const config = yield* ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      // Should have no providers
      expect(Object.keys(config.llm.providers)).toHaveLength(0);
    }),
  );
});
