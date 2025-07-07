> **Audience:** LLM / AI Agent (Implementation & Reference)

# Effect Services and Layers Guide

This guide explains how to use Effect's Services and Layers system to structure applications following the "actions, calculations, and data" paradigm.

## Core Concepts

### Services = Actions (Side Effects)
Services represent operations that interact with the outside world. They are defined using `Context.Tag` and contain functions that return `Effect` types.

### Layers = Implementations
Layers provide concrete implementations of services. They enable dependency injection and make it easy to swap between live and test implementations.

### Pure Functions = Calculations
Business logic should be implemented as pure functions that operate on data, separate from services.

## Service Definition Pattern

```typescript
import { Context, Effect } from "effect"

// 1. Define the service interface
export interface UserService {
  findById: (id: string) => Effect.Effect<User, UserNotFoundError>
  create: (data: CreateUserData) => Effect.Effect<User, ValidationError>
  update: (id: string, data: UpdateUserData) => Effect.Effect<User, UserNotFoundError | ValidationError>
}

// 2. Create a Context.Tag for dependency injection
export const UserService = Context.Tag<UserService>("UserService")

// 3. Define error types
export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
  "UserNotFoundError",
  { userId: Schema.String }
) {}
```

## Layer Implementation Pattern

### Live Implementation

```typescript
export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    // Inject dependencies
    const db = yield* DatabaseClient
    const logger = yield* Logger
    
    return {
      findById: (id) =>
        Effect.gen(function* () {
          yield* logger.info(`Finding user ${id}`)
          const user = yield* db.query("SELECT * FROM users WHERE id = ?", [id])
          if (!user) {
            return yield* Effect.fail(new UserNotFoundError({ userId: id }))
          }
          return user
        }),
        
      create: (data) =>
        Effect.gen(function* () {
          const validated = yield* Schema.decodeUnknown(CreateUserSchema)(data)
          const user = yield* db.insert("users", validated)
          yield* logger.info(`Created user ${user.id}`)
          return user
        })
    }
  })
)
```

### Test Implementation

```typescript
export const UserServiceTest = Layer.succeed(UserService, {
  findById: (id) => 
    id === "123" 
      ? Effect.succeed(testUser)
      : Effect.fail(new UserNotFoundError({ userId: id })),
      
  create: (data) => 
    Effect.succeed({ ...testUser, ...data })
})
```

## Database Service Patterns

### For SQL Databases (PostgreSQL, MySQL, SQLite)

Use Model.Class with @effect/sql:

```typescript
import { Model } from "@effect/sql"

// Define SQL model with Model.Class
export class User extends Model.Class<User>("User")({
  id: Model.Generated(Schema.Number),
  email: Schema.String,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate
}) {}

// Repository using Model.makeRepository
export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Model.makeRepository(User, {
    tableName: "users",
    idColumn: "id"
  })
)
```

### For Neo4j/Graph Databases

Use Schema.Struct or Schema.Class (NOT Model.Class):

```typescript
// Define Neo4j node schema
export const UserNode = Schema.Struct({
  id: Schema.String,  // Neo4j uses string IDs
  email: Schema.String,
  name: Schema.String,
  labels: Schema.Array(Schema.String)
})

// Neo4j repository implementation
export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const neo4j = yield* Neo4jClient
    
    return {
      findById: (id: string) =>
        neo4j.run(`MATCH (u:User {id: $id}) RETURN u`, { id }).pipe(
          Effect.map(result => result.records[0]?.get('u')),
          Effect.flatMap(Schema.decodeUnknown(UserNode))
        ),
        
      createRelationship: (fromId: string, toId: string, type: string) =>
        neo4j.run(
          `MATCH (a {id: $fromId}), (b {id: $toId}) 
           CREATE (a)-[r:${type}]->(b)`,
          { fromId, toId }
        )
    }
  })
)
```

### For Document Databases (MongoDB, DynamoDB)

Use Schema.Struct or Schema.Class:

```typescript
export const UserDocument = Schema.Struct({
  _id: Schema.String,
  email: Schema.String,
  profile: Schema.Struct({
    name: Schema.String,
    avatar: Schema.optional(Schema.String)
  }),
  metadata: Schema.Record(Schema.String, Schema.Unknown)
})
```

## Composing Services and Layers

### Vertical Composition (Dependencies)

