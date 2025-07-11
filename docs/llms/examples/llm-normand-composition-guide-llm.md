> **Audience:** LLM / AI Agent (Quick Reference)

# Effect LLM Guide: Normand Paradigm & Composition Patterns

Quick reference for implementing Effect features following "Data, Calculations, Actions" paradigm with proper composition patterns.

## Core Principles

1. **Data**: Pure, immutable structures with Schema validation
2. **Calculations**: Pure functions with no side effects
3. **Actions**: Side effects isolated in Effect system
4. **Composition**: Services compose through layers and dependency injection

## Data Layer Patterns

```typescript
// Branded types for type safety
export const UserId = Schema.Number.pipe(Schema.brand("UserId"))
export const Email = Schema.String.pipe(
  Schema.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  Schema.brand("Email")
)

// Domain models
export class User extends Model.Class<User>("User")({
  id: Model.Generated(UserId),
  email: Email,
  name: Schema.NonEmptyTrimmedString,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate
}) {}

// Model composition
export class UserWithProfile extends Model.Class<UserWithProfile>("UserWithProfile")({
  ...Model.fields(User),
  profile: Profile,
  account: Account
}) {}

// Tagged errors
export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: UserId },
  HttpApiSchema.annotations({ status: 404 })
) {}
```

## Calculations Layer Patterns

```typescript
// Pure transformations
export const UserIdFromString = Schema.NumberFromString.pipe(
  Schema.compose(UserId)
)

// Pure business logic
export const isEligibleForDiscount = (user: User): boolean => 
  user.age >= 65 || user.email.includes("student")

export const calculateDiscount = (amount: number, user: User): number => {
  if (!isEligibleForDiscount(user)) return 0
  return user.age >= 65 ? amount * 0.15 : amount * 0.10
}

// Pure data composition
export const enrichUserWithDiscount = (user: User, amount: number) => ({
  ...user,
  eligibleForDiscount: isEligibleForDiscount(user),
  discountAmount: calculateDiscount(amount, user)
})

// Policy calculations
export const canUpdateUser = (actor: User, target: User): boolean => {
  return actor.id === target.id || actor.role === "admin"
}
```

## Actions Layer Patterns

### Repository Pattern
```typescript
export class UserRepository extends Effect.Service<UserRepository>()(
  "UserRepository",
  {
    effect: Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient
      
      const findById = (id: UserId) =>
        sql`SELECT * FROM users WHERE id = ${id}`.pipe(
          Effect.flatMap(Schema.decodeUnknown(User)),
          Effect.withSpan("UserRepository.findById")
        )
      
      return { findById, create, update, delete } as const
    }),
    dependencies: [SqlLive]
  }
)
```

### Service Pattern
```typescript
export class UserService extends Effect.Service<UserService>()(
  "UserService",
  {
    effect: Effect.gen(function*() {
      const repo = yield* UserRepository
      const logger = yield* Logger.Logger
      
      const getUserById = (id: UserId) =>
        repo.findById(id).pipe(
          Effect.flatMap(Option.match({
            onNone: () => Effect.fail(new UserNotFound({ id })),
            onSome: Effect.succeed
          })),
          Effect.tap(user => logger.info(`Retrieved user: ${user.id}`)),
          Effect.withSpan("UserService.getUserById")
        )
      
      return { getUserById, createUser, updateUser } as const
    }),
    dependencies: [UserRepository.Default, Logger.Default]
  }
)
```

## Composition Patterns

### Layer Composition
```typescript
// Vertical composition (dependency chain)
const AppLive = UserService.Default.pipe(
  Layer.provide(UserRepository.Default),
  Layer.provide(SqlLive),
  Layer.provide(Logger.Default)
)

// Horizontal composition (parallel services)
const ServicesLive = Layer.mergeAll(
  UserService.Default,
  GroupService.Default,
  ProductService.Default
)

// API composition
export class Api extends HttpApi.empty
  .add(UserApi)
  .add(GroupApi)
  .add(ProductApi)
  .annotate(OpenApi.Title, "Application API")
{}
```

### HTTP Layer Composition
```typescript
const ApiLive = Layer.provide(HttpApiBuilder.api(Api), [
  HttpUserLive,
  HttpGroupLive,
  HttpProductLive
])

export const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(HttpApiBuilder.middlewareOpenApi()),
  Layer.provide(ApiLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)
```

## Testing Patterns

### Test Layer Composition
```typescript
// Mock service layer
export const makeTestLayer = <I, S extends object>(tag: Context.Tag<I, S>) => 
  (service: Partial<S>): Layer.Layer<I> =>
    Layer.succeed(tag, makeUnimplementedProxy(tag.key, service))

// Test setup
const TestLive = Layer.mergeAll(
  UserService.Test,
  makeTestLayer(UserRepository)({
    findById: () => Effect.succeed(Option.some(mockUser)),
    create: () => Effect.succeed(mockUser)
  })
)
```

## Implementation Checklist

When implementing new features:

1. **Start with Data**: Define schemas and models first
2. **Add Calculations**: Write pure business logic functions
3. **Create Actions**: Implement repositories and services
4. **Compose Layers**: Wire dependencies through layers
5. **Add HTTP**: Create API endpoints and handlers
6. **Test Each Layer**: Unit tests for calculations, integration tests for actions

## Common Patterns

- Use `Effect.gen` for sequential operations
- Use `Effect.all` for parallel operations
- Use `pipe` for function composition
- Use `Effect.withSpan` for observability
- Use `Effect.tap` for side effects that don't change the value
- Use `Effect.flatMap` for chaining dependent operations
- Use `Layer.provide` for dependency injection

## Error Handling

```typescript
// Domain errors
export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  { message: Schema.String }
) {}

// Service error handling
const safeOperation = (id: UserId) =>
  repo.findById(id).pipe(
    Effect.flatMap(Option.match({
      onNone: () => Effect.fail(new UserNotFound({ id })),
      onSome: Effect.succeed
    })),
    Effect.catchTag("SqlError", (error) => 
      Effect.fail(new DatabaseError({ cause: error }))
    )
  )
```

This guide ensures consistency with Effect's patterns while maintaining clean separation of concerns according to Normand's paradigm.