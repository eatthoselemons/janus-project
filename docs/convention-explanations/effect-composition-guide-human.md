# Effect Composition Guide: Types and Layers (Human Learning Edition)

This guide explains how Effect uses composition patterns for building scalable applications, with detailed explanations of why each pattern works and when to use it.

## Type Composition

Effect emphasizes type composition over inheritance, using several key patterns that provide better type safety and maintainability than traditional OOP approaches.

### 1. Model Class Composition

**Why this works:** Instead of creating deep inheritance hierarchies that become brittle over time, Effect allows you to compose models by mixing and matching fields. This gives you the flexibility of composition with the type safety of schemas.

```typescript
// Base model - this represents our core user data
// Notice how each field has validation built in (Model.Generated, Model.DateTimeInsert)
// This ensures data integrity at the type level
export class User extends Model.Class<User>("User")({
  id: Model.Generated(UserId),
  accountId: Model.GeneratedByApp(AccountId),
  email: Email,
  accessToken: Model.Sensitive(AccessToken),  // Sensitive fields are marked as such
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate
}) {}

// Composed model - we reuse the User fields but add and override specific ones
// This is better than inheritance because we're explicit about what we're changing
// and we don't inherit unwanted behavior or break the Liskov Substitution Principle
export class UserWithSensitive extends Model.Class<UserWithSensitive>(
  "UserWithSensitive"
)({
  ...Model.fields(User),  // Take all fields from User
  accessToken: AccessToken,  // Override: expose the sensitive field (not wrapped in Model.Sensitive)
  account: Account  // Add: include the full account object
}) {}
```

**When to use:** Use this pattern when you need different "views" of the same data for different contexts (e.g., public vs. internal API responses, database models vs. domain models).

### 2. Branded Types

**Why this works:** Branded types prevent "primitive obsession" - the anti-pattern where you use basic types like `number` or `string` for domain concepts. This catches bugs at compile time that would otherwise only be caught at runtime.

```typescript
// Without branded types, you could accidentally pass a UserId where an AccountId is expected
// With branded types, TypeScript prevents this mistake
export const UserId = Schema.Number.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export const AccountId = Schema.Number.pipe(Schema.brand("AccountId"))
export type AccountId = typeof AccountId.Type

// Composed transformations - these build on each other
// This transformation takes a string, converts it to a number, then brands it as a UserId
// The composition is explicit and type-safe
export const UserIdFromString = Schema.NumberFromString.pipe(
  Schema.compose(UserId)
)
```

**When to use:** Use branded types for any domain concept that has business meaning beyond its primitive representation (IDs, email addresses, currency amounts, etc.).

### 3. Tagged Error Composition

**Why this works:** Traditional exception hierarchies can become unwieldy and force you to catch exceptions you don't care about. Tagged errors compose naturally through union types, and you can handle exactly the errors you care about.

```typescript
// Each error is self-contained and carries exactly the information needed
// Notice how the HTTP status code is embedded in the error definition
export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: UserId },
  HttpApiSchema.annotations({ status: 404 })
) {}

export class GroupNotFound extends Schema.TaggedError<GroupNotFound>()(
  "GroupNotFound",
  { id: GroupId },
  HttpApiSchema.annotations({ status: 404 })
) {}

// Policy errors compose with domain errors - the type system knows about all possible errors
export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {
    actorId: UserId,
    entity: Schema.String,
    action: Schema.String
  },
  HttpApiSchema.annotations({ status: 403 })
) {
  // Custom message logic can be added to individual error types
  get message() {
    return `Actor (${this.actorId}) is not authorized to perform action "${this.action}" on entity "${this.entity}"`
  }
}
```

**When to use:** Use tagged errors for all domain-specific error conditions. They compose better than exceptions and provide better type information.

### 4. Context Tag Composition

**Why this works:** Context tags provide type-safe dependency injection without the complexity of DI containers. The type system ensures you never forget to provide a required dependency.

```typescript
// Context tags make dependencies explicit in the type system
// This is better than global singletons or implicit dependencies
export class CurrentUser extends Context.Tag("Domain/User/CurrentUser")<
  CurrentUser,
  User
>() {}

// When you use multiple context tags, the type system tracks all dependencies
// This function requires both CurrentUser and CurrentAccount to be provided
const requiresUserAndAccount = Effect.gen(function*() {
  const user = yield* CurrentUser      // Type: User
  const account = yield* CurrentAccount // Type: Account
  // TypeScript knows exactly what dependencies this function needs
  return { user, account }
})
```

**When to use:** Use context tags for any data that needs to be passed through multiple layers of your application (current user, request context, configuration, etc.).

