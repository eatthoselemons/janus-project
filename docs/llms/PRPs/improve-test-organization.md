name: "Improve Test Organization and Coverage"
description: |

## Purpose

Comprehensive PRP for expanding test coverage and reorganizing test files following Effect-TS patterns and Neo4j testing best practices.

## Core Principles

1. **Effect-First Testing**: All tests use `@effect/vitest` and Effect patterns
2. **Deterministic Testing**: Fixed test data, no random values
3. **Layer-Based Mocking**: Use Effect layers for dependency injection
4. **Comprehensive Coverage**: Expected, edge, and failure cases for every function
5. **Clear Organization**: Small, focused test files co-located with source

---

## Goal

Expand test coverage to include expected, failure, and edge cases for all functions, and reorganize test files into smaller, focused modules following Effect-TS patterns.

## Why

- **Quality Assurance**: Ensure all code paths are tested
- **Maintainability**: Smaller test files are easier to understand and modify
- **Reliability**: Comprehensive Neo4j operation testing prevents database issues
- **Documentation**: Tests serve as living documentation of expected behavior

## What

Create comprehensive test coverage for:

- Domain schemas (validation, branded types)
- Model calculations (pure functions)
- Neo4j repositories (CRUD operations)
- Database migrations

### Success Criteria

- [ ] All functions have 3+ tests (expected, edge, failure)
- [ ] Test files are under 300 lines each
- [ ] Neo4j operations tested with mocks
- [ ] All tests pass `pnpm test src`
- [ ] No lint/type errors

## All Needed Context

### Documentation & References

```yaml
- url: https://www.npmjs.com/package/@effect/vitest
  sections: ['Getting Started', 'Writing Effect Tests', 'Test Management']
  why: Official Effect testing integration patterns
  discovered_caveat: Must use it.effect() not regular it() for Effect code

- url: https://effect.website/llms.txt
  sections: ['Testing', 'Layers', 'Services']
  why: Effect patterns for dependency injection and testing
  critical: TestContext is automatically injected with it.effect()

- file: /home/user/git/janus-project/docs/llms/effect/effect-compliance-checklist.md
  why: Testing requirements and patterns to follow
  gotcha: Each test must have fresh layer instances, no sharing

- file: /home/user/git/janus-project/docs/llms/examples/effect-normand-paradigm-guide.md
  why: Data/Calculations/Actions separation pattern
  critical: Pure functions go in calculations layer, Effect code in actions

- docfile: /home/user/git/janus-project/examples/vitest/docs
  include_sections: ['Configuration', 'Mocking', 'Assertions']
  skip_sections: ['Migration', 'Browser Mode']

- docfile: /home/user/git/janus-project/examples/neo4j-documentation
  include_sections: ['Driver API', 'Sessions', 'Transactions']
  why: Understanding Neo4j operations for accurate mocking
```

### Current Codebase tree

```bash
src/
├── cli/
│   └── index.test.ts (placeholder)
├── core/
│   ├── domain.ts (schemas, branded types)
│   └── model.ts (pure calculations)
├── db/
│   ├── config.ts
│   ├── migrations.ts
│   ├── neo4j.ts (driver, sessions)
│   └── repositories.ts (CRUD operations)
└── services/
    └── snippet.ts

tests/
└── index.test.ts (placeholder)
```

### Desired Codebase tree with files to be added

```bash
src/
├── cli/
│   └── index.test.ts (expanded CLI tests)
├── core/
│   ├── domain.ts
│   ├── domain.test.ts (NEW: schema validation tests)
│   ├── model.ts
│   └── model.test.ts (NEW: calculation tests)
├── db/
│   ├── config.ts
│   ├── config.test.ts (NEW: config validation)
│   ├── migrations.ts
│   ├── migrations.test.ts (NEW: migration tests)
│   ├── neo4j.ts
│   ├── neo4j.test.ts (NEW: connection/session tests)
│   ├── repositories.ts
│   ├── repositories/
│   │   ├── snippet.test.ts (NEW: snippet CRUD tests)
│   │   └── composition.test.ts (NEW: composition CRUD tests)
└── test-utils/ (NEW)
    ├── index.ts (exports all utilities)
    ├── layers.ts (test layer factories)
    ├── data.ts (test data factories)
    └── neo4j-mocks.ts (Neo4j mock helpers)

tests/
└── index.test.ts (remove - use co-located tests)
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Effect testing requires @effect/vitest, not regular vitest
// Example: import { it } from "@effect/vitest" // NOT from "vitest"

// CRITICAL: Neo4j Integer type needs special handling in tests
// Example: neo4j.int(1) returns object, not number

// CRITICAL: Schema.decodeUnknown returns Effect, must be run
// Example: Effect.runSync(Schema.decodeUnknown(MySchema)(data))

// CRITICAL: Test layers must be created fresh for each test
// Example: DON'T share layers between tests, create new ones
```

