name: "Snippet Persistence Service Implementation v2.1"
description: |

## Purpose

Implement the Snippet Persistence Service (Section 2.1 from implementation-todo.md) with comprehensive context and validation capabilities for one-pass implementation success.

## Core Principles

1. **Context is Complete but Focused**: Include ALL necessary documentation sections, specific examples, and discovered caveats by linking specific documents
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md
6. **Condense Repeated Code**: Refactor code that repeated

---

## Goal

Implement a complete `SnippetPersistence` service that provides all required persistence methods for managing Snippets and SnippetVersions in Neo4j, following the established Effect-TS patterns in the codebase.

## Why

- **Business value**: Snippets are the fundamental building blocks of the Janus prompt engineering system. Without persistence, users cannot save, version, or retrieve their prompts.
- **Integration**: This service is a prerequisite for the Snippet CLI commands (Section 2.2) and will be used by the Composition services.
- **Problems solved**: Enables versioned storage of prompt snippets with full audit trail and search capabilities.

## What

Implement a type-safe, Effect-based persistence layer for Snippets that:

- Creates new Snippets with unique names (slugs)
- Creates new SnippetVersions with proper versioning chains
- Finds Snippets by name with proper error handling
- Lists all Snippets in the system
- Searches Snippets by content/description
- Follows the established Neo4j service patterns

### Success Criteria

- [ ] All 6 persistence methods implemented with proper Effect types
- [ ] Integration tests pass using test Neo4j database
- [ ] Proper error handling with typed errors (NotFoundError, PersistenceError)
- [ ] UUID generation for IDs
- [ ] Proper Neo4j relationship creation (VERSION_OF, PREVIOUS_VERSION)
- [ ] Effect compliance checklist completed

## All Needed Context

### Documentation & References (include complete sections that are directly relevant)

```yaml
# MUST READ - Include these specific sections in your context window

- file: src/domain/types/snippet.ts
  why: Snippet and SnippetVersion schemas we must persist
  critical: |
    - Snippet has id (SnippetId), name (Slug), description (String)
    - SnippetVersion has id (SnippetVersionId), content (String), createdAt (DateTimeUtc), commit_message (String)

- file: src/domain/types/branded.ts
  why: Understanding branded ID types and Slug validation
  critical: |
    - All IDs are UUID v4 format with pattern validation
    - Slug must match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    - Use Schema.decodeSync for construction in code

- file: src/services/neo4j/Neo4j.service.ts
  why: The Neo4j service interface we'll use for queries
  critical: |
    - Use runQuery for simple queries
    - Use runInTransaction for multi-step operations
    - TransactionContext provides tx.run method

- docfile: docs/llms/guides/effect-neo4j/05-actions-layer-services.md
  sections:
    ['Repository/Data Access Patterns', 'Service Layer with Transactions']
  why: Shows both Option A (individual functions) and Option B (grouped repository) patterns
  critical: |
    - For persistence services, use Option A (individual function exports)
    - Use cypher template function for queries
    - Use queryParams helper for parameters with proper error handling
    - Always use yield* with Effects inside Effect.gen

- docfile: docs/llms/guides/effect-neo4j/07-testing-strategies.md
  sections: ['Integration Testing with Test Layers']
  why: Shows how to structure test layers for persistence services
  critical: |
    - Test utilities go in separate .test-layers.ts files
    - Always construct branded types properly in tests using Schema.decodeSync

- file: src/layers/neo4j/Neo4j.layer.ts:358-413
  why: Neo4jTest layer implementation for mocking
  critical: |
    - Use Map<string, unknown[]> for mock data
    - Mock both runQuery and runInTransaction methods

- file: src/domain/types/tests/database-integration.test.ts
  why: Example integration test patterns
  critical: |
    - Use @effect/vitest for Effect-aware testing
    - Test layers are provided via Effect.provide
    - Use Effect.runPromise for async tests

- url: https://www.npmjs.com/package/@effect/vitest
  why: Effect-specific vitest instructions
  critical: |
    - Use it.effect for Effect-based tests
    - Automatic test environment setup

- docfile: docs/design/domain-model.md
  sections: ['Snippets', 'Relationship Definitions']
  why: Understanding the Neo4j graph relationships
  critical: |
    - (SnippetVersion) -[:VERSION_OF]-> (Snippet)
    - (SnippetVersion) -[:PREVIOUS_VERSION]-> (SnippetVersion)
    - SnippetVersion nodes need proper chronological linking

- file: src/domain/types/errors.ts
  why: Error types to use for failures
  critical: |
    - Use NotFoundError for entity lookup failures
    - Use PersistenceError for database operations
    - All errors have structured data, not just messages
```

### Context Inclusion Guidelines

