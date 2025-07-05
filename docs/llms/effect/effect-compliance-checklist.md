# Effect & Normand Paradigm Compliance Checklist

Use this checklist to ensure your Effect code follows best practices and Eric Normand's "Data, Calculations, Actions" paradigm.

## 🔍 Pre-Implementation Check

### Data Layer Verification
- [ ] **Branded Types**: Use `Schema.brand()` for domain identifiers (UserId, Email, etc.)
- [ ] **Schema Validation**: All external data uses `Schema.Struct()` with proper validation
- [ ] **Immutable Models**: Use `Model.Class` for domain entities with proper field types
- [ ] **Tagged Errors**: Use `Schema.TaggedError` for domain-specific errors
- [ ] **Sensitive Data**: Use `Model.Sensitive()` or `Schema.Redacted()` for passwords, tokens, etc.
- [ ] **No Behavior in Data**: Data classes contain only structure, no methods or logic

### Calculations Layer Verification
- [ ] **Pure Functions**: All business logic functions are pure (no side effects)
- [ ] **Type Transformations**: Use `Schema.compose()` and `pipe()` for data transformations
- [ ] **Validation Logic**: Separate validation functions that return boolean or Effect
- [ ] **Policy Logic**: Authorization decisions are pure functions that return boolean
- [ ] **Composition**: Complex calculations built from simple, composable functions
- [ ] **No Effect Types**: Business logic functions don't return `Effect` types

### Actions Layer Verification
- [ ] **Effect Wrapping**: All side effects wrapped in appropriate Effect constructors
- [ ] **Explicit Dependencies**: Layers declare dependencies in the `dependencies` array
- [ ] **Dependencies In Layers**: All depenencies should be in the Layers, not Services]
- [ ] **Context Tags**: Use `Context.Tag` for dependency injection
- [ ] **Service Pattern**: Use `Effect.Service` for business logic that coordinates actions
- [ ] **External Dependencies**: Wrap external dependencies (databases, APIs, file system) with proper error handling
- [ ] **Resource Management**: Use `Effect.withSpan()` for observability

## 📋 Implementation Patterns

### Error Handling
- [ ] **Tagged Error Structure**:
  ```typescript
  export class EntityNotFound extends Schema.TaggedError<EntityNotFound>()(
    "EntityNotFound",
    { id: EntityId }
  ) {}
  ```
- [ ] **Error Refinement**: Use `Effect.catchIf()` for conditional error handling
- [ ] **Option Handling**: Use `Option.match()` for nullable data
- [ ] **Error Propagation**: Let errors bubble up through Effect chain
- [ ] **Defect Handling**: Use `Effect.orDie` for unrecoverable errors

### Service Implementation
- [ ] **Service Definition Pattern**:
  ```typescript
  export class EntityService extends Effect.Service<EntityService>()(
    "EntityService",
    {
      effect: Effect.gen(function*() {
        const externalDep = yield* ExternalDependency
        return { create, find, update, process } as const
      }),
      dependencies: [ExternalDependency.Default]
    }
  ) {}
  ```
- [ ] **Generator Functions**: Use `Effect.gen()` for sequential operations
- [ ] **Dependency Injection**: Yield dependencies with `yield*`
- [ ] **Return Const**: Use `as const` for service method objects

### External Dependencies
- [ ] **Dependency Wrapping**:
  ```typescript
  export class FileSystem extends Effect.Service<FileSystem>()(
    "FileSystem",
    {
      effect: Effect.gen(function*() {
        return {
          readFile: (path: string) => Effect.tryPromise(() => fs.readFile(path)),
          writeFile: (path: string, data: string) => Effect.tryPromise(() => fs.writeFile(path, data))
        } as const
      })
    }
  ) {}
  ```
- [ ] **External API Wrapping**: Wrap HTTP clients, databases, file systems in Effect services
- [ ] **Span Prefixes**: Include `spanPrefix` for observability
- [ ] **Resource Management**: Use appropriate resource management for external connections

### Layer Composition
- [ ] **Dependency Declaration**: Clear `dependencies` arrays in services
- [ ] **Layer Merging**: Use `Layer.mergeAll()` for parallel services
- [ ] **Layer Providing**: Use `Layer.provide()` for dependency chains
- [ ] **Test Layers**: Create `*.Test` layers for testing with mocks
- [ ] **Layer Hierarchy**: Follow bottom-up dependency structure

### External Interface Implementation (Optional)
- [ ] **HTTP API Structure** (if building web services):
  ```typescript
  export class EntityApi extends HttpApiGroup.make("entities")
    .add(HttpApiEndpoint.get("getEntity", "/entities/:id")
      .addSuccess(Entity)
      .addError(EntityNotFound)
    )
  {}
  ```
- [ ] **CLI Interface** (if building CLI tools): Use proper argument parsing and error handling
- [ ] **Event Handling** (if building event-driven systems): Use Effect's concurrency primitives
- [ ] **Message Processing** (if building message processors): Use Queue and PubSub patterns

### Persistence Operations (If Applicable)
- [ ] **Database Operations** (if using databases):
  ```typescript
  export default Effect.gen(function*() {
    const db = yield* DatabaseClient
    yield* db.execute(`CREATE TABLE IF NOT EXISTS entities (...)`)
  })
  ```
- [ ] **File Operations** (if using file system):
  ```typescript
  const saveToFile = (data: string) =>
    Effect.tryPromise(() => fs.writeFile(filePath, data))
  ```
