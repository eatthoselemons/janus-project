name: "Unified Storage Layer with Git and Neo4j Backends"
description: |

## Purpose

Create a unified StorageService interface that abstracts persistence operations, with swappable Git and Neo4j implementations using the unified ContentNode model from the official domain model specification.

## Core Principles

1. **Context is Complete but Focused**: Include ALL necessary documentation sections, specific examples, and discovered caveats by linking specific documents
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md
6. **Condense Repeated Code**: Refactor code that repeated

---

## Goal

Replace direct Neo4jService usage with an abstract StorageService interface, enabling seamless switching between Git-based file storage and Neo4j graph database backends while using the unified ContentNode/ContentNodeVersion model.

## Why

- **Backend Flexibility**: Switch storage without changing business logic
- **Simplified Testing**: Mock storage easily without database setup
- **Future Extensibility**: Add new backends (PostgreSQL, S3, etc.) without touching existing code
- **Clean Architecture**: Follow Dependency Inversion Principle
- **Development Freedom**: Use Git locally, Neo4j in production

## What

A storage abstraction layer that:
- Defines a backend-agnostic StorageService interface
- Implements the interface for both Neo4j and Git
- Uses unified ContentNode/ContentNodeVersion types
- Allows runtime backend selection via configuration
- Maintains identical behavior across implementations
- **Git backend supports two modes**:
  - **Lossless**: Full JSON with metadata, complete version history via git log parsing
  - **Lossy**: Human-editable YAML/Markdown, current version only, fast performance

### Success Criteria

- [ ] All code uses StorageService instead of Neo4jService
- [ ] Both Git and Neo4j backends pass identical tests
- [ ] Backend switching requires only config change
- [ ] No implementation details leak through interface
- [ ] Migration tools work between backends

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Include these specific sections in your context window

- file: /home/user/git/janus-project/docs/design/domain-model.md
  why: [Official domain model specification with unified content types]
  critical: |
    ContentNode: abstract container (id, name, description)
    ContentNodeVersion: content + operation (insert/concatenate on edges)
    Tree structure with VERSION_OF, INCLUDES relationships
    TestCase defines conversation structure

- file: /home/user/git/janus-project/src/services/neo4j/Neo4j.service.ts
  why: [Current interface to abstract into StorageService]
  critical: |
    Four methods: runQuery, runInTransaction, runBatch, withSession
    All return Effect<T, Neo4jError, never>
    Must maintain this interface shape

- file: /home/user/git/janus-project/src/services/persistence/GenericPersistence.ts
  sections: [All usages of Neo4jService]
  why: [Shows all places that need StorageService]
  discovered_caveat: |
    Always accessed via: const neo4j = yield* Neo4jService
    Need to change to: const storage = yield* StorageService

- docfile: docs/llms/guides/effect-docs/platform/command.mdx
  include_sections: ['Creating Commands', 'Running Commands']
  why: [Git backend implementation]
  
- docfile: docs/llms/guides/effect-docs/platform/file-system.mdx
  include_sections: ['Basic Usage', 'Operations table']
  why: [File operations for Git backend]

- file: /home/user/git/janus-project/src/layers/neo4j/Neo4j.layer.ts
  sections: [Layer creation pattern]
  why: [Pattern for creating service layers]

- docfile: docs/llms/best-practices/generic-persistence-patterns.md
  why: [Patterns for type-safe persistence]
  critical: |
    Use Context.Tag for services
    Layer composition patterns
    Effect.gen usage

- file: /home/user/git/janus-project/docs/design/domain-model.md
  sections: ['Unified Content Types', 'Test Cases', 'Relationships']
  why: [Complete domain model with relationships and processing rules]
  critical: |
    Operation goes on EDGES not nodes
    TestCase defines roles, not content
    Children processed alphabetically by node name
    ContentNodeVersion has no operation field
```

### Known Gotchas & Critical Details

```typescript
// CRITICAL: Operation is on INCLUDES edges, NOT on ContentNodeVersion
// Git backend must store this in _meta.includes array with each relationship

// CRITICAL: Roles are defined in TestCase, NOT in content
// Content is role-agnostic - same content can be system/user/assistant

