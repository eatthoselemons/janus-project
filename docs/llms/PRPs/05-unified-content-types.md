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

Structural relationships managed entirely by Neo4j:
- Tree structure via INCLUDES relationships with operation and role on edges
- Versioning via VERSION_OF and PREVIOUS_VERSION
- Operations (insert/concatenate) and roles stored as edge properties

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
  content: Schema.optional(Schema.String), // Optional - role containers have no content
  createdAt: Schema.DateTimeUtc,
  commitMessage: Schema.String, // Align with existing convention
});

// Special marker for role containers
export const ROLE_CONTAINER_PREFIX = 'role-container-' as const;

// Neo4j Relationships:
// (ContentNodeVersion) -[:VERSION_OF]-> (ContentNode)
// (Parent:ContentNodeVersion) -[:INCLUDES {role?: ContentRole, operation: EdgeOperation, key?: string}]-> (Child:ContentNodeVersion)  
// (ContentNodeVersion) -[:PREVIOUS_VERSION]-> (ContentNodeVersion)
// Note: Every tree starts with a role container node that has no content but establishes the prompt type
// Role containers are identified by names starting with 'role-container-'
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

// Helper to create role containers
export const createRoleContainer = (
  role: ContentRole
): Effect.Effect<{ node: ContentNode; version: ContentNodeVersion }, PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
  const node = yield* createContentNode(
    `${ROLE_CONTAINER_PREFIX}${role}` as Slug,
    `Role container for ${role} prompts`
  );
  
  const version = yield* createContentNodeVersion(
    node.id,
    undefined, // No content
    `Created ${role} role container`
  );
  
  return { node, version };
});

