name: "Unified Content Types - Simplifying the Content Model"
description: |

## Goal

Implement a radically simplified content model by unifying all prompt-building entities (snippets, parameters, compositions) into a single `ContentNode` type that forms a tree structure in Neo4j, eliminating duplication and artificial separation while leveraging Neo4j's native graph capabilities.

## Why

- **Reduces Code Duplication**: Currently we have 6 separate types (Snippet/SnippetVersion, Parameter/ParameterOption, Composition/CompositionVersion) that all serve similar purposes
- **Simplifies Architecture**: All content is just nodes in a tree that either provide content or organize other content
- **Leverages Neo4j Strengths**: Moves structural information from type definitions into the graph where it belongs
- **Enables Flexibility**: Easy to add new content types, change roles dynamically, and A/B test without duplicating content

## What

Replace the existing 6 content types with 2 unified types:
- `ContentNode`: Abstract container with id, name, description
- `ContentNodeVersion`: Versioned content with optional content field

Add TestCase type for defining conversation structure:
- `TestCase`: Defines message slots with roles and filtering
- `MessageSlot`: Specifies role, tags, and content selection

Structural relationships managed entirely by Neo4j:
- Tree structure via INCLUDES relationships with operation on edges
- Versioning via VERSION_OF and PREVIOUS_VERSION
- Tags via HAS_TAG relationships
- Roles defined in TestCases, not in content

### Success Criteria

- [ ] All existing functionality maintained (create snippets, parameters, compositions)
- [ ] Tests pass showing correct tree traversal and content assembly
- [ ] Old types can be removed after migration
- [ ] Performance equal or better than current implementation

## All Needed Context

### Documentation & References

```yaml
- file: src/domain/types/snippet.ts
  why: Current Snippet and SnippetVersion types to be replaced
  gotcha: SnippetVersion uses commit_message not commitMessage

- file: src/domain/types/parameter.ts  
  why: Current Parameter and ParameterOption types to be replaced
  gotcha: ParameterOption is equivalent to a version but named differently

- file: src/domain/types/composition.ts
  why: Current Composition and CompositionVersion types to be replaced
  gotcha: CompositionVersion stores snippets array - this moves to Neo4j relationships

- file: src/domain/types/branded.ts
  why: Contains all branded ID types and patterns for creating new ones
  critical: Use makeIdType factory for new ContentNodeId and ContentNodeVersionId

- file: src/services/persistence/GenericPersistence.ts
  why: Contains patterns for Neo4j operations we'll follow
  discovered_caveat: Always use queryParams helper to avoid undefined parameters

- file: docs/llms/guides/effect-neo4j/03-data-layer-schema-design.md
  sections: ['Neo4j-Specific Schema Rules', 'Relationship Schemas']
  why: MUST use Schema.Struct for Neo4j, NOT Model.Class
  critical: Schema.Struct is the correct pattern for Neo4j nodes

- file: docs/llms/guides/effect-neo4j/05-actions-layer-services.md
  sections: ['The Neo4j Service: Modern Pattern', 'Key Patterns and Best Practices']
  why: Shows correct Neo4j service usage patterns
  gotcha: Use cypher template function and queryParams for safety

- url: https://medium.com/@adebisijoe/mastering-hierarchies-a-developers-guide-to-tree-structures-part-2-neo4j-87ecd5237299
  sections: ['Tree Structures in Neo4j']
  why: Best practices for hierarchical data in Neo4j
  discovered_caveat: Parent-child uses same label for recursive structures

- doc: CLAUDE.md
  include_sections: ['Code Style & Conventions', 'Effect-TS Specific Notes'] 
  skip_sections: ['Development Workflow']
  critical: Follow functional programming principles and type-driven development
```

### Current Codebase tree