## Layer Composition

Layers are Effect's primary composition mechanism. They solve the problem of dependency management in a type-safe way.

### 1. Service Layer Definition

**Why this works:** Services explicitly declare their dependencies, making the dependency graph visible and preventing circular dependencies. The type system ensures all dependencies are satisfied.

```typescript
// This service declaration tells you everything you need to know:
// 1. What it provides (Accounts service)
// 2. What it depends on (SqlClient, AccountsRepo, UsersRepo, Uuid)
// 3. How to construct it (the Effect.gen function)
export class Accounts extends Effect.Service<Accounts>()("Accounts", {
  effect: Effect.gen(function*() {
    // These yield* statements make dependencies explicit
    const sql = yield* SqlClient.SqlClient
    const accountRepo = yield* AccountsRepo
    const userRepo = yield* UsersRepo
    const uuid = yield* Uuid

    // The service implementation is just pure functions that use the dependencies
    return {
      createUser,
      updateUser,
      findUserByAccessToken,
      findUserById,
      embellishUser
    } as const
  }),
  // Dependencies are listed explicitly - no hidden global state
  dependencies: [
    SqlLive,
    AccountsRepo.Default,
    UsersRepo.Default,
    Uuid.Default
  ]
})
```

**When to use:** Use this pattern for any business logic that coordinates multiple repositories or external services.

### 2. Repository Layer Composition

**Why this works:** Repositories are a thin layer over the database that provides a clean domain interface. They compose naturally because they share the same underlying SQL connection.

```typescript
// Repository pattern with Effect - notice how it's built on top of the Model system
// This gives you all the benefits of the repository pattern with minimal boilerplate
export class AccountsRepo extends Effect.Service<AccountsRepo>()(
  "Accounts/AccountsRepo",
  {
    // Model.makeRepository generates standard CRUD operations
    effect: Model.makeRepository(Account, {
      tableName: "accounts",
      spanPrefix: "AccountsRepo",  // For observability
      idColumn: "id"
    }),
    dependencies: [SqlLive]  // Only depends on the database connection
  }
)
```

**When to use:** Use repositories for data access patterns. They provide a clean boundary between your domain logic and database concerns.

### 3. API Layer Composition

**Why this works:** APIs compose naturally because HTTP is inherently compositional. Each endpoint is independent, and you can group related endpoints together.

```typescript
// Individual API groups represent bounded contexts
// This follows domain-driven design principles
export class AccountsApi extends HttpApiGroup.make("accounts")
  .add(HttpApiEndpoint.patch("updateUser", "/users/:id")...)
  .add(HttpApiEndpoint.get("getUserMe", "/users/me")...)
  .add(HttpApiEndpoint.get("getUser", "/users/:id")...)
  .middlewareEndpoints(Authentication)  // Middleware applies to specific endpoints
  .add(HttpApiEndpoint.post("createUser", "/users")...)  // This endpoint doesn't have auth
  .annotate(OpenApi.Title, "Accounts")
  .annotate(OpenApi.Description, "Manage user accounts")
{}

// The main API is composed of smaller API groups
// This keeps related functionality together while allowing independent evolution
export class Api extends HttpApi.empty
  .add(AccountsApi)
  .add(GroupsApi)
  .add(PeopleApi)
  .annotate(OpenApi.Title, "Groups API")
{}
```

**When to use:** Use API groups to organize related endpoints. Compose them into a main API for the entire application.

### 4. HTTP Layer Composition

**Why this works:** HTTP layers compose middleware, routing, and infrastructure concerns. Each layer has a single responsibility and can be tested independently.

```typescript
// API layer - pure business logic, no infrastructure concerns
const ApiLive = Layer.provide(HttpApiBuilder.api(Api), [
  HttpAccountsLive,
  HttpGroupsLive,
  HttpPeopleLive
])

// Full HTTP server layer - this is where infrastructure concerns are handled
// Notice how concerns are separated: logging, documentation, CORS, etc.
export const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),      // Documentation
  Layer.provide(HttpApiBuilder.middlewareOpenApi()), // OpenAPI spec
  Layer.provide(HttpApiBuilder.middlewareCors()),    // CORS handling
  Layer.provide(ApiLive),                     // Business logic
  HttpServer.withLogAddress,                  // Logging
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })) // Server
)
```

**When to use:** Use this pattern to separate infrastructure concerns from business logic. Each layer can be tested and configured independently.

### 5. Test Layer Composition

**Why this works:** Test layers replace production dependencies with mocks or test doubles. This allows you to test business logic without hitting real databases or external services.

