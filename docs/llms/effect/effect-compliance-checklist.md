> **Audience:** LLM / AI Agent (Compliance Verification)

# Effect + Neo4j Compliance Checklist

Use this checklist to verify your code follows all required patterns and principles.

## Pre-Implementation Checklist

### Type Design
- [ ] All domain types defined BEFORE implementation
- [ ] All primitives are branded (no raw string/number)
- [ ] Illegal states are unrepresentable in types
- [ ] All IDs have specific branded types (PersonId, not string)
- [ ] All domain values are branded (Email, not string)
- [ ] Numeric constraints enforced in types (Age: 0-150)

### Function Signatures
- [ ] All function signatures written before implementation
- [ ] Return types explicitly defined
- [ ] No `any` or untyped `unknown` in signatures
- [ ] Calculations return plain values (not Effect)
- [ ] Actions return Effect types

## Implementation Checklist

### Data Layer (Schemas)
- [ ] NO Model.Class used (Neo4j uses Schema.Struct/Class)
- [ ] All node schemas use Schema.Struct
- [ ] Schema.Class only used when methods needed
- [ ] Relationships defined as Schema.Struct
- [ ] All schema properties use branded types
- [ ] DateTimeUtc used for timestamps (not DateTimeInsert)

### Calculations Layer
- [ ] All calculations are pure functions
- [ ] No Effect returns from calculations
- [ ] No side effects in calculations
- [ ] All parameters use branded types
- [ ] All returns use branded types
- [ ] Business rules encoded as calculations

### Actions Layer
- [ ] All side effects wrapped in Effect
- [ ] Repositories built through function composition
- [ ] Types derived from implementations
- [ ] All Cypher parameters are typed
- [ ] Query results parsed immediately
- [ ] Option used for nullable values

### Service Architecture
- [ ] Services composed from smaller functions
- [ ] No interface-first design
- [ ] Clear layer separation (Client → Repository → Service)
- [ ] Each layer only depends on layers below
- [ ] No circular dependencies
- [ ] Dependencies explicit in Layer.provide()

### Error Handling
- [ ] All errors use TaggedError
- [ ] Error types contain branded properties
- [ ] Errors handled at appropriate layer
- [ ] No throwing exceptions
- [ ] All failures explicit in Effect types

## Testing Checklist

### Test Coverage
- [ ] At least 1 happy path test per feature
- [ ] At least 1 failure case test per feature (e.g., user not found)
- [ ] At least 1 edge case test per feature (e.g., empty list, zero value)
- [ ] All test data uses proper type construction (no raw primitives)

### Test Implementation
- [ ] Test layers created for repositories and external services
- [ ] Unit tests for all pure calculations
- [ ] Effect programs tested with `Effect.runPromise` or `Effect.runPromiseExit`
- [ ] Test implementations are type-safe and use mocked services

## Observability & Security Checklist

### Tracing & Logging
- [ ] All public-facing service methods have a `Effect.withSpan()` wrapper
- [ ] Spans are named consistently (e.g., `ServiceName.methodName`)
- [ ] Important contextual data is added via `Effect.annotateCurrentSpan()`
- [ ] Sensitive data is redacted from logs and spans

### Security
- [ ] All external input is validated with `Schema` at the boundary
- [ ] SQL/Cypher queries are parameterized; no string interpolation with user input
- [ ] Authorization logic is applied in the service layer before executing actions
- [ ] Sensitive data in models is wrapped with `Schema.Redacted` or equivalent

## Code Quality Checklist

### Type Safety
- [ ] No `as` type assertions
- [ ] No `any` type usage
- [ ] No untyped `unknown` in domain logic
- [ ] All external data parsed at boundaries
- [ ] No type errors or warnings

### Best Practices
- [ ] Parse, don't validate (transform once)
- [ ] Composition over inheritance
- [ ] Functions as values
- [ ] Small, focused functions
- [ ] Clear separation of concerns

### Documentation
- [ ] Complex logic has comments
- [ ] Public APIs documented
- [ ] README updated with new features
- [ ] Environment variables documented

## Pre-Commit Checklist

- [ ] Run `pnpm run preflight`
- [ ] All tests passing
- [ ] No type errors
- [ ] No lint warnings
- [ ] Code follows all patterns above
- [ ] Changes committed with descriptive message

## Common Violations to Check

- [ ] No Model.Class usage anywhere
- [ ] No raw string IDs passed to functions
- [ ] No calculations returning Effect
- [ ] No parsing in service/business logic
- [ ] No interface-first service definitions
- [ ] No primitive obsession
- [ ] No missing error handling
- [ ] No untested code paths

## Final Verification

Count of violations found: ___

If count > 0, fix all violations before proceeding.