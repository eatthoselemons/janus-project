import { Effect, Layer, Schema } from 'effect';
import { Neo4jService } from '../neo4j';
import {
  ContentNode,
  ContentNodeVersion,
  ContentNodeId,
  ContentNodeVersionId,
  EdgeOperation,
  IncludesEdgeProperties,
} from '../../domain/types/contentNode';
import { TestCase, TestCaseTagName } from '../../domain/types/testCase';
import { Slug } from '../../domain/types/branded';
import { Neo4jError } from '../../domain/types/errors';

/**
 * Test data structure for content nodes and versions
 */
export interface ContentTestData {
  nodes: ContentNode[];
  versions: Array<{
    version: ContentNodeVersion;
    nodeId: ContentNodeId;
    previousVersionId?: ContentNodeVersionId;
  }>;
  edges: Array<{
    parentId: ContentNodeVersionId;
    childId: ContentNodeVersionId;
    properties: IncludesEdgeProperties;
  }>;
  tags: Array<{
    nodeId: ContentNodeId;
    tagName: string;
  }>;
  testCases: TestCase[];
}

/**
 * Generate test content node data
 */
export const generateTestContentNode = (
  name: string,
  description: string = 'Test content node',
  id: string = '550e8400-e29b-41d4-a716-446655440001',
): ContentNode => ({
  id: Schema.decodeSync(ContentNodeId)(id),
  name: Schema.decodeSync(Slug)(name),
  description,
});

/**
 * Generate test content node version data
 */
export const generateTestContentNodeVersion = (
  content: string | undefined,
  commitMessage: string = 'Test commit',
  createdAt: string = '2024-01-01T00:00:00.000Z',
  id: string = '650e8400-e29b-41d4-a716-446655440002',
): ContentNodeVersion => ({
  id: Schema.decodeSync(ContentNodeVersionId)(id),
  content,
  createdAt: Schema.decodeSync(Schema.DateTimeUtc)(createdAt),
  commitMessage,
});

/**
 * Default test data
 */
const defaultTestData: ContentTestData = {
  nodes: [
    generateTestContentNode(
      'greeting-template',
      'Greeting template',
      '550e8400-e29b-41d4-a716-446655440001',
    ),
    generateTestContentNode(
      'user-name',
      'User name parameter',
      '550e8400-e29b-41d4-a716-446655440002',
    ),
    generateTestContentNode(
      'be-concise',
      'Conciseness instruction',
      '550e8400-e29b-41d4-a716-446655440003',
    ),
    generateTestContentNode(
      'be-helpful',
      'Helpfulness instruction',
      '550e8400-e29b-41d4-a716-446655440004',
    ),
  ],
  versions: [
    {
      version: generateTestContentNodeVersion(
        'Hello {{name}}, welcome to our service!',
        'Initial greeting template',
        '2024-01-01T00:00:00.000Z',
        '650e8400-e29b-41d4-a716-446655440001',
      ),
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440001',
      ),
    },
    {
      version: generateTestContentNodeVersion(
        'Alice',
        'Default user name',
        '2024-01-02T00:00:00.000Z',
        '650e8400-e29b-41d4-a716-446655440002',
      ),
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440002',
      ),
    },
    {
      version: generateTestContentNodeVersion(
        'Be concise and direct in your responses',
        'Conciseness instruction',
        '2024-01-03T00:00:00.000Z',
        '650e8400-e29b-41d4-a716-446655440003',
      ),
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440003',
      ),
    },
    {
      version: generateTestContentNodeVersion(
        'Be helpful and supportive',
        'Helpfulness instruction',
        '2024-01-04T00:00:00.000Z',
        '650e8400-e29b-41d4-a716-446655440004',
      ),
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440004',
      ),
    },
  ],
  edges: [
    {
      parentId: Schema.decodeSync(ContentNodeVersionId)(
        '650e8400-e29b-41d4-a716-446655440001',
      ),
      childId: Schema.decodeSync(ContentNodeVersionId)(
        '650e8400-e29b-41d4-a716-446655440002',
      ),
      properties: {
        operation: 'insert' as EdgeOperation,
        key: 'name',
      },
    },
  ],
  tags: [
    {
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440001',
      ),
      tagName: 'greeting',
    },
    {
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440001',
      ),
      tagName: 'formal',
    },
    {
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440001',
      ),
      tagName: 'tone',
    },
    {
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440002',
      ),
      tagName: 'parameter',
    },
    {
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440003',
      ),
      tagName: 'instruction',
    },
    {
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440003',
      ),
      tagName: 'tone',
    },
    {
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440004',
      ),
      tagName: 'instruction',
    },
    {
      nodeId: Schema.decodeSync(ContentNodeId)(
        '550e8400-e29b-41d4-a716-446655440004',
      ),
      tagName: 'behavior',
    },
  ],
  testCases: [
    {
      id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
        '123e4567-e89b-42d3-a456-426614174000',
      ),
      name: 'Concise instruction as system',
      description: 'Test with conciseness in system role',
      createdAt: Schema.decodeSync(Schema.DateTimeUtc)('2024-01-01T00:00:00Z'),
      llmModel: Schema.decodeSync(Schema.String.pipe(Schema.brand('LLMModel')))(
        'gpt-4',
      ),
      messageSlots: [
        {
          role: 'system',
          tags: ['instruction'] as TestCaseTagName[],
          sequence: 0,
        },
        { role: 'user', tags: ['greeting'] as TestCaseTagName[], sequence: 1 },
      ],
    },
  ],
};