```typescript
// Test layer replaces production dependencies
// This is better than mocking because the type system ensures consistency
static Test = this.DefaultWithoutDependencies.pipe(
  Layer.provideMerge(SqlTest),    // Use in-memory SQLite for testing
  Layer.provideMerge(Uuid.Test)   // Use predictable UUIDs for testing
)

// Test helper makes it easy to create partial mocks
// You only need to implement the methods your test uses
export const makeTestLayer = <I, S extends object>(tag: Context.Tag<I, S>) => 
  (service: Partial<S>): Layer.Layer<I> =>
    Layer.succeed(tag, makeUnimplementedProxy(tag.key, service))

// Usage in tests - you can override specific methods for each test
const testLayer = Layer.mergeAll(
  Accounts.Test,
  makeTestLayer(AccountsRepo)({
    findById: () => Effect.succeed(Option.none()),  // This user doesn't exist
    create: () => Effect.succeed(mockUser)          // Always returns the same user
  })
)
```

**When to use:** Use test layers to isolate the code under test. Replace expensive operations (database, network) with fast, predictable alternatives.

## Composition Patterns

### 1. Vertical Composition (Dependency Chain)

**Why this works:** Vertical composition creates a clear dependency hierarchy. Higher-level services depend on lower-level services, preventing circular dependencies and making the system easier to understand.

```typescript
// Clear dependency chain from bottom to top
// Each layer only depends on the layer below it
// This makes the system predictable and testable

// Bottom layer: Database connection
SqlLive

// Middle layer: Data access (depends on SqlLive)
AccountsRepo.Default
UsersRepo.Default

// Top layer: Business logic (depends on repositories and database)
Accounts.Default
```

**When to use:** Use vertical composition to create clear architectural layers. Each layer should have a single responsibility.

### 2. Horizontal Composition (Parallel Services)

**Why this works:** Horizontal composition allows you to develop features independently while still being able to combine them. Services at the same layer don't depend on each other.

```typescript
// Multiple services at the same architectural layer
// They can be developed, tested, and deployed independently
const AppLive = Layer.mergeAll(
  Accounts.Default,  // User management
  Groups.Default,    // Group management
  People.Default     // Person management
)
```

**When to use:** Use horizontal composition for features that are logically separate but need to work together in the same application.

### 3. Middleware Composition

**Why this works:** Middleware composition follows the decorator pattern, allowing you to add cross-cutting concerns (logging, authentication, etc.) without modifying core business logic.

```typescript
// Each middleware layer adds one concern
// The order matters - logging should be outermost to catch all requests
HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),           // Add documentation
  Layer.provide(HttpApiBuilder.middlewareOpenApi()), // Add OpenAPI
  Layer.provide(HttpApiBuilder.middlewareCors()),    // Add CORS
  Layer.provide(ApiLive)                           // Add business logic
)
```

**When to use:** Use middleware composition for cross-cutting concerns that apply to multiple endpoints.

### 4. Policy Composition

**Why this works:** Policy composition allows you to build complex authorization rules from simple, reusable policies. Each policy can be tested independently.

```typescript
// Functional composition of policies
// Each policy is a pure function that can be combined with others
export const policyCompose = <Actor extends AuthorizedActor<any, any>, E, R>(
  that: Effect.Effect<Actor, E, R>
) =>
<Actor2 extends AuthorizedActor<any, any>, E2, R2>(
  self: Effect.Effect<Actor2, E2, R2>
): Effect.Effect<Actor | Actor2, E | Unauthorized, R | CurrentUser> => 
  Effect.zipRight(self, that) as any

// Usage - combine simple policies into complex authorization rules
const authorizedEffect = policyRequire("User", "read")(
  getUserById(id)
).pipe(
  policyCompose(policyRequire("Account", "access")(getAccountById(accountId)))
)
```

**When to use:** Use policy composition for authorization logic that needs to be flexible and reusable across different parts of your application.


## Benefits of Effect Composition

### 1. Type Safety
**Why it matters:** Compile-time verification prevents entire classes of runtime errors. You can't accidentally pass the wrong type or forget to provide a required dependency.

### 2. Testability
**Why it matters:** Each layer can be tested independently. You can test business logic without databases, and test data access without business logic.

### 3. Modularity
**Why it matters:** Services are self-contained with explicit dependencies. You can understand each service in isolation and change implementations without affecting other parts of the system.

### 4. Scalability
**Why it matters:** New features can be added without changing existing code. The composition patterns prevent the tight coupling that makes large systems hard to maintain.

This composition approach provides a robust foundation for building scalable, maintainable applications with Effect, while keeping the code understandable and testable.