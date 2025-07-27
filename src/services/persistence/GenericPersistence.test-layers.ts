import { Effect, Layer, Schema } from 'effect';
import { Neo4jService, TransactionContext } from '../neo4j';
import { Snippet, SnippetVersion } from '../../domain/types/snippet';
import { Tag } from '../../domain/types/tag';
import { Parameter, ParameterOption } from '../../domain/types/parameter';
import {
  Composition,
  CompositionVersion,
} from '../../domain/types/composition';
import {
  SnippetId,
  SnippetVersionId,
  TagId,
  ParameterId,
  ParameterOptionId,
  CompositionId,
  CompositionVersionId,
  Slug,
} from '../../domain/types/branded';
import { Neo4jError } from '../../domain/types/errors';
import { CypherQuery, QueryParameters } from '../../domain/types/database';

/**
 * Test data structure for generic persistence tests
 */
export interface GenericPersistenceTestData {
  snippets: Snippet[];
  snippetVersions: Array<{
    version: SnippetVersion;
    snippetId: SnippetId;
    previousVersionId?: SnippetVersionId;
  }>;
  tags: Tag[];
  parameters: Parameter[];
  parameterOptions: Array<{
    option: ParameterOption;
    parameterId: ParameterId;
    previousOptionId?: ParameterOptionId;
  }>;
  compositions: Composition[];
  compositionVersions: Array<{
    version: CompositionVersion;
    compositionId: CompositionId;
    previousVersionId?: CompositionVersionId;
  }>;
}

/**
 * Generate test snippet data
 */
export const generateTestSnippet = (
  id: string,
  name: string,
  description: string = 'Test snippet description',
): Snippet => ({
  id: Schema.decodeSync(SnippetId)(id),
  name: Schema.decodeSync(Slug)(name),
  description,
});

/**
 * Generate test tag data
 */
export const generateTestTag = (
  id: string,
  name: string,
  description: string = 'Test tag description',
): Tag => ({
  id: Schema.decodeSync(TagId)(id),
  name: Schema.decodeSync(Slug)(name),
  description,
});

/**
 * Generate test parameter data
 */
export const generateTestParameter = (
  id: string,
  name: string,
  description: string = 'Test parameter description',
): Parameter => ({
  id: Schema.decodeSync(ParameterId)(id),
  name: Schema.decodeSync(Slug)(name),
  description,
});

/**
 * Generate test composition data
 */
export const generateTestComposition = (
  id: string,
  name: string,
  description: string = 'Test composition description',
): Composition => ({
  id: Schema.decodeSync(CompositionId)(id),
  name: Schema.decodeSync(Slug)(name),
  description,
});

/**
 * Generate test snippet version data (raw format for database)
 */
export const generateTestSnippetVersionRaw = (
  id: string,
  content: string,
  commitMessage: string = 'Test commit',
  createdAt: string = '2024-01-01T00:00:00.000Z',
) => ({
  id,
  content,
  createdAt,
  commit_message: commitMessage,
});

/**
 * Generate test snippet version data
 */
export const generateTestSnippetVersion = (
  id: string,
  content: string,
  commitMessage: string = 'Test commit',
  createdAt: string = '2024-01-01T00:00:00.000Z',
): SnippetVersion => ({
  id: Schema.decodeSync(SnippetVersionId)(id),
  content,
  createdAt: Schema.decodeSync(Schema.DateTimeUtc)(createdAt),
  commit_message: commitMessage,
});

/**
 * Generate test parameter option data (raw format for database)
 */
export const generateTestParameterOptionRaw = (
  id: string,
  value: string,
  commitMessage: string = 'Test commit',
  createdAt: string = '2024-01-01T00:00:00.000Z',
) => ({
  id,
  value,
  createdAt,
  commit_message: commitMessage,
});

/**
 * Generate test parameter option data
 */
export const generateTestParameterOption = (
  id: string,
  value: string,
  commitMessage: string = 'Test commit',
  createdAt: string = '2024-01-01T00:00:00.000Z',
): ParameterOption => ({
  id: Schema.decodeSync(ParameterOptionId)(id),
  value,
  createdAt: Schema.decodeSync(Schema.DateTimeUtc)(createdAt),
  commit_message: commitMessage,
});

/**
 * Generate test composition version data
 */
export const generateTestCompositionVersion = (
  id: string,
  snippets: CompositionVersion['snippets'] = [],
  commitMessage: string = 'Test commit',
  createdAt: string = '2024-01-01T00:00:00.000Z',
): CompositionVersion => ({
  id: Schema.decodeSync(CompositionVersionId)(id),
  snippets,
  createdAt: Schema.decodeSync(Schema.DateTimeUtc)(createdAt),
  commit_message: commitMessage,
});

/**
 * Default test data
 */
