import { describe, it, expect } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import {
  Neo4jUri,
  Neo4jUser,
  CypherQuery,
  QueryParameterName,
  ProviderName,
  ApiBaseUrl,
  LlmModel,
  queryParams,
  UndefinedQueryParameterError,
} from '../database';

describe('Database Types', () => {
  describe('Neo4jUri', () => {
    it('should create a branded Neo4jUri using Schema.decodeSync', () => {
      const uri = Schema.decodeSync(Neo4jUri)('bolt://localhost:7687');
      expect(uri).toBe('bolt://localhost:7687');
      expect(typeof uri).toBe('string');
    });

    it('should validate bolt:// URIs', async () => {
      const result = await Effect.runPromise(
        Schema.decode(Neo4jUri)('bolt://localhost:7687'),
      );
      expect(result).toBe('bolt://localhost:7687');
    });

    it('should validate neo4j:// URIs', async () => {
      const result = await Effect.runPromise(
        Schema.decode(Neo4jUri)('neo4j://example.com:7687'),
      );
      expect(result).toBe('neo4j://example.com:7687');
    });

    it('should validate secure bolt+s:// URIs', async () => {
      const result = await Effect.runPromise(
        Schema.decode(Neo4jUri)('bolt+s://secure.example.com:7687'),
      );
      expect(result).toBe('bolt+s://secure.example.com:7687');
    });

    it('should validate secure neo4j+s:// URIs', async () => {
      const result = await Effect.runPromise(
        Schema.decode(Neo4jUri)('neo4j+s://secure.example.com:7687'),
      );
      expect(result).toBe('neo4j+s://secure.example.com:7687');
    });

    it('should validate bolt+ssc:// URIs', async () => {
      const result = await Effect.runPromise(
        Schema.decode(Neo4jUri)('bolt+ssc://secure.example.com:7687'),
      );
      expect(result).toBe('bolt+ssc://secure.example.com:7687');
    });

    it('should validate neo4j+ssc:// URIs', async () => {
      const result = await Effect.runPromise(
        Schema.decode(Neo4jUri)('neo4j+ssc://secure.example.com:7687'),
      );
      expect(result).toBe('neo4j+ssc://secure.example.com:7687');
    });

    it('should reject invalid URI schemes', async () => {
      const result = await Effect.runPromiseExit(
        Schema.decode(Neo4jUri)('http://localhost:7687'),
      );
      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        expect(result.cause._tag).toBe('Fail');
      }
    });

    it('should reject empty strings', async () => {
      const result = await Effect.runPromiseExit(Schema.decode(Neo4jUri)(''));
      expect(result._tag).toBe('Failure');
    });
  });

  describe('Neo4jUser', () => {
    it('should create a branded Neo4jUser using Schema.decodeSync', () => {
      const user = Schema.decodeSync(Neo4jUser)('neo4j');
      expect(user).toBe('neo4j');
      expect(typeof user).toBe('string');
    });

    it('should validate any non-empty username', async () => {
      const result = await Effect.runPromise(Schema.decode(Neo4jUser)('admin'));
      expect(result).toBe('admin');
    });

    it('should accept usernames with special characters', async () => {
      const result = await Effect.runPromise(
        Schema.decode(Neo4jUser)('user-123_test'),
      );
      expect(result).toBe('user-123_test');
    });

    it('should reject empty usernames', async () => {
      const result = await Effect.runPromiseExit(Schema.decode(Neo4jUser)(''));
      expect(result._tag).toBe('Failure');
    });
  });

  describe('CypherQuery', () => {
    it('should create a branded CypherQuery using Schema.decodeSync', () => {
      const query = Schema.decodeSync(CypherQuery)('MATCH (n) RETURN n');
      expect(query).toBe('MATCH (n) RETURN n');
      expect(typeof query).toBe('string');
    });

    it('should validate any non-empty query', async () => {
      const result = await Effect.runPromise(
        Schema.decode(CypherQuery)('CREATE (n:Person {name: $name})'),
      );
      expect(result).toBe('CREATE (n:Person {name: $name})');
    });

    it('should accept multi-line queries', async () => {
      const multiLineQuery = `
        MATCH (p:Person)
        WHERE p.age > 18
        RETURN p
      `;
      const result = await Effect.runPromise(
        Schema.decode(CypherQuery)(multiLineQuery),
      );
      expect(result).toBe(multiLineQuery);
    });

    it('should reject empty queries', async () => {
      const result = await Effect.runPromiseExit(
        Schema.decode(CypherQuery)(''),
      );
      expect(result._tag).toBe('Failure');
    });
  });

  describe('QueryParameterName', () => {
    it('should create a branded QueryParameterName using Schema.decodeSync', () => {
      const paramName = Schema.decodeSync(QueryParameterName)('userId');
      expect(paramName).toBe('userId');
      expect(typeof paramName).toBe('string');
    });

    it('should validate valid parameter names', async () => {
      const result = await Effect.runPromise(
        Schema.decode(QueryParameterName)('userName'),
      );
      expect(result).toBe('userName');
    });

    it('should validate parameter names with underscores', async () => {
      const result = await Effect.runPromise(
        Schema.decode(QueryParameterName)('user_name'),
      );
      expect(result).toBe('user_name');
    });

    it('should validate parameter names with numbers', async () => {
      const result = await Effect.runPromise(
        Schema.decode(QueryParameterName)('user123'),
      );
      expect(result).toBe('user123');
    });

    it('should reject parameter names starting with numbers', async () => {
      const result = await Effect.runPromiseExit(
        Schema.decode(QueryParameterName)('123user'),
      );
      expect(result._tag).toBe('Failure');
    });

    it('should reject parameter names with special characters', async () => {
      const result = await Effect.runPromiseExit(
        Schema.decode(QueryParameterName)('user-name'),
      );
      expect(result._tag).toBe('Failure');
    });

    it('should reject empty parameter names', async () => {
      const result = await Effect.runPromiseExit(
        Schema.decode(QueryParameterName)(''),
      );
      expect(result._tag).toBe('Failure');
    });
  });

  describe('ProviderName', () => {
    it('should create a branded ProviderName using Schema.decodeSync', () => {
      const provider = Schema.decodeSync(ProviderName)('openai');
      expect(provider).toBe('openai');
      expect(typeof provider).toBe('string');
    });

    it('should validate lowercase provider names', async () => {
      const result = await Effect.runPromise(
        Schema.decode(ProviderName)('anthropic'),
      );
      expect(result).toBe('anthropic');
    });

    it('should validate provider names with hyphens', async () => {
      const result = await Effect.runPromise(
        Schema.decode(ProviderName)('azure-openai'),
      );
      expect(result).toBe('azure-openai');
    });

    it('should validate provider names with underscores', async () => {
      const result = await Effect.runPromise(
        Schema.decode(ProviderName)('custom_provider'),
      );
      expect(result).toBe('custom_provider');
    });

    it('should reject uppercase provider names', async () => {
      const result = await Effect.runPromiseExit(
        Schema.decode(ProviderName)('OpenAI'),
      );
      expect(result._tag).toBe('Failure');
    });

    it('should reject provider names starting with numbers', async () => {
      const result = await Effect.runPromiseExit(
        Schema.decode(ProviderName)('3openai'),
      );
      expect(result._tag).toBe('Failure');
    });

    it('should reject empty provider names', async () => {
      const result = await Effect.runPromiseExit(
        Schema.decode(ProviderName)(''),
      );
      expect(result._tag).toBe('Failure');
    });
  });

  describe('ApiBaseUrl', () => {
    it('should create a branded ApiBaseUrl using Schema.decodeSync', () => {
      const url = Schema.decodeSync(ApiBaseUrl)('https://api.openai.com/v1');
      expect(url).toBe('https://api.openai.com/v1');
      expect(typeof url).toBe('string');
    });

    it('should validate HTTPS URLs', async () => {
      const result = await Effect.runPromise(
        Schema.decode(ApiBaseUrl)('https://api.example.com'),
      );
      expect(result).toBe('https://api.example.com');
    });

    it('should validate HTTP URLs', async () => {
      const result = await Effect.runPromise(
        Schema.decode(ApiBaseUrl)('http://localhost:8080'),
      );
      expect(result).toBe('http://localhost:8080');
    });

    it('should validate URLs with paths', async () => {
      const result = await Effect.runPromise(
        Schema.decode(ApiBaseUrl)('https://api.example.com/v1/chat'),
      );
      expect(result).toBe('https://api.example.com/v1/chat');
    });

    it('should validate URLs with query parameters', async () => {
      const result = await Effect.runPromise(
        Schema.decode(ApiBaseUrl)('https://api.example.com?version=1'),
      );
      expect(result).toBe('https://api.example.com?version=1');
    });

    it('should reject invalid URLs', async () => {
      const result = await Effect.runPromiseExit(
        Schema.decode(ApiBaseUrl)('not-a-url'),
      );
      expect(result._tag).toBe('Failure');
    });

    it('should reject empty URLs', async () => {
      const result = await Effect.runPromiseExit(Schema.decode(ApiBaseUrl)(''));
      expect(result._tag).toBe('Failure');
    });

    it('should reject URLs without protocol', async () => {
      const result = await Effect.runPromiseExit(
        Schema.decode(ApiBaseUrl)('api.example.com'),
      );
      expect(result._tag).toBe('Failure');
    });
  });

  describe('LlmModel', () => {
    it('should create a branded LlmModel using Schema.decodeSync', () => {
      const model = Schema.decodeSync(LlmModel)('gpt-4');
      expect(model).toBe('gpt-4');
      expect(typeof model).toBe('string');
    });

    it('should validate any non-empty model name', async () => {
      const result = await Effect.runPromise(
        Schema.decode(LlmModel)('claude-3-opus-20240229'),
      );
      expect(result).toBe('claude-3-opus-20240229');
    });

    it('should accept model names with special characters', async () => {
      const result = await Effect.runPromise(
        Schema.decode(LlmModel)('text-davinci-003'),
      );
      expect(result).toBe('text-davinci-003');
    });

    it('should reject empty model names', async () => {
      const result = await Effect.runPromiseExit(Schema.decode(LlmModel)(''));
      expect(result._tag).toBe('Failure');
    });
  });

  describe('queryParams helper', () => {
    it('should convert plain object to QueryParameters', async () => {
      const params = await Effect.runPromise(
        queryParams({
          name: 'Alice',
          age: 30,
          active: true,
        }),
      );

      expect(params[Schema.decodeSync(QueryParameterName)('name')]).toBe(
        'Alice',
      );
      expect(params[Schema.decodeSync(QueryParameterName)('age')]).toBe(30);
      expect(params[Schema.decodeSync(QueryParameterName)('active')]).toBe(
        true,
      );
    });

    it('should handle empty object', async () => {
      const params = await Effect.runPromise(queryParams({}));
      expect(Object.keys(params)).toHaveLength(0);
    });

    it('should handle nested objects', async () => {
      const params = await Effect.runPromise(
        queryParams({
          user: { name: 'Bob', id: 123 },
          tags: ['tag1', 'tag2'],
        }),
      );

      expect(params[Schema.decodeSync(QueryParameterName)('user')]).toEqual({
        name: 'Bob',
        id: 123,
      });
      expect(params[Schema.decodeSync(QueryParameterName)('tags')]).toEqual([
        'tag1',
        'tag2',
      ]);
    });

    it('should preserve null values', async () => {
      const params = await Effect.runPromise(
        queryParams({
          nullValue: null,
          validValue: 'test',
        }),
      );

      // null is preserved (valid in Neo4j)
      expect(
        params[Schema.decodeSync(QueryParameterName)('nullValue')],
      ).toBeNull();

      // regular values work as expected
      expect(params[Schema.decodeSync(QueryParameterName)('validValue')]).toBe(
        'test',
      );
    });

    it('should fail when encountering undefined values', async () => {
      const result = await Effect.runPromiseExit(
        queryParams({
          name: 'Alice',
          city: undefined,
          age: 30,
        }),
      );

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure' && result.cause._tag === 'Fail') {
        const error = result.cause.error;
        expect(error._tag).toBe('UndefinedQueryParameterError');
        expect(error.parameterName).toBe('city');
        expect(error.message).toContain(
          "Query parameter 'city' has undefined value",
        );
      }
    });

    it('should handle all falsy values except undefined', async () => {
      const params = await Effect.runPromise(
        queryParams({
          a: 'value',
          b: null,
          d: 0,
          e: false,
          f: '',
        }),
      );

      // Should have all 5 parameters
      expect(Object.keys(params)).toHaveLength(5);

      // Verify all values are preserved
      expect(params[Schema.decodeSync(QueryParameterName)('a')]).toBe('value');
      expect(params[Schema.decodeSync(QueryParameterName)('b')]).toBeNull();
      expect(params[Schema.decodeSync(QueryParameterName)('d')]).toBe(0);
      expect(params[Schema.decodeSync(QueryParameterName)('e')]).toBe(false);
      expect(params[Schema.decodeSync(QueryParameterName)('f')]).toBe('');
    });

    it('should provide helpful error recovery example', async () => {
      // Example of handling undefined parameters with fallback
      const rawParams = {
        name: 'Alice',
        age: undefined, // Maybe from optional form field
        city: 'Paris',
      };

      // Clean parameters before passing to queryParams
      const cleanParams = Object.fromEntries(
        Object.entries(rawParams).filter(([_, v]) => v !== undefined),
      );

      const params = await Effect.runPromise(queryParams(cleanParams));

      expect(Object.keys(params)).toHaveLength(2);
      expect(params[Schema.decodeSync(QueryParameterName)('name')]).toBe(
        'Alice',
      );
      expect(params[Schema.decodeSync(QueryParameterName)('city')]).toBe(
        'Paris',
      );
    });
  });

  describe('Type Safety', () => {
    it('should not allow assignment of plain strings to branded types', () => {
      // This test verifies TypeScript's compile-time type checking
      // The following would cause TypeScript errors if uncommented:
      // const uri: Neo4jUri = 'bolt://localhost:7687'; // Error!
      // const user: Neo4jUser = 'admin'; // Error!
      // const query: CypherQuery = 'MATCH (n) RETURN n'; // Error!

      // Correct usage requires using Schema.decodeSync:
      const uri: Neo4jUri = Schema.decodeSync(Neo4jUri)(
        'bolt://localhost:7687',
      );
      const user: Neo4jUser = Schema.decodeSync(Neo4jUser)('admin');
      const query: CypherQuery =
        Schema.decodeSync(CypherQuery)('MATCH (n) RETURN n');

      expect(uri).toBe('bolt://localhost:7687');
      expect(user).toBe('admin');
      expect(query).toBe('MATCH (n) RETURN n');
    });

    it('should maintain type safety across function boundaries', () => {
      // Example function that requires branded types
      const executeQuery = (
        query: CypherQuery,
        params: Record<QueryParameterName, unknown>,
      ) => {
        return { query, params };
      };

      // Must use branded types
      const result = executeQuery(
        Schema.decodeSync(CypherQuery)(
          'MATCH (n:Person {name: $name}) RETURN n',
        ),
        { [Schema.decodeSync(QueryParameterName)('name')]: 'Alice' },
      );

      expect(result.query).toBe('MATCH (n:Person {name: $name}) RETURN n');
      expect(result.params[Schema.decodeSync(QueryParameterName)('name')]).toBe(
        'Alice',
      );
    });
  });
});
