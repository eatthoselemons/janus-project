name: "Improve Test Organization and Coverage"
description: |

## Purpose
Comprehensive test reorganization and expansion to achieve proper test coverage with clear structure, following Effect patterns and functional programming principles.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
1. Expand existing tests to include expected cases, failure cases, and edge cases
2. Re-organize test files into clear directory structure with sub-files for each model type
3. Add comprehensive Neo4j database operation tests (create/update/delete/query)
4. Add tests for Schema.Structs validation to ensure proper implementation

## Why
- Ensure code reliability and catch regressions early
- Make tests easier to find and maintain through better organization
- Verify database operations work correctly with Neo4j
- Validate that Schema definitions properly validate data

## What
Create a comprehensive test suite that:
- Tests all pure functions (calculations) in isolation
- Tests all database operations (actions) with proper mocking
- Validates all Schema definitions work correctly
- Follows Effect patterns for testing

### Success Criteria
- [ ] All existing tests expanded with expected, failure, and edge cases
- [ ] Test files organized into logical directories
- [ ] Neo4j operations have comprehensive test coverage
- [ ] Schema.Structs are validated with proper test cases
- [ ] All tests pass with `pnpm run test`
- [ ] Test coverage significantly improved
- [ ] Follow all items in effect-compliance-checklist.md

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: src/core/model.test.ts
  why: Current test patterns to expand from
  
- file: src/core/model.ts
  why: Pure calculation functions that need testing
  
- file: src/core/domain.ts
  why: Schema definitions and types that need validation tests

- file: src/db/neo4j.ts
  why: Neo4j service implementation - focus on the service interface

- file: src/db/repositories.ts
  why: Repository patterns - focus on SnippetRepository as example

- doc: docs/llms/effect/effect-compliance-checklist.md
  section: Testing Patterns (lines 122-141)
  critical: Use it.effect() for Effect tests, makeTestLayer pattern

- url: https://effect.website/llms-small.txt
  section: Search for "Testing" and "it.effect"
  why: Condensed Effect testing patterns

- url: https://www.npmjs.com/package/@effect/vitest
| why: Has a simple how to for using effect and vitest
```

### Current Codebase Structure
```bash
src/
├── cli/
│   └── index.test.ts
├── core/
│   ├── domain.ts      # Schema definitions (Data layer)
│   ├── model.test.ts  # Current tests
│   └── model.ts       # Pure functions (Calculations layer)
└── db/
    ├── migrations.ts
    ├── neo4j.ts       # Neo4j service (Actions layer)
    └── repositories.ts # Repository services (Actions layer)
```

### Desired Test Structure
```bash
src/
├── core/
│   ├── tests/
│   │   ├── schemas/        # Tests for Schema validation (domain.ts)
│   │   │   ├── branded-types.test.ts  # Slug, IDs validation
│   │   │   ├── entities.test.ts       # Snippet, Parameter, etc schemas
│   │   │   └── errors.test.ts         # Tagged error schemas
│   │   └── calculations/   # Tests for pure functions (model.ts)
│   │       ├── slug-operations.test.ts     # normalizeSlugInput, createSlugFromInput
│   │       ├── entity-builders.test.ts     # buildSnippet, buildParameter, etc.
│   │       ├── composition-utils.test.ts   # validateSnippetSequencing, groupSnippetsByRole
│   │       └── data-creators.test.ts       # createSnippetData, etc.
│   ├── domain.ts
│   └── model.ts
└── db/
    ├── tests/
    │   ├── neo4j-service.test.ts          # Neo4j service unit tests
    │   ├── snippet-repository.test.ts     # Repository tests
    │   └── composition-repository.test.ts # Repository tests
    ├── neo4j.ts
    └── repositories.ts
```

### Known Gotchas & Library Quirks
```typescript
// CRITICAL: Effect tests use it.effect() from @effect/vitest
import { it } from "@effect/vitest"

// CRITICAL: Schema validation returns Effect, use Effect.runSync
const result = Effect.runSync(Schema.decodeUnknown(Snippet)(data))

// CRITICAL: To test Schema failures, use Effect.either
const result = Effect.runSync(Effect.either(Schema.decodeUnknown(Snippet)(data)))
if (result._tag === "Left") { /* error case */ }

// CRITICAL: Mock services with Layer.succeed, not manual objects
const mockNeo4j = Layer.succeed(Neo4jService, { /* methods */ })

// CRITICAL: Repository tests need Neo4j layer provided
Effect.provide(Layer.provide(SnippetRepository.Default, mockNeo4j))
```

## Implementation Blueprint

### Schema Test Pattern (for domain.ts entities)
```typescript
// src/core/__tests__/schemas/entities.test.ts
import { describe, it, expect } from "vitest"
import { Effect, Schema } from "effect"
import { Snippet, SnippetId, Slug } from "../../domain"

