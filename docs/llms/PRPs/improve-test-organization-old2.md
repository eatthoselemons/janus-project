name: "Test Organization and Expansion PRP"
description: |

This PRP was not finished, you need to finish it, also note that `Schema.Struct`

## Purpose
Implement comprehensive test coverage and reorganization for the Janus project, ensuring all entities have proper test cases (expected, edge, failure) and that large files are broken into smaller, manageable modules following the 300-line limit.

## Core Principles
1. **Context is Complete but Focused**: Include ALL necessary documentation sections, specific examples, and discovered caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
1. Break up model.ts (312 lines) into smaller, focused modules under 300 lines each
2. Expand all tests to include expected case, failure case, and edge case
3. Create comprehensive test directory structure with sub-files for each model type
4. Implement thorough Neo4j database operation tests including CRUD and relationships
5. Ensure all Schema.Structs have proper validation tests

## Why
- **Maintainability**: Smaller files are easier to navigate and maintain
- **Test Coverage**: Comprehensive tests prevent regressions and document behavior
- **Code Quality**: Following the 300-line limit improves code organization
- **Reliability**: Database operation tests ensure data integrity
- **Type Safety**: Schema validation tests catch runtime errors at development time

## What
Create a well-organized test suite that validates all domain logic, database operations, and schema definitions while reorganizing oversized files into focused modules.

### Success Criteria
- [ ] model.ts is split into files under 300 lines each
- [ ] All functions have at least 3 test cases (expected, edge, failure)
- [ ] All Neo4j entities have comprehensive CRUD tests
- [ ] All Schema.Structs have validation tests
- [ ] Test directory structure mirrors source structure
- [ ] All tests pass: `pnpm run test`
- [ ] No linting errors: `pnpm run lint`
- [ ] No type errors: `pnpm run typecheck`

## All Needed Context

### Documentation & References (include complete sections that are directly relevant)
```yaml
# MUST READ - Include these specific sections in your context window
# ✅ Include: Complete relevant sections, not just snippets
# ❌ Avoid: Entire folders or unrelated documentation

- url: https://effect.website/llms-small.txt
  sections: ["Testing", "Schema", "Services", "Layers"]
  why: Core Effect patterns for testing with vitest integration
  discovered_caveat: Use Effect.runSync for synchronous schema tests, Effect.gen for async

- url: https://vitest.dev/guide/
  sections: ["Writing Tests", "Mocking", "Test Context"]
  why: Vitest patterns for describe, it, expect, and mocking
  gotcha: Use @effect/vitest for Effect-based tests, regular vitest for pure functions

- docfile: docs/llms/effect/effect-compliance-checklist.md
  include_sections: ["Testing Patterns", "Test Structure", "Test Layer Pattern"]
  skip_sections: ["External Interface Implementation", "Authorization"]
  critical: |
    - Use it.effect() for Effect-based tests
    - Create mock layers with makeTestLayer()
    - Each function needs 3 tests: expected, edge, failure
    
- url: https://www.npmjs.com/package/@effect/vitest
  why: Has a simple how to for using effect and vitest
```

### Context Inclusion Guidelines
- Include COMPLETE sections when they contain implementation details
- Include MULTIPLE examples if they show different use cases
- Include ALL caveats and warnings discovered during research
- Skip sections about: history, philosophy, future plans, unrelated features
- When in doubt, include it - but be specific about WHY it's needed

### Current Codebase tree (run `tree` in the root of the project) to get an overview of the codebase
```bash
src/
├── core/
│   ├── domain.ts          # Schema definitions, branded types
│   ├── model.ts           # 312 lines - needs breaking up
│   └── tests/
│       ├── calculations/  # Pure function tests
│       └── schemas/       # Schema validation tests
└── db/
    ├── repositories.ts    # Repository implementations
    ├── neo4j-service.ts   # Neo4j connection service
    └── tests/
        └── *.test.ts      # Repository tests
```

### Desired Codebase tree with files to be added and responsibility of file
```bash
src/
├── core/
│   ├── domain.ts                    # Keep as-is
│   ├── model.ts                     # Re-export for backward compatibility
│   ├── calculations/                # NEW: Split from model.ts
│   │   ├── slug.ts                  # Slug normalization utilities
│   │   ├── builders.ts              # Entity construction helpers
│   │   ├── validators.ts            # Validation functions
│   │   └── transformers.ts          # Data transformation helpers
│   └── tests/
│       ├── calculations/
│       │   ├── slug.test.ts         # EXPAND: Add edge/failure cases
│       │   ├── builders.test.ts     # EXPAND: Test all builders
│       │   ├── validators.test.ts   # NEW: Test validation logic
│       │   └── transformers.test.ts # NEW: Test transformations
│       └── schemas/
│           ├── entities.test.ts     # EXPAND: Test all entity schemas
│           ├── create-data.test.ts  # NEW: Test creation schemas
│           └── relationships.test.ts # NEW: Test relationship schemas
└── db/
    ├── repositories/                # NEW: Split repositories by entity
    │   ├── snippet.repository.ts
    │   ├── parameter.repository.ts
    │   ├── composition.repository.ts
    │   └── ... (other repositories)
    └── tests/
        ├── repositories/            # NEW: Comprehensive repo tests
        │   ├── snippet.repository.test.ts
        │   ├── parameter.repository.test.ts
        │   └── ... (test each repository)
        └── neo4j-operations/        # NEW: Test Neo4j operations
            ├── crud.test.ts         # Test CRUD operations
            ├── relationships.test.ts # Test relationship operations
            └── queries.test.ts      # Test complex queries
```

