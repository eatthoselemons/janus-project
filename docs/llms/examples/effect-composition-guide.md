# Effect Composition Guide: Types and Layers

This guide explains how Effect uses composition patterns for building scalable applications, with examples from the http-server project.

## Type Composition

Effect emphasizes type composition over inheritance, using several key patterns:

### 1. Model Class Composition

Models can be composed by extending and mixing fields:

```typescript
// Base model
export class User extends Model.Class<User>("User")({
  id: Model.Generated(UserId),
  accountId: Model.GeneratedByApp(AccountId),
  email: Email,
  accessToken: Model.Sensitive(AccessToken),
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate
}) {}

// Composed model that includes sensitive fields
export class UserWithSensitive extends Model.Class<UserWithSensitive>(
  "UserWithSensitive"
)({
  ...Model.fields(User),  // Compose existing fields
  accessToken: AccessToken,  // Override sensitive field
  account: Account  // Add new field
}) {}
```

### 2. Branded Types

Create type-safe identifiers that compose naturally:

```typescript
// Branded types for type safety
export const UserId = Schema.Number.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export const AccountId = Schema.Number.pipe(Schema.brand("AccountId"))
export type AccountId = typeof AccountId.Type

// Composed transformations
export const UserIdFromString = Schema.NumberFromString.pipe(
  Schema.compose(UserId)
)
```

### 3. Tagged Error Composition

Errors compose through tagged unions rather than inheritance:

```typescript
// Domain-specific errors
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

// Policy errors that compose with domain errors
export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {
    actorId: UserId,
    entity: Schema.String,
    action: Schema.String
  },
  HttpApiSchema.annotations({ status: 403 })
) {
  get message() {
    return `Actor (${this.actorId}) is not authorized to perform action "${this.action}" on entity "${this.entity}"`
  }
}
```

### 4. Context Tag Composition

Use Context Tags for dependency injection:

```typescript
// Context tags for type-safe dependency injection
export class CurrentUser extends Context.Tag("Domain/User/CurrentUser")<
  CurrentUser,
  User
>() {}

// Services can require multiple context tags
const requiresUserAndAccount = Effect.gen(function*() {
  const user = yield* CurrentUser
  const account = yield* CurrentAccount
  // Use both dependencies
})
```

## Layer Composition

Layers are Effect's primary composition mechanism for building applications:

### 1. Service Layer Definition

Services define their dependencies explicitly:

```typescript
export class Accounts extends Effect.Service<Accounts>()("Accounts", {
  effect: Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient
    const accountRepo = yield* AccountsRepo
    const userRepo = yield* UsersRepo
    const uuid = yield* Uuid

    return {
      createUser,
      updateUser,
      findUserByAccessToken,
      findUserById,
      embellishUser
    } as const
  }),
  dependencies: [
    SqlLive,
    AccountsRepo.Default,
    UsersRepo.Default,
    Uuid.Default
  ]
})
```

### 2. Repository Layer Composition

Repositories compose through the Model system:

```typescript
export class AccountsRepo extends Effect.Service<AccountsRepo>()(
  "Accounts/AccountsRepo",
  {
    effect: Model.makeRepository(Account, {
      tableName: "accounts",
      spanPrefix: "AccountsRepo",
      idColumn: "id"
    }),
    dependencies: [SqlLive]
  }
)

export class UsersRepo extends Effect.Service<UsersRepo>()(
  "Accounts/UsersRepo",
  {
    effect: Model.makeRepository(User, {
      tableName: "users",
      spanPrefix: "UsersRepo",
      idColumn: "id"
    }),
    dependencies: [SqlLive]
  }
)
```

### 3. API Layer Composition

APIs compose through HttpApi and HttpApiGroup:

