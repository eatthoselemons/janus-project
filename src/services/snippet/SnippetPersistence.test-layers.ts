import { Effect, Layer, Schema } from 'effect';
import { Neo4jService } from '../neo4j';
import { cypher } from '../../domain/types/database';
import { Snippet, SnippetVersion } from '../../domain/types/snippet';
import { SnippetId, SnippetVersionId, Slug } from '../../domain/types/branded';
import { Neo4jError } from '../../domain/types/errors';

/**
 * Test data structure for snippets and versions
 */
export interface SnippetPersistenceTestData {
  snippets: Snippet[];
  snippetVersions: Array<{
    version: SnippetVersion;
    snippetId: SnippetId;
    previousVersionId?: SnippetVersionId;
  }>;
}

/**
 * Generate test snippet data
 */
export const generateTestSnippet = (
  name: string,
  description: string = 'Test snippet description',
): Snippet => ({
  id: Schema.decodeSync(SnippetId)('550e8400-e29b-41d4-a716-446655440001'),
  name: Schema.decodeSync(Slug)(name),
  description,
});

/**
 * Generate test snippet version data
 */
export const generateTestSnippetVersion = (
  content: string,
  commitMessage: string = 'Test commit',
  createdAt: string = '2024-01-01T00:00:00.000Z',
): SnippetVersion => ({
  id: Schema.decodeSync(SnippetVersionId)(
    '550e8400-e29b-41d4-a716-446655440002',
  ),
  content,
  createdAt: Schema.decodeSync(Schema.DateTimeUtc)(createdAt),
  commit_message: commitMessage,
});

/**
 * Default test data
 */
const defaultTestData: SnippetPersistenceTestData = {
  snippets: [
    generateTestSnippet('existing-snippet', 'An existing snippet'),
    generateTestSnippet('test-snippet', 'A test snippet'),
    generateTestSnippet('search-snippet', 'A searchable test snippet'),
  ],
  snippetVersions: [
    {
      version: generateTestSnippetVersion(
        'You {{obligation_level}} answer the question',
        'Initial version',
        '2024-01-01T00:00:00.000Z',
      ),
      snippetId: Schema.decodeSync(SnippetId)(
        '550e8400-e29b-41d4-a716-446655440001',
      ),
    },
    {
      version: generateTestSnippetVersion(
        'You {{obligation_level}} provide a helpful response',
        'Updated wording',
        '2024-01-02T00:00:00.000Z',
      ),
      snippetId: Schema.decodeSync(SnippetId)(
        '550e8400-e29b-41d4-a716-446655440001',
      ),
      previousVersionId: Schema.decodeSync(SnippetVersionId)(
        '550e8400-e29b-41d4-a716-446655440002',
      ),
    },
  ],
};

/**
 * Create Neo4j test layer with snippet data
 */
export const Neo4jTestWithSnippetData = (
  testData: SnippetPersistenceTestData = defaultTestData,
) => {
  // # Reason: Mock function to handle parameter-based queries
  const handleQuery = (query: string, params: any = {}): unknown[] => {
    // Check if snippet exists by name
    if (query.includes('MATCH (s:Snippet {name: $name}) RETURN s')) {
      const name = params.name;
      return testData.snippets
        .filter((s) => s.name === name)
        .map((s) => ({ s }));
    }

    // Create snippet query
    if (
      query.includes(
        'CREATE (s:Snippet {id: $id, name: $name, description: $description})',
      )
    ) {
      return [
        {
          s: {
            id: params.id,
            name: params.name,
            description: params.description,
          },
        },
      ];
    }

    // Find snippet by ID (for version creation)
    if (query.includes('MATCH (s:Snippet {id: $id}) RETURN s')) {
      const id = params.id;
      const snippet = testData.snippets.find((s) => s.id === id);
      return snippet ? [{ s: snippet }] : [];
    }

    // Find latest version query
    if (
      query.includes(
        'MATCH (s:Snippet {id: $snippetId})<-[:VERSION_OF]-(sv:SnippetVersion)',
      )
    ) {
      const snippetId = params.snippetId;
      const versions = testData.snippetVersions
        .filter((sv) => sv.snippetId === snippetId)
        .sort((a, b) => {
          const dateA = new Date(
            JSON.parse(JSON.stringify(a.version.createdAt)),
          );
          const dateB = new Date(
            JSON.parse(JSON.stringify(b.version.createdAt)),
          );
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 1)
        .map((sv) => ({
          sv: {
            ...sv.version,
            createdAt: JSON.parse(JSON.stringify(sv.version.createdAt)),
          },
        }));
      return versions;
    }

    // Create version with previous
    if (query.includes('CREATE (sv)-[:PREVIOUS_VERSION]->(prev)')) {
      return [
        {
          sv: {
            id: params.versionId,
            content: params.content,
            createdAt: '2024-01-03T00:00:00.000Z',
            commit_message: params.commitMessage,
          },
        },
      ];
    }

    // Create version without previous
    if (
      query.includes('CREATE (sv)-[:VERSION_OF]->(s)') &&
      query.includes('CREATE (sv:SnippetVersion')
    ) {
      return [
        {
          sv: {
            id: params.versionId,
            content: params.content,
            createdAt: '2024-01-03T00:00:00.000Z',
            commit_message: params.commitMessage,
          },
        },
      ];
    }

    // Search snippets - check for WHERE clause first
    if (query.includes('WHERE toLower(s.name) CONTAINS toLower($query)')) {
      const searchQuery = params.query?.toLowerCase() || '';
      return testData.snippets
        .filter(
          (s) =>
            s.name.toLowerCase().includes(searchQuery) ||
            s.description.toLowerCase().includes(searchQuery),
        )
        .map((s) => ({ s }));
    }

    // List all snippets - check this after search to avoid false matches
    if (
      query.includes('MATCH (s:Snippet)') &&
      query.includes('RETURN s') &&
      query.includes('ORDER BY s.name') &&
      !query.includes('WHERE')
    ) {
      return testData.snippets
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ s }));
    }

    return [];
  };

  // # Reason: Return Neo4j service with query handler
  return Layer.succeed(
    Neo4jService,
    Neo4jService.of({
      runQuery: <T = unknown>(query: any, params: any = {}) => {
        const data = handleQuery(query, params);
        return Effect.succeed(data as T[]);
      },
      runInTransaction: <A>(operations: any) => {
        const txContext = {
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
      withSession: () =>
        Effect.fail(
          new Neo4jError({
            query: '',
            originalMessage: 'withSession not implemented in test layer',
          }),
        ),
    }),
  );
};

/**
 * Test layer with empty data
 */
export const Neo4jTestWithEmptyData = Neo4jTestWithSnippetData({
  snippets: [],
  snippetVersions: [],
});

/**
 * Test layer for snippet without versions
 */
export const Neo4jTestWithSnippetNoVersions = Neo4jTestWithSnippetData({
  snippets: [generateTestSnippet('snippet-no-versions', 'Has no versions')],
  snippetVersions: [],
});