```bash
src/
├── domain/
│   └── types/
│       ├── branded.ts          # ID types using brands
│       ├── composition.ts      # To be replaced
│       ├── parameter.ts        # To be replaced
│       ├── snippet.ts          # To be replaced
│       └── errors.ts           # Error types
├── services/
│   ├── persistence/
│   │   └── GenericPersistence.ts  # Generic Neo4j patterns
│   └── snippet/
│       └── SnippetPersistence.ts  # To be updated
└── layers/
    └── neo4j/
        └── Neo4j.layer.ts      # Neo4j connection layer
```

### Desired Codebase tree with files to be added

```bash
src/
├── domain/
│   └── types/
│       ├── branded.ts          # Add ContentNodeId, ContentNodeVersionId
│       ├── contentNode.ts      # NEW: Unified content types
│       └── tests/
│           └── contentNode.test.ts  # NEW: Schema tests
├── services/
│   └── content/               # NEW: Unified content service
│       ├── ContentService.ts
│       ├── ContentService.test.ts
│       └── ContentService.test-layers.ts
└── migration/
    └── unifyContentTypes.ts    # NEW: Migration script
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Effect.gen requires function* syntax for generators
// CRITICAL: Schema.decode returns an Effect, not a plain value
// CRITICAL: We use Effect v3 and Schema.Struct for Neo4j (not Model.Class)
// CRITICAL: Neo4j undefined parameters cause errors - use null instead
// CRITICAL: Always use queryParams() helper to validate parameters
// CRITICAL: Children processed in alphabetical order by node name for determinism
```

## Implementation Blueprint

### Data models and structure

```typescript
// Individual role types - explicit and type-safe
export const SystemRole = Schema.Literal('system');
export type SystemRole = typeof SystemRole.Type;

export const UserRole = Schema.Literal('user');
export type UserRole = typeof UserRole.Type;

export const AssistantRole = Schema.Literal('assistant');
export type AssistantRole = typeof AssistantRole.Type;

// Composed role type
export const ContentRole = Schema.Union(SystemRole, UserRole, AssistantRole);
export type ContentRole = typeof ContentRole.Type;

// ContentNode - unified container type
export const ContentNode = Schema.Struct({
  id: ContentNodeId,  // New branded type
  name: Slug,         // Existing from branded.ts
  description: Schema.String,
});

// ContentNodeVersion - unified version type  
export const ContentNodeVersion = Schema.Struct({
  id: ContentNodeVersionId,  // New branded type
  content: Schema.optional(Schema.String), // Optional - branches may not have content
  createdAt: Schema.DateTimeUtc,
  commitMessage: Schema.String, // Align with existing convention
});

// Neo4j Relationships:
// (ContentNodeVersion) -[:VERSION_OF]-> (ContentNode)
// (Parent:ContentNodeVersion) -[:INCLUDES {operation: EdgeOperation, key?: string}]-> (Child:ContentNodeVersion)  
// (ContentNodeVersion) -[:PREVIOUS_VERSION]-> (ContentNodeVersion)
// (ContentNode) -[:HAS_TAG]-> (Tag)
// Note: Content is role-agnostic - roles are defined in TestCases
```

### Type Safety and Data Models