// CRITICAL: Children processed alphabetically by node name for determinism
// When loading includes and concatenation, sort by the included node's name

// CRITICAL: TestCase defines conversation structure
// MessageSlots filter content by tags and explicit includes/excludes

// CRITICAL: Edge properties must be preserved
// operation: 'insert' | 'concatenate'
// key: only for insert operations (parameter name)

// CRITICAL: Slugs are already validated to be filesystem-safe
// Regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ ensures no special characters
```

### Current Service Usage

```typescript
// CURRENT: Direct Neo4j dependency
import { Neo4jService } from '../services/neo4j';

const doSomething = Effect.gen(function* () {
  const neo4j = yield* Neo4jService;
  return yield* neo4j.runQuery('MATCH (n) RETURN n');
});

// DESIRED: Abstract storage dependency
import { StorageService } from '../services/storage';

const doSomething = Effect.gen(function* () {
  const storage = yield* StorageService;
  return yield* storage.runQuery('MATCH (n) RETURN n');
});
```

### Interface Design

```typescript
// StorageService - Abstract interface (replaces direct Neo4jService usage)
export interface StorageImpl {
  readonly runQuery: <T = unknown>(
    query: Query,
    params?: QueryParameters,
  ) => Effect.Effect<T[], StorageError, never>;

  readonly runInTransaction: <A>(
    operations: (tx: TransactionContext) => Effect.Effect<A, StorageError, never>,
  ) => Effect.Effect<A, StorageError, never>;

  readonly runBatch: <T = unknown>(
    queries: Array<{
      query: Query;
      params?: QueryParameters;
    }>,
  ) => Effect.Effect<T[][], StorageError, never>;

  readonly withSession: <A>(
    work: (session: Session) => Effect.Effect<A, StorageError, never>,
  ) => Effect.Effect<A, StorageError, never>;
}

export class StorageService extends Context.Tag('StorageService')<
  StorageService,
  StorageImpl
>() {}

// Query type can be Cypher for Neo4j or structured query for Git
type Query = CypherQuery | StructuredQuery;

// Unified error type
export class StorageError extends Data.TaggedError("StorageError")<{
  readonly query?: string;
  readonly operation: 'create' | 'read' | 'update' | 'delete' | 'transaction';
  readonly originalMessage: string;
}> {}
```

### Backend Implementations

```typescript
// Neo4j implementation
export const Neo4jStorageLive = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const driver = yield* createNeo4jDriver();
    
    return StorageService.of({
      runQuery: (query, params) => {
        // Existing Neo4j implementation
        // Just wrap Neo4jError as StorageError
      },
      // ... other methods
    });
  })
);

// Git implementation  
export const GitStorageLive = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const git = yield* GitService;
    const fs = yield* FileSystem.FileSystem;
    
    return StorageService.of({
      runQuery: (query, params) => {
        // Translate query to file operations
        // Return same shape as Neo4j
      },
      // ... other methods
    });
  })
);
```

### Unified Type Model

```typescript
// Core content types (from unified PRP)
type ContentNode = {
  id: ContentNodeId;
  name: Slug;
  description: string;
}

type ContentNodeVersion = {
  id: ContentNodeVersionId;
  content?: string; // Optional - branches might not have content
  createdAt: Date;
  commitMessage: string;
  // NOTE: operation is on EDGES, not nodes!
}

// Edge properties for INCLUDES relationship
type IncludesEdgeProperties = {
  operation: 'insert' | 'concatenate';
  key?: string; // Only for insert operations
}

// TestCase defines conversation structure
type TestCase = {
  id: TestCaseId;
  name: string;
  description: string;
  createdAt: Date;
  llmModel: string;
  messageSlots: MessageSlot[];
  parameters?: Record<string, string>;
}

type MessageSlot = {
  role: 'system' | 'user' | 'assistant';
  tags?: string[];
  excludeNodes?: string[];
  includeNodes?: string[];
  sequence: number;
}

