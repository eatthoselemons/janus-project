# PRP: Ensure Effect Compliance

## Goal
Transform the Janus project codebase to fully comply with Effect-TS best practices and Eric Normand's "Data, Calculations, Actions" paradigm. The codebase has a good foundation but needs significant compliance work to follow Effect patterns correctly, particularly in data modeling, service architecture, and error handling.

## Why
- **Type Safety**: Leverage Effect's robust type system for compile-time verification
- **Maintainability**: Follow proven patterns for scalable, maintainable code
- **Testability**: Enable proper mocking and testing through Effect's dependency injection
- **Functional Principles**: Enforce clean separation between data, calculations, and actions
- **Error Handling**: Implement comprehensive, composable error handling patterns

## What
Refactor the existing codebase to comply with Effect best practices while maintaining current functionality. This includes converting domain models to Schema-based validation, implementing proper service patterns, and ensuring clean separation of concerns.

### Success Criteria
- [ ] All domain models use Schema validation with branded types
- [ ] All services follow Effect.Service pattern with proper dependency injection
- [ ] All side effects are wrapped in Effect types
- [ ] All errors use Schema.TaggedError pattern
- [ ] All tests use Effect testing patterns
- [ ] Configuration uses Effect Config system
- [ ] Code passes all compliance checklist items
- [ ] All existing functionality continues to work

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- url: https://effect.website/llms-full.txt
  why: Complete Effect documentation for complex patterns
  
- file: docs/llms/examples/effect-composition-guide.md
  why: Complete guide to Effect composition patterns and layer architecture
  
- file: docs/llms/examples/effect-normand-paradigm-guide.md
  why: How to implement Eric Normand's paradigm with Effect
  
- file: docs/llms/examples/llm-normand-composition-guide.md
  why: Quick reference for proper Effect usage patterns

- file: docs/llms/effect/effect-compliance-checklist.md
  why: Comprehensive checklist for Effect compliance validation
  
- file: examples/effect-official-examples/examples/http-server/src/Domain/User.ts
  why: Reference implementation of proper Schema-based domain models
  
- file: examples/effect-official-examples/examples/http-server/src/Accounts.ts
  why: Reference implementation of proper Effect.Service pattern
  
- file: examples/effect-official-examples/examples/http-server/test/Accounts.test.ts
  why: Reference implementation of Effect testing patterns
```

### Current Codebase Structure
```bash
src/
├── cli/
│   ├── index.ts          # CLI commands (needs service integration)
│   └── index.test.ts     # Basic tests (needs Effect patterns)
├── config.ts             # Environment config (needs Config system)
├── core/
│   ├── domain.ts         # Domain models (needs Schema rewrite)
│   ├── model.ts          # Smart constructors (needs Schema integration)
│   └── model.test.ts     # Basic tests (needs Effect patterns)
├── db/
│   ├── neo4j.ts          # Database driver (needs service pattern)
│   ├── repositories.ts   # Repositories (needs compliance fixes)
│   └── migrations.ts     # Database migrations (partially compliant)
├── index.ts              # Main entry point (basic Effect setup)
└── tests/
    └── index.test.ts     # Integration tests (needs Effect patterns)
```

### Target Compliant Structure
```bash
src/
├── cli/
│   ├── index.ts          # CLI commands integrated with Effect services
│   └── index.test.ts     # Effect-aware CLI tests
├── config.ts             # Config system with Effect Config
├── core/
│   ├── domain.ts         # Schema-based domain models with branded types
│   ├── model.ts          # Pure calculation functions
│   └── model.test.ts     # Effect-aware unit tests
├── db/
│   ├── neo4j.ts          # Proper Effect.Service with resource management
│   ├── repositories.ts   # Repositories following Effect.Service pattern
│   └── migrations.ts     # Effect-aware migration system
├── index.ts              # Main entry point with proper layer composition
└── tests/
    └── index.test.ts     # Integration tests with Effect patterns