```typescript
import { Chunk } from 'effect';

// Operation types for edges
export const InsertOperation = Schema.Literal('insert');
export type InsertOperation = typeof InsertOperation.Type;

export const ConcatenateOperation = Schema.Literal('concatenate');
export type ConcatenateOperation = typeof ConcatenateOperation.Type;

export const EdgeOperation = Schema.Union(InsertOperation, ConcatenateOperation);
export type EdgeOperation = typeof EdgeOperation.Type;

// Edge properties schema for type safety
export const IncludesEdgeProperties = Schema.Struct({
  operation: EdgeOperation,
  key: Schema.optional(Schema.String), // Only for insert operations
});
export type IncludesEdgeProperties = typeof IncludesEdgeProperties.Type;

// Parameter types to avoid primitive obsession
export const ParameterKey = Schema.String.pipe(
  Schema.pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  Schema.brand('ParameterKey')
);
export type ParameterKey = typeof ParameterKey.Type;

export const ParameterValue = Schema.String.pipe(Schema.brand('ParameterValue'));
export type ParameterValue = typeof ParameterValue.Type;

export const ParameterContext = Schema.HashMap(ParameterKey, ParameterValue);
export type ParameterContext = typeof ParameterContext.Type;

// Message and Conversation types for LLM APIs
export const Message = Schema.Struct({
  role: ContentRole,
  content: Schema.String
});
export type Message = typeof Message.Type;

// Use Chunk for efficient immutable collections
export type Conversation = Chunk.Chunk<Message>;

// Processing options for filtering
export const ProcessingOptions = Schema.Struct({
  includeTags: Schema.optional(Schema.Array(Schema.String)),
  excludeVersionIds: Schema.optional(Schema.Array(ContentNodeVersionId))
});
export type ProcessingOptions = typeof ProcessingOptions.Type;

// Type-safe child node structure
export type ChildNode = {
  node: ContentNodeVersion;
  edge: IncludesEdgeProperties;
};

// Tag types
export const TagId = makeIdType('TagId');
export type TagId = typeof TagId.Type;

export const TagName = Slug; // Tags use slug format
export type TagName = typeof TagName.Type;

// LLM Model validation
export const LLMModel = Schema.String.pipe(
  Schema.pattern(/^(gpt-4|gpt-3\.5-turbo|claude-3|claude-2|llama).*$/),
  Schema.brand('LLMModel')
);
export type LLMModel = typeof LLMModel.Type;

// Test Case types - define conversation structure
export const MessageSlot = Schema.Struct({
  role: ContentRole,
  tags: Schema.optional(Schema.Array(Schema.Union(TagId, TagName))),
  excludeNodes: Schema.optional(Schema.Array(Schema.Union(ContentNodeId, Slug))),
  includeNodes: Schema.optional(Schema.Array(Schema.Union(ContentNodeId, Slug))),
  sequence: Schema.Number.pipe(Schema.int(), Schema.nonNegative())
});
export type MessageSlot = typeof MessageSlot.Type;

export const TestCaseId = makeIdType('TestCaseId');
export type TestCaseId = typeof TestCaseId.Type;

export const TestCase = Schema.Struct({
  id: TestCaseId,
  name: Schema.String,
  description: Schema.String,
  createdAt: Schema.DateTimeUtc,
  llmModel: LLMModel,
  messageSlots: Schema.Array(MessageSlot),
  parameters: Schema.optional(ParameterContext)
});
export type TestCase = typeof TestCase.Type;
```

### List of tasks to be completed

```yaml
Task 1: Create new branded types
MODIFY src/domain/types/branded.ts:
  - FIND pattern: "export const TagId = makeIdType('TagId');"
  - INJECT after with ContentNodeId and ContentNodeVersionId
  - UPDATE AnyId union to include new types

Task 2: Create ContentNode schema
CREATE src/domain/types/contentNode.ts:
  - MIRROR pattern from: src/domain/types/snippet.ts
  - IMPLEMENT ContentNode and ContentNodeVersion schemas
  - EXPORT types using Schema.Type pattern

Task 3: Create ContentNode schema tests
CREATE src/domain/types/tests/contentNode.test.ts:
  - FOLLOW pattern from other schema tests
  - TEST valid ContentNode creation
  - TEST invalid data rejection
  - TEST EdgeOperation and IncludesEdgeProperties validation

Task 4: Create ContentService
CREATE src/services/content/ContentService.ts:
  - MIRROR pattern from: src/services/persistence/GenericPersistence.ts
  - IMPLEMENT createContentNode, createContentNodeVersion
  - IMPLEMENT getContentTree for recursive traversal
  - IMPLEMENT processContent for tree evaluation

Task 5: Create test layers for ContentService
CREATE src/services/content/ContentService.test-layers.ts:
  - FOLLOW pattern from: src/services/snippet/SnippetPersistence.test-layers.ts
  - CREATE ContentTestWithData layer
  - MOCK Neo4j responses for tree structures

Task 6: Create ContentService tests
CREATE src/services/content/ContentService.test.ts:
  - TEST creating content nodes
  - TEST version creation with relationships
  - TEST tree traversal and content processing
  - TEST parameter replacement (insert operation)
  - TEST snippet concatenation

Task 7: Create migration script
CREATE src/migration/unifyContentTypes.ts:
  - READ all existing Snippets, Parameters, Compositions
  - CREATE equivalent ContentNodes
  - MAP relationships correctly
  - PRESERVE version history

Task 8: Update existing code to use new types
MODIFY throughout codebase:
  - FIND usages of old types
  - REPLACE with ContentNode operations
  - UPDATE tests
```

