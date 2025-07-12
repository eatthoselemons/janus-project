name: "Error Sub-Types Implementation PRP"
description: |

## Purpose
Implement the error type hierarchy for the Janus project as specified in section 1.2 of the implementation TODO. This provides a foundation for consistent, type-safe error handling throughout the application using Effect-TS patterns.

## Core Principles
1. **Errors as Data**: All errors are immutable data structures with Schema validation
2. **Type Safety**: Errors carry branded types in their properties  
3. **Explicit Failures**: All Effect types explicitly declare possible errors
4. **Composable**: Errors compose through tagged unions, not inheritance
5. **Global Rules**: Follow all rules in CLAUDE.md and effect-compliance-checklist.md

---

## Goal
Create a comprehensive error type hierarchy using Effect's TaggedError pattern, enabling type-safe error handling across all layers of the application with clear, self-documenting error types that integrate seamlessly with Neo4j operations and CLI commands.

## Why
- **Type Safety**: Compile-time guarantees about error handling paths
- **Better DX**: Self-documenting errors with all context included
- **Consistent Error Handling**: Standardized error types across the codebase
- **Effect Integration**: Leverages Effect's powerful error handling capabilities
- **User Experience**: Clear, actionable error messages for CLI users

## What
Implement base `JanusError` and five specific error subtypes that cover all failure scenarios in the application, following established Effect-TS patterns.

### Success Criteria
- [ ] All error types use TaggedError pattern correctly
- [ ] Errors include branded types in properties where applicable  
- [ ] Each error type has comprehensive unit tests
- [ ] All tests pass with `pnpm test src`
- [ ] No TypeScript or linting errors
- [ ] Errors integrate with existing branded types
- [ ] Documentation reflects new error types

## All Needed Context

### Documentation & References
```yaml
- url: https://effect.website/docs/guides/error-management
  sections: ["Tagged Errors", "Error Channel Operations"]
  why: Core documentation for Effect error handling patterns
  
- file: docs/llms/guides/effect-neo4j/09-advanced-composition.md
  why: Shows exact TaggedError patterns used in the project
  sections: ["Tagged Error Composition"]
  critical: |
    Schema.TaggedError for domain errors with validation
    Data.TaggedError for simpler errors without schema needs
    Always include message getter for good error messages
  
- file: docs/llms/guides/effect-neo4j/05-actions-layer-services.md  
  why: Shows how errors are used in service layer
  gotcha: Neo4jError uses simple Data.TaggedError pattern
  
- file: docs/llms/effect/effect-compliance-checklist.md
  include_sections: ["Error Handling"]
  critical: |
    All errors use TaggedError
    Error types contain branded properties
    Errors handled at appropriate layer
    No throwing exceptions
    All failures explicit in Effect types

- file: src/domain/types/branded.ts
  why: Import existing branded types for error properties
  pattern: All IDs should use these branded types, not raw strings
```

### Current Codebase tree
```bash
src
└── domain
    ├── index.ts
    └── types
        ├── branded.ts
        ├── composition.ts
        ├── experiment.ts
        ├── index.ts
        ├── parameter.ts
        ├── snippet.ts
        ├── tag.ts
        └── tests
            ├── branded.test.ts
            ├── composition.test.ts
            ├── experiment.test.ts
            ├── parameter.test.ts
            ├── snippet.test.ts
            └── tag.test.ts
```

### Desired Codebase tree with files to be added
```bash
src
└── domain
    ├── index.ts                    # UPDATE: Export errors
    └── types
        ├── branded.ts              
        ├── composition.ts          
        ├── errors.ts               # NEW: All error type definitions
        ├── experiment.ts           
        ├── index.ts                # UPDATE: Export errors  
        ├── parameter.ts            
        ├── snippet.ts              
        ├── tag.ts                  
        └── tests
            ├── branded.test.ts     
            ├── composition.test.ts 
            ├── errors.test.ts      # NEW: Error type tests
            ├── experiment.test.ts  
            ├── parameter.test.ts   
            ├── snippet.test.ts     
            └── tag.test.ts         
```

### Known Gotchas & Library Quirks
```typescript
// CRITICAL: Schema.TaggedError vs Data.TaggedError
// - Use Schema.TaggedError when you need schema validation on error properties
// - Use Data.TaggedError for simple errors with just a message
// Example: JanusError uses Data.TaggedError as base class
// Example: Domain errors like NotFoundError use Schema.TaggedError

// CRITICAL: Always import branded types from './branded'
// Never use raw strings for IDs in error properties

// GOTCHA: Schema.TaggedError requires 3 parameters:
// 1. Error name as string literal
// 2. Schema for error properties  
// 3. Optional annotations (like HTTP status)

// PATTERN: Include custom message getter for better error messages
// get message() { return `Detailed error message with ${this.property}` }
```

## Implementation Blueprint

### Data models and structure

```typescript
// Base error using Data.TaggedError (simpler pattern for base class)
export class JanusError extends Data.TaggedError("JanusError")<{
  message: string
}> {}

// Domain errors using Schema.TaggedError for validation
export class PersistenceError extends Schema.TaggedError<PersistenceError>()(
  "PersistenceError",
  {
    message: Schema.String,
    query: Schema.optional(Schema.String),
    operation: Schema.Literal("create", "read", "update", "delete")
  }
) {}

export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError", 
  {
    entityType: Schema.Literal("snippet", "parameter", "composition", "tag"),
    id: Schema.optional(Schema.String), // Can be SnippetId, ParameterId, etc
    slug: Schema.optional(Slug)
  }
) {
  get message() {
    const identifier = this.id ?? this.slug
    return `${this.entityType} not found: ${identifier}`
  }
}
```