// Relationships handled by backend
// Neo4j: Native graph edges with properties
// Git: File references with edge data in _meta
```

### Git Backend Modes

The Git backend supports two modes for different use cases:

#### Lossless Mode (Full Fidelity)
- **Purpose**: Automated backups, migrations, data integrity
- **Format**: JSON with complete metadata and IDs
- **Versioning**: Parses git history for version traversal
- **Performance**: Slower due to git operations
- **Use cases**: CI/CD, backups, Neo4j migration

#### Lossy Mode (Human Editable)
- **Purpose**: Local development, manual editing
- **Format**: YAML or Markdown for easy editing
- **Versioning**: Current version only (git handles history)
- **Performance**: Fast - simple file reads
- **Use cases**: Development, prototyping, content authoring

### File Structure (Git Backend)

#### Lossless Mode Structure
```bash
data/
├── nodes/                      # ContentNode entities (JSON)
│   ├── greeting.json          
│   ├── tone.json             
│   └── welcome-prompt.json    
├── versions/                  # ContentNodeVersion entities (JSON)
│   ├── greeting/
│   │   └── v1.json           
│   ├── tone/
│   │   ├── v1.json          
│   │   └── v2.json          
│   └── welcome-prompt/
│       └── v1.json          
├── tags/                     # Tag definitions
│   ├── cli.json
│   └── greeting.json
└── testcases/               # TestCase definitions
    ├── support-conversation.json
    └── concise-system-prompt.json
```

#### Lossy Mode Structure
```bash
data/
├── content/                   # All content in human-friendly format
│   ├── greeting.yaml         # Or .md for Markdown format
│   ├── tone.yaml            
│   └── welcome-prompt.yaml   
├── testcases/                # Test cases in YAML
│   ├── support-conversation.yaml
│   └── concise-system-prompt.yaml
└── tags.yaml                 # All tags in one file
```

### Storage Format Examples

#### Lossless Mode (JSON)

```json
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
  "createdAt": "2024-01-15T10:30:00Z",
  "commitMessage": "Initial greeting template",
  "_meta": {
    "nodeId": "cn_550e8400-e29b-41d4-a716-446655440000", // VERSION_OF
    "includes": [  // INCLUDES relationships with edge properties
      {
        "versionId": "cnv_770e8400-e29b-41d4-a716-446655440000",
        "operation": "insert",  // Edge property
        "key": "tone"          // Edge property for insert operation
      }
    ]
  }
}

// File: data/versions/tone/v1.json (parameter node version)
{
  "id": "cnv_770e8400-e29b-41d4-a716-446655440000",
  "content": "professional",
  "createdAt": "2024-01-15T10:30:00Z",
  "commitMessage": "Professional tone option",
  "_meta": {
    "nodeId": "cn_880e8400-e29b-41d4-a716-446655440000"
    // No includes - this is a leaf node
  }
}

// File: data/testcases/support-conversation.json
{
  "id": "tc_990e8400-e29b-41d4-a716-446655440000",
  "name": "Support conversation flow",
  "description": "Multi-turn support conversation",
  "createdAt": "2024-01-15T10:30:00Z",
  "llmModel": "gpt-4",
  "messageSlots": [
    {
      "role": "system",
      "tags": ["instruction", "behavior"],
      "sequence": 0
    },
    {
      "role": "user",
      "tags": ["greeting"],
      "sequence": 1
    },
    {
      "role": "assistant",
      "tags": ["greeting-response"],
      "sequence": 2
    }
  ],
  "parameters": {
    "tone": "helpful",
    "style": "concise"
  }
}
```

#### Lossy Mode (YAML/Markdown)

```yaml
# File: data/content/greeting.yaml
name: greeting
description: A friendly greeting template
tags: [greeting, cli]
content: |
  Hello! Reply in a {{tone}} manner.
includes:
  - name: tone        # Reference by name, not ID
    operation: insert
    key: tone
```

```yaml
# File: data/content/tone.yaml
name: tone
description: Tone parameter for responses
tags: [parameter]
content: professional
# No includes - leaf node
```

```markdown
<!-- Alternative: data/content/greeting.md -->
---
name: greeting
description: A friendly greeting template
tags: [greeting, cli]
includes:
  tone: insert  # Simplified syntax for single parameter
---

