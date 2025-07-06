name: "Improve Test Organization PRP"
description: |

## Purpose
Implement comprehensive test coverage and organize tests into a well-structured directory hierarchy for the Janus project, following Effect-TS best practices and the functional programming paradigm (data, calculations, actions).

## Core Principles
1. **Context is Complete but Focused**: Include all Effect-TS testing patterns and domain model structures
2. **Validation Loops**: Run tests with `pnpm test src` to validate each implementation
3. **Information Dense**: Follow existing patterns from Effect examples
4. **Progressive Success**: Start with basic tests, then expand coverage
5. **Global rules**: Follow all rules in CLAUDE.md and effect-compliance-checklist.md

---

## Goal
Create a comprehensive test suite with proper organization that:
- Tests all domain models, calculations, and actions separately
- Achieves full coverage for expected cases, edge cases, and failure cases
- Organizes tests into logical subdirectories matching the codebase structure
- Tests Neo4j database operations thoroughly
- Follows Effect-TS testing patterns using `@effect/vitest`

## Why
- **Business value**: Ensures code reliability and prevents regressions
- **Integration**: Tests validate that all components work together correctly
- **Problems solved**: Currently only one test file exists; need comprehensive coverage for all models and database operations

## What
Create organized test structure with comprehensive coverage for:
- Domain models (Schema.Struct validation)
- Pure calculations (business logic)
- Effect-based actions (database operations, side effects)
- Neo4j specific operations (CRUD, queries, migrations)

### Success Criteria
- [ ] All models have tests for validation, edge cases, and failures
- [ ] All pure functions have comprehensive test coverage
- [ ] All Effect services have proper test layers
- [ ] Neo4j operations are tested with mock layers
- [ ] Tests are organized in logical directory structure
- [ ] All tests pass with `pnpm test src`

## All Needed Context

### Documentation & References
```yaml
- url: https://www.npmjs.com/package/@effect/vitest
  sections: ["Usage", "Testing Effects", "Test Layers"]
  why: Official Effect testing library documentation
  discovered_caveat: Must use it.effect() for Effect-based tests
  
- url: https://effect.website/llms.txt
  sections: ["Testing", "Layers", "Services"] 
  why: Effect-TS patterns for testing with layers and mocks
  critical: |
    Test layers must be isolated per test
    Use makeTestLayer() pattern for mocks
    
- docfile: docs/llms/effect/effect-compliance-checklist.md
  include_sections: ["Testing Patterns", "Test Structure", "Test Layer Pattern"]
  why: Project-specific testing requirements and patterns
  
- docfile: docs/llms/examples/effect-normand-paradigm-guide.md
  include_sections: ["Testing Data/Calculations/Actions Separately"]
  why: How to structure tests following the paradigm
  
- file: examples/effect-official-examples/examples/http-server/test/Accounts.test.ts
  why: Example of proper Effect test structure with layers
  gotcha: Shows makeTestLayer pattern and it.effect usage
```

### Context Inclusion Guidelines
- Include complete Effect testing patterns
- Include all domain model structures that need testing
- Include Neo4j specific testing considerations
- Skip unrelated documentation sections

### Current Codebase tree
```bash
src/
├── cli/
│   └── index.test.ts     # Only existing test
├── core/
│   ├── tests/           # Empty directory created
│   │   ├── calculations/
│   │   └── schemas/
│   ├── domain.ts        # Domain models (needs tests)
│   └── model.ts         # Business logic (needs tests)  
├── db/
│   ├── tests/           # Empty directory created
│   ├── migrations.ts    # Migration logic (needs tests)
│   ├── neo4j.ts        # Database layer (needs tests)
│   └── repositories.ts  # Repository services (needs tests)
├── cli.ts
├── config.ts
├── index.ts
└── logger.ts
```