- Include COMPLETE sections when they contain implementation details
- Include MULTIPLE examples if they show different use cases
- Include ALL caveats and warnings discovered during research
- Skip sections about: history, philosophy, future plans, unrelated features
- When in doubt, include it - but be specific about WHY it's needed

### Current Codebase tree (run `tree` in the root of the project) to get an overview of the codebase

```bash
src
├── domain
│   └── types
│       └── tests
├── layers
│   ├── configuration
│   └── neo4j
├── lib
└── services
    ├── config
    ├── configuration
    └── neo4j
```

### Desired Codebase tree with files to be added and responsibility of file

```bash
src
├── domain
│   └── types
│       └── tests
├── layers
│   ├── configuration
│   └── neo4j
├── lib
└── services
    ├── config
    ├── configuration
    ├── neo4j
    └── snippet                              # NEW: Snippet service directory
        ├── SnippetPersistence.ts            # Main persistence implementation
        ├── SnippetPersistence.test.ts       # Integration tests
        ├── SnippetPersistence.test-layers.ts # Test layers for mocking
        └── index.ts                         # Re-exports
```

### Domain Structure & Naming Conventions

```
src/
├── domain/
│   └── types/              # Domain types and schemas
│       ├── <type>.ts       # Type definitions using Schema.Struct
│       └── tests/
│           └── <type>.test.ts
├── services/
│   └── <service-name>/
│       └── index.ts
└── layers/
    └── <layer-domain>/
        ├── <LayerName>.layer.ts         # Live/production implementation
        ├── <LayerName>.staticLayers.ts  # Test implementation with static data
        ├── <LayerName>.test.ts          # Tests for the layers
        └── index.ts                     # Re-exports
```

**Key Naming Conventions:**

- `*.layer.ts` - Production layers that may have side effects
- `*.test-layers.ts` - Test layers with mocking support
- `*.test.ts` - Test files that test the implementation

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: Effect v3 requires function* syntax for generators
// Example: Effect.gen(function* () { ... })

// CRITICAL: Always use yield* to unwrap Effects
// Example: const result = yield* someEffect

// CRITICAL: Schema.decode returns an Effect, not a plain value
// Example: const validated = yield* Schema.decode(MySchema)(value)

// CRITICAL: We use Schema.Struct for Neo4j (not Model.Class which is for SQL)

// CRITICAL: Never use undefined in Neo4j parameters - use null for absent values
// The queryParams helper will catch this and throw UndefinedQueryParameterError

// CRITICAL: Neo4j datetime() function returns ISO strings, use Schema.DateTimeUtc for parsing

// CRITICAL: UUIDs must be generated with crypto.randomUUID() or equivalent
```

## Implementation Blueprint

### Data models and structure

The core data models are already defined in the domain layer. We need to focus on:

```typescript
Examples:
 - Using existing Snippet and SnippetVersion schemas
 - Leveraging branded types (SnippetId, SnippetVersionId, Slug)
 - Using NotFoundError and PersistenceError for failures
 - Creating helper functions for UUID generation
```

### list of tasks to be completed to fullfill the PRP in the order they should be completed

```yaml
Task 1:
CREATE src/services/snippet/SnippetPersistence.ts:
  - MIRROR pattern from: docs/llms/guides/effect-neo4j/05-actions-layer-services.md (Option A pattern)
  - IMPORT: Neo4jService, Snippet/SnippetVersion schemas, error types, Effect
  - IMPLEMENT: UUID generation helper using crypto.randomUUID()
  - IMPLEMENT: createSnippet function
  - IMPLEMENT: createSnippetVersion function with relationship creation
  - KEEP error handling pattern from existing services

Task 2:
CONTINUE src/services/snippet/SnippetPersistence.ts:
  - IMPLEMENT: findSnippetByName with Option return type
  - IMPLEMENT: findLatestSnippetVersion with proper chronological ordering
  - IMPLEMENT: listSnippets with array return
  - IMPLEMENT: searchSnippets with Neo4j full-text search
  - USE: cypher template function and queryParams helper throughout

Task 3:
CREATE src/services/snippet/SnippetPersistence.test-layers.ts:
  - MIRROR pattern from: src/layers/neo4j/Neo4j.layer.ts:358-413
  - CREATE: SnippetPersistenceTestData type for test data structure
  - CREATE: generateTestSnippet and generateTestSnippetVersion helpers
  - CREATE: Neo4jTestWithSnippetData layer using Map<string, unknown[]>
  - IMPLEMENT: Mock data for all query patterns

Task 4:
CREATE src/services/snippet/SnippetPersistence.test.ts:
  - MIRROR pattern from: src/domain/types/tests/database-integration.test.ts
  - USE: @effect/vitest with it.effect
  - TEST: createSnippet - happy path, duplicate name error
  - TEST: createSnippetVersion - happy path, linking, invalid snippet
  - TEST: findSnippetByName - found, not found
  - TEST: findLatestSnippetVersion - with versions, without versions
  - TEST: listSnippets - empty, with data
  - TEST: searchSnippets - matching, no matches