Hello! Reply in a {{tone}} manner.
```

```yaml
# File: data/testcases/support-conversation.yaml
name: support-conversation
description: Multi-turn support conversation
model: gpt-4
parameters:
  tone: helpful
  style: concise
messages:
  - role: system
    tags: [instruction, behavior]
  - role: user
    tags: [greeting]
  - role: assistant
    tags: [greeting-response]
```

### Query Pattern Mappings

```yaml
# Key queries that must be supported
MATCH (n:ContentNode {name: $name}):
  - Read data/nodes/${name}.json

CREATE (n:ContentNode $props):
  - Write data/nodes/${props.name}.json
  - Add tags to _meta.tags
  - Git add & commit

MATCH (n:ContentNode)<-[:VERSION_OF]-(v:ContentNodeVersion):
  - Read node file to get ID
  - List data/versions/${nodeName}/*.json
  - Filter by _meta.nodeId

MATCH (parent:ContentNodeVersion)-[:INCLUDES]->(child:ContentNodeVersion):
  - Read parent version file
  - Map _meta.includes array with edge properties
  - Load each referenced child version

CREATE (parent)-[:INCLUDES {operation: $op, key: $key}]->(child):
  - Add to parent's _meta.includes with edge properties
  - Store operation and key on the relationship

MATCH (n:ContentNode)-[:HAS_TAG]->(:Tag {name: $tag}):
  - Read node's _meta.tags array
  - Filter nodes by tag membership

ORDER BY v.createdAt DESC:
  - Sort files by createdAt field
  - Or use git log for true chronological order
```

### Configuration

```typescript
// Config schema with storage backend selection
export const ConfigSchema = Schema.Struct({
  storageBackend: Schema.Literal('neo4j', 'git').pipe(
    Schema.withDefault(() => 'neo4j')
  ),
  neo4j: Neo4jConfigSchema,
  git: Schema.Struct({
    dataPath: Schema.String.pipe(Schema.withDefault(() => './data')),
    mode: Schema.Literal('lossless', 'lossy').pipe(
      Schema.withDefault(() => 'lossy') // Default to human-friendly
    )
  })
});

// Layer selection based on config
export const StorageLive = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    
    if (config.storageBackend === 'git') {
      return yield* Layer.buildSync(GitStorageLive);
    } else {
      return yield* Layer.buildSync(Neo4jStorageLive);
    }
  })
).pipe(Layer.flatten);
```

## Implementation Blueprint

### List of tasks to be completed

```yaml
Task 1: Create Storage Service Interface
CREATE src/services/storage/Storage.service.ts:
  - Define StorageService with Context.Tag
  - Copy interface from Neo4jService but rename
  - Define StorageError to replace Neo4jError
  - Create TransactionContext interface
  - Export Query type (union of CypherQuery | StructuredQuery)

Task 2: Create Unified Domain Types
CREATE src/domain/types/content.ts:
  - ContentNode with id, name, description
  - ContentNodeVersion with content, createdAt, commitMessage
  - EdgeOperation type: 'insert' | 'concatenate' (for edges)
  - IncludesEdgeProperties with operation and optional key
  - TestCase and MessageSlot types
  - Branded IDs using makeIdType factory

Task 3: Update All Service Imports
MODIFY all files importing Neo4jService:
  - Change import to StorageService
  - Update yield* Neo4jService to yield* StorageService
  - Update error handling from Neo4jError to StorageError
  - Files to update:
    - src/services/persistence/GenericPersistence.ts
    - src/services/snippet/SnippetPersistence.ts
    - src/cli/commands/snippet/search.ts
    - All test files

Task 4: Create Neo4j Storage Implementation
CREATE src/services/storage/neo4j/Neo4jStorage.ts:
  - Implement StorageService interface
  - Wrap existing Neo4j logic
  - Convert Neo4jError to StorageError
  - Handle ContentNode queries

CREATE src/layers/storage/Neo4jStorage.layer.ts:
  - Create Neo4jStorageLive layer
  - Reuse existing Neo4j driver setup

Task 5: Create Git Storage Implementation
CREATE src/services/storage/git/GitStorage.ts:
  - Implement StorageService interface
  - Delegate to appropriate strategy based on mode
  - Handle mode switching

CREATE src/services/storage/git/strategies/LosslessStrategy.ts:
  - Extends BaseGitStrategy
  - Full JSON with metadata and complete IDs
  - Parse git history for version traversal
  - Preserve all timestamps and relationships
  - Support migration to/from Neo4j
  - Store edge properties in _meta.includes arrays

CREATE src/services/storage/git/strategies/LossyStrategy.ts:
  - Extends BaseGitStrategy
  - YAML/Markdown format for human editing
  - Name-based references (no IDs in files)
  - Single current version per node
  - Generate stable IDs from names when needed
  - Simplified include syntax in frontmatter

CREATE src/services/storage/git/query-translator.ts:
  - Parse Cypher-like queries
  - Map to file operations
  - Support both modes

CREATE src/layers/storage/GitStorage.layer.ts:
  - Create GitStorageLive layer
  - Initialize Git repo if needed
  - Select strategy based on config

Task 6: Create Storage Layer Selector
CREATE src/layers/storage/Storage.layer.ts:
  - Read config to determine backend
  - Export appropriate implementation
  - Maintain backward compatibility

MODIFY src/layers/index.ts:
  - Export StorageLive instead of Neo4jLive
  - Update dependent layers

Task 7: Update Configuration
MODIFY src/domain/types/config.ts:
  - Add storageBackend field
  - Add git configuration section

MODIFY src/services/config/index.ts:
  - Handle new config fields
  - Set appropriate defaults

Task 8: Create Migration Tools
CREATE src/tools/migrate-storage.ts:
  - Export from Neo4j to Git format
  - Import from Git to Neo4j
  - Handle unified types

Task 9: Update Tests
MODIFY all test files:
  - Use StorageService instead of Neo4jService
  - Create tests that run against both backends
  - Ensure identical behavior

CREATE src/services/storage/Storage.test.ts:
  - Test both implementations
  - Verify interface compliance
  - Performance benchmarks

Task 10: Documentation
CREATE docs/storage-backends.md:
  - Configuration instructions
  - Migration guide
  - Performance characteristics
```

### Per task pseudocode

```typescript
// Task 1: Storage Service Interface
// src/services/storage/Storage.service.ts
import { Context, Effect, Data } from 'effect';

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly query?: string;
  readonly operation: 'create' | 'read' | 'update' | 'delete' | 'transaction';
  readonly originalMessage: string;
}> {}

export interface TransactionContext {
  readonly run: <T = unknown>(
    query: Query,
    params?: QueryParameters,
  ) => Effect.Effect<T[], StorageError, never>;
}

export interface StorageImpl {
  readonly runQuery: <T = unknown>(
    query: Query,
    params?: QueryParameters,
  ) => Effect.Effect<T[], StorageError, never>;

  readonly runInTransaction: <A>(
    operations: (tx: TransactionContext) => Effect.Effect<A, StorageError, never>,
  ) => Effect.Effect<A, StorageError, never>;

  readonly runBatch: <T = unknown>(
    queries: Array<{
      query: Query;
      params?: QueryParameters;
    }>,
  ) => Effect.Effect<T[][], StorageError, never>;

  readonly withSession: <A>(
    work: (session: Session) => Effect.Effect<A, StorageError, never>,
  ) => Effect.Effect<A, StorageError, never>;
}

export class StorageService extends Context.Tag('StorageService')<
  StorageService,
  StorageImpl
>() {}

// Task 3: Update service usage
// Before:
const neo4j = yield* Neo4jService;
const results = yield* neo4j.runQuery(query, params);

// After:
const storage = yield* StorageService;
const results = yield* storage.runQuery(query, params);

// Task 4: Neo4j Storage Implementation
// src/services/storage/neo4j/Neo4jStorage.ts
export const createNeo4jStorage = (driver: Driver): StorageImpl => ({
  runQuery: (query, params) =>
    Effect.gen(function* () {
      // Reuse existing Neo4j implementation
      const session = driver.session();
      try {
        const result = yield* Effect.tryPromise({
          try: () => session.run(query as string, params),
          catch: (e) => new StorageError({
            query: query as string,
            operation: 'read',
            originalMessage: e instanceof Error ? e.message : String(e)
          })
        });
        return result.records.map(r => r.toObject());
      } finally {
        yield* Effect.promise(() => session.close());
      }
    }),

  runInTransaction: (operations) =>
    // Existing transaction logic, wrapped with StorageError
    
  // ... other methods
});

// Task 5: Git Storage Implementation with Strategy Pattern
// src/services/storage/git/GitStorage.ts
interface GitStorageStrategy {
  runQuery: StorageImpl['runQuery'];
  runInTransaction: StorageImpl['runInTransaction'];
  runBatch: StorageImpl['runBatch'];
  withSession: StorageImpl['withSession'];
}

// Base strategy with common git operations
abstract class BaseGitStrategy implements GitStorageStrategy {
  constructor(
    protected git: GitService,
    protected fs: FileSystem.FileSystem,
    protected config: GitConfig
  ) {}

  abstract runQuery: StorageImpl['runQuery'];
  
  runInTransaction = (operations) =>
    Effect.gen(function* () {
      const filesWritten: string[] = [];
      
      const txContext: TransactionContext = {
        run: (query, params) =>
          Effect.gen(function* () {
            const result = yield* this.runQuery(query, params);
            
            // Track files for batch commit
            const { operation, entityType } = yield* parseQuery(query);
            if (operation === 'CREATE' || operation === 'UPDATE') {
              filesWritten.push(/* file path */);
            }
            
            return result;
          })
      };
      
      const result = yield* operations(txContext);
      
      // Commit all changes at once
      if (filesWritten.length > 0) {
        yield* Effect.all(
          filesWritten.map(f => this.git.add(f)),
          { concurrency: "unbounded" }
        );
        yield* this.git.commit("Transaction commit");
      }
      
      return result;
    });

  runBatch = (queries) =>
    Effect.gen(function* () {
      return yield* Effect.forEach(
        queries,
        (query) => this.runQuery(query.query, query.params),
        { concurrency: "unbounded" }
      );
    });

  withSession = <A>(work: (session: Session) => Effect.Effect<A, StorageError, never>) =>
    Effect.gen(function* () {
      // Git doesn't need sessions, but provide compatible interface
      const mockSession = {} as Session;
      return yield* work(mockSession);
    });
}