### List of tasks to be completed in order

```yaml
Task 1: Create error types file
CREATE src/domain/types/errors.ts:
  - Import Effect, Data, Schema from "effect"
  - Import branded types from "./branded"  
  - Define JanusError base class
  - Define all 5 error subtypes
  - Export all error types

Task 2: Update domain type exports
MODIFY src/domain/types/index.ts:
  - ADD export * from "./errors"
  - KEEP all existing exports

Task 3: Write comprehensive tests
CREATE src/domain/types/tests/errors.test.ts:
  - Import @effect/vitest utilities
  - Test successful error creation
  - Test error message generation
  - Test type safety with branded types
  - Test Schema validation for each error

Task 4: Run validation and fix issues
RUN pnpm test src/domain
RUN pnpm run build  
RUN pnpm run lint
FIX any issues found

Task 5: Final preflight check
RUN pnpm run preflight
ENSURE all tests pass
VERIFY compliance checklist items
```

### Per task pseudocode

```typescript
// Task 1: errors.ts structure
import { Data, Schema } from "effect"
import type { 
  SnippetId, ParameterId, CompositionId, TagId, Slug 
} from "./branded"

// Base error - simple pattern
export class JanusError extends Data.TaggedError("JanusError")<{
  message: string
}> {}

// PersistenceError - for Neo4j operations
export class PersistenceError extends Schema.TaggedError<PersistenceError>()(
  "PersistenceError",
  {
    message: Schema.String,
    query: Schema.optional(Schema.String),
    operation: Schema.Literal("create", "read", "update", "delete", "connect")
  }
) {
  get message() {
    return `Database ${this.operation} failed: ${this.message}`
  }
}

// LlmApiError - for LLM provider failures
export class LlmApiError extends Schema.TaggedError<LlmApiError>()(
  "LlmApiError",
  {
    provider: Schema.String,
    statusCode: Schema.optional(Schema.Number),
    message: Schema.String
  }
) {
  get message() {
    const status = this.statusCode ? ` (${this.statusCode})` : ""
    return `LLM API error from ${this.provider}${status}: ${this.message}`
  }
}

// Task 3: Test structure
import { it } from "@effect/vitest"
import { Effect, Either } from "effect"
import * as Schema from "effect/Schema"
import { 
  JanusError, PersistenceError, NotFoundError, 
  FileSystemError, ConflictError, LlmApiError 
} from "../errors"
import { SnippetId } from "../branded"

it.effect("PersistenceError includes operation context", () =>
  Effect.gen(function* () {
    const error = new PersistenceError({
      message: "Connection timeout",
      operation: "create",
      query: "CREATE (n:Snippet {id: $id})"
    })
    
    expect(error._tag).toBe("PersistenceError")
    expect(error.message).toContain("create")
    expect(error.query).toBeDefined()
  })
)

it.effect("NotFoundError works with branded types", () =>
  Effect.gen(function* () {
    const id = yield* SnippetId.make("550e8400-e29b-41d4-a716-446655440000")
    const error = new NotFoundError({
      entityType: "snippet",
      id: id
    })
    
    expect(error.message).toContain("snippet not found")
    expect(error.id).toBe(id)
  })
)
```

### Integration Points
```yaml
IMPORTS:
  - Other files will import errors as:
    import { PersistenceError, NotFoundError } from "@/domain/types"
  
SERVICE LAYER:
  - Services return Effect<T, PersistenceError | NotFoundError>
  - Example: findById(id) => Effect<Option<Entity>, PersistenceError>
  
CLI LAYER:  
  - CLI commands handle errors with Effect.catchTag
  - Pretty print error messages to console
```

## Validation Loop

### Level 1: Syntax & Type Checking
```bash
# After creating errors.ts
pnpm run build                    # TypeScript compilation
pnpm run lint                     # ESLint checking

# Expected: No errors. Common issues:
# - Missing imports: Add "effect" imports
# - Type errors: Ensure branded types are imported as types
```

### Level 2: Unit Tests
```bash
# Run domain tests
pnpm test src/domain/types/tests/errors.test.ts

# If failing:
# - Schema validation: Check Schema.Literal values
# - Type mismatches: Verify branded type usage
# - Missing properties: Ensure all required fields in error constructors
```

### Level 3: Integration with existing code
```bash
# Full test suite  
pnpm test src

# Build check
pnpm run build

# Final preflight
pnpm run preflight
```

## Final validation Checklist
- [ ] All 6 error types implemented (JanusError + 5 subtypes)
- [ ] All errors use appropriate TaggedError pattern
- [ ] Branded types used in error properties
- [ ] Custom message getters provide clear error messages  
- [ ] Comprehensive tests for each error type
- [ ] All tests pass: `pnpm test src/domain`
- [ ] No linting errors: `pnpm run lint`
- [ ] No type errors: `pnpm run build`
- [ ] Preflight passes: `pnpm run preflight`
- [ ] Exports added to index files

---

## Anti-Patterns to Avoid
- ❌ Don't use plain Error classes - use TaggedError
- ❌ Don't use raw strings for IDs - use branded types
- ❌ Don't throw errors - return them in Effect types
- ❌ Don't catch all errors - use typed error handling
- ❌ Don't create error hierarchies - use tagged unions
- ❌ Don't forget custom message getters
- ❌ Don't mix Schema.TaggedError and Data.TaggedError incorrectly
- ❌ Don't create new patterns - follow existing conventions

## Confidence Score: 9/10

High confidence due to:
- Clear requirements in implementation TODO
- Well-documented patterns in effect-neo4j guides  
- Existing branded types to build upon
- Simple, focused scope
- Clear validation steps

Minor uncertainty (-1) for potential integration complexities with future services.