### Per task pseudocode

```typescript
// Task 4: ContentService key functions
export const createContentNode = (
  name: Slug,
  description: string
): Effect.Effect<ContentNode, PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
  // PATTERN: Use existing createNamedEntity from GenericPersistence
  return yield* createNamedEntity('ContentNode', ContentNode, {
    name,
    description
  });
});

// Tag content for organization
export const tagContent = (
  nodeId: ContentNodeId,
  tagNames: TagName[]
): Effect.Effect<void, PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    
    yield* Effect.forEach(tagNames, (tagName) => 
      Effect.gen(function* () {
        // Create tag if it doesn't exist
        const query = cypher`
          MERGE (t:Tag {name: $tagName})
          WITH t
          MATCH (n:ContentNode {id: $nodeId})
          MERGE (n)-[:HAS_TAG]->(t)
        `;
        
        const params = yield* queryParams({ tagName, nodeId });
        yield* neo4j.runQuery(query, params);
      })
    );
  });

export const createContentNodeVersion = (
  nodeId: ContentNodeId,
  content: string | undefined,
  commitMessage: string,
  parents?: Array<{ 
    versionId: ContentNodeVersionId;
    operation: EdgeOperation;
    key?: string; // For insert operations - which placeholder to fill
  }>
): Effect.Effect<ContentNodeVersion, NotFoundError | PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    
    return yield* neo4j.runInTransaction((tx) => 
    Effect.gen(function* () {
      // Create version using existing pattern
      const version = yield* createVersion(
        'ContentNodeVersion',
        'ContentNode', 
        nodeId,
        ContentNodeVersion,
        { content, commitMessage }
      );
      
      // Link this version as a child of its parents
      if (parents && parents.length > 0) {
        for (const parent of parents) {
          const query = cypher`
            MATCH (parent:ContentNodeVersion {id: $parentId})
            MATCH (child:ContentNodeVersion {id: $childId})
            CREATE (parent)-[:INCLUDES {operation: $operation, key: $key}]->(child)
          `;
          
          // Validate edge properties
          const edgeProps = yield* Schema.decodeUnknown(IncludesEdgeProperties)({
            operation: parent.operation,
            key: parent.key
          });
          
          const params = yield* queryParams({
            parentId: parent.versionId,
            childId: version.id,  // The new version is the child
            operation: edgeProps.operation,
            key: edgeProps.key || null
          });
          yield* tx.run(query, params);
        }
      }
      
      return version;
    })
  );
});

// Lazy processing - only load what's needed
export const processContentFromId = (
  versionId: ContentNodeVersionId,
  context: ParameterContext = HashMap.empty<ParameterKey, ParameterValue>(),
  options: ProcessingOptions = {}
): Effect.Effect<string, PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    
    // Check if this version should be excluded
    if (options.excludeVersionIds?.includes(versionId)) {
      return '';
    }
    
    // Get just this node and its immediate children
    const query = cypher`
      MATCH (node:ContentNodeVersion {id: $versionId})
      OPTIONAL MATCH (node)-[r:INCLUDES]->(child:ContentNodeVersion)
      RETURN node, collect({child: child, edge: r}) as children
    `;
    
    const params = yield* queryParams({ versionId });
    const result = yield* neo4j.runQuery<{ 
      node: unknown, 
      children: Array<{ child: unknown, edge: unknown }> 
    }>(query, params);
    
    if (result.length === 0) {
      return yield* Effect.fail(new NotFoundError({ entityType: 'content-node-version', id: versionId }));
    }
    
    const nodeVersion = yield* Schema.decodeUnknown(ContentNodeVersion)(result[0].node);
    const children = yield* Effect.forEach(result[0].children, (item) => 
      Effect.gen(function* () {
        const child = yield* Schema.decodeUnknown(ContentNodeVersion)(item.child);
        const edge = yield* Schema.decodeUnknown(IncludesEdgeProperties)(item.edge);
        return { node: child, edge };
      })
    );
    
    // Process based on edge operations
    return yield* processNode(nodeVersion, children, context, options);
  });

// Type-safe edge retrieval
export const getChildren = (
  nodeVersionId: ContentNodeVersionId
): Effect.Effect<readonly ChildNode[], PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
  const query = cypher`
    MATCH (parent:ContentNodeVersion {id: $parentId})-[r:INCLUDES]->(child:ContentNodeVersion)
    RETURN child, r
  `;
  const params = yield* queryParams({ parentId: nodeVersionId });
  const results = yield* neo4j.runQuery<{ child: unknown, r: unknown }>(query, params);
  
  // Decode and validate edge properties
  return yield* Effect.forEach(results, (result) =>
    Effect.gen(function* () {
      const child = yield* Schema.decodeUnknown(ContentNodeVersion)(result.child);
      const edgeProps = yield* Schema.decodeUnknown(IncludesEdgeProperties)(result.r);
      return { node: child, edge: edgeProps } as ChildNode;
    })
  );
});

// Process a node with its children
const processNode = (
  nodeVersion: ContentNodeVersion,
  children: readonly ChildNode[],
  context: ParameterContext,
  options: ProcessingOptions
): Effect.Effect<string, PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
    // Build context from insert operations
    const insertChildren = children.filter(c => c.edge.operation === 'insert');
    const updatedContext = yield* Effect.reduce(
      insertChildren,
      context,
      (ctx, child) => 
        Effect.gen(function* () {
          if (!child.edge.key) {
            return ctx; // Skip if no key specified
          }
          const key = yield* Schema.decodeUnknown(ParameterKey)(child.edge.key);
          const value = yield* processContentFromId(child.node.id, ctx, options);
          return HashMap.set(ctx, key, value as ParameterValue);
        })
    );
    
    // Apply context to current node's content
    let processed = nodeVersion.content || '';
    HashMap.forEach(updatedContext, (value, key) => {
      processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    // Process concatenation children
    const concatChildren = children
      .filter(c => c.edge.operation === 'concatenate')
      .sort((a, b) => a.node.name.localeCompare(b.node.name));
      
    const concatenated = yield* Effect.forEach(
      concatChildren,
      (child) => processContentFromId(child.node.id, updatedContext, options)
    ).pipe(Effect.map(results => results.filter(Boolean).join('\n')));
    
    return processed + (concatenated ? '\n' + concatenated : '');
  });

// Find content matching message slot criteria
export const findContentForSlot = (
  slot: MessageSlot,
  parameters: ParameterContext
): Effect.Effect<ContentNodeVersionId[], PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    
    let query = cypher`
      MATCH (n:ContentNode)-[:VERSION_OF]-(v:ContentNodeVersion)
    `;
    
    // Add tag filtering if specified
    if (slot.tags && slot.tags.length > 0) {
      query += cypher`
        WHERE ALL(tag IN $tags WHERE (n)-[:HAS_TAG]->(:Tag {name: tag}))
      `;
    }
    
    // Add exclusions
    if (slot.excludeNodes && slot.excludeNodes.length > 0) {
      query += cypher`
        AND NOT n.id IN $excludeIds AND NOT n.name IN $excludeNames
      `;
    }
    
    // Add inclusions  
    if (slot.includeNodes && slot.includeNodes.length > 0) {
      query += cypher`
        AND (n.id IN $includeIds OR n.name IN $includeNames)
      `;
    }
    
    query += cypher`
      RETURN v.id as versionId
      ORDER BY v.createdAt DESC
    `;
    
    const params = yield* queryParams({
      tags: slot.tags || [],
      excludeIds: slot.excludeNodes?.filter(n => n.includes('-')) || [],
      excludeNames: slot.excludeNodes?.filter(n => !n.includes('-')) || [],
      includeIds: slot.includeNodes?.filter(n => n.includes('-')) || [],
      includeNames: slot.includeNodes?.filter(n => !n.includes('-')) || []
    });
    
    const results = yield* neo4j.runQuery<{ versionId: ContentNodeVersionId }>(query, params);
    return results.map(r => r.versionId);
  });

// Build conversation from TestCase
export const buildConversationFromTestCase = (
  testCase: TestCase
): Effect.Effect<Conversation, Error | PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
    // Sort slots by sequence
    const sortedSlots = [...testCase.messageSlots].sort((a, b) => a.sequence - b.sequence);
    
    // Process each slot
    const messages = yield* Effect.forEach(
      sortedSlots,
      (slot) => Effect.gen(function* () {
        // Find content matching slot criteria
        const versionIds = yield* findContentForSlot(slot, testCase.parameters || HashMap.empty());
        
        if (versionIds.length === 0) {
          return yield* Effect.fail(new Error(`No content found for slot with role ${slot.role}`));
        }
        
        // Process all matching content and concatenate
        const contents = yield* Effect.forEach(
          versionIds,
          (versionId) => processContentFromId(
            versionId, 
            testCase.parameters || HashMap.empty(),
            { includeTags: slot.tags }
          )
        );
        
        const combinedContent = contents.filter(Boolean).join('\n');
        return { role: slot.role, content: combinedContent } satisfies Message;
      })
    );
    
    // Effect.forEach returns a Chunk by default
    return messages;
  });

// Type-safe link creation
export const linkNodes = (
  parentId: ContentNodeVersionId,
  childId: ContentNodeVersionId,
  props: IncludesEdgeProperties
): Effect.Effect<void, PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    
    // Validate properties
    const validProps = yield* Schema.decodeUnknown(IncludesEdgeProperties)(props);
    
    const query = cypher`
      MATCH (parent:ContentNodeVersion {id: $parentId})
      MATCH (child:ContentNodeVersion {id: $childId})
      CREATE (parent)-[:INCLUDES {operation: $operation, key: $key}]->(child)
    `;
    
    const params = yield* queryParams({
      parentId,
      childId,
      operation: validProps.operation,
      key: validProps.key || null
    });
    
    yield* neo4j.runQuery(query, params);
  });
```