### Known Gotchas of our codebase & Library Quirks
```typescript
# CRITICAL: Effect-TS testing patterns
# For Schema tests: Use Effect.runSync(Schema.decodeUnknown(...))
# For failure tests: Use Effect.either to catch errors
# For Effect services: Use it.effect() from @effect/vitest

# CRITICAL: Neo4j patterns
# Always use parameterized queries, never string concatenation
# Use randomUUID() for ID generation in CREATE statements
# DETACH DELETE required when deleting nodes with relationships

# CRITICAL: File size limit
# All files must be under 300 lines
# Use index.ts for re-exports to maintain backward compatibility
```

## Implementation Blueprint

### Data models and structure

The domain models are already defined in domain.ts using Schema.Struct. Key entities:
```typescript
- Snippet: Text templates with unique slug names
- SnippetVersion: Versions of snippets with content
- Parameter: Named parameters for snippets
- ParameterOption: Different values for parameters
- Composition: Collections of snippets
- CompositionVersion: Versions with snippet arrangements
- TestRun: Test executions with LLM details
- DataPoint: Individual test results
- Tag: Labels for categorization
```

### list of tasks to be completed to fullfill the PRP in the order they should be completed

```yaml
Task 1: Break up model.ts into smaller modules
ANALYZE src/core/model.ts:
  - Group functions by responsibility
  - Plan module boundaries
  
CREATE src/core/calculations/slug.ts:
  - MOVE normalizeSlugInput and createSlugFromInput functions
  - EXPORT all moved functions
  
CREATE src/core/calculations/builders.ts:
  - MOVE all build* functions (buildSnippet, buildParameter, etc.)
  - IMPORT necessary types from domain
  
CREATE src/core/calculations/validators.ts:
  - MOVE validation helper functions
  - ENSURE proper imports
  
CREATE src/core/calculations/transformers.ts:
  - MOVE transformation functions (extractIds, groupByRole, etc.)
  
MODIFY src/core/model.ts:
  - CONVERT to re-export file for backward compatibility
  - EXPORT * from each new module

Task 2: Expand existing calculation tests
MODIFY src/core/tests/calculations/slug-operations.test.ts:
  - ADD edge cases: empty string, special characters, very long input
  - ADD failure cases: null/undefined handling
  - ENSURE 3 test cases per function
  
CREATE src/core/tests/calculations/builders.test.ts:
  - TEST each build function with valid data
  - TEST edge cases: minimal data, optional fields
  - TEST failure cases: invalid inputs
  
CREATE src/core/tests/calculations/validators.test.ts:
  - TEST validation logic for all entities
  - TEST edge cases: boundary conditions
  - TEST failure cases: invalid data

Task 3: Create comprehensive schema tests
EXPAND src/core/tests/schemas/entities.test.ts:
  - ADD tests for ALL entity schemas (not just Snippet)
  - TEST SnippetVersion, Parameter, ParameterOption, etc.
  - INCLUDE edge cases: empty strings, max lengths
  
CREATE src/core/tests/schemas/create-data.test.ts:
  - TEST all Create*Data schemas
  - VALIDATE required vs optional fields
  - TEST validation errors

Task 4: Reorganize repository structure
CREATE src/db/repositories/ directory structure:
  - SPLIT repositories.ts by entity type
  - CREATE individual repository files
  - MAINTAIN consistent patterns
  
CREATE comprehensive repository tests:
  - TEST all CRUD operations per entity
  - MOCK Neo4jService responses
  - TEST error scenarios

Task 5: Implement Neo4j operation tests
CREATE src/db/tests/neo4j-operations/crud.test.ts:
  - TEST CREATE operations with proper ID generation
  - TEST MATCH queries with various conditions
  - TEST UPDATE with property merging
  - TEST DELETE with relationship handling
  
CREATE src/db/tests/neo4j-operations/relationships.test.ts:
  - TEST relationship creation patterns
  - TEST traversal queries
  - TEST cascade delete scenarios
  
CREATE src/db/tests/neo4j-operations/queries.test.ts:
  - TEST complex queries (version history, etc.)
  - TEST parameter substitution
  - TEST query performance patterns

Task 6: Run validation and fix issues
RUN pnpm run preflight:
  - FIX any build errors
  - FIX any test failures
  - FIX any lint issues
  - FIX any type errors
  
VERIFY effect-compliance-checklist.md:
  - CHECK all testing requirements met
  - ENSURE 3 tests per function
  - VALIDATE Effect patterns used correctly
```