### Desired Codebase tree with files to be added
```bash
src/
├── cli/
│   ├── tests/
│   │   ├── cli.test.ts          # CLI command tests
│   │   └── index.test.ts        # Main CLI integration tests
├── core/
│   ├── tests/
│   │   ├── calculations/
│   │   │   ├── slug.test.ts     # Slug utilities tests
│   │   │   ├── validation.test.ts # Validation helpers tests
│   │   │   └── transformation.test.ts # Data transformation tests
│   │   └── schemas/
│   │       ├── branded-types.test.ts # Branded ID type tests
│   │       ├── entities.test.ts      # Entity schema tests
│   │       └── errors.test.ts        # Error class tests
├── db/
│   ├── tests/
│   │   ├── neo4j.test.ts        # Neo4j connection/operations
│   │   ├── migrations.test.ts   # Migration tests
│   │   └── repositories.test.ts # Repository service tests
├── tests/
│   ├── config.test.ts           # Configuration tests
│   └── logger.test.ts           # Logger tests
```

### Known Gotchas of our codebase & Library Quirks
```typescript
// CRITICAL: We use Schema.Struct not Model.Class (Neo4j vs SQL)
// Example: Schema.brand() for branded types
// Example: Effect.gen for service implementations
// Example: it.effect() for testing Effects
// Example: makeTestLayer() for mocking services
```

## Implementation Blueprint

### Data models and structure

Test structure for domain models using @effect/vitest:
```typescript
// Example test structure for schemas
import { it, expect } from "@effect/vitest"
import * as S from "@effect/schema/Schema"
import { Slug, createSlugFromInput } from "../domain"

// Test Schema.Struct validation
it("validates Slug schema", () => {
  const validSlug = "valid-slug"
  const result = S.decodeUnknownSync(Slug)(validSlug)
  expect(result).toBe(validSlug)
})

// Test edge cases
it("rejects invalid slug format", () => {
  expect(() => S.decodeUnknownSync(Slug)("Invalid Slug!"))
    .toThrow()
})

// Test Effect-based functions
it.effect("creates slug from input", () => 
  Effect.gen(function* () {
    const result = yield* createSlugFromInput("Test Input")
    expect(result).toBe("test-input")
  })
)
```

### List of tasks to be completed

```yaml
Task 1: Create test infrastructure and helpers
CREATE src/core/tests/test-utils.ts:
  - Test data factories for consistent test data
  - Mock ID generators with fixed values
  - Common test assertions

CREATE src/db/tests/test-layers.ts:
  - Mock Neo4j layer for testing
  - Test database connection utilities
  - Transaction test helpers

Task 2: Test branded types and basic schemas
CREATE src/core/tests/schemas/branded-types.test.ts:
  - Test all branded ID types (SnippetId, ParameterId, etc.)
  - Test brand validation and creation
  - Test serialization/deserialization

CREATE src/core/tests/schemas/errors.test.ts:
  - Test InvalidSlugError
  - Test EntityNotFoundError  
  - Test error messages and properties

Task 3: Test entity schemas
CREATE src/core/tests/schemas/entities.test.ts:
  - Test Snippet schema validation
  - Test SnippetVersion schema with relationships
  - Test Parameter and ParameterOption schemas
  - Test Composition and CompositionVersion schemas
  - Test TestRun and DataPoint schemas
  - Test Tag schema

Task 4: Test pure calculations
CREATE src/core/tests/calculations/slug.test.ts:
  - Test normalizeSlugInput function
  - Test createSlugFromInput with various inputs
  - Test edge cases (empty, special chars, unicode)

CREATE src/core/tests/calculations/validation.test.ts:
  - Test validateSnippetSequencing
  - Test validateUniqueSnippetVersions
  - Test validateCompositionStructure

CREATE src/core/tests/calculations/transformation.test.ts:
  - Test extractSnippetVersionIds
  - Test groupSnippetsByRole
  - Test sortSnippetsBySequence

Task 5: Test model creation functions
CREATE src/core/tests/model.test.ts:
  - Test createSnippetData
  - Test buildSnippet with all fields
  - Test buildParameter and related functions
  - Test composition building functions

Task 6: Test database layer
CREATE src/db/tests/neo4j.test.ts:
  - Test connection creation
  - Test query execution
  - Test transaction handling
  - Test error scenarios

CREATE src/db/tests/migrations.test.ts:
  - Test migration execution
  - Test rollback capabilities
  - Test migration ordering

Task 7: Test repository services  
CREATE src/db/tests/repositories.test.ts:
  - Test SnippetRepository CRUD operations
  - Test ParameterRepository operations
  - Test CompositionRepository operations
  - Test complex queries (find by criteria)
  - Test relationship management

Task 8: Test configuration and logging
CREATE src/tests/config.test.ts:
  - Test config loading
  - Test environment variable handling
  - Test default values

CREATE src/tests/logger.test.ts:
  - Test logger creation
  - Test log levels
  - Test structured logging

Task 9: Final validation and cleanup
- Run full test suite with coverage
- Ensure all Effect compliance checklist items are met
- Update any discovered test cases
```

