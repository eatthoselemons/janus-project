import { Effect, Layer, Schema, Match } from 'effect';
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

  // Query handler functions
  const findNodeByName = (params: any): unknown[] => {
    const name = params.name;
    return testData.nodes.filter((n) => n.name === name).map((n) => ({ n }));
  };

  const createNode = (params: any): unknown[] => {
    if (params.props) {
      testData.nodes.push(params.props as ContentNode);
    }
    return [{ n: params.props }];
  };

  const findNodeById = (params: any): unknown[] => {
    const id = params.id;
    const node = testData.nodes.find((n) => n.id === id);
    return node ? [{ p: node }] : [];
  };

  const findLatestVersion = (params: any): unknown[] => {
    const parentId = params.parentId;
    const versions = testData.versions
      .filter((v) => v.nodeId === parentId)
      .sort((a, b) => {
        const dateA = new Date(JSON.parse(JSON.stringify(a.version.createdAt)));
        const dateB = new Date(JSON.parse(JSON.stringify(b.version.createdAt)));
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
  };

  const createVersionWithPrevious = (params: any): unknown[] => {
    if (params.props) {
      const nodeId = params.parentId;
      const previousVersionId = params.previousId;
      testData.versions.push({
        version: {
          id: params.props.id,
          content: params.props.content,
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(params.props.createdAt),
          commitMessage: params.props.commitMessage,
        },
        nodeId,
        previousVersionId,
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
  };

  const createVersionWithoutPrevious = (params: any): unknown[] => {
    if (params.props) {
      const nodeId = params.parentId;
      testData.versions.push({
        version: {
          id: params.props.id,
          content: params.props.content,
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(params.props.createdAt),
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
  };

  const getVersionById = (params: any): unknown[] => {
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
  };

  const getChildrenWithParentName = (params: any): unknown[] => {
    const versionId = params.versionId;
    return testData.edges
      .filter((e) => e.parentId === versionId)
      .map((e) => {
        const childVersion = testData.versions.find(
          (v) => v.version.id === e.childId,
        );
        if (!childVersion) return null;
        // Find the parent node for this version
        const parentNode = testData.nodes.find(
          (n) => n.id === childVersion.nodeId,
        );
        return {
          child: {
            ...childVersion.version,
            createdAt: JSON.parse(
              JSON.stringify(childVersion.version.createdAt),
            ),
          },
          edge: e.properties,
          parentName: parentNode?.name || '',
        };
      })
      .filter((c) => c !== null);
  };

  const createTag = (params: any): unknown[] => {
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
    return [];
  };

  const getNodeTags = (params: any): unknown[] => {
    const nodeId = params.nodeId;
    return testData.tags
      .filter((t) => t.nodeId === nodeId)
      .map((t) => ({ tagName: t.tagName }))
      .sort((a, b) => a.tagName.localeCompare(b.tagName));
  };

  const listAllNodes = (): unknown[] => {
    return testData.nodes
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => ({ n }));
  };

  const createTestCase = (params: any): unknown[] => {
    if (params.props) {
      testData.testCases.push(params.props as TestCase);
    }
    return [{ t: params.props }];
  };

  const findTestCaseById = (params: any): unknown[] => {
    const id = params.id;
    const testCase = testData.testCases.find((t) => t.id === id);
    return testCase ? [{ t: testCase }] : [];
  };

  const createEdgeRelationships = (params: any): unknown[] => {
    const { parentVersion, relationships } = params;
    
    relationships.forEach((rel: any) => {
      testData.edges.push({
        parentId: rel.versionId,
        childId: parentVersion,
        properties: {
          operation: rel.operation as EdgeOperation,
          key: rel.key,
        },
      });
    });
    
    return [];
  };

  const getChildrenWithSlotsAndRoles = (params: any): unknown[] => {
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
            : null,
          r: e.properties,  // Changed from 'edge' to 'r' to match query
        };
      })
      .filter((item) => item.child !== null);
  };

  const findContentForSlots = (params: any): unknown[] => {
    const slots = params.slots;
    const tags = params.tags;
    const excludeVersionIds = params.excludeVersionIds || [];

    return slots
      .map((slot: string) => {
        // Find nodes with matching tags
        const nodesWithTags = testData.tags
          .filter((t) => tags.includes(t.tagName))
          .map((t) => t.nodeId);

        // Find latest version for each matching node
        const versions = nodesWithTags
          .map((nodeId) => {
            const nodeVersions = testData.versions
              .filter(
                (v) =>
                  v.nodeId === nodeId &&
                  !excludeVersionIds.includes(v.version.id),
              )
              .sort((a, b) => {
                const dateA = new Date(
                  JSON.parse(JSON.stringify(a.version.createdAt)),
                );
                const dateB = new Date(
                  JSON.parse(JSON.stringify(b.version.createdAt)),
                );
                return dateB.getTime() - dateA.getTime();
              });
            return nodeVersions[0];
          })
          .filter((v) => v);

        return versions[0] ? { versionId: versions[0].version.id } : null;
      })
      .filter((v) => v !== null);
  };

  // Helper to create query pattern matchers
  const queryContains = (...patterns: string[]) => (query: string) =>
    patterns.every(pattern => query.includes(pattern));

  const queryContainsAny = (...patterns: string[]) => (query: string) =>
    patterns.some(pattern => query.includes(pattern));

  const queryExcludes = (...patterns: string[]) => (query: string) =>
    patterns.every(pattern => !query.includes(pattern));

  // Mock function to handle parameter-based queries
  const handleQuery = (query: string, params: any = {}): unknown[] => {
    return Match.value(query).pipe(
      // Find node by name
      Match.when(
        queryContains('MATCH (n:ContentNode {name: $name}) RETURN n'),
        () => findNodeByName(params)
      ),
      // Create content node
      Match.when(
        queryContains('CREATE (n:ContentNode $props) RETURN n'),
        () => createNode(params)
      ),
      // Find node by ID
      Match.when(
        queryContains('MATCH (p:ContentNode {id: $id}) RETURN p'),
        () => findNodeById(params)
      ),
      // Find latest version
      Match.when(
        queryContains('MATCH (p:ContentNode {id: $parentId})<-[:VERSION_OF]-(v:ContentNodeVersion)'),
        () => findLatestVersion(params)
      ),
      // Create version with previous
      Match.when(
        queryContains('CREATE (v)-[:PREVIOUS_VERSION]->(prev)'),
        () => createVersionWithPrevious(params)
      ),
      // Create version without previous
      Match.when(
        (q) => queryContains('CREATE (v)-[:VERSION_OF]->(p)', 'CREATE (v:ContentNodeVersion $props)')(q),
        () => createVersionWithoutPrevious(params)
      ),
      // Get version by ID
      Match.when(
        (q) => queryContains('MATCH (node:ContentNodeVersion {id: $versionId})', 'RETURN node')(q) &&
               queryExcludes('OPTIONAL MATCH')(q),
        () => getVersionById(params)
      ),
      // Get children with parent name
      Match.when(
        (q) => queryContains(
          'MATCH (node:ContentNodeVersion {id: $versionId})-[r:INCLUDES]->(child:ContentNodeVersion)',
          'MATCH (child)-[:VERSION_OF]->(parentNode:ContentNode)',
          'RETURN child, r as edge, parentNode.name as parentName'
        )(q),
        () => getChildrenWithParentName(params)
      ),
      // Get children (old pattern)
      Match.when(
        (q) => queryContains('MATCH (parent:ContentNodeVersion {id: $parentId})-[r:INCLUDES]->(child:ContentNodeVersion)')(q) &&
               queryExcludes('parentNode.name')(q),
        () => getChildrenWithSlotsAndRoles(params)
      ),
      // Create tag with relationship
      Match.when(
        (q) => queryContains('MERGE (t:Tag {name: $tagName})', 'MERGE (n)-[:HAS_TAG]->(t)')(q),
        () => createTag(params)
      ),
      // Create tag without relationship
      Match.when(
        (q) => queryContains('MERGE (t:Tag {name: $tagName})')(q) &&
               queryExcludes('MERGE (n)-[:HAS_TAG]->(t)')(q),
        () => []
      ),
      // Create INCLUDES relationship
      Match.when(
        queryContains('CREATE (parent)-[:INCLUDES {operation:'),
        () => {
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
      ),
      // Find content for slot with tags
      Match.when(
        (q) => queryContains('MATCH (n:ContentNode)-[:VERSION_OF]-(v:ContentNodeVersion)', 'WHERE ALL(tag IN $tags')(q),
        () => {
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
      ),
      // List all nodes
      Match.when(
        (q) => queryContains('MATCH (n:ContentNode)', 'RETURN n', 'ORDER BY n.name')(q),
        () => listAllNodes()
      ),
      // Get tags for a node
      Match.when(
        (q) => queryContains('MATCH (n:ContentNode {id: $nodeId})-[:HAS_TAG]->(t:Tag)', 'RETURN t.name as tagName')(q),
        () => getNodeTags(params)
      ),
      // Create test case
      Match.when(
        queryContains('CREATE (t:TestCase $props) RETURN t'),
        () => createTestCase(params)
      ),
      // Find test case by ID
      Match.when(
        queryContains('MATCH (t:TestCase {id: $id}) RETURN t'),
        () => findTestCaseById(params)
      ),
      // Create edge relationships
      Match.when(
        queryContains('UNWIND $relationships AS rel'),
        () => createEdgeRelationships(params)
      ),
      // Find content for slots
      Match.when(
        (q) => queryContains('UNWIND $slots AS slot', 'WHERE ALL(tag IN $tags')(q),
        () => findContentForSlots(params)
      ),
      // Default case
      Match.orElse(() => [])
    );
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