- [ ] **Transaction Scoping**: Use appropriate atomic operations for your persistence layer
- [ ] **Error Handling**: Transform external errors to domain errors
- [ ] **Input Sanitization**: Validate and sanitize all external input

## 🧪 Testing Patterns

### Test Structure
- [ ] **Effect Tests**: Use `it.effect()` for Effect-based tests
- [ ] **Test Layers**: Create mock layers with `makeTestLayer()`
- [ ] **Deterministic Data**: Use predictable test data (fixed UUIDs, timestamps)
- [ ] **Layer Isolation**: Each test gets fresh layer instances
- [ ] **Mock Services**: Mock only the services needed for each test

### Test Layer Pattern
- [ ] **Mock Implementation**:
  ```typescript
  const testLayer = makeTestLayer(ExternalService)({
    fetch: (id: EntityId) => Effect.succeed(Option.some(mockEntity)),
    save: (entity: Entity) => Effect.succeed(entity)
  })
  ```
- [ ] **Partial Mocks**: Only implement methods used in the test
- [ ] **Predictable Responses**: Use fixed responses for consistent tests

## 🔧 Observability

### Tracing
- [ ] **Span Creation**: Use `Effect.withSpan()` for all service operations
- [ ] **Span Attributes**: Include relevant data in span attributes
- [ ] **Span Naming**: Use consistent naming convention (Service.operation)
- [ ] **Current Span**: Use `Effect.annotateCurrentSpan()` for additional context

### Configuration
- [ ] **Environment Variables**: Use `Config.string()`, `Config.redacted()` for secrets
- [ ] **Default Values**: Use `Config.withDefault()` for optional config
- [ ] **Conditional Layers**: Support different environments with conditional layer construction

## 🚀 Performance & Concurrency

### Concurrency Patterns
- [ ] **Structured Concurrency**: Use Effect's built-in concurrency primitives
- [ ] **Parallel Operations**: Use `Effect.all()` for independent operations
- [ ] **Resource Safety**: Ensure proper resource cleanup with scopes
- [ ] **Fiber Management**: Let Effect manage fiber lifecycle automatically

### Resource Management
- [ ] **Scope Management**: Use `Effect.scoped()` for resource-bound operations
- [ ] **Finalizers**: Add cleanup logic with `Effect.addFinalizer()`
- [ ] **Connection Pooling**: Use appropriate connection pool configurations
- [ ] **Memory Management**: Avoid memory leaks with proper resource disposal

## 🔒 Security

### Data Protection
- [ ] **Sensitive Data**: Use `Model.Sensitive()` or `Schema.Redacted()` for secrets
- [ ] **Input Validation**: Validate all external input with Schema
- [ ] **Injection Prevention**: Use parameterized queries/commands, never string concatenation
- [ ] **Authorization**: Implement proper authorization checks for sensitive operations

### Authorization (If Applicable)
- [ ] **Policy-based Auth**: Use policy functions for authorization decisions
- [ ] **Context Propagation**: Pass security context through `Context.Tag`
- [ ] **Privileged Operations**: Clearly mark and handle privileged operations
- [ ] **Credential Management**: Properly handle and store credentials/tokens

## 📊 Code Quality

### Type Safety
- [ ] **Strong Typing**: Use branded types for domain concepts
- [ ] **Error Types**: All possible errors are represented in Effect types
- [ ] **Type Composition**: Build complex types from simple ones
- [ ] **Schema Evolution**: Handle schema changes gracefully

### Code Organization
- [ ] **Layer Separation**: Clear separation between data, calculations, and actions
- [ ] **Single Responsibility**: Each service has a focused purpose
- [ ] **Dependency Direction**: Dependencies flow from high-level to low-level
- [ ] **Domain Boundaries**: Clear boundaries between different business domains

## ✅ Final Verification

Before submitting code, verify:
- [ ] All data structures are immutable and validated
- [ ] All business logic is pure and testable
- [ ] All side effects are wrapped in Effect types
- [ ] All dependencies are explicitly declared
- [ ] All errors are properly typed and handled
- [ ] All resources are properly managed
- [ ] All operations include proper observability
- [ ] All new code should have unit tests:
  - Include at least:
    - [ ] 1 test for expected use
    - [ ] 1 edge case
    - [ ] 1 failure case
- [ ] All tests pass and cover edge cases
- [ ] Code follows consistent naming conventions
- [ ] Documentation is complete and accurate

## 🔍 Common Anti-Patterns to Avoid

### Data Layer Anti-Patterns
- ❌ Mutable data structures
- ❌ Data classes with business logic methods
- ❌ Primitive obsession (using string/number instead of branded types)
- ❌ Missing validation on external data

### Calculations Layer Anti-Patterns
- ❌ Side effects in business logic functions
- ❌ Returning Effect types from pure calculations
- ❌ Mixing I/O operations with business logic
- ❌ Implicit dependencies (global state access)

### Actions Layer Anti-Patterns
- ❌ Bare promises or async/await (use Effect.promise/tryPromise)
- ❌ Unhandled exceptions (use proper Effect error handling)
- ❌ Missing resource cleanup
- ❌ Implicit dependencies (not declared in service definition)

### Architecture Anti-Patterns
- ❌ Circular dependencies between services
- ❌ Tight coupling between layers
- ❌ Missing abstraction layers (direct external access from business logic)
- ❌ Inconsistent error handling patterns

This checklist ensures your Effect code is maintainable, testable, and follows functional programming best practices while adhering to Eric Normand's paradigm.