### Integration Points

```yaml
DATABASE:
  - Create new node labels: ContentNode, ContentNodeVersion
  - Create indexes: 
    - CREATE INDEX idx_content_node_name ON :ContentNode(name)
    - CREATE INDEX idx_content_version_created ON :ContentNodeVersion(createdAt)

RELATIONSHIPS:
  - VERSION_OF: Links versions to their parent node
  - INCLUDES: Forms the tree structure with properties - operation, key (for inserts)
  - PREVIOUS_VERSION: Links to previous version for history
  - HAS_TAG: Links content nodes to tags for organization

ROLE BEHAVIOR:
  - Content is role-agnostic - no roles in the content tree
  - Roles are defined in TestCase message slots
  - Same content can have different roles in different test cases
  - TestCases define the conversation structure and role assignments

MIGRATION:
  - Map Snippet -> ContentNode with appropriate tags
  - Map Parameter -> ContentNode (operation='insert' on parent edges)
  - Map Composition -> TestCase with message slots
  - Extract tags from existing categorization
  - Create TestCases for existing compositions
  - Preserve all version history and relationships
```

## Validation Loop

### Level 1: Syntax & Type Checking

```bash
# After implementing each file:
pnpm run build      # TypeScript compilation
pnpm run lint       # ESLint checking

# Expected: No errors. Fix before proceeding.
```