## Implementation Blueprint

### Test Utilities Structure

Create reusable test utilities for consistent testing patterns:

```typescript
// src/test-utils/layers.ts
import { Layer, Context } from 'effect';

// Generic test layer factory
export const makeTestLayer =
  <I, S extends object>(tag: Context.Tag<I, S>) =>
  (implementation: Partial<S>): Layer.Layer<I> => {
    const proxy = new Proxy({} as S, {
      get(_, prop) {
        if (prop in implementation) {
          return implementation[prop as keyof S];
        }
        throw new Error(`Method ${String(prop)} not implemented in test`);
      },
    });
    return Layer.succeed(tag, proxy);
  };

// src/test-utils/data.ts
import { faker } from '@faker-js/faker';

// Use fixed seed for deterministic tests
faker.seed(12345);

export const testIds = {
  snippet: 'test-snippet-123',
  parameter: 'test-param-456',
  composition: 'test-comp-789',
};

// src/test-utils/neo4j-mocks.ts
import { Effect } from 'effect';
import * as Neo4j from '../db/neo4j';

export const mockNeo4jRecord = (data: Record<string, any>) => ({
  get: (key: string) => data[key],
  has: (key: string) => key in data,
  keys: Object.keys(data),
  forEach: (fn: Function) => Object.entries(data).forEach(([k, v]) => fn(v, k)),
  toObject: () => data,
});
```

### List of tasks to be completed

```yaml
Task 1: Create test utilities infrastructure
CREATE src/test-utils/index.ts:
  - Export all utilities from one place
  - Follow pattern from src/core/index.ts

CREATE src/test-utils/layers.ts:
  - Generic makeTestLayer function
  - Specific test layers for each service

CREATE src/test-utils/data.ts:
  - Fixed test IDs and slugs
  - Test data factories with deterministic values

CREATE src/test-utils/neo4j-mocks.ts:
  - Mock Neo4j record/result structures
  - Transaction mock helpers

Task 2: Test domain schemas and branded types
CREATE src/core/domain.test.ts:
  - Test each branded type (SnippetId, ParameterId, etc.)
  - Test slug validation patterns
  - Test entity schema validation
  - Test error creation

Task 3: Test model calculations
CREATE src/core/model.test.ts:
  - Test normalizeSlugInput (various inputs)
  - Test createSlugFromInput (Effect-based)
  - Test all validation functions
  - Test entity builders
  - Test grouping and sorting functions

Task 4: Test Neo4j service
CREATE src/db/neo4j.test.ts:
  - Test connection creation and cleanup
  - Test session lifecycle
  - Test query execution
  - Test transaction management
  - Test error handling

Task 5: Test repositories
CREATE src/db/repositories/snippet.test.ts:
  - Test CRUD operations for snippets
  - Test query building
  - Test error scenarios

CREATE src/db/repositories/composition.test.ts:
  - Test CRUD operations for compositions
  - Test relationship handling
  - Test cascade deletes

Task 6: Test additional components
CREATE src/db/config.test.ts:
  - Test config validation
  - Test environment variable parsing

CREATE src/db/migrations.test.ts:
  - Test constraint creation
  - Test migration ordering

Task 7: Update existing test files
MODIFY src/cli/index.test.ts:
  - Expand with real CLI tests
  - Test command parsing
  - Test error output

Task 8: Remove placeholder test
DELETE tests/index.test.ts:
  - No longer needed with co-located tests
```

### Per task pseudocode

```typescript
// Task 2: Domain schema tests
import { describe, it, expect } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import * as Domain from './domain';

describe('Domain Schemas', () => {
  describe('SnippetId', () => {
    it('accepts valid UUID format', () => {
      const valid = '123e4567-e89b-12d3-a456-426614174000';
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.SnippetId)(valid),
      );
      expect(result).toBe(valid);
    });

    it('rejects invalid format', () => {
      const invalid = 'not-a-uuid';
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.SnippetId)(invalid),
      );
      expect(result._tag).toBe('Failure');
    });

    it('rejects empty string', () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.SnippetId)(''),
      );
      expect(result._tag).toBe('Failure');
    });
  });
});

// Task 3: Model calculation tests
describe('Model Calculations', () => {
  describe('normalizeSlugInput', () => {
    it('converts to lowercase and replaces spaces', () => {
      expect(normalizeSlugInput('Hello World')).toBe('hello-world');
    });

    it('handles special characters', () => {
      expect(normalizeSlugInput('Test@#$%Name')).toBe('test-name');
    });

    it('collapses multiple dashes', () => {
      expect(normalizeSlugInput('test   name')).toBe('test-name');
    });
  });
});

// Task 4: Neo4j service tests
describe('Neo4jService', () => {
  it.effect('creates and closes sessions', () =>
    Effect.gen(function* () {
      const neo4j = yield* Neo4jService;
      const session = yield* neo4j.createSession();
      // Session should have required methods
      expect(session.run).toBeDefined();
      expect(session.close).toBeDefined();
    }).pipe(Effect.provide(TestNeo4jLayer)),
  );
});
```

