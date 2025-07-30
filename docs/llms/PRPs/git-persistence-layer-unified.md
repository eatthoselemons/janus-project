name: "Unified Storage Layer with Git and Neo4j Backends"
description: |

## Purpose

Create a unified StorageService interface that abstracts persistence operations, with swappable Git and Neo4j implementations using the simplified ContentNode model.

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

### Success Criteria

- [ ] All code uses StorageService instead of Neo4jService
- [ ] Both Git and Neo4j backends pass identical tests
- [ ] Backend switching requires only config change
- [ ] No implementation details leak through interface
- [ ] Performance remains acceptable for both backends
- [ ] Migration tools work between backends

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Include these specific sections in your context window

- file: /home/user/git/janus-project/docs/llms/features/unified-content-types.md
  why: [Unified type model both backends must support]
  critical: |
    ContentNode: abstract container (id, name, description)
    ContentNodeVersion: content + operation (insert/concatenate)
    Tree structure with VERSION_OF, INCLUDES relationships

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
// Single types for both backends
type ContentNode = {
  id: ContentNodeId;
  name: Slug;
  description: string;
}

type ContentNodeVersion = {
  id: ContentNodeVersionId;
  content?: string;
  operation: 'insert' | 'concatenate';
  createdAt: Date;
  commitMessage: string;
}

// Relationships handled by backend
// Neo4j: Graph edges
// Git: File references in _meta
```

### File Structure (Git Backend)

```bash
data/
├── nodes/                      # ContentNode entities
│   ├── greeting.json          
│   ├── tone.json             
│   └── welcome-prompt.json    
├── versions/                  # ContentNodeVersion entities
│   ├── greeting/
│   │   └── v1.json           
│   ├── tone/
│   │   ├── v1.json          
│   │   └── v2.json          
│   └── welcome-prompt/
│       └── v1.json          
└── tags/                     
    ├── cli.json
    └── greeting.json
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
    dataPath: Schema.String.pipe(Schema.withDefault(() => './data'))
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
  - ContentNodeVersion with content, operation
  - Operation type: 'insert' | 'concatenate'
  - Branded IDs for type safety

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
  - Translate queries to file operations
  - Use Git for version history
  - Process tree relationships

CREATE src/services/storage/git/query-translator.ts:
  - Parse Cypher-like queries
  - Map to file operations
  - Support ContentNode queries

CREATE src/layers/storage/GitStorage.layer.ts:
  - Create GitStorageLive layer
  - Initialize Git repo if needed

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

// Task 5: Git Storage Implementation
// src/services/storage/git/GitStorage.ts
export const createGitStorage = (
  git: GitService,
  fs: FileSystem.FileSystem
): StorageImpl => ({
  runQuery: (query, params) =>
    Effect.gen(function* () {
      const { operation, entityType, filters } = yield* parseQuery(query);
      
      switch (operation) {
        case 'MATCH':
          if (entityType === 'ContentNode' && filters.name) {
            const path = `data/nodes/${filters.name}.json`;
            const exists = yield* fs.exists(path);
            if (!exists) return [];
            
            const content = yield* fs.readFileString(path);
            const node = JSON.parse(content);
            const { _meta, ...data } = node;
            return [{ n: data }];
          }
          // Handle other patterns
          
        case 'CREATE':
          if (entityType === 'ContentNode') {
            const node = params?.props;
            const path = `data/nodes/${node.name}.json`;
            
            const fileContent = {
              ...node,
              _meta: {
                type: 'ContentNode',
                created: new Date().toISOString(),
                tags: []
              }
            };
            
            yield* fs.writeFileString(path, JSON.stringify(fileContent, null, 2));
            yield* git.add(path);
            yield* git.commit(`Create ContentNode: ${node.name}`);
            
            return [{ n: node }];
          }
          // Handle other types
      }
    }),

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

LAYERS:
  - All layers that depended on Neo4jLive now depend on StorageLive
  - No changes needed in business logic layers

MIGRATION:
  - npm run migrate:export -- --from neo4j --to git
  - npm run migrate:import -- --from git --to neo4j
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

## Migration Strategy

1. Create StorageService interface alongside Neo4jService
2. Implement Neo4j backend that delegates to existing code
3. Update imports incrementally (can be done file by file)
4. Implement Git backend
5. Remove direct Neo4jService usage
6. Deprecate Neo4jService once migration complete

---

## Confidence Score: 9/10

High confidence because:
- Clear abstraction boundary
- Existing Neo4j code can be wrapped
- Simple interface to implement
- Effect patterns well-established
- Can migrate incrementally

Minor uncertainty:
- Query abstraction complexity (Cypher vs structured queries)
- Performance overhead of abstraction layer