export const createGitStorage = (
  git: GitService,
  fs: FileSystem.FileSystem,
  config: GitConfig
): StorageImpl => {
  // Select strategy based on mode
  const strategy = config.mode === 'lossless' 
    ? new LosslessStrategy(git, fs)
    : new LossyStrategy(git, fs);
    
  return {
    runQuery: strategy.runQuery,
    runInTransaction: strategy.runInTransaction,
    runBatch: strategy.runBatch,
    withSession: strategy.withSession
  };
};

// src/services/storage/git/strategies/LossyStrategy.ts
export class LossyStrategy implements GitStorageStrategy {
  constructor(
    private git: GitService,
    private fs: FileSystem.FileSystem
  ) {}
  
  runQuery = (query, params) =>
    Effect.gen(function* () {
      const { operation, entityType, filters } = yield* parseQuery(query);
      
      switch (operation) {
        case 'MATCH':
          if (entityType === 'ContentNode' && filters.name) {
            // Lossy mode: single YAML file per node
            const path = `data/content/${filters.name}.yaml`;
            const exists = yield* this.fs.exists(path);
            if (!exists) return [];
            
            const content = yield* this.fs.readFileString(path);
            const data = yield* parseYaml(content);
            
            // Generate ID from name for compatibility
            const node = {
              ...data,
              id: generateIdFromName('ContentNode', data.name)
            };
            
            return [{ n: node }];
          }
          // Handle other patterns
          
        case 'CREATE':
          if (entityType === 'ContentNode') {
            const node = params?.props;
            const path = `data/content/${node.name}.yaml`;
            
            // Human-friendly YAML format
            const yamlContent = stringifyYaml({
              name: node.name,
              description: node.description,
              tags: node.tags || [],
              content: node.content,
              includes: [] // Will be populated by relationships
            });
            
            yield* this.fs.writeFileString(path, yamlContent);
            yield* this.git.add(path);
            yield* this.git.commit(`Create ${node.name}`);
            
            return [{ n: node }];
          }
          // Handle other types
      }
    });