Task 5:
CREATE src/services/snippet/index.ts:
  - EXPORT all public functions from SnippetPersistence.ts
  - DO NOT export test utilities

Task 6:
RUN validation and compliance:
  - Execute pnpm run preflight
  - Complete Effect compliance checklist
  - Fix any issues found
```

### Per task pseudocode as needed added to each task

```typescript
// Task 1 - Core persistence functions
// UUID generation helper
const generateId = (): string => crypto.randomUUID();

// createSnippet implementation
export const createSnippet = (name: Slug, description: string) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    // Check if name already exists
    const existsQuery = cypher`MATCH (s:Snippet {name: $name}) RETURN s`;
    const existsParams = yield* queryParams({ name });
    const existing = yield* neo4j.runQuery(existsQuery, existsParams);

    if (existing.length > 0) {
      return yield* Effect.fail(
        new PersistenceError({
          originalMessage: `Snippet with name '${name}' already exists`,
          operation: 'create' as const,
        }),
      );
    }

    // Create new snippet
    const id = Schema.decodeSync(SnippetId)(generateId());
    const createQuery = cypher`
      CREATE (s:Snippet {id: $id, name: $name, description: $description})
      RETURN s
    `;
    const createParams = yield* queryParams({ id, name, description });
    const results = yield* neo4j.runQuery<{ s: unknown }>(
      createQuery,
      createParams,
    );

    return yield* Schema.decode(Snippet)(results[0].s);
  });

// createSnippetVersion with transaction for relationship creation
export const createSnippetVersion = (
  snippetId: SnippetId,
  content: string,
  commitMessage: string,
) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    return yield* neo4j.runInTransaction((tx) =>
      Effect.gen(function* () {
        // Find the snippet
        const snippetQuery = cypher`MATCH (s:Snippet {id: $id}) RETURN s`;
        const snippetParams = yield* queryParams({ id: snippetId });
        const snippetResults = yield* tx.run<{ s: unknown }>(
          snippetQuery,
          snippetParams,
        );

        if (snippetResults.length === 0) {
          return yield* Effect.fail(
            new NotFoundError({
              entityType: 'snippet' as const,
              id: snippetId,
            }),
          );
        }

        // Find latest version to link as previous
        const latestQuery = cypher`
          MATCH (s:Snippet {id: $snippetId})<-[:VERSION_OF]-(sv:SnippetVersion)
          RETURN sv
          ORDER BY sv.createdAt DESC
          LIMIT 1
        `;
        const latestParams = yield* queryParams({ snippetId });
        const latestResults = yield* tx.run<{ sv: unknown }>(
          latestQuery,
          latestParams,
        );

        // Create new version with relationships
        const versionId = Schema.decodeSync(SnippetVersionId)(generateId());
        const createQuery = cypher`
          MATCH (s:Snippet {id: $snippetId})
          CREATE (sv:SnippetVersion {
            id: $versionId,
            content: $content,
            createdAt: datetime(),
            commit_message: $commitMessage
          })
          CREATE (sv)-[:VERSION_OF]->(s)
          ${latestResults.length > 0 ? 'WITH sv MATCH (prev:SnippetVersion {id: $prevId}) CREATE (sv)-[:PREVIOUS_VERSION]->(prev)' : ''}
          RETURN sv
        `;

        const params =
          latestResults.length > 0
            ? yield* queryParams({
                snippetId,
                versionId,
                content,
                commitMessage,
                prevId: yield* Schema.decode(SnippetVersionId)(
                  latestResults[0].sv.id,
                ),
              })
            : yield* queryParams({
                snippetId,
                versionId,
                content,
                commitMessage,
              });

        const results = yield* tx.run<{ sv: unknown }>(createQuery, params);

        // Parse the created version
        const created = results[0].sv;
        // Convert Neo4j datetime string to Date
        created.createdAt = new Date(created.createdAt);

        return yield* Schema.decode(SnippetVersion)(created);
      }),
    );
  });

// Task 2 - Query functions
// findSnippetByName with Option return
export const findSnippetByName = (name: Slug) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`MATCH (s:Snippet {name: $name}) RETURN s`;
    const params = yield* queryParams({ name });
    const results = yield* neo4j.runQuery<{ s: unknown }>(query, params);

    if (results.length === 0) return Option.none();

    const snippet = yield* Schema.decode(Snippet)(results[0].s);
    return Option.some(snippet);
  });