describe("Snippet Schema", () => {
  // Expected case
  it("should decode valid snippet data", () => {
    const validData = {
      id: "550e8400-e29b-41d4-a716-446655440000", // Valid UUID
      name: "valid-slug-name",
      description: "Test description",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01")
    }
    
    const result = Effect.runSync(Schema.decodeUnknown(Snippet)(validData))
    expect(result.name).toBe("valid-slug-name")
    expect(result.id).toBeDefined()
  })

  // Failure case - invalid slug
  it("should fail with invalid slug format in name", () => {
    const invalidData = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Invalid Slug!",  // Contains invalid characters
      description: "Test",
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = Effect.runSync(Effect.either(Schema.decodeUnknown(Snippet)(invalidData)))
    expect(result._tag).toBe("Left")
  })

  // Edge case - empty description
  it("should accept empty description", () => {
    const edgeData = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "valid-slug",
      description: "",  // Empty but valid
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = Effect.runSync(Schema.decodeUnknown(Snippet)(edgeData))
    expect(result.description).toBe("")
  })
})
```

### Calculation Test Pattern (for model.ts functions)
```typescript
// src/core/__tests__/calculations/slug-operations.test.ts
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { normalizeSlugInput, createSlugFromInput } from "../../model"
import { InvalidSlugError } from "../../domain"

describe("normalizeSlugInput", () => {
  // Expected case
  it("should convert spaces to hyphens", () => {
    expect(normalizeSlugInput("Hello World")).toBe("hello-world")
  })

  // Edge case
  it("should handle consecutive spaces", () => {
    expect(normalizeSlugInput("hello   world")).toBe("hello-world")
  })

  // Edge case
  it("should trim hyphens from start and end", () => {
    expect(normalizeSlugInput("-hello-world-")).toBe("hello-world")
  })
})

describe("createSlugFromInput", () => {
  // Expected case
  it("should create slug from valid input", () => {
    const result = Effect.runSync(createSlugFromInput("Test Slug"))
    expect(result).toBe("test-slug")
  })

  // Failure case
  it("should fail on empty input after normalization", () => {
    const result = Effect.runSync(Effect.either(createSlugFromInput("!!!")))
    expect(result._tag).toBe("Left")
    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(InvalidSlugError)
    }
  })
})
```

### Repository Test Pattern
```typescript
// src/db/__tests__/snippet-repository.test.ts
import { describe, it, expect } from "vitest"
import { it as effectIt } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import { SnippetRepository, Neo4jService } from "../repositories"
import { Slug } from "../../core/domain"