### Per task pseudocode

```typescript
// Task 2: Branded types testing pattern
describe("Branded ID Types", () => {
  it("creates valid SnippetId", () => {
    const id = "snippet_123"
    const result = S.decodeUnknownSync(SnippetId)(id)
    expect(result).toBe(id)
  })
  
  it("rejects invalid format", () => {
    expect(() => S.decodeUnknownSync(SnippetId)("invalid"))
      .toThrow(/Invalid SnippetId format/)
  })
})

// Task 6: Database testing with mock layer
const testNeo4jLayer = makeTestLayer(Neo4jService)({
  query: (cypher: string, params: any) => 
    Effect.succeed({ records: mockRecords }),
  transaction: (fn: any) => 
    fn(mockTx)
})

it.effect("executes cypher query", () =>
  Effect.gen(function* () {
    const result = yield* runQuery("MATCH (n) RETURN n")
    expect(result.records).toHaveLength(mockRecords.length)
  }).pipe(
    Effect.provide(testNeo4jLayer)
  )
)
```

### Integration Points
```yaml
TESTING:
  - framework: "@effect/vitest"
  - pattern: "it.effect() for Effect-based tests"
  
MOCKING:
  - pattern: "makeTestLayer() for service mocks"
  - usage: "Provide test layers to isolate tests"
  
COVERAGE:
  - command: "pnpm test src --coverage"
  - minimum: "80% coverage for all files"
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run after creating each test file
pnpm run typecheck           # Ensure types are correct
pnpm run lint               # Fix any linting issues

# Expected: No errors
```

### Level 2: Unit Tests for each file
```bash
# Run tests for specific areas as you implement
pnpm test src/core/tests/schemas   # Test schema tests
pnpm test src/core/tests/calculations  # Test calculation tests
pnpm test src/db/tests            # Test database tests

# If failing: Read error output, fix implementation
```

### Level 3: Full Test Suite
```bash
# Run complete test suite
pnpm test src

# Run with coverage
pnpm test src --coverage

# Expected: All tests pass, good coverage
```

## Final Validation Checklist
- [ ] All tests pass: `pnpm test src`
- [ ] No type errors: `pnpm run typecheck`
- [ ] No lint errors: `pnpm run lint`
- [ ] Each model has 3+ test cases (expected, edge, failure)
- [ ] All Effect services use proper test layers
- [ ] Tests follow functional paradigm separation
- [ ] Coverage meets minimum requirements
- [ ] All Effect compliance checklist items met

---

## Anti-Patterns to Avoid
- ❌ Don't test implementation details, test behavior
- ❌ Don't use real database connections in tests
- ❌ Don't skip error case testing
- ❌ Don't create tests without proper test data isolation
- ❌ Don't mix data/calculation/action tests
- ❌ Don't use async/await, use Effect patterns