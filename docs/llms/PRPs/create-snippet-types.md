name: "Create Snippet Types PRP - Neo4j Domain Model Implementation"
status: completed
completion_date: 2025-07-11
description: |

## Purpose
Implement all snippet-related types from the domain model using Effect-TS patterns with Schema.Struct for Neo4j graph database. This includes branded types, schemas, and comprehensive tests following functional programming principles.

## Core Principles
1. **Context is Complete but Focused**: All necessary documentation for Effect + Neo4j patterns included
2. **Validation Loops**: Executable tests using vitest and Effect compliance checks
3. **Information Dense**: Specific patterns from Effect documentation and examples
4. **Progressive Success**: Start with types, then schemas, then tests
5. **Global rules**: Follow all rules in CLAUDE.md and Effect compliance checklist

---

## Goal
Create all snippet-related types defined in `docs/design/domain-model.md` as Effect Schema types suitable for Neo4j graph database, with comprehensive type safety and testing.

## Why
- **Business value**: Enable the core functionality of the Janus project - managing reusable prompt snippets
- **Integration**: Foundation for all future features that will interact with snippets
- **Problems solved**: Type-safe prompt composition, version control, and parameter management for LLM testing

## What
Implement the following entities from the domain model:
- Snippet (abstract container)
- SnippetVersion (immutable snapshots)
- Parameter (named variables)
- ParameterOption (versioned values)
- Composition (prompt recipes)
- CompositionVersion (immutable composition snapshots)
- TestRun and DataPoint (testing results)
- Tag (categorization)
- All associated branded types and relationships

### Success Criteria
- [ ] All entity types implemented with proper branded types
- [ ] Schema validation working correctly
- [ ] No primitive obsession - all IDs and domain values are branded
- [ ] All tests passing (unit tests for each type)
- [ ] Type inference working correctly
- [ ] Neo4j compatibility (no Model.Class usage)

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these specific sections in your context window

- url: https://effect.website/docs/guides/schema/branded-types
  sections: ["Creating Branded Types", "Validation"]
  why: Need to implement all IDs as branded types for type safety
  discovered_caveat: Must use Schema.brand() not just TypeScript brands
  
- url: https://www.npmjs.com/package/@effect/vitest
  sections: ["Usage", "Testing Effects"]
  why: Testing Effect-based code requires special vitest integration
  critical: Use it.effect() for Effect-based tests, not regular it()
  
- file: docs/design/domain-model.md
  why: Contains exact specifications for all entities and relationships
  critical: |
    - All entity IDs are string UUIDs with brands
    - Slug type for human-readable names
    - Specific relationship types for Neo4j edges
  
- file: docs/llms/examples/effect-neo4j-essential-guide-llm.md
  include_sections: ["Critical Schema Rules for Neo4j", "Data, Calculations, Actions Pattern"]
  why: Shows correct patterns for Neo4j with Schema.Struct instead of Model.Class
  critical: |
    - NEVER use Model.Class with Neo4j (SQL only!)
    - Use Schema.Struct for simple nodes
    - Use Schema.Class when nodes need methods

- file: docs/llms/examples/effect-normand-paradigm-guide-llm.md
  include_sections: ["Using Schema for Non-SQL Database Data"]
  why: Shows how to structure Neo4j schemas following Eric Normand's paradigm
  gotcha: Neo4j uses string IDs, not auto-increment numbers

- file: docs/llms/effect/effect-compliance-checklist.md
  include_all: true
  why: Must ensure all code follows Effect best practices
  critical: |
    - Branded Types: Use Schema.brand() for domain identifiers
    - No Behavior in Data: Data classes contain only structure
    - Use Schema.Struct() with proper validation
```

### Current Codebase tree
```bash
janus-project/
├── src/                    # Currently empty
├── package.json            # Has effect, neo4j-driver, @effect/vitest dependencies
├── tsconfig.json          # ES2022 target, strict mode
├── vitest.config.ts       # Excludes examples folder
└── docs/
    └── design/
        └── domain-model.md # Contains entity specifications
```

### Desired Codebase tree with files to be added
```bash
janus-project/
└── src/
    └── domain/
        ├── types/
        │   ├── tests/
        │   │   ├── branded.test.ts
        │   │   ├── snippet.test.ts
        │   │   ├── parameter.test.ts
        │   │   ├── composition.test.ts
        │   │   ├── testing.test.ts
        │   │   └── tag.test.ts
        │   ├── branded.ts        # All branded types (IDs, Slug, etc.)
        │   ├── snippet.ts        # Snippet and SnippetVersion schemas
        │   ├── parameter.ts      # Parameter and ParameterOption schemas
        │   ├── composition.ts    # Composition schemas
        │   ├── testing.ts        # TestRun and DataPoint schemas
        │   ├── tag.ts           # Tag schema
        │   └── index.ts         # Re-exports all types
        └── index.ts             # Re-exports from types
