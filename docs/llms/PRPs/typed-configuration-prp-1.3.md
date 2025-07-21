# PRP: Typed Configuration Service (Section 1.3)

## Objective

Implement a typed configuration service for the Janus project that provides type-safe access to all application settings, including Neo4j connection details and LLM provider API keys, using Effect's Config module.

## Context and References

### Required Reading

1. **Effect Config Documentation**: https://effect.website/docs/configuration/
2. **Effect Redacted Documentation**: https://effect.website/docs/data-types/redacted/
3. **Effect Default Services**: https://effect.website/docs/requirements-management/default-services/
4. **Effect-Neo4j Service Pattern**: See `docs/llms/guides/effect-neo4j/05-actions-layer-services.md:66-78` for Config usage example
5. **Compliance Checklist**: `docs/llms/effect/effect-compliance-checklist.md`

### Existing Patterns to Follow

1. **Schema Definitions**: See `src/domain/types/*.ts` - Use `Schema.Struct` for data structures
2. **Service Pattern**: Reference `examples/effect-official-examples/examples/http-server/src/Accounts.ts` for Effect.Service pattern
3. **Test Pattern**: See `src/domain/types/tests/branded.test.ts` - Use `@effect/vitest` with `it.effect`
4. **Error Types**: See `src/domain/types/errors.ts` - Use TaggedError pattern

## Implementation Blueprint

### 1. Define Configuration Schema

```typescript
// src/domain/types/config.ts
import { Schema } from 'effect';
import { Config } from 'effect';

// Define the configuration schema structure
export const ConfigSchema = Schema.Struct({
  neo4j: Schema.Struct({
    uri: Schema.String,
    user: Schema.String,
    password: Schema.String, // Will be wrapped with Config.redacted
  }),
  llm: Schema.Struct({
    providers: Schema.Record({
      key: Schema.String,
      value: Schema.Struct({
        apiKey: Schema.String, // Will be wrapped with Config.redacted
        baseUrl: Schema.optional(Schema.String),
        model: Schema.optional(Schema.String),
      }),
    }),
  }),
});

// Extract the type from schema
export type ConfigSchema = typeof ConfigSchema.Type;
```

### 2. Create Config Service

```typescript
// src/services/config/config.service.ts
import { Effect, Context, Layer, Config, Redacted } from 'effect';
import { ConfigSchema } from '../../domain/types/config';

// Define the Config service tag
export class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  {
    readonly neo4j: {
      readonly uri: string;
      readonly user: string;
      readonly password: Redacted.Redacted<string>;
    };
    readonly llm: {
      readonly providers: Record<
        string,
        {
          readonly apiKey: Redacted.Redacted<string>;
          readonly baseUrl?: string;
          readonly model?: string;
        }
      >;
    };
  }
>() {}

// Implementation using Effect Config module
const configProgram = Effect.gen(function* () {
  // Neo4j configuration
  const neo4jUri = yield* Config.string('NEO4J_URI');
  const neo4jUser = yield* Config.string('NEO4J_USER');
  const neo4jPassword = yield* Config.redacted('NEO4J_PASSWORD');

  // LLM providers configuration (supporting multiple providers)
  // Example: LLM_OPENAI_API_KEY, LLM_ANTHROPIC_API_KEY, etc.
  const llmProviders = yield* Config.all({
    openai: Config.all({
      apiKey: Config.redacted('LLM_OPENAI_API_KEY'),
      baseUrl: Config.optional(Config.string('LLM_OPENAI_BASE_URL')),
      model: Config.optional(Config.string('LLM_OPENAI_MODEL')),
    }).pipe(Config.optional),
    anthropic: Config.all({
      apiKey: Config.redacted('LLM_ANTHROPIC_API_KEY'),
      baseUrl: Config.optional(Config.string('LLM_ANTHROPIC_BASE_URL')),
      model: Config.optional(Config.string('LLM_ANTHROPIC_MODEL')),
    }).pipe(Config.optional),
  });

  // Filter out undefined providers
  const providers = Object.entries(llmProviders)
    .filter(([_, value]) => value !== undefined)
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

  return {
    neo4j: {
      uri: neo4jUri,
      user: neo4jUser,
      password: neo4jPassword,
    },
    llm: {
      providers,
    },
  };
});

// Create the live layer
export const ConfigServiceLive = Layer.effect(ConfigService, configProgram);
```

