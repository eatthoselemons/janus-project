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
- `ContentNodeVersion`: Versioned content with optional content field and explicit operation type

Structural relationships managed entirely by Neo4j:
- Tree structure via INCLUDES relationships
- Versioning via VERSION_OF and PREVIOUS_VERSION
- Role-based flexibility via edge properties

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
  operation: Schema.Literal('insert', 'concatenate'), // Explicit operation
  createdAt: Schema.DateTimeUtc,
  commitMessage: Schema.String, // Align with existing convention
});

// Neo4j Relationships:
// (ContentNodeVersion) -[:VERSION_OF]-> (ContentNode)
// (ContentNodeVersion) -[:INCLUDES {role?: string}]-> (ContentNodeVersion)  
// (ContentNodeVersion) -[:PREVIOUS_VERSION]-> (ContentNodeVersion)
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
  - TEST operation enum validation

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
) => Effect.gen(function* () {
  // PATTERN: Use existing createNamedEntity from GenericPersistence
  return yield* createNamedEntity('ContentNode', ContentNode, {
    name,
    description
  });
});

export const createContentNodeVersion = (
  nodeId: ContentNodeId,
  content: string | undefined,
  operation: 'insert' | 'concatenate',
  commitMessage: string,
  includes?: Array<{ versionId: ContentNodeVersionId; role?: string }>
) => Effect.gen(function* () {
  const neo4j = yield* Neo4jService;
  
  return yield* neo4j.runInTransaction((tx) => 
    Effect.gen(function* () {
      // Create version using existing pattern
      const version = yield* createVersion(
        'ContentNodeVersion',
        'ContentNode', 
        nodeId,
        ContentNodeVersion,
        { content, operation, commitMessage }
      );
      
      // Add INCLUDES relationships if specified
      if (includes && includes.length > 0) {
        for (const include of includes) {
          const query = cypher`
            MATCH (parent:ContentNodeVersion {id: $parentId})
            MATCH (child:ContentNodeVersion {id: $childId})
            CREATE (parent)-[:INCLUDES {role: $role}]->(child)
          `;
          const params = yield* queryParams({
            parentId: version.id,
            childId: include.versionId,
            role: include.role || null
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
) => Effect.gen(function* () {
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

export const processContent = (
  tree: ContentTree,
  context: Record<string, string> = {}
) => Effect.gen(function* () {
  // Recursive processing based on operation type
  if (tree.operation === 'insert') {
    // This node's content replaces placeholders in parent
    return tree.content || '';
  } else { // concatenate
    // Process children first (alphabetical order by name)
    const childrenContent = yield* Effect.forEach(
      tree.children.sort((a, b) => a.name.localeCompare(b.name)),
      (child) => processContent(child, context)
    );
    
    // Replace placeholders in this node's content
    let processed = tree.content || '';
    for (const [key, value] of Object.entries(context)) {
      processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    // Concatenate with children
    return [processed, ...childrenContent].filter(Boolean).join('\n');
  }
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
  - INCLUDES: Forms the tree structure with optional role property
  - PREVIOUS_VERSION: Links to previous version for history

MIGRATION:
  - Map Snippet -> ContentNode with operation='concatenate'
  - Map Parameter -> ContentNode with operation='insert'  
  - Map Composition -> ContentNode with operation='concatenate'
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
    // Create parent node
    const parent = yield* createContentNode('parent', 'Parent node');
    const parentVersion = yield* createContentNodeVersion(
      parent.id,
      'Parent {{childValue}}',
      'concatenate',
      'Initial parent'
    );
    
    // Create child node
    const child = yield* createContentNode('child', 'Child node');
    const childVersion = yield* createContentNodeVersion(
      child.id,
      'content',
      'insert',
      'Initial child',
      [{ versionId: parentVersion.id }]
    );
    
    // Process tree
    const tree = yield* getContentTree(parentVersion.id);
    const result = yield* processContent(tree, { childValue: 'replaced' });
    
    expect(result).toBe('Parent replaced\ncontent');
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
- ❌ Don't assume operation type - make it explicit
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