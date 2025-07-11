name: "Base PRP Template v2 - Context-Rich with Validation Loops"
description: |

## Purpose
Template optimized for AI agents to implement features with sufficient context and self-validation capabilities to achieve working code through iterative refinement.

## Core Principles
1. **Context is Complete but Focused**: Include ALL necessary documentation sections, specific examples, and discovered caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
[What needs to be built - be specific about the end state and desires]

## Why
- [Business value and user impact]
- [Integration with existing features]
- [Problems this solves and for whom]

## What
[User-visible behavior and technical requirements]

### Success Criteria
- [ ] [Specific measurable outcomes]

## All Needed Context

### Documentation & References (include complete sections that are directly relevant)
```yaml
# MUST READ - Include these specific sections in your context window
# ✅ Include: Complete relevant sections, not just snippets
# ❌ Avoid: Entire folders or unrelated documentation

- url: [Official API docs URL]
  sections: ["Authentication", "Error Handling"]  # Complete sections needed
  why: [These endpoints will be used for X, Y, Z]
  discovered_caveat: [Rate limit of 10 req/sec not documented in main API]
  
- file: [path/to/example.ts]
  why: [Follow this exact pattern for connection handling]
  gotcha: [Lines 45-60 show retry logic that prevents common timeout issue]
  
- doc: [Library documentation URL] 
  section: ["Common Pitfalls", "Advanced Configuration"]
  critical: |
    BatchProcessor silently fails on batches > 1000 items
    Must set connection_pool_size=50 for production
  
- docfile: docs/architecture/[component].md
  include_sections: ["Data Flow", "Error Handling", "Configuration"]
  skip_sections: ["Historical Context", "Roadmap"]  # Not relevant for implementation

```

### Context Inclusion Guidelines
- Include COMPLETE sections when they contain implementation details
- Include MULTIPLE examples if they show different use cases
- Include ALL caveats and warnings discovered during research
- Skip sections about: history, philosophy, future plans, unrelated features
- When in doubt, include it - but be specific about WHY it's needed

### Current Codebase tree (run `tree` in the root of the project) to get an overview of the codebase
```bash

```

### Desired Codebase tree with files to be added and responsibility of file
```bash

```

### Known Gotchas of our codebase & Library Quirks
```typescript
// CRITICAL: [Library name] requires [specific setup]
// Example: Effect.gen requires function* syntax for generators
// Example: Schema.decode returns an Effect, not a plain value
// Example: We use Effect v3 and Schema.Struct for Neo4j (not Model.Class)
```

## Implementation Blueprint

### Data models and structure

Create the core data models, we ensure type safety and consistency.
```typescript
Examples: 
 - Effect Schema types (Schema.Struct)
 - Branded types for domain concepts
 - Tagged errors for error handling
 - Service definitions with Context.Tag

```

### list of tasks to be completed to fullfill the PRP in the order they should be completed

```yaml
Task 1:
MODIFY src/existing_module.py:
  - FIND pattern: "class OldImplementation"
  - INJECT after line containing "def __init__"
  - PRESERVE existing method signatures

CREATE src/new_feature.py:
  - MIRROR pattern from: src/similar_feature.py
  - MODIFY class name and core logic
  - KEEP error handling pattern identical

...(...)

Task N:
...

```


### Per task pseudocode as needed added to each task
```typescript

// Task 1
// Pseudocode with CRITICAL details dont write entire code
const newFeature = (param: string) => 
  Effect.gen(function* () {
    // PATTERN: Always decode/validate input first (see src/domain/types)
    const validated = yield* Schema.decode(ParamSchema)(param)
    
    // GOTCHA: Effect requires yield* to unwrap Effects
    const conn = yield* ConnectionPool
    
    // PATTERN: Use Effect retry policies
    const result = yield* pipe(
      ExternalApi.call(validated),
      Effect.retry(Schedule.exponential("1 second").pipe(
        Schedule.jittered,
        Schedule.compose(Schedule.recurs(3))
      )),
      // CRITICAL: API returns 429 if >10 req/sec
      Effect.tap(() => RateLimiter.acquire)
    )
    
    // PATTERN: Return domain types, not raw data
    return yield* Schema.decode(ResponseSchema)(result)
  })
```

### Integration Points
```yaml
DATABASE:
  - migration: "Add column 'feature_enabled' to users table"
  - index: "CREATE INDEX idx_feature_lookup ON users(feature_id)"
  
CONFIG:
  - add to: src/config.ts
  - pattern: "export const featureTimeout = Config.integer('FEATURE_TIMEOUT').pipe(Config.withDefault(30))"
  
ROUTES:
  - add to: src/api/routes.ts  
  - pattern: "HttpApiGroup.add(HttpApiEndpoint.get('getFeature', '/feature/:id'))"
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
// CREATE new-feature.test.ts with these test cases:
import { it } from "@effect/vitest"
import { Effect, Exit } from "effect"

it.effect("should handle happy path", () =>
  Effect.gen(function* () {
    const result = yield* newFeature("valid_input")
    expect(result.status).toBe("success")
  })
)

it.effect("should reject invalid input", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(newFeature(""))
    expect(Exit.isFailure(result)).toBe(true)
  })
)

it.effect("should handle external API timeout", () =>
  Effect.gen(function* () {
    const TestLayer = Layer.succeed(ExternalApi, {
      call: () => Effect.fail(new TimeoutError())
    })
    
    const result = yield* pipe(
      newFeature("valid"),
      Effect.provide(TestLayer),
      Effect.either
    )
    expect(result._tag).toBe("Left")
  })
)
```

```bash
# Run and iterate until passing:
pnpm test new-feature.test.ts
# If failing: Read error, understand root cause, fix code, re-run (never mock to pass)
```

### Level 3: Integration Test
```bash
# Start the service
pnpm run dev

# Test the endpoint
curl -X POST http://localhost:3000/feature \
  -H "Content-Type: application/json" \
  -d '{"param": "test_value"}'

# Expected: {"status": "success", "data": {...}}
# If error: Check console output for Effect stack trace
```

## Final validation Checklist
- [ ] All tests pass: `pnpm test`
- [ ] No linting errors: `pnpm run lint`
- [ ] No type errors: `pnpm run build`
- [ ] Preflight passes: `pnpm run preflight`
- [ ] Manual test successful: [specific curl/command]
- [ ] Error cases handled with proper Effect error types
- [ ] Traces are informative (using Effect.withSpan)
- [ ] Documentation updated if needed

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
