import { Schema, Effect } from 'effect';

/**
 * Branded types for Neo4j database configuration and operations
 */

// ===========================
// NEO4J CONFIGURATION TYPES
// ===========================

/**
 * Neo4j connection URI (e.g., "bolt://localhost:7687")
 */
export const Neo4jUri = Schema.String.pipe(
  Schema.filter(
    (s): s is string => {
      const validPrefixes = [
        'bolt://',
        'neo4j://',
        'bolt+s://',
        'bolt+ssc://',
        'neo4j+s://',
        'neo4j+ssc://',
      ];
      return validPrefixes.some((prefix) => s.startsWith(prefix));
    },
    {
      message: () =>
        'Neo4j URI must start with bolt://, neo4j://, bolt+s://, bolt+ssc://, neo4j+s://, or neo4j+ssc://',
    },
  ),
  Schema.brand('Neo4jUri'),
);
export type Neo4jUri = typeof Neo4jUri.Type;

/**
 * Neo4j username for authentication
 */
export const Neo4jUser = Schema.NonEmptyString.pipe(Schema.brand('Neo4jUser'));
export type Neo4jUser = typeof Neo4jUser.Type;

// ===========================
// CYPHER QUERY TYPES
// ===========================

/**
 * A Cypher query string
 */
export const CypherQuery = Schema.NonEmptyString.pipe(
  Schema.brand('CypherQuery'),
);
export type CypherQuery = typeof CypherQuery.Type;

/**
 * Parameter name for Cypher queries (e.g., "userId", "name")
 */
export const QueryParameterName = Schema.String.pipe(
  Schema.filter((s): s is string => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s), {
    message: () => 'Query parameter name must be a valid identifier',
  }),
  Schema.brand('QueryParameterName'),
);
export type QueryParameterName = typeof QueryParameterName.Type;

/**
 * Query parameters for Cypher queries
 */
export type QueryParameters = Record<QueryParameterName, unknown>;

// ===========================
// LLM CONFIGURATION TYPES
// ===========================

/**
 * LLM provider name (e.g., "openai", "anthropic", "gemini")
 */
export const ProviderName = Schema.String.pipe(
  Schema.filter((s): s is string => /^[a-z][a-z0-9_-]*$/.test(s), {
    message: () =>
      'Provider name must be lowercase alphanumeric with hyphens/underscores',
  }),
  Schema.brand('ProviderName'),
);
export type ProviderName = typeof ProviderName.Type;

/**
 * API base URL for LLM providers
 */
export const ApiBaseUrl = Schema.String.pipe(
  Schema.filter(
    (s): s is string => {
      try {
        new URL(s);
        return true;
      } catch {
        return false;
      }
    },
    {
      message: () => 'API base URL must be a valid URL',
    },
  ),
  Schema.brand('ApiBaseUrl'),
);
export type ApiBaseUrl = typeof ApiBaseUrl.Type;

/**
 * LLM model identifier (e.g., "gpt-4", "claude-3-opus", "gemini-pro")
 */
export const LlmModel = Schema.NonEmptyString.pipe(Schema.brand('LlmModel'));
export type LlmModel = typeof LlmModel.Type;

// ===========================
// HELPER FUNCTIONS
// ===========================

/**
 * Helper to create a CypherQuery from a template literal
 */
export const cypher = (
  strings: TemplateStringsArray,
  ...values: unknown[]
): CypherQuery => {
  const query = strings.reduce((acc, str, i) => {
    return acc + str + (values[i] !== undefined ? String(values[i]) : '');
  }, '');
  return Schema.decodeSync(CypherQuery)(query);
};

/**
 * Error thrown when undefined values are found in query parameters
 */
export class UndefinedQueryParameterError extends Schema.TaggedError<UndefinedQueryParameterError>()(
  'UndefinedQueryParameterError',
  {
    parameterName: Schema.String,
    message: Schema.String,
  },
) {}

/**
 * Helper to create query parameters with proper typing
 *
 * Note: This function preserves `null` values (which are valid in Neo4j)
 * but fails with an error for `undefined` values (which have no Neo4j equivalent).
 *
 * @example
 * // Success case
 * queryParams({ name: 'Alice', age: null })
 * // Returns: Effect.succeed({ name: 'Alice', age: null })
 *
 * // Failure case
 * queryParams({ name: 'Alice', city: undefined })
 * // Returns: Effect.fail(UndefinedQueryParameterError)
 */
export const queryParams = (
  params: Record<string, unknown>,
): Effect.Effect<QueryParameters, UndefinedQueryParameterError> =>
  Effect.gen(function* () {
    const result: QueryParameters = {};

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        return yield* Effect.fail(
          new UndefinedQueryParameterError({
            parameterName: key,
            message: `Query parameter '${key}' has undefined value. Use null for absent values in Neo4j queries.`,
          }),
        );
      }
      result[Schema.decodeSync(QueryParameterName)(key)] = value;
    }

    return result;
  });