```

### Known Gotchas & Library Quirks
```typescript
# CRITICAL: Neo4j specific considerations
# 1. Neo4j uses string UUIDs, not numeric auto-increment IDs
# 2. Must use Schema.Struct or Schema.Class, NEVER Model.Class
# 3. All node properties must be serializable (no functions)
# 4. Relationships have properties that need their own schemas
# 5. DateTimeUtc for all timestamps (Neo4j datetime compatible)
# 6. Array properties need explicit Schema.Array definitions
```

## Implementation Blueprint

### Data models and structure

Create the core data models following type-driven development principles:

```typescript
// Example structure for branded.ts
import { Schema } from "effect"

// All IDs are string UUIDs with brands
export const SnippetId = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
  Schema.brand("SnippetId")
)
export type SnippetId = typeof SnippetId.Type

// Slug for URL-friendly names
export const Slug = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  Schema.minLength(1),
  Schema.maxLength(100),
  Schema.brand("Slug")
)
export type Slug = typeof Slug.Type

// Example structure for snippet.ts
import { Schema } from "effect"
import { SnippetId, SnippetVersionId, Slug } from "./branded"

// Abstract container for snippets
export const Snippet = Schema.Struct({
  id: SnippetId,
  name: Slug,
  description: Schema.String
})
export type Snippet = typeof Snippet.Type

// Immutable version with content
export const SnippetVersion = Schema.Struct({
  id: SnippetVersionId,
  content: Schema.String, // Template string with {{variables}}
  createdAt: Schema.DateTimeUtc,
  commit_message: Schema.String
})
export type SnippetVersion = typeof SnippetVersion.Type
```

### List of tasks to be completed

```yaml
Task 1: Create branded types (src/domain/types/branded.ts)
CREATE src/domain/types/branded.ts:
  - Define all ID types with UUID pattern validation
  - Define Slug type with lowercase-hyphen pattern
  - Define RelationshipStrength (0-1 range for Neo4j)
  - Export all types properly
  - Add JSDoc comments for each type

Task 2: Create snippet schemas (src/domain/types/snippet.ts)
CREATE src/domain/types/snippet.ts:
  - Import branded types
  - Define Snippet schema (abstract container)
  - Define SnippetVersion schema (with template content)
  - Ensure DateTimeUtc for timestamps
  - Export schemas and types

Task 3: Create parameter schemas (src/domain/types/parameter.ts)
CREATE src/domain/types/parameter.ts:
  - Define Parameter schema (abstract definition)
  - Define ParameterOption schema (versioned values)
  - Include proper relationships to snippets
  - Export all schemas and types

Task 4: Create composition schemas (src/domain/types/composition.ts)
CREATE src/domain/types/composition.ts:
  - Define Composition schema
  - Define CompositionVersion schema
  - Define CompositionSnippet (junction with role/sequence)
  - Define role as literal union ("system" | "user_prompt" | "model_response")
  - Export all schemas and types

Task 5: Create testing result schemas (src/domain/types/testing.ts)
CREATE src/domain/types/testing.ts:
  - Define TestRun schema
  - Define DataPoint schema
  - Use Schema.Record for flexible metadata
  - Export all schemas and types

Task 6: Create tag schema (src/domain/types/tag.ts)
CREATE src/domain/types/tag.ts:
  - Define Tag schema with Slug name
  - Export schema and type

Task 7: Create index file (src/domain/types/index.ts)
CREATE src/domain/types/index.ts:
  - Re-export all types from all modules
  - Group exports logically

Task 8: Write tests for branded types (src/domain/types/tests/branded.test.ts)
CREATE src/domain/types/tests/branded.test.ts:
  - Test UUID validation for all ID types
  - Test Slug pattern validation
  - Test edge cases (empty, too long, invalid chars)
  - Use it.effect() for Effect-based tests

Task 9: Write tests for snippet schemas (src/domain/types/tests/snippet.test.ts)
CREATE src/domain/types/tests/snippet.test.ts:
  - Test valid snippet creation
  - Test validation failures
  - Test template string content
  - Test date handling

Task 10: Write tests for remaining schemas
CREATE remaining test files:
  - parameter.test.ts
  - composition.test.ts  
  - testing.test.ts
  - tag.test.ts
  - Each with happy path, edge cases, and failure cases

Task 11: Create main index (src/domain/index.ts)
CREATE src/domain/index.ts:
  - Export * from './types'
  - Add module documentation

Task 12: Update tsconfig.json paths
MODIFY tsconfig.json:
  - Add path mappings for cleaner imports
  - Ensure src is included properly
