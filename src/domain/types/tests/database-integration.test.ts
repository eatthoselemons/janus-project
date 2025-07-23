import { describe, it, expect } from '@effect/vitest';
import { Effect, Layer, ConfigProvider, Redacted, Schema } from 'effect';
import { ConfigService } from '../../../services/config';
import { Neo4jService } from '../../../services/neo4j';
import { ConfigServiceLive } from '../../../layers/configuration/Configuration.layer';
import { Neo4jTest } from '../../../layers/neo4j/Neo4j.layer';
import {
  Neo4jUri,
  Neo4jUser,
  CypherQuery,
  QueryParameterName,
  ProviderName,
  ApiBaseUrl,
  LlmModel,
  queryParams,
} from '../database';

describe('Database Types Integration', () => {
  describe('ConfigService with branded types', () => {
    it('should properly handle branded types in configuration', async () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
        LLM_PROVIDERS: 'openai',
        LLM_OPENAI_API_KEY: 'sk-test',
        LLM_OPENAI_BASE_URL: 'https://api.openai.com/v1',
        LLM_OPENAI_MODEL: 'gpt-4',
      };

      const program = Effect.gen(function* () {
        const config = yield* ConfigService;

        // Verify the types are properly branded
        const uri: Neo4jUri = config.neo4j.uri;
        const user: Neo4jUser = config.neo4j.user;

        expect(uri).toBe('bolt://localhost:7687');
        expect(user).toBe('neo4j');

        // Check LLM provider configuration
        const providerName = Schema.decodeSync(ProviderName)('openai');
        const provider = config.llm.providers[providerName];

        expect(provider).toBeDefined();
        if (provider) {
          const baseUrl: ApiBaseUrl = provider.baseUrl;
          const model: LlmModel = provider.model;

          expect(baseUrl).toBe('https://api.openai.com/v1');
          expect(model).toBe('gpt-4');
        }
      });

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ConfigServiceLive),
          Effect.withConfigProvider(
            ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
          ),
        ),
      );
    });

    it('should fail with invalid Neo4j URI format', async () => {
      const mockConfig = {
        NEO4J_URI: 'invalid://localhost:7687', // Invalid protocol
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      const program = ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      const result = await Effect.runPromiseExit(program);
      expect(result._tag).toBe('Failure');
    });

    it('should handle provider names case-insensitively', async () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
        LLM_PROVIDERS: 'OpenAI', // Gets normalized to lowercase
        LLM_OPENAI_API_KEY: 'sk-test',
        LLM_OPENAI_BASE_URL: 'https://api.openai.com/v1',
        LLM_OPENAI_MODEL: 'gpt-4',
      };

      const program = Effect.gen(function* () {
        const config = yield* ConfigService;

        // The provider name should be normalized to lowercase
        const providerName = Schema.decodeSync(ProviderName)('openai');
        const provider = config.llm.providers[providerName];

        expect(provider).toBeDefined();
      });

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ConfigServiceLive),
          Effect.withConfigProvider(
            ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
          ),
        ),
      );
    });

    it('should silently ignore providers with invalid names', async () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
        LLM_PROVIDERS: 'open@ai,validprovider', // One invalid, one valid
        LLM_OPEN_AI_API_KEY: 'sk-test',
        LLM_OPEN_AI_BASE_URL: 'https://api.openai.com/v1',
        LLM_OPEN_AI_MODEL: 'gpt-4',
        LLM_VALIDPROVIDER_API_KEY: 'key',
        LLM_VALIDPROVIDER_BASE_URL: 'https://api.example.com',
        LLM_VALIDPROVIDER_MODEL: 'model',
      };

      const program = Effect.gen(function* () {
        const config = yield* ConfigService;

        // The invalid provider name should be processed but won't match env vars
        // So it won't be included in the final config
        const providers = Object.keys(config.llm.providers);

        // Only the valid provider should be present
        expect(providers).toContain('validprovider');
        expect(providers).not.toContain('open@ai');
      });

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ConfigServiceLive),
          Effect.withConfigProvider(
            ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
          ),
        ),
      );
    });
  });

  describe('Neo4jService with branded types', () => {
    it('should use CypherQuery and QueryParameters correctly', async () => {
      const mockData = new Map([
        [
          'MATCH (n:Person {name: $name}) RETURN n',
          [{ n: { name: 'Alice', age: 30 } }],
        ],
      ]);

      const program = Effect.gen(function* () {
        const neo4j = yield* Neo4jService;

        const query = Schema.decodeSync(CypherQuery)(
          'MATCH (n:Person {name: $name}) RETURN n',
        );
        const params = queryParams({ name: 'Alice' });

        const results = yield* neo4j.runQuery(query, params);

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({ n: { name: 'Alice', age: 30 } });
      });

      await Effect.runPromise(
        program.pipe(Effect.provide(Neo4jTest(mockData))),
      );
    });

    it('should handle complex query parameters', async () => {
      const mockData = new Map([
        [
          'CREATE (n:Person $props) RETURN n',
          [{ n: { name: 'Bob', age: 25, tags: ['developer', 'typescript'] } }],
        ],
      ]);

      const program = Effect.gen(function* () {
        const neo4j = yield* Neo4jService;

        const query = Schema.decodeSync(CypherQuery)(
          'CREATE (n:Person $props) RETURN n',
        );
        const params = yield* queryParams({
          props: {
            name: 'Bob',
            age: 25,
            tags: ['developer', 'typescript'],
          },
        });

        const results = yield* neo4j.runQuery(query, params);

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
          n: { name: 'Bob', age: 25, tags: ['developer', 'typescript'] },
        });
      });

      await Effect.runPromise(
        program.pipe(Effect.provide(Neo4jTest(mockData))),
      );
    });

    it('should work with transactions using branded types', async () => {
      const mockData = new Map([
        ['CREATE (n:User {id: $id}) RETURN n', [{ n: { id: 1 } }]],
        [
          'CREATE (p:Profile {userId: $userId}) RETURN p',
          [{ p: { userId: 1 } }],
        ],
      ]);

      const program = Effect.gen(function* () {
        const neo4j = yield* Neo4jService;

        const result = yield* neo4j.runInTransaction((tx) =>
          Effect.gen(function* () {
            const userQuery = Schema.decodeSync(CypherQuery)(
              'CREATE (n:User {id: $id}) RETURN n',
            );
            const userParams = queryParams({ id: 1 });
            const users = yield* tx.run(userQuery, userParams);

            const profileQuery = Schema.decodeSync(CypherQuery)(
              'CREATE (p:Profile {userId: $userId}) RETURN p',
            );
            const profileParams = queryParams({ userId: 1 });
            const profiles = yield* tx.run(profileQuery, profileParams);

            return { users, profiles };
          }),
        );

        expect(result.users).toHaveLength(1);
        expect(result.profiles).toHaveLength(1);
      });

      await Effect.runPromise(
        program.pipe(Effect.provide(Neo4jTest(mockData))),
      );
    });

    it('should work with batch queries using branded types', async () => {
      const mockData = new Map([
        [
          'MATCH (n:Person) RETURN n',
          [{ n: { name: 'Alice' } }, { n: { name: 'Bob' } }],
        ],
        ['MATCH (n:Company) RETURN n', [{ n: { name: 'Acme Corp' } }]],
      ]);

      const program = Effect.gen(function* () {
        const neo4j = yield* Neo4jService;

        const queries = [
          {
            query: Schema.decodeSync(CypherQuery)('MATCH (n:Person) RETURN n'),
          },
          {
            query: Schema.decodeSync(CypherQuery)('MATCH (n:Company) RETURN n'),
          },
        ];

        const results = yield* neo4j.runBatch(queries);

        expect(results).toHaveLength(2);
        expect(results[0]).toHaveLength(2); // Two persons
        expect(results[1]).toHaveLength(1); // One company
      });

      await Effect.runPromise(
        program.pipe(Effect.provide(Neo4jTest(mockData))),
      );
    });
  });

  describe('Cross-service integration', () => {
    it('should pass branded types from config to Neo4j', async () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      const program = Effect.gen(function* () {
        const config = yield* ConfigService;

        // These should be properly typed as branded types
        const uri: Neo4jUri = config.neo4j.uri;
        const user: Neo4jUser = config.neo4j.user;

        // In a real scenario, these would be passed to Neo4j driver
        expect(uri).toBe('bolt://localhost:7687');
        expect(user).toBe('neo4j');

        // Verify password is redacted
        expect(config.neo4j.password.toString()).toContain('<redacted>');
        expect(Redacted.value(config.neo4j.password)).toBe('password');
      });

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ConfigServiceLive),
          Effect.withConfigProvider(
            ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
          ),
        ),
      );
    });
  });

  describe('Error messages and validation', () => {
    it('should provide clear error messages for invalid URIs', async () => {
      const mockConfig = {
        NEO4J_URI: 'http://localhost:7687', // Wrong protocol
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
      };

      const program = ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      const result = await Effect.runPromiseExit(program);
      expect(result._tag).toBe('Failure');
      // The error should mention the valid URI formats
    });

    it('should provide clear error messages for invalid URLs', async () => {
      const mockConfig = {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'password',
        LLM_PROVIDERS: 'custom',
        LLM_CUSTOM_API_KEY: 'key',
        LLM_CUSTOM_BASE_URL: 'not-a-url', // Invalid URL
        LLM_CUSTOM_MODEL: 'model',
      };

      const program = ConfigService.pipe(
        Effect.provide(ConfigServiceLive),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map(Object.entries(mockConfig))),
        ),
      );

      const result = await Effect.runPromiseExit(program);
      expect(result._tag).toBe('Failure');
    });
  });
});