export const createContentNodeVersion = (
  nodeId: ContentNodeId,
  content: string | undefined,
  commitMessage: string,
  parents?: Array<{ 
    versionId: ContentNodeVersionId;
    role?: ContentRole; // Role on the edge
    operation: 'insert' | 'concatenate';
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
            CREATE (parent)-[:INCLUDES {role: $role, operation: $operation, key: $key}]->(child)
          `;
          const params = yield* queryParams({
            parentId: parent.versionId,
            childId: version.id,  // The new version is the child
            role: parent.role || null,
            operation: parent.operation,
            key: parent.key || null
          });
          yield* tx.run(query, params);
        }
      }
      
      return version;
    })
  );
});

export const getContentTree = (
  versionId: ContentNodeVersionId
): Effect.Effect<ContentTree, PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
  const neo4j = yield* Neo4jService;
  
  // PATTERN: Recursive query to get entire tree
  const query = cypher`
    MATCH (root:ContentNodeVersion {id: $versionId})
    OPTIONAL MATCH path = (root)-[:INCLUDES*]->(child:ContentNodeVersion)
    WITH root, collect({node: child, depth: length(path), relationships: relationships(path)}) as children
    RETURN root, children
    ORDER BY children.depth
  `;
  
  const params = yield* queryParams({ versionId });
  const results = yield* neo4j.runQuery(query, params);
  
  // Build tree structure from results
  return buildTreeFromResults(results);
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

export const processContent = (
  nodeVersion: ContentNodeVersion,
  parentContext: Record<string, string> = {}
): Effect.Effect<string, PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
    const children = yield* getChildren(nodeVersion.id); // Type-safe retrieval
  
  // Build context from insert operations
  const localContext = yield* Effect.reduce(
    children.filter(c => c.edge.operation === 'insert'),
    { ...parentContext },
    (context, child) => 
      Effect.gen(function* () {
        const value = yield* processContent(child.node, context);
        return { ...context, [child.edge.key]: value };
      })
  );
  
  // Apply context to current node's content
  let processed = nodeVersion.content || '';
  for (const [key, value] of Object.entries(localContext)) {
    processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  // Process concatenation children with the built context
  const concatenated = yield* Effect.forEach(
    children
      .filter(c => c.edge.operation === 'concatenate')
      .sort((a, b) => a.node.name.localeCompare(b.node.name)), // Alphabetical order
    (child) => processContent(child.node, localContext)
  ).pipe(Effect.map(results => results.join('\n')));
  
  return processed + (concatenated ? '\n' + concatenated : '');
});

// Determine the role of a tree by finding its role container
export const getTreeRole = (
  tree: ContentTree
): Effect.Effect<ContentRole, Error, never> => 
  Effect.gen(function* () {
  // Role containers are leaf nodes with names starting with ROLE_CONTAINER_PREFIX
  const findRoleContainer = (node: ContentTree): ContentRole | null => {
    if (node.name.startsWith(ROLE_CONTAINER_PREFIX) && node.children.length === 0) {
      return node.name.replace(ROLE_CONTAINER_PREFIX, '') as ContentRole;
    }
    
    for (const child of node.children) {
      const role = findRoleContainer(child);
      if (role) return role;
    }
    
    return null;
  };
  
  const role = findRoleContainer(tree);
  if (!role) {
    return yield* Effect.fail(new Error('No role container found in tree'));
  }
  
  return role;
});

// Build complete prompts by processing trees based on their role containers
export const buildPrompts = (
  compositionVersions: ContentNodeVersionId[]
): Effect.Effect<{ system: string; user: string; assistant: string }, Error | PersistenceError, Neo4jService> => 
  Effect.gen(function* () {
  const prompts = {
    system: '',
    user: '',
    assistant: ''
  };
  
  // Process each composition
  for (const versionId of compositionVersions) {
    const tree = yield* getContentTree(versionId);
    const role = yield* getTreeRole(tree);
    const content = yield* processContent(tree);
    
    prompts[role] = prompts[role] ? `${prompts[role]}\n${content}` : content;
  }
  
  return prompts;
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
  - INCLUDES: Forms the tree structure with properties:
    - role: Optional role override for A/B testing
    - operation: How to combine child with parent (insert or concatenate)
    - key: For insert operations, which placeholder to fill
  - PREVIOUS_VERSION: Links to previous version for history

ROLE BEHAVIOR:
  - Every prompt tree has a role container as a leaf node
  - Role containers have no content, just establish the tree's role
  - Role is stored on INCLUDES edges for flexible A/B testing
  - Same content can have different roles in different contexts
  - Role containers are named 'role-container-system', 'role-container-user', etc.

MIGRATION:
  - Map Snippet -> ContentNode (operation will be on edges)
  - Map Parameter -> ContentNode (operation='insert' on parent edges)
  - Map Composition -> ContentNode (operation='concatenate' on child edges)
  - Create role containers for each existing composition based on its usage
  - Attach role containers as leaf nodes to maintain tree structure
  - Move role from CompositionSnippet to INCLUDES edge property
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
    // Create role container first
    const roleContainer = yield* createRoleContainer('system');
    
    // Create parent node
    const parent = yield* createContentNode('parent', 'Parent node');
    const parentVersion = yield* createContentNodeVersion(
      parent.id,
      'Parent {{childValue}}',
      'Initial parent'
    );
    
    // Link parent to role container
    yield* linkNodes(parentVersion.id, roleContainer.version.id, {
      role: 'system',
      operation: 'concatenate'
    });
    
    // Create child node
    const child = yield* createContentNode('child', 'Child node');
    const childVersion = yield* createContentNodeVersion(
      child.id,
      'content',
      'Initial child',
      [{ 
        versionId: parentVersion.id,
        operation: 'insert',
        key: 'childValue'
      }]
    );
    
    // Process tree
    const tree = yield* getContentTree(parentVersion.id);
    const result = yield* processContent(tree, { childValue: 'replaced' });
    
    expect(result).toBe('Parent replaced\ncontent');
  })
);

// A/B Testing example - same content, different roles
it.effect('should support A/B testing with role containers', () =>
  Effect.gen(function* () {
    // Create shared content
    const sharedNode = yield* createContentNode('be-concise', 'Conciseness instruction');
    const sharedVersion = yield* createContentNodeVersion(
      sharedNode.id,
      'Be concise and direct in your responses',
      'Initial version'
    );
    
    // Test A: As system prompt
    const systemRole = yield* createRoleContainer('system');
    yield* linkNodes(sharedVersion.id, systemRole.version.id, {
      role: 'system',
      operation: 'concatenate'
    });
    
    // Test B: As user prompt
    const userRole = yield* createRoleContainer('user');
    yield* linkNodes(sharedVersion.id, userRole.version.id, {
      role: 'user',
      operation: 'concatenate'
    });
    
    // Build prompts for both tests
    const testA = yield* buildPrompts([sharedVersion.id]); // Finds system role container
    const testB = yield* buildPrompts([sharedVersion.id]); // Same content, different role
    
    expect(testA.system).toContain('Be concise');
    expect(testA.user).toBe('');
    
    expect(testB.user).toContain('Be concise');
    expect(testB.system).toBe('');
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
- ❌ Don't forget role containers - every tree needs one
- ❌ Don't forget to handle recursive cycles in tree traversal
- ❌ Don't mutate content - keep everything immutable

---

**Confidence Score: 8/10**

The PRP provides comprehensive context including:
- Complete understanding of current architecture
- Clear migration path from 6 types to 2
- Explicit Neo4j patterns to follow
- Effect-TS best practices incorporated
- Validation gates at every level
- Known gotchas documented

The implementation should succeed in one pass with the detailed blueprint and existing patterns to follow.