  runInTransaction: (operations) =>
    Effect.gen(function* () {
      const filesWritten: string[] = [];
      
      const txContext: TransactionContext = {
        run: (query, params) =>
          Effect.gen(function* () {
            const result = yield* runQuery(query, params);
            
            // Track files for batch commit
            const { operation, entityType } = yield* parseQuery(query);
            if (operation === 'CREATE' || operation === 'UPDATE') {
              filesWritten.push(/* file path */);
            }
            
            return result;
          })
      };
      
      const result = yield* operations(txContext);
      
      // Commit all changes at once
      if (filesWritten.length > 0) {
        yield* Effect.all(
          filesWritten.map(f => git.add(f)),
          { concurrency: "unbounded" }
        );
        yield* git.commit("Transaction commit");
      }
      
      return result;
    }),
    
  // ... other methods
});

// Task 6: Layer Selector
// src/layers/storage/Storage.layer.ts
export const StorageLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* ConfigService;
    
    if (config.storageBackend === 'git') {
      return GitStorageLive;
    } else {
      return Neo4jStorageLive;
    }
  })
);

// Task 9: Cross-backend testing
// src/services/storage/Storage.test.ts
const backends = [
  { name: 'Neo4j', layer: Neo4jStorageLive },
  { name: 'Git', layer: GitStorageLive }
];