const defaultTestData: GenericPersistenceTestData = {
  snippets: [
    generateTestSnippet(
      '550e8400-e29b-41d4-a716-446655440001',
      'existing-snippet',
      'An existing snippet',
    ),
    generateTestSnippet(
      '550e8400-e29b-41d4-a716-446655440002',
      'test-snippet',
      'A test snippet',
    ),
  ],
  snippetVersions: [
    {
      // Store raw version for mock returns
      version: {
        ...generateTestSnippetVersionRaw(
          '650e8400-e29b-41d4-a716-446655440001',
          'You {{obligation_level}} answer the question',
          'Initial version',
          '2024-01-01T00:00:00.000Z',
        ),
      } as any,
      snippetId: Schema.decodeSync(SnippetId)(
        '550e8400-e29b-41d4-a716-446655440001',
      ),
    },
    {
      // Store raw version for mock returns
      version: {
        ...generateTestSnippetVersionRaw(
          '650e8400-e29b-41d4-a716-446655440002',
          'You {{obligation_level}} provide a helpful response',
          'Updated wording',
          '2024-01-02T00:00:00.000Z',
        ),
      } as any,
      snippetId: Schema.decodeSync(SnippetId)(
        '550e8400-e29b-41d4-a716-446655440001',
      ),
      previousVersionId: Schema.decodeSync(SnippetVersionId)(
        '650e8400-e29b-41d4-a716-446655440001',
      ),
    },
  ],
  tags: [
    generateTestTag(
      '750e8400-e29b-41d4-a716-446655440001',
      'existing-tag',
      'An existing tag',
    ),
    generateTestTag(
      '750e8400-e29b-41d4-a716-446655440002',
      'test-tag',
      'A test tag',
    ),
  ],
  parameters: [
    generateTestParameter(
      '850e8400-e29b-41d4-a716-446655440001',
      'obligation-level',
      'Defines obligation level',
    ),
  ],
  parameterOptions: [
    {
      // Store raw option for mock returns
      option: {
        ...generateTestParameterOptionRaw(
          '950e8400-e29b-41d4-a716-446655440001',
          'must',
          'Initial option',
          '2024-01-01T00:00:00.000Z',
        ),
      } as any,
      parameterId: Schema.decodeSync(ParameterId)(
        '850e8400-e29b-41d4-a716-446655440001',
      ),
    },
  ],
  compositions: [
    generateTestComposition(
      'a50e8400-e29b-41d4-a716-446655440001',
      'test-composition',
      'A test composition',
    ),
  ],
  compositionVersions: [],
};

/**
 * Query tracking for tests
 */
export interface QueryTracker {
  queries: Array<{
    query: string;
    params: any;
  }>;
}

/**
 * Create Neo4j test layer with generic data
 */