describe("SnippetRepository", () => {
  // Mock Neo4j at service level
  const mockNeo4jLayer = Layer.succeed(Neo4jService, {
    runQuery: (query: string, params?: any) => {
      if (query.includes("CREATE")) {
        return Effect.succeed([{
          id: "test-id",
          name: params.name,
          description: params.description,
          createdAt: new Date(),
          updatedAt: new Date()
        }])
      }
      if (query.includes("MATCH") && params?.id === "exists") {
        return Effect.succeed([{
          id: "exists",
          name: "existing-snippet",
          description: "Existing",
          createdAt: new Date(),
          updatedAt: new Date()
        }])
      }
      return Effect.succeed([])
    },
    createSession: () => Effect.dieMessage("Not needed in test"),
    runTransaction: () => Effect.dieMessage("Not needed in test"),
    close: () => Effect.void
  })

  const testLayer = Layer.provide(SnippetRepository.Default, mockNeo4jLayer)

  effectIt("should create a snippet", () =>
    Effect.gen(function* () {
      const repo = yield* SnippetRepository
      const snippet = yield* repo.create({
        name: "test-snippet" as Slug,
        description: "Test description"
      })
      
      expect(snippet.name).toBe("test-snippet")
      expect(snippet.description).toBe("Test description")
    }).pipe(Effect.provide(testLayer))
  )

  effectIt("should find snippet by id", () =>
    Effect.gen(function* () {
      const repo = yield* SnippetRepository
      const result = yield* repo.findById("exists" as any)
      
      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(result.value.name).toBe("existing-snippet")
      }
    }).pipe(Effect.provide(testLayer))
  )

  effectIt("should return None for non-existent snippet", () =>
    Effect.gen(function* () {
      const repo = yield* SnippetRepository
      const result = yield* repo.findById("not-exists" as any)
      
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )
})
```

### List of Tasks

```yaml
Task 1: Set up test directory structure
CREATE src/core/__tests__/schemas/:
  - For testing Schema validation from domain.ts
  - PATTERN: One file per logical group of schemas

CREATE src/core/__tests__/calculations/:
  - For testing pure functions from model.ts
  - PATTERN: Group by functionality, not by entity

CREATE src/db/__tests__/:
  - For testing database services and repositories
  - PATTERN: One file per service/repository

Task 2: Move and expand existing slug tests
MOVE src/core/model.test.ts TO src/core/__tests__/calculations/slug-operations.test.ts:
  - PRESERVE existing createSlug tests
  - ADD tests for normalizeSlugInput
  - ADD edge cases: empty string, unicode, very long strings
  - TEST both the pure function and Effect-wrapped versions

Task 3: Create Schema validation tests
CREATE src/core/__tests__/schemas/branded-types.test.ts:
  - Test Slug schema validation
  - Test all ID types (SnippetId, ParameterId, etc.)
  - Test brand validation works correctly

CREATE src/core/__tests__/schemas/entities.test.ts:
  - Test Snippet, Parameter, Composition schemas
  - Test CompositionSnippet with role and sequence validation
  - Test TestRun with metadata, DataPoint with metrics

CREATE src/core/__tests__/schemas/errors.test.ts:
  - Test InvalidSlugError schema
  - Test EntityNotFoundError with proper fields
  - Test all other tagged errors

Task 4: Create calculation function tests
CREATE src/core/__tests__/calculations/entity-builders.test.ts:
  - Test buildSnippet, buildParameter, etc.
  - Verify UUID generation (mock crypto.randomUUID)
  - Test timestamp generation

CREATE src/core/__tests__/calculations/composition-utils.test.ts:
  - Test validateSnippetSequencing with various sequences
  - Test groupSnippetsByRole with multiple snippets
  - Test sortSnippetsBySequence ordering

CREATE src/core/__tests__/calculations/data-creators.test.ts:
  - Test createSnippetData, createParameterData, etc.
  - These are simple but should verify structure

Task 5: Create Neo4j service tests
CREATE src/db/__tests__/neo4j-service.test.ts:
  - Mock neo4j-driver at driver level
  - Test connection verification
  - Test query execution error handling
  - Test session lifecycle

Task 6: Create repository tests
CREATE src/db/__tests__/snippet-repository.test.ts:
  - Mock at Neo4jService level (not driver)
  - Test all CRUD operations
  - Test NotFound errors
  - Test query construction

CREATE src/db/__tests__/composition-repository.test.ts:
  - Similar pattern to snippet repository
  - Focus on the specific queries used

Task 7: Update test configuration
VERIFY vitest.config.ts includes:
  - __tests__ directories
  - Proper test globals

Task 8: Run compliance checklist
VERIFY against docs/llms/effect/effect-compliance-checklist.md:
  - Section "Testing Patterns" (lines 122-141)
  - Each function has 3 test cases minimum
  - Uses it.effect() where appropriate
```

### Integration Points
```yaml
CONFIG:
  - vitest.config.ts: Ensure includes __tests__ pattern
  
SCRIPTS:
  - package.json: Verify test script exists
  - Add test:watch for development
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Fix any TypeScript/ESLint errors first
pnpm run typecheck
pnpm run lint

# Expected: No errors
```

### Level 2: Run Tests Incrementally
```bash
# Test each module as you create it
pnpm run test src/core/__tests__/schemas/
pnpm run test src/core/__tests__/calculations/
pnpm run test src/db/__tests__/

# Full test suite
pnpm run test
```

### Level 3: Coverage Check
```bash
# Check coverage improved
pnpm run test -- --coverage

# Focus on:
# - domain.ts (Schema coverage)
# - model.ts (Calculation coverage)
# - repositories.ts (Action coverage)
```

## Final Validation Checklist
- [ ] All tests pass: `pnpm run test`
- [ ] No linting errors: `pnpm run lint`
- [ ] No type errors: `pnpm run typecheck`
- [ ] Test structure follows schemas/calculations split
- [ ] Each function has 3+ test cases
- [ ] Schema validation thoroughly tested
- [ ] Repository operations tested with proper mocking
- [ ] Effect compliance checklist items followed

---

## Anti-Patterns to Avoid
- ❌ Don't mix Schema tests with calculation tests
- ❌ Don't mock at neo4j-driver level for repository tests
- ❌ Don't forget Effect.either() for error testing
- ❌ Don't test private implementation details
- ❌ Don't create overly complex test setups
- ❌ Don't skip the Effect compliance checklist

## Confidence Score
**9/10** - Clear separation of concerns, specific documentation references, and practical test patterns. The directory structure now clearly separates Schema validation tests from pure function tests.
