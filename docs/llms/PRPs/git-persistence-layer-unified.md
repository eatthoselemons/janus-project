name: "Git-Based Persistence Layer with Unified Content Types"
description: |

## Purpose

Create a Git-based persistence layer that uses the simplified ContentNode model, storing entities as JSON files and leveraging Git's native versioning while maintaining Neo4jService interface compatibility.

## Core Principles

1. **Context is Complete but Focused**: Include ALL necessary documentation sections, specific examples, and discovered caveats by linking specific documents
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md
6. **Condense Repeated Code**: Refactor code that repeated

---

## Goal

Implement a Git-based backend using the unified ContentNode/ContentNodeVersion model that eliminates the need for Neo4j while providing identical functionality through file storage and Git history.

## Why

- **Simplified Model**: Only two types (ContentNode + ContentNodeVersion) instead of six
- **Natural Versioning**: Git commits replace VERSION_OF relationships
- **Tree-Native Storage**: Filesystem naturally represents tree structures
- **No Database Setup**: Clone and run immediately
- **Direct Editing**: JSON files can be edited with any text editor

## What

A Git persistence layer that:
- Uses the unified ContentNode type for all content (snippets, parameters, compositions)
- Stores nodes as JSON files with relationships as file references
- Leverages Git history for version tracking
- Maintains tree structure through directory organization
- Supports the same Neo4jService interface

### Success Criteria

- [ ] All content types unified into ContentNode/ContentNodeVersion
- [ ] Tree relationships preserved in filesystem structure
- [ ] Git history provides version traversal
- [ ] Operation types (insert/concatenate) properly handled
- [ ] Role-based includes work through file references
- [ ] All existing tests pass with new model

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Include these specific sections in your context window

- file: /home/user/git/janus-project/docs/llms/features/unified-content-types.md
  why: [New unified type model to implement]
  critical: |
    ContentNode: abstract container (id, name, description)
    ContentNodeVersion: content + operation (insert/concatenate)
    Relationships define structure, not arrays in types
    Children processed alphabetically by node name

- file: /home/user/git/janus-project/src/services/neo4j/Neo4j.service.ts
  why: [Interface to implement - must match exactly]
  critical: |
    Four methods: runQuery, runInTransaction, runBatch, withSession
    All return Effect<T, Neo4jError, never>

- docfile: docs/llms/guides/effect-docs/platform/command.mdx
  include_sections: ['Creating Commands', 'Running Commands', 'Output Formats']
  why: [Git operations via Command module]
  
- docfile: docs/llms/guides/effect-docs/platform/file-system.mdx
  include_sections: ['Basic Usage', 'Operations table']
  why: [File operations for entity storage]

- file: /home/user/git/janus-project/src/services/persistence/GenericPersistence.ts
  sections: [lines 99-232 for query patterns, 276-419 for version creation]
  why: [Shows query patterns to support]
  discovered_caveat: |
    Main patterns:
    - MATCH by name or id
    - CREATE with properties
    - Relationship queries: VERSION_OF, INCLUDES, HAS_TAG
    - ORDER BY name or createdAt

- docfile: docs/llms/best-practices/generic-persistence-patterns.md
  why: [Type-safe persistence patterns]
  critical: |
    Use Schema.decode for validation
    Follow Effect.gen patterns
    Generic functions with type constraints
```

### Current vs Desired Type Model

```typescript
// OLD MODEL (to replace)
type Snippet = { id, name, description }
type SnippetVersion = { id, content, createdAt, commitMessage }
type Parameter = { id, name, description }
type ParameterOption = { id, value, createdAt, commitMessage }
type Composition = { id, name, description }
type CompositionVersion = { id, snippets[], createdAt, commitMessage }

// NEW UNIFIED MODEL
type ContentNode = {
  id: ContentNodeId;
  name: Slug;
  description: string;
}

type ContentNodeVersion = {
  id: ContentNodeVersionId;
  content?: string; // Optional - branches might not have content
  operation: 'insert' | 'concatenate';
  createdAt: Date;
  commitMessage: string;
}

// Relationships (stored as file references)
// VERSION_OF: version file references its node
// INCLUDES: version file lists included version IDs with roles
// HAS_TAG: node file lists tag names
// PREVIOUS_VERSION: Git history handles this
```

### File Storage Structure

```bash
data/
├── nodes/                      # All ContentNode entities
│   ├── greeting.json          # A snippet node
│   ├── tone.json             # A parameter node
│   └── welcome-prompt.json    # A composition node
├── versions/                  # All ContentNodeVersion entities
│   ├── greeting/
│   │   └── v1.json           # Version of greeting node
│   ├── tone/
│   │   ├── v1.json          # "professional" option
│   │   └── v2.json          # "casual" option
│   └── welcome-prompt/
│       └── v1.json          # Composition version
└── tags/                     # Tag definitions
    ├── cli.json
    └── greeting.json