// searchSnippets using Neo4j full-text search
export const searchSnippets = (query: string) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    // Use case-insensitive CONTAINS for simple search
    const searchQuery = cypher`
      MATCH (s:Snippet)
      WHERE toLower(s.name) CONTAINS toLower($query) 
         OR toLower(s.description) CONTAINS toLower($query)
      RETURN s
      ORDER BY s.name
    `;
    const params = yield* queryParams({ query });
    const results = yield* neo4j.runQuery<{ s: unknown }>(searchQuery, params);

    return yield* Effect.forEach(results, (r) => Schema.decode(Snippet)(r.s));
  });
```

### Integration Points

```yaml
NEO4J:
  - node labels: Snippet, SnippetVersion
  - relationships: VERSION_OF, PREVIOUS_VERSION
  - properties: All fields from Snippet and SnippetVersion schemas
  - datetime: Use Neo4j datetime() function for createdAt

DEPENDENCIES:
  - Neo4jService: Already exists, use via Context.Tag
  - Schemas: Import from domain/types
  - Errors: Import from domain/types/errors

EXPORTS:
  - All 6 persistence functions as individual exports
  - No service object, following Option A pattern
```

## Validation Loop

### Level 1: Syntax & Type Checking

```bash
# Run these FIRST - fix any errors before proceeding
pnpm run build                    # TypeScript compilation
pnpm run lint                     # ESLint checking

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests each new feature/file/function use existing test patterns

```typescript
// SnippetPersistence.test.ts structure
import { describe, it, expect } from '@effect/vitest';
import { Effect, Option, Schema } from 'effect';
import * as SP from './SnippetPersistence';
import { Slug, SnippetId } from '../../domain/types/branded';
import { NotFoundError, PersistenceError } from '../../domain/types/errors';
import { Neo4jTestWithSnippetData } from './SnippetPersistence.test-layers';

describe('SnippetPersistence', () => {
  describe('createSnippet', () => {
    it.effect('should create a new snippet', () =>
      Effect.gen(function* () {
        const name = Schema.decodeSync(Slug)('test-snippet');
        const snippet = yield* SP.createSnippet(name, 'Test description');

        expect(snippet.name).toBe(name);
        expect(snippet.description).toBe('Test description');
      }).pipe(Effect.provide(Neo4jTestWithSnippetData)),
    );

    it.effect('should fail on duplicate name', () =>
      Effect.gen(function* () {
        const name = Schema.decodeSync(Slug)('existing-snippet');
        const result = yield* Effect.exit(SP.createSnippet(name, 'Duplicate'));

        expect(Exit.isFailure(result)).toBe(true);
        if (Exit.isFailure(result)) {
          expect(result.cause._tag).toBe('Fail');
          expect(result.cause.error).toBeInstanceOf(PersistenceError);
        }
      }).pipe(Effect.provide(Neo4jTestWithSnippetData)),
    );
  });

  // Similar test structure for other functions...
});
```

```bash
# Run and iterate until passing:
pnpm test src/services/snippet/SnippetPersistence.test.ts
# If failing: Read error, understand root cause, fix code, re-run (never mock to pass)
```

### Level 3: Integration Test

```bash
# If you have a test Neo4j instance running:
NEO4J_URI=bolt://localhost:7687 NEO4J_USER=neo4j NEO4J_PASSWORD=password pnpm test:integration

# Expected: All persistence operations work against real Neo4j
# If error: Check Neo4j connection, query syntax, relationship creation
```

## Final validation Checklist

- [ ] All tests pass: `pnpm test`
- [ ] No linting errors: `pnpm run lint`
- [ ] No type errors: `pnpm run build`
- [ ] Preflight passes: `pnpm run preflight`
- [ ] All 6 persistence methods implemented
- [ ] Proper error handling with typed errors
- [ ] UUID generation working correctly
- [ ] Neo4j relationships created properly
- [ ] Effect compliance checklist from `docs/llms/effect/effect-compliance-checklist.md` completed

---

## Anti-Patterns to Avoid

- ❌ Don't create new patterns when existing ones work
- ❌ Don't skip validation because "it should work"
- ❌ Don't ignore failing tests - fix them
- ❌ Don't use Promise/async-await - use Effect
- ❌ Don't hardcode values - use Config service
- ❌ Don't catch all errors - use typed errors
- ❌ Don't use try/catch - use Effect error handling
- ❌ Don't mutate data - keep everything immutable
- ❌ Don't use class-based services - use individual function exports
- ❌ Don't forget to handle undefined in query parameters
- ❌ Don't use Model.Class - use Schema.Struct for Neo4j

## Confidence Score

**9/10** - This PRP provides comprehensive context with:

- Complete code patterns from the existing codebase
- Specific implementation guidance for each function
- Clear test patterns and validation gates
- All necessary type information and error handling
- Detailed Neo4j query examples with relationship management

The only uncertainty is around Neo4j-specific datetime handling which may require minor adjustments during implementation.