backends.forEach(({ name, layer }) => {
  describe(`${name} Storage Backend`, () => {
    it.effect('should create and retrieve ContentNode', () =>
      Effect.gen(function* () {
        const storage = yield* StorageService;
        
        // Create
        yield* storage.runQuery(
          'CREATE (n:ContentNode $props) RETURN n',
          { props: { id: 'cn_123', name: 'test', description: 'Test node' } }
        );
        
        // Retrieve
        const results = yield* storage.runQuery(
          'MATCH (n:ContentNode {name: $name}) RETURN n',
          { name: 'test' }
        );
        
        expect(results).toHaveLength(1);
        expect(results[0].n.name).toBe('test');
      }).pipe(Effect.provide(layer))
    );
    
    // All other tests...
  });
});
```

### Integration Points

```yaml
CONFIGURATION:
  - add to: src/domain/types/config.ts
  - field: "storageBackend: Schema.Literal('neo4j', 'git')"
  - default: 'neo4j' for backward compatibility

ENVIRONMENT:
  - STORAGE_BACKEND=git for Git backend
  - STORAGE_BACKEND=neo4j for Neo4j backend (default)
  - GIT_STORAGE_MODE=lossless for full fidelity
  - GIT_STORAGE_MODE=lossy for human-editable (default)

LAYERS:
  - All layers that depended on Neo4jLive now depend on StorageLive
  - No changes needed in business logic layers

MIGRATION:
  - npm run migrate:export -- --from neo4j --to git --mode lossless
  - npm run migrate:import -- --from git --to neo4j
  - npm run migrate:convert -- --from lossless --to lossy
  - npm run migrate:convert -- --from lossy --to lossless
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
// Test storage abstraction
describe('Storage Service Abstraction', () => {
  it.effect('should hide implementation details', () =>
    Effect.gen(function* () {
      const storage = yield* StorageService;
      
      // Should not expose Neo4j or Git specifics
      expect(storage).not.toHaveProperty('driver');
      expect(storage).not.toHaveProperty('git');
      
      // Should only have interface methods
      expect(storage).toHaveProperty('runQuery');
      expect(storage).toHaveProperty('runInTransaction');
      expect(storage).toHaveProperty('runBatch');
      expect(storage).toHaveProperty('withSession');
    }).pipe(Effect.provide(StorageLive))
  );
});