```typescript
// Bottom layer: Infrastructure
const DatabaseLive = Layer.succeed(DatabaseClient, dbConnection)

// Middle layer: Repositories (depend on database)
const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const db = yield* DatabaseClient
    // ... implementation
  })
).pipe(Layer.provide(DatabaseLive))

// Top layer: Services (depend on repositories)
const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const repo = yield* UserRepository
    const logger = yield* Logger
    // ... implementation
  })
).pipe(
  Layer.provide(UserRepositoryLive),
  Layer.provide(LoggerLive)
)
```

### Horizontal Composition (Parallel Services)

```typescript
const AppLive = Layer.mergeAll(
  UserServiceLive,
  PostServiceLive,
  CommentServiceLive
)
```

## Best Practices

### 1. Service Design
- Keep services focused on a single domain
- Return Effect types for all operations
- Use typed errors for failure cases
- Inject dependencies via Effect.gen

### 2. Layer Design
- Provide both live and test implementations
- Use Layer.provide to satisfy dependencies
- Keep infrastructure concerns in lower layers
- Business logic should be in higher layers

### 3. Error Handling
```typescript
export class DatabaseError extends Schema.TaggedError<DatabaseError>()(
  "DatabaseError",
  { message: Schema.String, code: Schema.String }
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError", 
  { field: Schema.String, message: Schema.String }
) {}

// Use union types for multiple errors
type ServiceError = DatabaseError | ValidationError | NotFoundError
```

### 4. Testing with Layers
```typescript
const testProgram = Effect.gen(function* () {
  const user = yield* UserService.findById("123")
  return user.name
})

// Run with test layer
const result = await Effect.runPromise(
  testProgram.pipe(Effect.provide(UserServiceTest))
)

// Run with live layer  
const result = await Effect.runPromise(
  testProgram.pipe(Effect.provide(UserServiceLive))
)
```

### 5. Schema Selection Guide

| Database Type | Use | Don't Use |
|--------------|-----|-----------|
| SQL (PostgreSQL, MySQL, SQLite) | Model.Class | Schema.Struct/Class |
| Neo4j/Graph | Schema.Struct or Schema.Class | Model.Class |
| MongoDB/Document | Schema.Struct or Schema.Class | Model.Class |
| Redis/KV Store | Schema.Struct | Model.Class |
| HTTP API | Schema.Struct | Model.Class |

## Common Patterns

### Repository Pattern
```typescript
export interface Repository<T, Id> {
  findById: (id: Id) => Effect.Effect<Option.Option<T>, DatabaseError>
  findAll: () => Effect.Effect<ReadonlyArray<T>, DatabaseError>
  create: (data: T) => Effect.Effect<T, DatabaseError>
  update: (id: Id, data: Partial<T>) => Effect.Effect<T, DatabaseError>
  delete: (id: Id) => Effect.Effect<void, DatabaseError>
}
```

### Service with Calculations
```typescript
// Pure calculation
const calculateDiscount = (user: User, amount: number): number => {
  if (user.loyaltyTier === "gold") return amount * 0.2
  if (user.loyaltyTier === "silver") return amount * 0.1
  return 0
}

// Service using calculation
export const OrderServiceLive = Layer.effect(
  OrderService,
  Effect.gen(function* () {
    const users = yield* UserService
    
    return {
      createOrder: (userId: string, items: CartItem[]) =>
        Effect.gen(function* () {
          const user = yield* users.findById(userId)
          const subtotal = items.reduce((sum, item) => sum + item.price, 0)
          const discount = calculateDiscount(user, subtotal)  // Pure calculation
          const total = subtotal - discount
          
          // ... create order with calculated total
        })
    }
  })
)
```

### Context Propagation
```typescript
export class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, User>() {}

export const AuthenticatedServiceLive = Layer.effect(
  AuthenticatedService,
  Effect.gen(function* () {
    return {
      getMyProfile: Effect.gen(function* () {
        const currentUser = yield* CurrentUser  // Access context
        return yield* UserService.findById(currentUser.id)
      })
    }
  })
)
```

## Summary

Services and Layers in Effect provide:
1. **Type-safe dependency injection** without frameworks
2. **Clear separation** between actions and calculations  
3. **Easy testing** through layer substitution
4. **Composable architecture** through vertical and horizontal composition
5. **Database agnostic patterns** with proper schema selection

Remember: Services are for actions (side effects), pure functions are for calculations, and schemas define your data.