### 3. Write Unit Tests

```typescript
// src/services/config/tests/config.service.test.ts
import { describe, expect, it } from '@effect/vitest';
import { Effect, ConfigProvider, Redacted } from 'effect';
import { ConfigService, ConfigServiceLive } from '../config.service';

describe('ConfigService', () => {
  // Test with valid configuration
  it.effect('should load configuration from environment variables', () =>
    Effect.gen(function* () {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'test-password',
        LLM_OPENAI_API_KEY: 'sk-test-key',
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
      expect(config.llm.providers.openai!.model).toBe('gpt-4');
    }),
  );

  // Test missing required configuration
  it.effect('should fail when required configuration is missing', () =>
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
    }),
  );

  // Test redacted values don't leak in logs
  it.effect('should not expose redacted values in logs', () =>
    Effect.gen(function* () {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'super-secret',
        LLM_OPENAI_API_KEY: 'sk-secret-key',
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
      expect(passwordString).toContain('Redacted');
      expect(apiKeyString).toContain('Redacted');
    }),
  );
});
```

### 4. Update README Documentation

Add the following section to `README.md`:

```markdown
## Configuration

The application requires the following environment variables:

### Neo4j Database

- `NEO4J_URI` - Neo4j connection URI (e.g., `bolt://localhost:7687`)
- `NEO4J_USER` - Neo4j username
- `NEO4J_PASSWORD` - Neo4j password (stored securely as redacted value)

### LLM Providers

Configure one or more LLM providers:

#### OpenAI

- `LLM_OPENAI_API_KEY` - OpenAI API key (stored securely as redacted value)
- `LLM_OPENAI_BASE_URL` - (Optional) Custom base URL for OpenAI API
- `LLM_OPENAI_MODEL` - (Optional) Default model to use

#### Anthropic

- `LLM_ANTHROPIC_API_KEY` - Anthropic API key (stored securely as redacted value)
- `LLM_ANTHROPIC_BASE_URL` - (Optional) Custom base URL for Anthropic API
- `LLM_ANTHROPIC_MODEL` - (Optional) Default model to use
```

## Task Sequence

1. **Create configuration types**
   - Create `src/domain/types/config.ts` with the ConfigSchema definition
   - Ensure all sensitive fields are marked for redaction

2. **Implement ConfigService**
   - Create `src/services/config/config.service.ts`
   - Implement the service using Effect.Tag pattern
   - Use Config module functions for environment variable access
   - Wrap all secrets with Config.redacted

3. **Write comprehensive tests**
   - Create `src/services/config/tests/config.service.test.ts`
   - Test successful configuration loading
   - Test missing configuration handling
   - Test redacted values don't leak

4. **Update documentation**
   - Add configuration section to README.md
   - Document all required environment variables
   - Include examples for each provider

5. **Validate implementation**
   - Run `pnpm run preflight`
   - Ensure all tests pass
   - Check compliance with effect-compliance-checklist.md

## Error Handling Strategy

- Configuration loading errors will be handled by Effect's built-in Config error types
- Missing required fields will fail fast at application startup
- Invalid configuration values will produce descriptive error messages
- All errors will maintain the functional error handling pattern (no thrown exceptions)

## Important Implementation Notes

1. **NO Model.Class** - Use Schema.Struct as we're using Neo4j, not SQL
2. **Redacted Values** - All passwords and API keys MUST use Config.redacted
3. **Service Pattern** - Follow the existing service pattern from the examples
4. **Test Coverage** - Include happy path, failure case, and edge case tests
5. **Type Safety** - No `any` types, no type assertions with `as`

## Validation Gates

```bash
# Run all validation commands
pnpm run preflight

# Specific checks
pnpm test src/services/config
pnpm run typecheck
pnpm run lint
```

## Expected Outcomes

1. A fully typed configuration service that validates all settings at startup
2. Secure handling of sensitive data using Redacted types
3. Clear error messages for missing or invalid configuration
4. Comprehensive test coverage including edge cases
5. Updated documentation for all environment variables

## Confidence Score: 9/10

The implementation path is clear with all necessary context provided. The only minor uncertainty is around the exact LLM provider configuration structure, but the flexible approach with Record types should handle various provider configurations effectively.