/**
 * Deep copy test data to avoid mutations
 */
const copyTestData = (data: ContentTestData): ContentTestData => ({
  nodes: [...data.nodes],
  versions: [...data.versions],
  edges: [...data.edges],
  tags: [...data.tags],
  testCases: [...data.testCases],
});

/**
 * Create Neo4j test layer with content data
 */
export const ContentTestWithData = (
  initialData: ContentTestData = defaultTestData,
) => {
  // Create a deep copy to avoid cross-test pollution
  const testData = copyTestData(initialData);
  // Mock function to handle parameter-based queries
  const handleQuery = (query: string, params: any = {}): unknown[] => {
    // Check if content node exists by name
    if (query.includes('MATCH (n:ContentNode {name: $name}) RETURN n')) {
      const name = params.name;
      return testData.nodes.filter((n) => n.name === name).map((n) => ({ n }));
    }

    // Create content node query
    if (query.includes('CREATE (n:ContentNode $props) RETURN n')) {
      // Add the new node to testData
      if (params.props) {
        testData.nodes.push(params.props as ContentNode);
      }
      return [{ n: params.props }];
    }

    // Find content node by ID (for version creation)
    if (query.includes('MATCH (p:ContentNode {id: $id}) RETURN p')) {
      const id = params.id;
      const node = testData.nodes.find((n) => n.id === id);
      return node ? [{ p: node }] : [];
    }

    // Find latest version query
    if (
      query.includes(
        'MATCH (p:ContentNode {id: $parentId})<-[:VERSION_OF]-(v:ContentNodeVersion)',
      )
    ) {
      const parentId = params.parentId;
      const versions = testData.versions
        .filter((v) => v.nodeId === parentId)
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
        .map((v) => ({
          v: {
            ...v.version,
            createdAt: JSON.parse(JSON.stringify(v.version.createdAt)),
          },
        }));
      return versions;
    }

    // Create version with previous
    if (query.includes('CREATE (v)-[:PREVIOUS_VERSION]->(prev)')) {
      return [
        {
          v: {
            id: params.props.id,
            content: params.props.content,
            createdAt: params.props.createdAt,
            commitMessage: params.props.commitMessage,
          },
        },
      ];
    }

    // Create version without previous
    if (
      query.includes('CREATE (v)-[:VERSION_OF]->(p)') &&
      query.includes('CREATE (v:ContentNodeVersion $props)')
    ) {
      // Add the new version to test data
      if (params.props) {
        const nodeId = params.parentId;
        testData.versions.push({
          version: {
            id: params.props.id,
            content: params.props.content,
            createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
              params.props.createdAt,
            ),
            commitMessage: params.props.commitMessage,
          },
          nodeId,
        });
      }
      return [
        {
          v: {
            id: params.props.id,
            content: params.props.content,
            createdAt: params.props.createdAt,
            commitMessage: params.props.commitMessage,
          },
        },
      ];
    }

    // Get node with children (old combined query)
    if (
      query.includes('MATCH (node:ContentNodeVersion {id: $versionId})') &&
      query.includes(
        'OPTIONAL MATCH (node)-[r:INCLUDES]->(child:ContentNodeVersion)',
      )
    ) {
      const versionId = params.versionId;
      const version = testData.versions.find((v) => v.version.id === versionId);
      if (!version) return [];

      const children = testData.edges
        .filter((e) => e.parentId === versionId)
        .map((e) => {
          const childVersion = testData.versions.find(
            (v) => v.version.id === e.childId,
          );
          return {
            child: childVersion
              ? {
                  ...childVersion.version,
                  createdAt: JSON.parse(
                    JSON.stringify(childVersion.version.createdAt),
                  ),
                }
              : undefined,
            edge: e.properties,
          };
        })
        .filter((c) => c.child !== undefined);

      return [
        {
          node: {
            ...version.version,
            createdAt: JSON.parse(JSON.stringify(version.version.createdAt)),
          },
          children: children,
        },
      ];
    }

    // Get node only (new query pattern)
    if (
      query.includes('MATCH (node:ContentNodeVersion {id: $versionId})') &&
      query.includes('RETURN node') &&
      !query.includes('OPTIONAL MATCH')
    ) {
      const versionId = params.versionId;
      const version = testData.versions.find((v) => v.version.id === versionId);
      if (!version) return [];

      return [
        {
          node: {
            ...version.version,
            createdAt: JSON.parse(JSON.stringify(version.version.createdAt)),
          },
        },
      ];
    }

    // Get children of a node (new query pattern)
    if (
      query.includes(
        'MATCH (node:ContentNodeVersion {id: $versionId})-[r:INCLUDES]->(child:ContentNodeVersion)',
      ) &&
      query.includes('RETURN child, r as edge')
    ) {
      const versionId = params.versionId;
      return testData.edges
        .filter((e) => e.parentId === versionId)
        .map((e) => {
          const childVersion = testData.versions.find(
            (v) => v.version.id === e.childId,
          );
          if (!childVersion) return null;
          return {
            child: {
              ...childVersion.version,
              createdAt: JSON.parse(
                JSON.stringify(childVersion.version.createdAt),
              ),
            },
            edge: e.properties,
          };
        })
        .filter((c) => c !== null);
    }

    // Get children
    if (
      query.includes(
        'MATCH (parent:ContentNodeVersion {id: $parentId})-[r:INCLUDES]->(child:ContentNodeVersion)',
      )
    ) {
      const parentId = params.parentId;
      return testData.edges
        .filter((e) => e.parentId === parentId)
        .map((e) => {
          const childVersion = testData.versions.find(
            (v) => v.version.id === e.childId,
          );
          return {
            child: childVersion
              ? {
                  ...childVersion.version,
                  createdAt: JSON.parse(
                    JSON.stringify(childVersion.version.createdAt),
                  ),
                }
              : undefined,
            r: e.properties,
          };
        })
        .filter((c) => c.child !== undefined);
    }

    // Create tag
    if (query.includes('MERGE (t:Tag {name: $tagName})')) {
      // Check if this is part of the tagContent flow
      if (query.includes('MERGE (n)-[:HAS_TAG]->(t)')) {
        const nodeId = params.nodeId;
        const tagName = params.tagName;
        if (nodeId && tagName) {
          // Add tag to testData if not already exists
          const exists = testData.tags.some(
            (t) => t.nodeId === nodeId && t.tagName === tagName,
          );
          if (!exists) {
            testData.tags.push({ nodeId, tagName });
          }
        }
      }
      return [];
    }

    // Create INCLUDES relationship
    if (query.includes('CREATE (parent)-[:INCLUDES {operation:')) {
      // Add edge to test data
      if (params.parentId && params.childId) {
        testData.edges.push({
          parentId: params.parentId,
          childId: params.childId,
          properties: {
            operation: params.operation,
            key: params.key || undefined,
          },
        });
      }
      return [];
    }

    // Find content for slot with tags
    if (
      query.includes(
        'MATCH (n:ContentNode)-[:VERSION_OF]-(v:ContentNodeVersion)',
      ) &&
      query.includes('WHERE ALL(tag IN $tags')
    ) {
      const tags = params.tags || [];
      // Find nodes that have all required tags
      const matchingNodes = testData.nodes.filter((node) => {
        const nodeTags = testData.tags
          .filter((t) => t.nodeId === node.id)
          .map((t) => t.tagName);
        return tags.every((tag: string) => nodeTags.includes(tag));
      });

      // Get latest version for each matching node
      return matchingNodes
        .map((node) => {
          const versions = testData.versions
            .filter((v) => v.nodeId === node.id)
            .sort((a, b) => {
              const dateA = new Date(
                JSON.parse(JSON.stringify(a.version.createdAt)),
              );
              const dateB = new Date(
                JSON.parse(JSON.stringify(b.version.createdAt)),
              );
              return dateB.getTime() - dateA.getTime();
            });
          return versions[0] ? { versionId: versions[0].version.id } : null;
        })
        .filter((v) => v !== null);
    }

    // List all nodes - check this after search to avoid false matches
    if (
      query.includes('MATCH (n:ContentNode)') &&
      query.includes('RETURN n') &&
      query.includes('ORDER BY n.name')
    ) {
      return testData.nodes
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((n) => ({ n }));
    }

    return [];
  };

  // Return Neo4j service with query handler
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
export const ContentTestWithEmptyData = () =>
  ContentTestWithData({
    nodes: [],
    versions: [],
    edges: [],
    tags: [],
    testCases: [],
  });

/**
 * Test layer for node without versions
 */
export const ContentTestWithNodeNoVersions = ContentTestWithData({
  nodes: [
    generateTestContentNode(
      'node-no-versions',
      'Has no versions',
      '550e8400-e29b-41d4-a716-446655440001',
    ),
  ],
  versions: [],
  edges: [],
  tags: [],
  testCases: [],
});