### Level 2: Unit Tests

```typescript
// ContentNode schema tests
it('should create valid ContentNode', () => {
  const result = Schema.decodeUnknownSync(ContentNode)({
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'my-content',
    description: 'Test content node'
  });
  expect(result.name).toBe('my-content');
});

// ContentService tests  
it.effect('should create content tree', () =>
  Effect.gen(function* () {
    // Create parent node with tags
    const parent = yield* createContentNode('greeting-template', 'Greeting template');
    yield* tagContent(parent.id, ['greeting', 'formal']);
    const parentVersion = yield* createContentNodeVersion(
      parent.id,
      'Hello {{name}}, welcome to our service!',
      'Initial greeting template'
    );
    
    // Create parameter node
    const param = yield* createContentNode('user-name', 'User name parameter');
    yield* tagContent(param.id, ['parameter', 'user-info']);
    const paramVersion = yield* createContentNodeVersion(
      param.id,
      'Alice',
      'Default user name',
      [{ 
        versionId: parentVersion.id,
        operation: 'insert',
        key: 'name'
      }]
    );
    
    // Process content with parameter substitution
    const result = yield* processContentFromId(parentVersion.id);
    
    expect(result).toBe('Hello Alice, welcome to our service!');
  })
);

// A/B Testing example - same content, different roles
it.effect('should support A/B testing with TestCases', () =>
  Effect.gen(function* () {
    // Create shared content
    const conciseNode = yield* createContentNode('be-concise', 'Conciseness instruction');
    yield* tagContent(conciseNode.id, ['instruction', 'tone']);
    const conciseVersion = yield* createContentNodeVersion(
      conciseNode.id,
      'Be concise and direct in your responses',
      'Conciseness instruction'
    );
    
    // Create helper content  
    const helperNode = yield* createContentNode('be-helpful', 'Helpfulness instruction');
    yield* tagContent(helperNode.id, ['instruction', 'behavior']);
    const helperVersion = yield* createContentNodeVersion(
      helperNode.id,
      'Be helpful and supportive',
      'Helpfulness instruction'
    );
    
    // Test A: Conciseness in system prompt
    const testCaseA = Schema.decodeSync(TestCase)({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Concise instruction as system',
      description: 'Test with conciseness in system role',
      createdAt: new Date().toISOString(),
      llmModel: 'gpt-4',
      messageSlots: [
        { role: 'system', tags: ['instruction'], sequence: 0 },
        { role: 'user', tags: ['greeting'], sequence: 1 }
      ]
    });
    
    // Test B: Conciseness in user prompt
    const testCaseB = Schema.decodeSync(TestCase)({
      id: '223e4567-e89b-12d3-a456-426614174001',
      name: 'Concise instruction as user',
      description: 'Test with conciseness in user role',
      createdAt: new Date().toISOString(),
      llmModel: 'gpt-4',
      messageSlots: [
        { role: 'system', tags: ['behavior'], sequence: 0 },
        { role: 'user', tags: ['tone', 'greeting'], sequence: 1 }
      ]
    });
    
    // Build conversations for both test cases
    const conversationA = yield* buildConversationFromTestCase(testCaseA);
    const conversationB = yield* buildConversationFromTestCase(testCaseB);
    
    // Test A should have conciseness in system role
    expect(Chunk.toReadonlyArray(conversationA)[0]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('Be concise')
    });
    
    // Test B should have conciseness in user role
    expect(Chunk.toReadonlyArray(conversationB)[1]).toMatchObject({
      role: 'user',
      content: expect.stringContaining('Be concise')
    });
  })
);

// Multi-turn conversation example
it.effect('should build multi-turn conversations', () =>
  Effect.gen(function* () {
    // Create content nodes with tags
    const greeting = yield* createContentNode('user-greeting', 'User greeting');
    yield* tagContent(greeting.id, ['greeting', 'user-message']);
    const greetingV = yield* createContentNodeVersion(
      greeting.id,
      'Hello, can you help me?',
      'Initial greeting'
    );
    
    const response = yield* createContentNode('assistant-response', 'Assistant response');
    yield* tagContent(response.id, ['greeting-response', 'assistant-message']);
    const responseV = yield* createContentNodeVersion(
      response.id,
      'Hello! I\'d be happy to help.',
      'Initial response'
    );
    
    const followup = yield* createContentNode('user-followup', 'User followup');
    yield* tagContent(followup.id, ['followup', 'user-message']);
    const followupV = yield* createContentNodeVersion(
      followup.id,
      'I need help with {{topic}}',
      'Followup with parameter'
    );
    
    // Create a test case for the conversation
    const conversationTest = Schema.decodeSync(TestCase)({
      id: '323e4567-e89b-12d3-a456-426614174002',
      name: 'Support conversation',
      description: 'Multi-turn support conversation',
      createdAt: new Date().toISOString(),
      llmModel: 'gpt-4',
      messageSlots: [
        { role: 'user', tags: ['greeting'], sequence: 0 },
        { role: 'assistant', tags: ['greeting-response'], sequence: 1 },
        { role: 'user', tags: ['followup'], sequence: 2 }
      ],
      parameters: HashMap.make<ParameterKey, ParameterValue>([
        [Schema.decodeSync(ParameterKey)('topic'), Schema.decodeSync(ParameterValue)('TypeScript')]
      ])
    });
    
    // Build conversation from test case
    const conversation = yield* buildConversationFromTestCase(conversationTest);
    
    // Should create proper message array for LLM API
    expect(Chunk.toReadonlyArray(conversation)).toEqual([
      { role: 'user', content: 'Hello, can you help me?' },
      { role: 'assistant', content: 'Hello! I\'d be happy to help.' },
      { role: 'user', content: 'I need help with TypeScript' }
    ]);
  })
);
```