```typescript
// Individual API groups
export class AccountsApi extends HttpApiGroup.make("accounts")
  .add(HttpApiEndpoint.patch("updateUser", "/users/:id")...)
  .add(HttpApiEndpoint.get("getUserMe", "/users/me")...)
  .add(HttpApiEndpoint.get("getUser", "/users/:id")...)
  .middlewareEndpoints(Authentication)
  .add(HttpApiEndpoint.post("createUser", "/users")...)
  .annotate(OpenApi.Title, "Accounts")
  .annotate(OpenApi.Description, "Manage user accounts")
{}

// Composed API
export class Api extends HttpApi.empty
  .add(AccountsApi)
  .add(GroupsApi)
  .add(PeopleApi)
  .annotate(OpenApi.Title, "Groups API")
{}
```

### 4. HTTP Layer Composition

HTTP layers compose services with middleware and infrastructure:

```typescript
// API layer that provides HTTP endpoints
const ApiLive = Layer.provide(HttpApiBuilder.api(Api), [
  HttpAccountsLive,
  HttpGroupsLive,
  HttpPeopleLive
])

// Full HTTP server layer
export const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(HttpApiBuilder.middlewareOpenApi()),
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(ApiLive),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)
```

### 5. Test Layer Composition

Testing layers compose through dependency replacement:

```typescript
// Test layer that replaces dependencies
static Test = this.DefaultWithoutDependencies.pipe(
  Layer.provideMerge(SqlTest),
  Layer.provideMerge(Uuid.Test)
)

// Test helper for creating mock services
export const makeTestLayer = <I, S extends object>(tag: Context.Tag<I, S>) => 
  (service: Partial<S>): Layer.Layer<I> =>
    Layer.succeed(tag, makeUnimplementedProxy(tag.key, service))

// Usage in tests
const testLayer = Layer.mergeAll(
  Accounts.Test,
  makeTestLayer(AccountsRepo)({
    findById: () => Effect.succeed(Option.none()),
    create: () => Effect.succeed(mockUser)
  })
)
```

## Composition Patterns

### 1. Vertical Composition (Dependency Chain)

```typescript
// Bottom layer: Database
SqlLive

// Middle layer: Repositories
AccountsRepo.Default (depends on SqlLive)
UsersRepo.Default (depends on SqlLive)

// Top layer: Services
Accounts.Default (depends on AccountsRepo, UsersRepo, SqlLive)
```

### 2. Horizontal Composition (Parallel Services)

```typescript
// Multiple services at the same level
const AppLive = Layer.mergeAll(
  Accounts.Default,
  Groups.Default,
  People.Default
)
```

### 3. Middleware Composition

```typescript
// Compose middleware layers
HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(HttpApiBuilder.middlewareOpenApi()),
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(ApiLive)
)
```

### 4. Policy Composition

```typescript
// Functional composition of policies
export const policyCompose = <Actor extends AuthorizedActor<any, any>, E, R>(
  that: Effect.Effect<Actor, E, R>
) =>
<Actor2 extends AuthorizedActor<any, any>, E2, R2>(
  self: Effect.Effect<Actor2, E2, R2>
): Effect.Effect<Actor | Actor2, E | Unauthorized, R | CurrentUser> => 
  Effect.zipRight(self, that) as any

// Usage
const authorizedEffect = policyRequire("User", "read")(
  getUserById(id)
).pipe(
  policyCompose(policyRequire("Account", "access")(getAccountById(accountId)))
)
```

## Benefits of Effect Composition

### 1. Type Safety
- Compile-time verification of dependencies
- No runtime surprises about missing services
- Clear error types that compose

### 2. Testability
- Easy to mock individual layers
- Isolated testing of components
- Dependency injection without frameworks

### 3. Modularity
- Services are self-contained with explicit dependencies
- Easy to swap implementations
- Clear boundaries between components

### 4. Scalability
- Add new services without changing existing ones
- Compose complex applications from simple parts
- Reusable layers across different applications

## Best Practices

1. **Keep layers focused** - Each layer should have a single responsibility
2. **Explicit dependencies** - Always declare what your service needs
3. **Use branded types** - Create type-safe domain models
4. **Compose errors** - Use tagged errors instead of inheritance
5. **Test with mocks** - Use test layers to replace dependencies
6. **Document composition** - Make layer relationships clear

This composition approach provides a robust foundation for building scalable, maintainable applications with Effect.