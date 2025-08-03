import { Effect, Layer, Schema } from 'effect';
import { StorageService, TransactionContext, type StorageError } from '../storage';
import { Neo4jError, GitPersistenceError } from '../../domain/types/errors';
import { StorageBackend } from '../../domain/types/config';
import { Tag } from '../../domain/types/tag';
import {
  ContentNode,
  ContentNodeVersion,
} from '../../domain/types/contentNode';
import {
  TagId,
  ContentNodeId,
  ContentNodeVersionId,
  Slug,
} from '../../domain/types/branded';

/**
 * Test data structure for generic persistence testing
 */
export interface GenericPersistenceTestData {
  contentNodes: ContentNode[];
  contentNodeVersions: Array<{
    version: ContentNodeVersion;
    nodeId: ContentNodeId;
    previousVersionId?: ContentNodeVersionId;
  }>;
  tags: Tag[];
}

/**
 * Generate test content node data
 */
export const generateTestContentNode = (
  id: string,
  name: string,
  description: string = 'Test content node description',
): ContentNode => ({
  id: Schema.decodeSync(ContentNodeId)(id),
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
 * Generate test content node version data (raw format for database)
 */
export const generateTestContentNodeVersionRaw = (
  id: string,
  content: string,
  commitMessage: string = 'Test commit',
  createdAt: string = '2024-01-01T00:00:00.000Z',
) => ({
  id,
  content,
  createdAt,
  commitMessage,
});

/**
 * Default test data
 */
const defaultTestData: GenericPersistenceTestData = {
  contentNodes: [
    generateTestContentNode(
      '550e8400-e29b-41d4-a716-446655440001',
      'existing-content-node',
      'An existing content node',
    ),
    generateTestContentNode(
      '550e8400-e29b-41d4-a716-446655440002',
      'test-content-node',
      'A test content node',
    ),
  ],
  contentNodeVersions: [
    {
      // Store raw version for mock returns
      version: {
        id: Schema.decodeSync(ContentNodeVersionId)(
          '650e8400-e29b-41d4-a716-446655440001',
        ),
        content: 'Test content with {{parameter}}',
        createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
          '2024-01-01T00:00:00.000Z',
        ),
        commitMessage: 'Initial version',
      },
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440001',
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
 * Create storage test layer with generic data
 * @param testData - The test data to use
 * @param queryTracker - Optional query tracker for testing
 * @param backend - The storage backend to simulate ('neo4j' or 'git')
 */
export const StorageTestWithGenericData = (
  testData: GenericPersistenceTestData = defaultTestData,
  queryTracker?: QueryTracker,
  backend: StorageBackend = 'neo4j',
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
        case 'ContentNode': {
          results = testData.contentNodes
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
        default: {
          results = [];
        }
      }
      return results;
    }

    // Generic create entity query
    if (queryStr.match(/CREATE \(n:\w+ \$props\) RETURN n/)) {
      return [{ n: params.props }];
    }

    // Generic list all query
    if (queryStr.match(/MATCH \(n:(\w+)\) RETURN n ORDER BY n\.name/)) {
      const nodeLabel = queryStr.match(/MATCH \(n:(\w+)/)?.[1];

      switch (nodeLabel) {
        case 'ContentNode': {
          return testData.contentNodes
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => ({ n: s }));
        }
        case 'Tag': {
          return testData.tags
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => ({ n: t }));
        }
        default: {
          return [];
        }
      }
    }

    // Default empty result
    return [];
  };

  // Return Neo4j service with query handler
  return Layer.succeed(
    StorageService,
    StorageService.of({
      runQuery: <T = unknown>(query: any, params: any = {}) => {
        const data = handleQuery(query, params);
        return Effect.succeed(data as T[]);
      },
      runInTransaction: <A>(operations: any) => {
        const txContext: TransactionContext = {
          run: <T = unknown>(query: any, params: any = {}) => {
            const data = handleQuery(query, params);
            return Effect.succeed(data as T[]);
          },
        };
        return operations(txContext);
      },
      runBatch: <T = unknown>(queries: any) => {
        const results = queries.map(({ query, params }: any) =>
          handleQuery(query, params),
        );
        return Effect.succeed(results as T[][]);
      },
      withSession: () => {
        const error: StorageError =
          backend === 'git'
            ? new GitPersistenceError({
                path: '/test/git/repo',
                operation: 'read',
                originalMessage: 'withSession not implemented in test layer',
              })
            : new Neo4jError({
                query: '',
                originalMessage: 'withSession not implemented in test layer',
              });
        return Effect.fail(error);
      },
    }),
  );
};