```

### Per task pseudocode

```typescript
# Task 1: Branded Types
// All IDs follow UUID v4 pattern
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Create branded ID factory
const makeIdType = (brand: string) => 
  Schema.String.pipe(
    Schema.pattern(uuidPattern),
    Schema.brand(brand)
  )

// Slug validation for URL-safe names
const Slug = Schema.String.pipe(
  Schema.transform(
    Schema.String,
    (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    (s) => s
  ),
  Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  Schema.brand("Slug")
)

# Task 2-6: Schema Creation Pattern
// Follow Neo4j compatibility rules
// 1. Use Schema.Struct for data-only nodes
// 2. Use DateTimeUtc for all timestamps
// 3. All properties must be serializable
// 4. Arrays need explicit Schema.Array

# Task 8-10: Test Pattern
import { it } from "@effect/vitest"
import { Effect, Schema } from "effect"

it.effect("should validate correct UUID", () =>
  Effect.gen(function* () {
    const validId = "123e4567-e89b-12d3-a456-426614174000"
    const result = yield* Schema.decode(SnippetId)(validId)
    expect(result).toBe(validId)
  })
)

it.effect("should reject invalid UUID", () =>
  Effect.gen(function* () {
    const invalidId = "not-a-uuid"
    const result = yield* Effect.either(Schema.decode(SnippetId)(invalidId))
    expect(result._tag).toBe("Left")
  })
)
```

### Integration Points

```yaml
NEO4J:
  - All schemas compatible with neo4j-driver serialization
  - String IDs (not numeric)
  - DateTimeUtc format for temporal data
  
IMPORTS:
  - Use relative imports within domain
  - Export everything through index files
  - Type exports alongside schema exports
```

## Validation Loop

### Level 1: Syntax & Type Checking
```bash
# Run these FIRST - fix any errors before proceeding
pnpm run build                      # TypeScript compilation
# Expected: Successful build with no errors

# If errors:
# - Check import paths are correct
# - Ensure all types are exported
# - Verify Effect import syntax
```

### Level 2: Unit Tests
```bash
# Run all tests
pnpm test src/domain/types

# Run specific test file during development
pnpm test branded.test.ts

# Expected: All tests passing
# If failing:
# - Check Schema.decode usage with Effect.gen
# - Ensure it.effect() is used for Effect tests
# - Verify error handling with Effect.either
```

### Level 3: Effect Compliance
```bash
# Manual checklist verification:
# □ All IDs use Schema.brand()
# □ No Model.Class usage (Neo4j incompatible)
# □ Schema.Struct for all entities
# □ No behavior in data schemas
# □ All external data validated
# □ DateTimeUtc for all timestamps
```

### Level 4: Integration Test
```typescript
// Create a simple integration test to verify Neo4j compatibility
import { Schema } from "effect"
import neo4j from "neo4j-driver"

// Test that schemas can be serialized for Neo4j
const testNeo4jCompatibility = () => {
  const snippet = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "test-snippet",
    description: "Test description"
  }
  
  // Decode and validate
  const validated = Schema.decodeUnknownSync(Snippet)(snippet)
  
  // Ensure it can be passed to Neo4j
  const query = "CREATE (s:Snippet $props) RETURN s"
  const params = { props: validated }
  
  // This should not throw
  console.log("Neo4j compatible:", params)
}
```

## Final Validation Checklist
- [x] All tests pass: `pnpm test src/domain/types`
- [x] Build succeeds: `pnpm run build`
- [x] No TypeScript errors: `npx tsc --noEmit`
- [x] All branded types have UUID validation
- [x] Slug type validates lowercase-hyphen pattern
- [x] All schemas use Schema.Struct (not Model.Class)
- [x] DateTimeUtc used for all timestamps
- [x] Every schema has corresponding tests
- [x] Tests cover: happy path, validation errors, edge cases
- [x] All exports properly organized through index files

---

## Anti-Patterns to Avoid
- ❌ Don't use Model.Class - it's SQL-specific, not for Neo4j
- ❌ Don't use numeric IDs - Neo4j uses string UUIDs
- ❌ Don't skip branded types - enforce type safety everywhere
- ❌ Don't put behavior in data schemas - keep them pure
- ❌ Don't use raw strings/numbers - always use branded types
- ❌ Don't forget DateTimeUtc - ensure Neo4j compatibility
- ❌ Don't use regular it() - use it.effect() for Effect tests

## Confidence Score: 9/10

High confidence due to:
- ✅ Clear domain model specification provided
- ✅ Comprehensive Effect + Neo4j documentation included  
- ✅ Specific patterns and examples for Schema.Struct usage
- ✅ Detailed test strategy with @effect/vitest
- ✅ Clear file structure and implementation order
- ✅ Known gotchas documented (Model.Class vs Schema.Struct)
- ⚠️ -1 point: No existing code patterns in the project to reference

This PRP provides sufficient context for one-pass implementation success.