```bash
# Run tests iteratively:
pnpm test contentNode.test.ts
pnpm test ContentService.test.ts
```

### Level 3: Integration Test

```bash
# Run migration
pnpm tsx src/migration/unifyContentTypes.ts

# Verify data integrity
# Check that all content is preserved
# Verify relationships are correct
```

## Final Validation Checklist

- [ ] All tests pass: `pnpm test`
- [ ] No linting errors: `pnpm run lint`
- [ ] No type errors: `pnpm run build`
- [ ] Preflight passes: `pnpm run preflight`
- [ ] Migration completes successfully
- [ ] Existing functionality preserved
- [ ] Performance benchmarks equal or better
- [ ] Complete Effect compliance checklist items

## Anti-Patterns to Avoid

- ❌ Don't use Model.Class - Neo4j requires Schema.Struct
- ❌ Don't store relationships in type fields - use Neo4j edges
- ❌ Don't pass undefined to Neo4j - use null
- ❌ Don't skip the queryParams helper
- ❌ Don't put operation on nodes - it belongs on edges
- ❌ Don't put roles in content - they belong in TestCases
- ❌ Don't forget to handle recursive cycles in tree traversal
- ❌ Don't mutate content - keep everything immutable

---

**Confidence Score: 9/10**

The PRP provides comprehensive context including:
- Complete understanding of current architecture
- Clear migration path from 6 types to 2 plus TestCase
- Explicit Neo4j patterns to follow
- Effect-TS best practices incorporated
- Type-safe design with proper branded types
- Lazy processing to avoid memory issues
- LLM-ready conversation format
- Flexible A/B testing through TestCases
- Validation gates at every level
- Known gotchas documented

The implementation should succeed in one pass with the detailed blueprint and existing patterns to follow.