export const Neo4jTestWithGenericData = (
  testData: GenericPersistenceTestData = defaultTestData,
  queryTracker?: QueryTracker,
) => {
  // Mock function to handle parameter-based queries
  const handleQuery = (query: string, params: any = {}): unknown[] => {
    const queryStr = query.toString();
    
    // Track queries if tracker provided
    if (queryTracker) {
      queryTracker.queries.push({ query: queryStr, params });
    }

    // Generic find by name query
    if (queryStr.match(/MATCH \(n:(\w+) \{name: \$name\}\) RETURN n/)) {
      const nodeLabel = queryStr.match(/MATCH \(n:(\w+)/)?.[1];
      const name = params.name;

      let results: unknown[] = [];
      switch (nodeLabel) {
        case 'Snippet': {
          results = testData.snippets
            .filter((s) => s.name === name)
            .map((s) => ({ n: s }));
          break;
        }
        case 'Tag': {
          results = testData.tags
            .filter((t) => t.name === name)
            .map((t) => ({ n: t }));
          break;
        }
        case 'Parameter': {
          results = testData.parameters
            .filter((p) => p.name === name)
            .map((p) => ({ n: p }));
          break;
        }
        case 'Composition': {
          results = testData.compositions
            .filter((c) => c.name === name)
            .map((c) => ({ n: c }));
          break;
        }
      }
      return results;
    }

    // Generic create query
    if (queryStr.match(/CREATE \(n:(\w+) \$props\) RETURN n/)) {
      return [{ n: params.props }];
    }

    // Generic list all query
    if (queryStr.match(/MATCH \(n:(\w+)\) RETURN n ORDER BY n\.name/)) {
      const nodeLabel = queryStr.match(/MATCH \(n:(\w+)/)?.[1];

      let results: unknown[] = [];
      switch (nodeLabel) {
        case 'Snippet': {
          results = testData.snippets
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => ({ n: s }));
          break;
        }
        case 'Tag': {
          results = testData.tags
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => ({ n: t }));
          break;
        }
        case 'Parameter': {
          results = testData.parameters
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((p) => ({ n: p }));
          break;
        }
        case 'Composition': {
          results = testData.compositions
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => ({ n: c }));
          break;
        }
      }
      return results;
    }

    // Check parent exists for version creation
    if (queryStr.match(/MATCH \(p:(\w+) \{id: \$id\}\) RETURN p/)) {
      const nodeLabel = queryStr.match(/MATCH \(p:(\w+)/)?.[1];
      const id = params.id || params.parentId;

      switch (nodeLabel) {
        case 'Snippet': {
          const snippet = testData.snippets.find((s) => s.id === id);
          return snippet ? [{ p: snippet }] : [];
        }
        case 'Parameter': {
          const parameter = testData.parameters.find((p) => p.id === id);
          return parameter ? [{ p: parameter }] : [];
        }
        case 'Composition': {
          const composition = testData.compositions.find((c) => c.id === id);
          return composition ? [{ p: composition }] : [];
        }
        case 'Tag': {
          const tag = testData.tags.find((t) => t.id === id);
          return tag ? [{ p: tag }] : [];
        }
      }
    }

    // Find previous version
    if (
      queryStr.includes('VERSION_OF') &&
      queryStr.includes('ORDER BY v.createdAt DESC')
    ) {
      const parentId = params.id || params.parentId;

      if (queryStr.includes('SnippetVersion')) {
        const versions = testData.snippetVersions
          .filter((sv) => sv.snippetId === parentId)
          .sort((a, b) => {
            const dateA = new Date(
              typeof a.version.createdAt === 'string'
                ? a.version.createdAt
                : String(a.version.createdAt),
            );
            const dateB = new Date(
              typeof b.version.createdAt === 'string'
                ? b.version.createdAt
                : String(b.version.createdAt),
            );
            return dateB.getTime() - dateA.getTime();
          });
        // Return raw data format (version is already raw)
        if (versions.length > 0) {
          return [{ v: versions[0].version }];
        }
        return [];
      }
      if (queryStr.includes('ParameterOption')) {
        const options = testData.parameterOptions
          .filter((po) => po.parameterId === parentId)
          .sort((a, b) => {
            const dateA = new Date(
              typeof a.option.createdAt === 'string'
                ? a.option.createdAt
                : String(a.option.createdAt),
            );
            const dateB = new Date(
              typeof b.option.createdAt === 'string'
                ? b.option.createdAt
                : String(b.option.createdAt),
            );
            return dateB.getTime() - dateA.getTime();
          });
        // Return raw data format (option is already raw)
        if (options.length > 0) {
          return [{ v: options[0].option }];
        }
        return [];
      }
      if (queryStr.includes('CompositionVersion')) {
        const versions = testData.compositionVersions
          .filter((cv) => cv.compositionId === parentId)
          .sort((a, b) => {
            const dateA = new Date(
              typeof a.version.createdAt === 'string'
                ? a.version.createdAt
                : String(a.version.createdAt),
            );
            const dateB = new Date(
              typeof b.version.createdAt === 'string'
                ? b.version.createdAt
                : String(b.version.createdAt),
            );
            return dateB.getTime() - dateA.getTime();
          });
        // Return raw data format (version is already raw if using raw generators)
        if (versions.length > 0) {
          return [{ v: versions[0].version }];
        }
        return [];
      }
    }

    // Create version query
    if (queryStr.includes('CREATE (v:') && queryStr.includes('VERSION_OF')) {
      // Return raw format - if createdAt is a Date/DateTime object, convert to string
      const props = params.props;
      const rawProps = {
        ...props,
        createdAt:
          typeof props.createdAt === 'string'
            ? props.createdAt
            : typeof props.createdAt === 'object' && props.createdAt.toString
              ? // Extract ISO string from DateTime.Utc(...) format
                props.createdAt
                  .toString()
                  .match(/DateTime\.Utc\((.*?)\)/)?.[1] ||
                String(props.createdAt)
              : String(props.createdAt),
      };
      return [{ v: rawProps }];
    }

    // Default: return empty array for unmatched queries
    return [];
  };

  // Mock transaction handler
  const mockTransaction = <A>(
    operations: (tx: TransactionContext) => Effect.Effect<A, Neo4jError, never>,
  ): Effect.Effect<A, Neo4jError, never> => {
    const mockTx: TransactionContext = {
      run: <T = unknown>(query: CypherQuery, params?: QueryParameters) =>
        Effect.succeed(
          handleQuery(query.toString(), params) as T[],
        ) as Effect.Effect<T[], Neo4jError, never>,
    };
    return operations(mockTx);
  };

  const mockNeo4j = Neo4jService.of({
    runQuery: <T = unknown>(query: CypherQuery, params?: QueryParameters) =>
      Effect.succeed(
        handleQuery(query.toString(), params) as T[],
      ) as Effect.Effect<T[], Neo4jError, never>,
    runInTransaction: mockTransaction,
    runBatch: <T = unknown>(
      queries: Array<{ query: CypherQuery; params?: QueryParameters }>,
    ) =>
      Effect.succeed(
        queries.map((q) => handleQuery(q.query.toString(), q.params) as T[]),
      ) as Effect.Effect<T[][], Neo4jError, never>,
    withSession: <A>(
      work: (session: any) => Effect.Effect<A, Neo4jError, never>,
    ) => work({} as any) as Effect.Effect<A, Neo4jError, never>,
  });

  return Layer.succeed(Neo4jService, mockNeo4j);
};