// Test backend switching
describe('Backend Switching', () => {
  it.effect('should use Git when configured', () =>
    Effect.gen(function* () {
      const storage = yield* StorageService;
      
      // Create a node
      yield* storage.runQuery(
        'CREATE (n:ContentNode $props) RETURN n',
        { props: { id: 'cn_1', name: 'git-test', description: 'Testing Git' } }
      );
      
      // Verify file was created
      const fs = yield* FileSystem.FileSystem;
      const exists = yield* fs.exists('data/nodes/git-test.json');
      expect(exists).toBe(true);
    }).pipe(
      Effect.provide(
        Layer.merge(
          Layer.succeed(ConfigService, { storageBackend: 'git' }),
          GitStorageLive
        )
      )
    )
  );
});
```

### Level 3: Integration Test

```bash
# Test with Neo4j backend (default)
pnpm run dev

# Create content
janus content create node --name "test" --description "Test node"

# Switch to Git backend
STORAGE_BACKEND=git pnpm run dev

# Same command should work
janus content create node --name "test2" --description "Test node 2"

# Verify file created
ls data/nodes/test2.json

# Test migration
npm run migrate:export -- --from neo4j --to git
# Should export all Neo4j data to Git format

npm run migrate:import -- --from git --to neo4j  
# Should import Git data back to Neo4j
```

## Final validation Checklist

- [ ] All tests pass: `pnpm test`
- [ ] No linting errors: `pnpm run lint`
- [ ] No type errors: `pnpm run build`
- [ ] Preflight passes: `pnpm run preflight`
- [ ] All code uses StorageService (no direct Neo4jService usage)
- [ ] Backend switching works with just config change
- [ ] Both backends pass identical test suites
- [ ] Migration tools work bidirectionally
- [ ] No implementation details leak through interface
- [ ] Performance benchmarks acceptable for both backends
- [ ] Effect compliance checklist from `docs/llms/effect/effect-compliance-checklist.md`

---

## Anti-Patterns to Avoid

- ❌ Don't expose backend-specific types through StorageService
- ❌ Don't use different method names for different backends
- ❌ Don't let implementation details leak (e.g., Driver, git commands)
- ❌ Don't hardcode backend checks in business logic
- ❌ Don't skip the abstraction "for performance" 
- ❌ Don't create backend-specific error types
- ❌ Don't break existing code that uses Neo4jService
- ❌ Don't forget to update all imports and yields

## Benefits of Storage Abstraction

1. **True Backend Independence**: Swap storage without touching business logic
2. **Easier Testing**: Mock storage without databases
3. **Future Proof**: Add new backends easily
4. **Clean Architecture**: Proper dependency inversion
5. **Development Flexibility**: Different backends for different environments

## Benefits of Dual-Mode Git Backend

### Lossy Mode Benefits
- **Human Readable**: Edit content in VS Code, vim, or any text editor
- **Fast Performance**: No git history parsing, simple file reads
- **Easy Collaboration**: Review changes in standard diff tools
- **Rapid Prototyping**: Create content without worrying about IDs
- **Intuitive Format**: YAML/Markdown familiar to developers

### Lossless Mode Benefits
- **Complete Fidelity**: All metadata preserved
- **Migration Ready**: Can move data to/from Neo4j
- **Full History**: Access all versions via git log parsing
- **Audit Trail**: Complete record of all changes
- **CI/CD Compatible**: Automated backups and restores

### Mode Switching
- Start in lossy mode for development
- Switch to lossless for production backups
- Convert between modes as needed
- Mix modes (read lossless, write lossy)

## Migration Strategy

1. Create StorageService interface alongside Neo4jService
2. Implement Neo4j backend that delegates to existing code
3. Update imports incrementally (can be done file by file)
4. Implement Git backend
5. Remove direct Neo4jService usage
6. Deprecate Neo4jService once migration complete

---

## Confidence Score: 8/10

High confidence because:
- Clear abstraction boundary
- Existing Neo4j code can be wrapped
- Simple interface to implement
- Effect patterns well-established
- Can migrate incrementally
- Dual-mode design provides flexibility

Moderate complexity added by:
- Two Git storage strategies to implement
- ID generation/resolution in lossy mode
- Format conversion between modes
- YAML/Markdown parsing and generation

The dual-mode approach adds implementation complexity but greatly improves usability for development scenarios.