### Integration Points

```yaml
CONFIG:
  - Vitest config: Use default, no changes needed
  - TypeScript: Already excludes test files

IMPORTS:
  - Always use: import { it } from "@effect/vitest"
  - Test utils: import * as TestUtils from "../test-utils"

PATTERNS:
  - Test files: *.test.ts co-located with source
  - Test names: describe block matches module/function name
  - Assertions: Use Effect.runSync for synchronous Effects
```

## Validation Loop

### Level 1: Syntax & Style

```bash
# Run after creating each test file
pnpm run lint
pnpm run typecheck

# Expected: No errors. Common fixes:
# - Import from @effect/vitest not vitest
# - Use Effect.runSync for synchronous Effect execution
# - Ensure test data matches schema types
```

### Level 2: Unit Tests

```typescript
// Each test file should have AT MINIMUM:
describe('FunctionName', () => {
  it('handles expected input correctly', () => {
    // Happy path test
  });

  it('handles edge case', () => {
    // Boundary condition, empty input, etc.
  });

  it('handles failure case', () => {
    // Invalid input, errors, etc.
  });
});
```

```bash
# Run tests incrementally as you create them
pnpm test src/core/domain.test.ts
pnpm test src/core/model.test.ts
pnpm test src/db

# If failing: Check that mocks match expected Neo4j response format
```

### Level 3: Coverage Check

```bash
# Ensure comprehensive coverage
pnpm test src -- --coverage

# Expected: High coverage for all modules
# Focus on: Branch coverage for validation functions
```

### Level 4: Full Test Suite

```bash
# Final validation
pnpm run preflight

# This runs:
# - pnpm run build
# - pnpm run typecheck
# - pnpm run lint
# - pnpm test

# Must pass all checks
```

## Final Validation Checklist

- [ ] All tests use @effect/vitest patterns
- [ ] Each function has 3+ test cases
- [ ] Test files are under 300 lines
- [ ] Neo4j operations use mock layers
- [ ] Deterministic test data (no random values)
- [ ] All Effect compliance items complete (docs/llms/effect/effect-compliance-checklist.md)
- [ ] `pnpm run preflight` passes
- [ ] No shared state between tests

---

## Anti-Patterns to Avoid

- ❌ Don't use regular `it()` from vitest - use `it.effect()`
- ❌ Don't share test layers between tests
- ❌ Don't use random data - tests must be deterministic
- ❌ Don't mock at the Effect level - mock at the service level
- ❌ Don't ignore Effect errors - handle them explicitly
- ❌ Don't create test files over 300 lines
- ❌ Don't skip any of the 3 required test cases
- ❌ Don't use async/await - use Effect.gen

## Critical Implementation Notes

1. **Effect Testing Pattern**: Always use `it.effect()` for testing Effect code:

```typescript
it.effect('description', () =>
  Effect.gen(function* () {
    const service = yield* MyService;
    const result = yield* service.method();
    expect(result).toBe(expected);
  }).pipe(Effect.provide(testLayer)),
);
```

2. **Neo4j Mock Pattern**: Mock at the service level, not the driver level:

```typescript
const TestNeo4jLayer = makeTestLayer(Neo4jService)({
  runQuery: (query, params) =>
    Effect.succeed({
      records: [mockNeo4jRecord({ id: '123' })],
    }),
});
```

3. **Error Testing Pattern**: Use Effect.flip or expect exit:

```typescript
it.effect('handles errors', () =>
  Effect.gen(function* () {
    const exit = yield* Effect.exit(failingOperation);
    expect(exit._tag).toBe('Failure');
  }),
);
```

**Confidence Score: 9/10**

This PRP provides comprehensive context including:

- Complete test patterns from the codebase
- External documentation references
- Explicit file paths and structure
- Working code examples
- Clear validation steps
- Common pitfalls to avoid

The AI agent has everything needed for one-pass implementation success.