```

### Storage Format Examples

```typescript
// File: data/nodes/greeting.json
{
  "id": "cn_550e8400-e29b-41d4-a716-446655440000",
  "name": "greeting",
  "description": "A friendly greeting template",
  "_meta": {
    "type": "ContentNode",
    "tags": ["greeting", "cli"],  // HAS_TAG relationships
    "created": "2024-01-15T10:30:00Z",
    "updated": "2024-01-15T10:30:00Z"
  }
}

// File: data/versions/greeting/v1.json
{
  "id": "cnv_660e8400-e29b-41d4-a716-446655440000",
  "content": "Hello! Reply in a {{tone}} manner.",
  "operation": "concatenate",
  "createdAt": "2024-01-15T10:30:00Z",
  "commitMessage": "Initial greeting template",
  "_meta": {
    "nodeId": "cn_550e8400-e29b-41d4-a716-446655440000", // VERSION_OF
    "includes": [  // INCLUDES relationships
      {
        "versionId": "cnv_770e8400-e29b-41d4-a716-446655440000",
        "role": "parameter"  // Edge property
      }
    ]
  }
}

// File: data/versions/tone/v1.json (parameter)
{
  "id": "cnv_770e8400-e29b-41d4-a716-446655440000",
  "content": "professional",
  "operation": "insert",
  "createdAt": "2024-01-15T10:30:00Z",
  "commitMessage": "Professional tone option",
  "_meta": {
    "nodeId": "cn_880e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Query Pattern Mappings

```yaml
# Cypher to File Operations
MATCH (n:ContentNode {name: $name}):
  - Read data/nodes/${name}.json

CREATE (n:ContentNode $props):
  - Write data/nodes/${props.name}.json
  - Git add & commit

MATCH (n:ContentNode)<-[:VERSION_OF]-(v:ContentNodeVersion):
  - Read node file to get ID
  - List data/versions/${nodeName}/*.json
  - Filter by _meta.nodeId

MATCH (v:ContentNodeVersion)-[:INCLUDES]->(included:ContentNodeVersion):
  - Read version file
  - Map _meta.includes array to load referenced versions

ORDER BY v.createdAt DESC:
  - Sort files by createdAt field
  - Or use git log for true chronological order
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Children processed alphabetically by node name
// When listing includes, sort by the included node's name, not version ID

// CRITICAL: Operation type determines processing
// 'insert': content replaces placeholders in parent
// 'concatenate': content appends to result

// CRITICAL: File paths must handle special characters in slugs
// Use encodeURIComponent for safety

// DISCOVERED: No complex graph traversals needed
// Max depth is composition -> snippet -> parameter (3 levels)

// CRITICAL: Concurrent writes need coordination
// Use file locking or queue for write operations
```

## Implementation Blueprint

### List of tasks to be completed

```yaml
Task 1: Create Unified Domain Types
CREATE src/domain/types/content.ts:
  - Define ContentNode schema with id, name, description
  - Define ContentNodeVersion with content, operation, dates
  - Define Operation as Schema.Literal('insert', 'concatenate')
  - Export branded IDs for type safety

Task 2: Create Git Service Layer
CREATE src/services/git/Git.service.ts:
  - GitService interface with Context.Tag
  - Methods: log, show, add, commit, status, init
  - Error handling with GitError type

CREATE src/layers/git/Git.layer.ts:
  - Implement using Command module
  - Auto-initialize repo if needed
  - Export GitLive and GitTest

Task 3: Create Unified File Storage
CREATE src/services/git-persistence/unified-storage.ts:
  - nodePath(name): Generate node file path
  - versionPath(nodeName, versionId): Version file path
  - readNode(name): Read and validate ContentNode
  - writeNode(node): Write with _meta
  - readVersion(nodeName, versionId): Read ContentNodeVersion
  - writeVersion(nodeName, version): Write with relationships
  - listVersions(nodeName): Get all versions for a node

Task 4: Create Relationship Manager
CREATE src/services/git-persistence/relationships.ts:
  - addInclude(versionId, includedId, role): Add to _meta.includes
  - getIncludes(versionId): Retrieve with roles
  - addTag(nodeId, tag): Add to _meta.tags
  - getTags(nodeId): Get all tags
  - getVersionHistory(nodeName): Use git log for history

Task 5: Create Query Translator for Unified Model
CREATE src/services/git-persistence/unified-query-translator.ts:
  - Parse ContentNode queries (no more Snippet/Parameter/Composition)
  - Handle VERSION_OF through file structure
  - Handle INCLUDES through _meta references
  - Support operation-based filtering

Task 6: Implement GitPersistence with Unified Types
CREATE src/services/git-persistence/GitPersistence.service.ts:
  - runQuery: Route to appropriate storage operation
  - runInTransaction: Batch file operations with git commit
  - Handle tree traversal for compositions
  - Process children alphabetically by node name

Task 7: Create Content Tree Processor
CREATE src/services/git-persistence/tree-processor.ts:
  - processContentTree(rootVersionId): Recursive processing
  - handleInsertOperation(content, params): Replace placeholders
  - handleConcatenateOperation(contents): Join contents
  - Sort children by node name for deterministic order

Task 8: Update Persistence Layer
CREATE src/layers/git/GitPersistence.layer.ts:
  - Compose Git and FileSystem services
  - Initialize directory structure
  - Export GitPersistenceLive

Task 9: Migration from Old Types
CREATE src/tools/migrate-to-unified.ts:
  - Convert Snippet → ContentNode with operation='concatenate'
  - Convert Parameter → ContentNode with operation='insert'
  - Convert relationships to file references
  - Preserve version history

Task 10: Comprehensive Testing
CREATE src/services/git-persistence/GitPersistence.test.ts:
  - Test unified type CRUD operations
  - Test tree processing with operations
  - Test alphabetical ordering
  - Verify Git history tracking
```

### Per task pseudocode

```typescript
// Task 1: Unified Domain Types
// src/domain/types/content.ts
export const ContentNodeId = Schema.String.pipe(
  Schema.brand('ContentNodeId'),
  Schema.pattern(/^cn_[0-9a-f-]+$/)
);

export const ContentNode = Schema.Struct({
  id: ContentNodeId,
  name: Slug,
  description: Schema.String,
});

export const Operation = Schema.Literal('insert', 'concatenate');

export const ContentNodeVersion = Schema.Struct({
  id: ContentNodeVersionId,
  content: Schema.optional(Schema.String),
  operation: Operation,
  createdAt: Schema.DateTimeUtc,
  commitMessage: Schema.String,
});

// Task 3: Unified Storage
const writeNode = (node: ContentNode) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = nodePath(node.name);
    
    const data = {
      ...node,
      _meta: {
        type: 'ContentNode',
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      }
    };
    
    yield* fs.writeFileString(path, JSON.stringify(data, null, 2));
    
    // Track in git
    const git = yield* GitService;
    yield* git.add(path);
  });

// Task 4: Relationship Manager
const addInclude = (
  versionPath: string, 
  includedId: string, 
  role: string
) => Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(versionPath);
  const data = JSON.parse(content);
  
  // Add to includes array
  data._meta.includes = data._meta.includes || [];
  data._meta.includes.push({ versionId: includedId, role });
  
  // Sort by included node name for deterministic order
  // This requires loading each included version to get its node name
  const sortedIncludes = yield* Effect.all(
    data._meta.includes.map(inc =>
      Effect.gen(function* () {
        const version = yield* readVersionById(inc.versionId);
        const node = yield* readNodeById(version._meta.nodeId);
        return { ...inc, nodeName: node.name };
      })
    )
  );
  
  data._meta.includes = sortedIncludes
    .sort((a, b) => a.nodeName.localeCompare(b.nodeName))
    .map(({ nodeName, ...inc }) => inc);
  
  yield* fs.writeFileString(versionPath, JSON.stringify(data, null, 2));
});

// Task 5: Query Translation
const translateQuery = (query: CypherQuery) => {
  // MATCH (n:ContentNode {name: $name})
  if (query.match(/MATCH.*:ContentNode.*{name:/)) {
    return {
      operation: 'findNodeByName',
      params: extractParams(query)
    };
  }
  
  // MATCH (n:ContentNode)<-[:VERSION_OF]-(v:ContentNodeVersion)
  if (query.match(/VERSION_OF/)) {
    return {
      operation: 'findVersionsForNode',
      params: extractParams(query)
    };
  }
  
  // CREATE (n:ContentNode $props)
  if (query.match(/CREATE.*:ContentNode/)) {
    return {
      operation: 'createNode',
      params: extractParams(query)
    };
  }
  
  // CREATE (v:ContentNodeVersion $props)
  if (query.match(/CREATE.*:ContentNodeVersion/)) {
    return {
      operation: 'createVersion',
      params: extractParams(query)
    };
  }
};

// Task 7: Tree Processor
const processContentTree = (
  rootVersionId: string
): Effect.Effect<string, ProcessingError> =>
  Effect.gen(function* () {
    const version = yield* readVersionById(rootVersionId);
    
    if (!version._meta.includes || version._meta.includes.length === 0) {
      // Leaf node - return content as is
      return version.content || '';
    }
    
    // Process children in alphabetical order by node name
    const childResults = yield* Effect.all(
      version._meta.includes.map(inc =>
        Effect.gen(function* () {
          const childVersion = yield* readVersionById(inc.versionId);
          const childNode = yield* readNodeById(childVersion._meta.nodeId);
          const childContent = yield* processContentTree(inc.versionId);
          return { 
            content: childContent, 
            operation: childVersion.operation,
            nodeName: childNode.name,
            role: inc.role
          };
        })
      )
    );
    
    // Sort by node name for deterministic order
    const sortedChildren = childResults.sort((a, b) => 
      a.nodeName.localeCompare(b.nodeName)
    );
    
    // Apply operations based on type
    let result = version.content || '';
    
    for (const child of sortedChildren) {
      if (child.operation === 'insert') {
        // Replace {{nodeName}} with content
        const placeholder = `{{${child.nodeName}}}`;
        result = result.replace(placeholder, child.content);
      } else if (child.operation === 'concatenate') {
        // Append with role-based formatting
        if (child.role === 'system') {
          result = child.content + '\n\n' + result;
        } else {
          result = result + '\n\n' + child.content;
        }
      }
    }
    
    return result;
  });

// Task 6: Main GitPersistence Implementation
const runQuery = <T>(query: CypherQuery, params?: QueryParameters) =>
  Effect.gen(function* () {
    const { operation, params: queryParams } = translateQuery(query);
    
    switch (operation) {
      case 'findNodeByName':
        const node = yield* readNode(queryParams.name);
        return Option.match(node, {
          onNone: () => [],
          onSome: (n) => [{ n }] as T[]
        });
        
      case 'createNode':
        const newNode = yield* Schema.decode(ContentNode)(queryParams.props);
        yield* writeNode(newNode);
        yield* commitChanges(`Create ContentNode: ${newNode.name}`);
        return [{ n: newNode }] as T[];
        
      case 'findVersionsForNode':
        const versions = yield* listVersions(queryParams.nodeName);
        return versions.map(v => ({ v })) as T[];
        
      case 'createVersion':
        const newVersion = yield* Schema.decode(ContentNodeVersion)(queryParams.props);
        const nodeName = yield* getNodeNameFromId(queryParams.nodeId);
        yield* writeVersion(nodeName, newVersion);
        yield* commitChanges(`Create version for ${nodeName}: ${newVersion.commitMessage}`);
        return [{ v: newVersion }] as T[];
    }
  });
```

## Validation Loop

### Level 1: Syntax & Type Checking

```bash
# Run these FIRST - fix any errors before proceeding
pnpm run build                    # TypeScript compilation
pnpm run lint                     # ESLint checking

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests

```typescript
// Test unified types
describe('Unified ContentNode Storage', () => {
  it.effect('should store and retrieve ContentNode', () =>
    Effect.gen(function* () {
      const node: ContentNode = {
        id: Schema.decodeSync(ContentNodeId)('cn_test-123'),
        name: Schema.decodeSync(Slug)('greeting'),
        description: 'A greeting node'
      };
      
      yield* writeNode(node);
      const retrieved = yield* readNode('greeting');
      
      expect(Option.isSome(retrieved)).toBe(true);
      if (Option.isSome(retrieved)) {
        expect(retrieved.value.name).toBe('greeting');
      }
    }).pipe(Effect.provide(TestLayers))
  );
  
  it.effect('should handle insert operations', () =>
    Effect.gen(function* () {
      // Create parameter node and version
      const paramVersion: ContentNodeVersion = {
        id: Schema.decodeSync(ContentNodeVersionId)('cnv_param-1'),
        content: 'friendly',
        operation: 'insert',
        createdAt: new Date(),
        commitMessage: 'Friendly tone'
      };
      
      // Create template that uses it
      const templateVersion: ContentNodeVersion = {
        id: Schema.decodeSync(ContentNodeVersionId)('cnv_template-1'),
        content: 'Please respond in a {{tone}} manner',
        operation: 'concatenate',
        createdAt: new Date(),
        commitMessage: 'Template with tone'
      };
      
      // Process tree
      const result = yield* processContentTree('cnv_template-1');
      expect(result).toBe('Please respond in a friendly manner');
    }).pipe(Effect.provide(TestLayers))
  );
  
  it.effect('should process children alphabetically', () =>
    Effect.gen(function* () {
      // Create composition with multiple children
      const compVersion = {
        id: 'cnv_comp-1',
        content: '',
        operation: 'concatenate',
        _meta: {
          includes: [
            { versionId: 'cnv_zebra-1', role: 'content' },
            { versionId: 'cnv_alpha-1', role: 'content' },
            { versionId: 'cnv_beta-1', role: 'content' }
          ]
        }
      };
      
      // Children should be processed: alpha, beta, zebra
      const result = yield* processContentTree('cnv_comp-1');
      expect(result).toBe('Alpha content\n\nBeta content\n\nZebra content');
    }).pipe(Effect.provide(TestLayers))
  );
});

// Test Neo4j interface compatibility
describe('GitPersistence Neo4j Compatibility', () => {
  it.effect('should support VERSION_OF queries', () =>
    Effect.gen(function* () {
      const service = yield* Neo4jService;
      
      // Query for versions of a node
      const versions = yield* service.runQuery(
        'MATCH (n:ContentNode {name: $name})<-[:VERSION_OF]-(v:ContentNodeVersion) RETURN v',
        { name: 'greeting' }
      );
      
      expect(versions.length).toBeGreaterThan(0);
      expect(versions[0].v).toHaveProperty('content');
      expect(versions[0].v).toHaveProperty('operation');
    }).pipe(Effect.provide(GitPersistenceLive))
  );
});
```

### Level 3: Integration Test

```bash
# Test with git backend
PERSISTENCE_BACKEND=git pnpm run dev

# Create a parameter node
echo '{
  "name": "tone",
  "description": "Response tone",
  "content": "professional",
  "operation": "insert"
}' | janus content create parameter

# Create a snippet that uses it
echo '{
  "name": "greeting",
  "description": "Greeting template",
  "content": "Hello! Please respond in a {{tone}} manner.",
  "operation": "concatenate",
  "includes": [{"name": "tone", "role": "parameter"}]
}' | janus content create snippet