```

### Known Gotchas & Library Quirks
```typescript
// CRITICAL: Effect Schema validation patterns
// Always use Schema.brand() for domain identifiers
export const UserId = Schema.Number.pipe(Schema.brand("UserId"))
// NOT: type UserId = string & { readonly __brand: "UserId" }

// CRITICAL: Effect.Service pattern requirements
// Services MUST declare dependencies in the dependencies array
export class UserService extends Effect.Service<UserService>()(
  "UserService",
  {
    effect: Effect.gen(function*() {
      const repo = yield* UserRepository
      return { getUser } as const
    }),
    dependencies: [UserRepository.Default]  // REQUIRED
  }
) {}

// CRITICAL: Schema.TaggedError for all domain errors
export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: UserId }
) {}
// NOT: class UserNotFound extends Error

// CRITICAL: Effect.gen for all side effects
// Use Effect.gen for sequential operations, not async/await
const getUserById = (id: UserId) => Effect.gen(function*() {
  const repo = yield* UserRepository
  const user = yield* repo.findById(id)
  return user
})

// CRITICAL: Test patterns with Effect
// Use it.effect() for Effect-based tests
it.effect("should get user by id", () => Effect.gen(function*() {
  const service = yield* UserService
  const user = yield* service.getUserById(UserId(1))
  expect(user).toEqual(expectedUser)
}))
```

## Implementation Blueprint

### Phase 1: Data Layer Compliance
Fix all domain models to use Schema validation with branded types and proper error handling.

```typescript
// Transform from current primitive types to Schema-based models
// OLD: type UserId = string & { readonly __brand: "UserId" }
// NEW: export const UserId = Schema.Number.pipe(Schema.brand("UserId"))

// Model classes with proper validation
export class User extends Model.Class<User>("User")({
  id: Model.Generated(UserId),
  name: Schema.NonEmptyTrimmedString,
  email: Email,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate
}) {}

// Tagged errors for domain exceptions
export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: UserId }
) {}
```

### Phase 2: Configuration System
Convert environment-based configuration to Effect Config system.

```typescript
// Transform from process.env to Effect Config
export const AppConfig = Config.struct({
  neo4jUri: Config.string("NEO4J_URI"),
  neo4jUsername: Config.string("NEO4J_USERNAME"),
  neo4jPassword: Config.redacted("NEO4J_PASSWORD"),
  logLevel: Config.string("LOG_LEVEL").pipe(Config.withDefault("info"))
})
```

### Phase 3: Service Layer Compliance
Convert all services to proper Effect.Service pattern with dependency injection.

```typescript
// Transform repositories and services to Effect.Service pattern
export class UserRepository extends Effect.Service<UserRepository>()(
  "UserRepository",
  {
    effect: Effect.gen(function*() {
      const driver = yield* Neo4jDriver
      return {
        findById: (id: UserId) => Effect.gen(function*() {
          const session = yield* driver.session()
          // Implementation with proper resource management
        }),
        create: (user: User) => Effect.gen(function*() {
          // Implementation
        })
      } as const
    }),
    dependencies: [Neo4jDriver.Default]
  }
)
```

### Phase 4: Testing Infrastructure
Implement Effect-aware testing patterns with proper mocking.

```typescript
// Transform tests to use Effect patterns
export const makeTestLayer = <I, S extends object>(tag: Context.Tag<I, S>) => 
  (service: Partial<S>): Layer.Layer<I> =>
    Layer.succeed(tag, makeUnimplementedProxy(tag.key, service))