### Per task pseudocode as needed added to each task

```typescript

# Task 1: Breaking up model.ts
# src/core/calculations/slug.ts
export const normalizeSlugInput = (input: string): string => {
  // PATTERN: Pure function, no side effects
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-]/g, '-')
    // ... rest of implementation
}

# src/core/model.ts (new version)
// Re-export everything for backward compatibility
export * from "./calculations/slug"
export * from "./calculations/builders"
export * from "./calculations/validators"
export * from "./calculations/transformers"

# Task 2: Test pattern for calculations
describe("slug operations", () => {
  describe("normalizeSlugInput", () => {
    it("should normalize valid input", () => {
      // Expected case
      expect(normalizeSlugInput("Hello World")).toBe("hello-world")
    })
    
    it("should handle special characters", () => {
      // Edge case
      expect(normalizeSlugInput("Test@#$%123")).toBe("test-123")
    })
    
    it("should handle empty input", () => {
      // Failure case
      expect(normalizeSlugInput("")).toBe("")
    })
  })
})

# Task 3: Schema test pattern
describe("Snippet Schema", () => {
  it("should decode valid snippet data", () => {
    const validData = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "test-snippet",
      description: "A test snippet",
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = Effect.runSync(
      Schema.decodeUnknown(Snippet)(validData)
    )
    expect(result.name).toBe("test-snippet")
  })
  
  it("should reject invalid slug name", () => {
    const invalidData = { ...validData, name: "Invalid Name!" }
    
    const result = Effect.runSync(
      Effect.either(Schema.decodeUnknown(Snippet)(invalidData))
    )
    expect(result._tag).toBe("Left")
  })
})

# Task 4: Repository test pattern
const mockNeo4jLayer = Layer.succeed(Neo4jService, {
  executeQuery: <T>(query: string, params?: any) => {
    if (query.includes("CREATE")) {
      return Effect.succeed([{ /* mock created entity */ }])
    }
    if (query.includes("MATCH")) {
      return Effect.succeed([{ /* mock found entity */ }])
    }
    return Effect.succeed([])
  }
} as Neo4jService)

# Task 5: Neo4j operation test pattern
describe("Neo4j CRUD Operations", () => {
  it.effect("should create entity with proper ID", () =>
    Effect.gen(function* () {
      const service = yield* Neo4jService
      const query = `CREATE (s:Snippet {id: randomUUID(), name: $name})`
      
      const result = yield* service.executeQuery(query, { name: "test" })
      expect(result[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
    }).pipe(Effect.provide(mockNeo4jLayer))
  )
})
```

### Integration Points
```yaml
DATABASE:
  - relationships: Define all entity relationships in Neo4j
  - indexes: CREATE INDEX for frequently queried fields (name, slug)
  
CONFIG:
  - No config changes needed
  
IMPORTS:
  - update: All files importing from model.ts remain compatible
  - pattern: Import from specific modules for better tree-shaking
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
pnpm run lint                # ESLint check
pnpm run typecheck           # TypeScript validation

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests each new feature/file/function use existing test patterns
```bash
# Run all tests with coverage
pnpm run test

# Run specific test suites during development
pnpm run test src/core/tests/calculations/
pnpm run test src/core/tests/schemas/
pnpm run test src/db/tests/

# Expected: All tests pass with 100% coverage for new code
```

### Level 3: Integration Test
```bash
# Run the full preflight check
pnpm run preflight

# This runs:
# - build
# - test
# - typecheck  
# - lint

# Expected: All checks pass
```

## Final validation Checklist
- [ ] All tests pass: `pnpm run test`
- [ ] No linting errors: `pnpm run lint`
- [ ] No type errors: `pnpm run typecheck`
- [ ] All functions have 3+ tests (expected, edge, failure)
- [ ] All Schema.Structs have validation tests
- [ ] All Neo4j operations have tests
- [ ] model.ts is under 300 lines (split into modules)
- [ ] Test structure mirrors source structure
- [ ] Effect compliance checklist items completed

---

## Anti-Patterns to Avoid
- ❌ Don't create files over 300 lines
- ❌ Don't skip edge case or failure tests
- ❌ Don't use string concatenation for Cypher queries
- ❌ Don't mock at the driver level, mock at service level
- ❌ Don't use async/await, use Effect patterns
- ❌ Don't forget to test Schema validation errors

## Confidence Score: 9/10

The PRP provides comprehensive context with actual code patterns from the codebase, clear task ordering, and executable validation steps. The only uncertainty is discovering additional edge cases during implementation.