# Create a composition
echo '{
  "name": "welcome",
  "description": "Welcome message",
  "operation": "concatenate",
  "includes": [
    {"name": "greeting", "role": "user"}
  ]
}' | janus content create composition

# Test tree processing
janus content render welcome
# Expected: "Hello! Please respond in a professional manner."

# Check git history
cd data && git log --oneline
# Should show creation commits

# Verify file structure
tree data/
# Should show nodes/, versions/, tags/ structure
```

## Final validation Checklist

- [ ] All tests pass: `pnpm test`
- [ ] No linting errors: `pnpm run lint`
- [ ] No type errors: `pnpm run build`
- [ ] Preflight passes: `pnpm run preflight`
- [ ] Unified types work for all content (snippets, parameters, compositions)
- [ ] Tree processing respects operation types
- [ ] Children processed alphabetically by node name
- [ ] Git history tracks all changes
- [ ] File structure represents relationships clearly
- [ ] Performance <100ms for typical operations
- [ ] Effect compliance checklist from `docs/llms/effect/effect-compliance-checklist.md`

---

## Anti-Patterns to Avoid

- ❌ Don't store relationships in type arrays - use file references
- ❌ Don't mix old types (Snippet/Parameter) with new (ContentNode)
- ❌ Don't process children in random order - use alphabetical
- ❌ Don't ignore operation type - it determines processing behavior
- ❌ Don't duplicate node data in version files
- ❌ Don't use sync file operations - always Effect's FileSystem
- ❌ Don't forget _meta fields for relationships
- ❌ Don't break Neo4jService interface compatibility

## Benefits of Unified Model

1. **Simplicity**: Two types instead of six
2. **Flexibility**: Any node can have content and children
3. **Consistency**: All content follows same patterns
4. **Natural Storage**: Filesystem mirrors tree structure
5. **Easy Extension**: New operations are just enum values

## Migration Path

1. Implement new types alongside old ones
2. Create migration tool to convert existing data
3. Update services to use unified types
4. Run parallel tests to ensure compatibility
5. Remove old types once fully migrated

---

## Confidence Score: 8/10

High confidence due to:
- Simpler type model (2 vs 6 types)
- Clear operation semantics
- Natural filesystem representation
- Existing Effect patterns

Slight uncertainty around:
- Migration complexity from existing data
- Performance with deep content trees
- Edge cases in tree processing logic