// Test setup with mock layers
const TestLive = Layer.mergeAll(
  UserService.Test,
  makeTestLayer(UserRepository)({
    findById: () => Effect.succeed(Option.some(mockUser)),
    create: () => Effect.succeed(mockUser)
  })
)
```

## Task List (Implementation Order)

### Task 1: Fix Domain Models (High Priority)
**MODIFY** `src/core/domain.ts`:
- REPLACE all manual branded types with `Schema.brand()`
- REPLACE all plain types with `Schema.Struct()` definitions
- ADD proper Schema validation for all domain entities
- CONVERT all error classes to `Schema.TaggedError`

**MODIFY** `src/core/model.ts`:
- EXTRACT all side effects from constructors
- CONVERT to pure calculation functions
- REMOVE crypto.randomUUID() calls (move to service layer)

### Task 2: Implement Configuration System (High Priority)
**MODIFY** `src/config.ts`:
- REPLACE all `process.env` usage with `Config.string()` and `Config.redacted()`
- ADD proper configuration validation
- IMPLEMENT default values with `Config.withDefault()`

### Task 3: Fix Service Patterns (Critical)
**MODIFY** `src/db/neo4j.ts`:
- CONVERT to proper `Effect.Service` pattern
- ADD resource management with `Effect.scoped()`
- IMPLEMENT proper error handling with tagged errors

**MODIFY** `src/db/repositories.ts`:
- CONVERT all repositories to `Effect.Service` pattern
- ADD proper dependency injection
- IMPLEMENT proper error handling

### Task 4: Add Effect Testing (Medium Priority)
**MODIFY** all test files:
- CONVERT to `it.effect()` pattern
- ADD test layers for mocking
- IMPLEMENT proper Effect testing patterns

### Task 5: CLI Integration (Medium Priority)
**MODIFY** `src/cli/index.ts`:
- INTEGRATE CLI commands with Effect services
- ADD proper error handling
- IMPLEMENT layer composition

### Task 6: Layer Composition (Low Priority)
**MODIFY** `src/index.ts`:
- IMPLEMENT proper layer composition
- ADD observability with spans
- CONFIGURE proper application startup

## Integration Points

### Database Layer
- Migration: Update schema validation for all entity types
- Connection: Implement proper connection pooling with Effect scopes
- Transactions: Add Effect-aware transaction handling

### Configuration
- Environment: Convert all environment variables to Config system
- Validation: Add schema validation for all configuration values
- Secrets: Use Config.redacted() for sensitive values

### CLI Layer
- Commands: Integrate CLI commands with Effect services
- Error Handling: Implement proper error reporting
- Testing: Add Effect-aware CLI testing

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
pnpm run lint          # ESLint with Effect-specific rules
pnpm run typecheck     # TypeScript compilation
pnpm run format        # Prettier formatting

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests
```bash
# Run unit tests with Effect patterns
pnpm run test:unit

# Expected: All tests pass with proper Effect testing patterns
# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Integration Tests
```bash
# Run full test suite
pnpm run test

# Expected: All tests pass, including integration tests
# If failing: Check that services are properly integrated
```

### Level 4: Compliance Validation
```bash
# Run through the compliance checklist
# Check each item in docs/llms/effect/effect-compliance-checklist.md
# Ensure all patterns are followed correctly
```

## Final Validation Checklist
- [ ] All domain models use Schema validation: `pnpm run test:domain`
- [ ] All services follow Effect.Service pattern: `pnpm run test:services`
- [ ] All tests use Effect patterns: `pnpm run test`
- [ ] Configuration uses Config system: `pnpm run test:config`
- [ ] No TypeScript errors: `pnpm run typecheck`
- [ ] No linting errors: `pnpm run lint`
- [ ] All compliance checklist items verified
- [ ] Existing functionality preserved
- [ ] All new code follows Effect patterns

## Anti-Patterns to Avoid
- ❌ Don't use manual branded types when Schema.brand() exists
- ❌ Don't use plain classes when Model.Class provides validation
- ❌ Don't use async/await when Effect.gen is available
- ❌ Don't use regular Error classes when Schema.TaggedError exists
- ❌ Don't access process.env directly when Config system is available
- ❌ Don't create services without proper dependency injection
- ❌ Don't write tests without Effect patterns
- ❌ Don't mix side effects with pure calculations
- ❌ Don't ignore resource management for external dependencies

## Confidence Score: 8/10

This PRP provides comprehensive context and clear implementation steps for achieving Effect compliance. The score reflects high confidence due to:
- Complete documentation of current issues
- Clear reference implementations from examples
- Detailed compliance checklist
- Proper validation steps
- Comprehensive context for the AI agent

The implementation should succeed in one pass with careful attention to the provided patterns and validation steps.