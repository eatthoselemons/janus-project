# Using Effect to Follow Eric Normand's "Data, Calculations, Actions" Paradigm

This guide shows how to use Effect to implement Eric Normand's paradigm from "Grokking Simplicity", demonstrating how Effect's type system naturally enforces the separation between Data, Calculations, and Actions.

## Overview of the Paradigm

Eric Normand's paradigm categorizes code into three types:

- **DATA**: Values that don't change (immutable data structures)
- **CALCULATIONS**: Pure functions that transform data (no side effects)
- **ACTIONS**: Functions that interact with the world (side effects)

Effect's type system makes this separation explicit and enforced at compile time.

## 1. DATA: Modeling Pure, Immutable Data

### Using Schema for Data Definition

Effect's Schema system is perfect for modeling pure data with validation:

```typescript
import { Schema } from "@effect/schema"

// Branded types for type safety
export const UserId = Schema.Number.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export const Email = Schema.String.pipe(
  Schema.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  Schema.brand("Email")
)
export type Email = typeof Email.Type

// Complex data structures
export const User = Schema.Struct({
  id: UserId,
  email: Email,
  name: Schema.NonEmptyTrimmedString,
  age: Schema.Number.pipe(Schema.int(), Schema.positive()),
  createdAt: Schema.DateTimeUtc
})
export type User = typeof User.Type
```

### Using Model Classes for SQL Database Data

For SQL database models specifically, use Effect's Model system. IMPORTANT: Model.Class is ONLY for SQL databases (PostgreSQL, MySQL, SQLite). For graph databases like Neo4j, use Schema.Struct or Schema.Class instead:

```typescript
import { Model } from "@effect/sql"

// SQL-specific model with auto-generated fields
export class User extends Model.Class<User>("User")({
  id: Model.Generated(UserId),  // SQL auto-increment
  email: Email,
  name: Schema.NonEmptyTrimmedString,
  age: Schema.Number.pipe(Schema.int(), Schema.positive()),
  createdAt: Model.DateTimeInsert,  // SQL timestamp
  updatedAt: Model.DateTimeUpdate   // SQL timestamp
}) {}

// Compose models by extending
export class UserWithProfile extends Model.Class<UserWithProfile>("UserWithProfile")({
  ...Model.fields(User),
  profile: Profile,
  preferences: UserPreferences
}) {}
```

### Using Schema for Non-SQL Database Data (Neo4j, MongoDB, etc.)

For graph databases, document databases, or any non-SQL storage:

```typescript
// Neo4j node schema
export const UserNode = Schema.Struct({
  id: Schema.String,  // Neo4j uses string IDs
  email: Email,
  name: Schema.NonEmptyTrimmedString,
  age: Schema.Number.pipe(Schema.int(), Schema.positive()),
  createdAt: Schema.DateTimeUtc,
  labels: Schema.Array(Schema.String)
})

// MongoDB document schema
export const UserDocument = Schema.Struct({
  _id: Schema.String,
  email: Email,
  name: Schema.NonEmptyTrimmedString,
  age: Schema.Number.pipe(Schema.int(), Schema.positive()),
  createdAt: Schema.DateTimeUtc,
  metadata: Schema.Record(Schema.String, Schema.Unknown)
})
```

### Data Composition Patterns

```typescript
// Option types for nullable data
export const OptionalAddress = Schema.optional(Address)

// Union types for variants
export const UserStatus = Schema.Literal("active", "inactive", "suspended")

// Nested data structures
export const UserProfile = Schema.Struct({
  user: User,
  address: OptionalAddress,
  status: UserStatus,
  metadata: Schema.Record(Schema.String, Schema.JsonValue)
})
```

## 2. CALCULATIONS: Pure Functions and Transformations

### Schema Transformations (Pure Calculations)

```typescript
// Pure data transformations
export const UserIdFromString = Schema.NumberFromString.pipe(
  Schema.compose(UserId)
)

export const EmailFromString = Schema.String.pipe(
  Schema.compose(Email)
)

// Complex transformations
export const UserFromJson = Schema.Struct({
  id: Schema.NumberFromString.pipe(Schema.compose(UserId)),
  email: Schema.String.pipe(Schema.compose(Email)),
  name: Schema.NonEmptyTrimmedString,
  age: Schema.NumberFromString.pipe(Schema.int(), Schema.positive())
})
```

### Business Logic as Pure Functions

```typescript
import { pipe } from "effect"

// Pure calculation: determine user eligibility
export const isEligibleForDiscount = (user: User): boolean => {
  return user.age >= 65 || user.email.includes("student")
}

// Pure calculation: calculate discount amount
export const calculateDiscount = (amount: number, user: User): number => {
  if (!isEligibleForDiscount(user)) return 0
  return user.age >= 65 ? amount * 0.15 : amount * 0.10
}

// Pure calculation: transform user data
export const formatUserDisplay = (user: User): string => {
  return `${user.name} (${user.email})`
}

// Pure calculation: compose data
export const enrichUserWithDiscount = (user: User, purchaseAmount: number) => ({
  ...user,
  eligibleForDiscount: isEligibleForDiscount(user),
  discountAmount: calculateDiscount(purchaseAmount, user)
})
```

### Validation as Pure Calculations

```typescript
// Pure validation functions
export const validateAge = (age: number): boolean => age >= 0 && age <= 150

export const validateEmail = (email: string): boolean => 
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)

// Compose validations
export const validateUser = (userData: unknown): Effect.Effect<User, Schema.ParseError> =>
  Schema.decodeUnknown(User)(userData)
```

### Policy Logic as Pure Calculations

```typescript
// Pure authorization logic
export const canUpdateUser = (actor: User, target: User): boolean => {
  return actor.id === target.id || actor.role === "admin"
}

export const canViewSensitiveData = (actor: User): boolean => {
  return actor.role === "admin" || actor.permissions.includes("view_sensitive")
}

// Compose policies
export const hasPermission = (actor: User, action: string, resource: string): boolean => {
  const permission = `${action}:${resource}`
  return actor.permissions.includes(permission) || actor.role === "admin"
}
```

## 3. ACTIONS: Side Effects with the Effect System

### Database Actions

For SQL databases using @effect/sql:

```typescript
import { Effect, Context } from "effect"
import { SqlClient } from "@effect/sql"

// SQL Repository with Model.Class
export interface UserRepository {
  findById: (id: UserId) => Effect.Effect<Option.Option<User>, SqlError>
  create: (user: User) => Effect.Effect<User, SqlError>
  update: (id: UserId, user: Partial<User>) => Effect.Effect<User, SqlError>
  delete: (id: UserId) => Effect.Effect<void, SqlError>
}

export const UserRepository = Context.GenericTag<UserRepository>("UserRepository")

export const UserRepositoryLive = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const findById = (id: UserId): Effect.Effect<Option.Option<User>, SqlError> =>
    sql`SELECT * FROM users WHERE id = ${id}`.pipe(
      Effect.map(Schema.decodeUnknown(User)),
      Effect.map(Option.fromNullable),
      Effect.withSpan("UserRepository.findById")
    )

  const create = (user: User): Effect.Effect<User, SqlError> =>
    sql`INSERT INTO users ${sql.insert(user)} RETURNING *`.pipe(
      Effect.flatMap(Schema.decodeUnknown(User)),
      Effect.withSpan("UserRepository.create")
    )

  return { findById, create, update, delete } satisfies UserRepository
})
```

For Neo4j graph database:

```typescript
// Neo4j Repository with Schema.Struct
export interface UserNodeRepository {
  findById: (id: string) => Effect.Effect<Option.Option<UserNode>, Neo4jError>
  create: (user: UserNode) => Effect.Effect<UserNode, Neo4jError>
  createRelationship: (userId: string, targetId: string, type: string) => Effect.Effect<void, Neo4jError>
  findConnections: (id: string) => Effect.Effect<UserNode[], Neo4jError>
}

export const UserNodeRepository = Context.GenericTag<UserNodeRepository>("UserNodeRepository")

export const UserNodeRepositoryLive = Effect.gen(function* () {
  const neo4j = yield* Neo4jClient

  const findById = (id: string): Effect.Effect<Option.Option<UserNode>, Neo4jError> =>
    neo4j.query(`MATCH (u:User {id: $id}) RETURN u`, { id }).pipe(
      Effect.map(result => result.records[0]?.get('u')),
      Effect.map(Option.fromNullable),
      Effect.flatMap(Option.traverse(Schema.decodeUnknown(UserNode))),
      Effect.withSpan("UserNodeRepository.findById")
    )

  const create = (user: UserNode): Effect.Effect<UserNode, Neo4jError> =>
    neo4j.query(
      `CREATE (u:User $props) RETURN u`,
      { props: user }
    ).pipe(
      Effect.map(result => result.records[0].get('u')),
      Effect.flatMap(Schema.decodeUnknown(UserNode)),
      Effect.withSpan("UserNodeRepository.create")
    )

  const createRelationship = (userId: string, targetId: string, type: string) =>
    neo4j.query(
      `MATCH (a:User {id: $userId}), (b:User {id: $targetId})
       CREATE (a)-[r:${type} {createdAt: datetime()}]->(b)`,
      { userId, targetId }
    ).pipe(
      Effect.asVoid,
      Effect.withSpan("UserNodeRepository.createRelationship")
    )

  const findConnections = (id: string): Effect.Effect<UserNode[], Neo4jError> =>
    neo4j.query(
      `MATCH (u:User {id: $id})-[*1..2]-(connected:User)
       RETURN DISTINCT connected`,
      { id }
    ).pipe(
      Effect.map(result => result.records.map(r => r.get('connected'))),
      Effect.flatMap(Schema.decodeUnknown(Schema.Array(UserNode))),
      Effect.withSpan("UserNodeRepository.findConnections")
    )

  return { findById, create, createRelationship, findConnections } satisfies UserNodeRepository
})
```

### Service Actions (Business Logic + Side Effects)

```typescript
// Service interface
export interface UserService {
  getUserById: (id: UserId) => Effect.Effect<User, UserNotFound | SqlError>
  createUser: (userData: unknown) => Effect.Effect<User, ValidationError | SqlError>
  updateUser: (id: UserId, userData: unknown) => Effect.Effect<User, UserNotFound | ValidationError | SqlError>
}

export const UserService = Context.GenericTag<UserService>("UserService")

// Service implementation combining calculations and actions
export const UserServiceLive = Effect.gen(function* () {
  const repo = yield* UserRepository
  const logger = yield* Logger.Logger

  const getUserById = (id: UserId): Effect.Effect<User, UserNotFound | SqlError> =>
    repo.findById(id).pipe(
      Effect.flatMap(Option.match({
        onNone: () => Effect.fail(new UserNotFound({ id })),
        onSome: Effect.succeed
      })),
      Effect.tap(user => logger.info(`Retrieved user: ${user.id}`)),
      Effect.withSpan("UserService.getUserById")
    )

  const createUser = (userData: unknown): Effect.Effect<User, ValidationError | SqlError> =>
    Effect.gen(function* () {
      // CALCULATION: Validate and transform data
      const validatedUser = yield* Schema.decodeUnknown(User)(userData)
      
      // ACTION: Log the creation attempt
      yield* logger.info(`Creating user: ${validatedUser.email}`)
      
      // ACTION: Save to database
      const savedUser = yield* repo.create(validatedUser)
      
      // ACTION: Log success
      yield* logger.info(`User created successfully: ${savedUser.id}`)
      
      return savedUser
    }).pipe(Effect.withSpan("UserService.createUser"))

  return { getUserById, createUser, updateUser } satisfies UserService
})
```

### HTTP Actions

```typescript
import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"

// HTTP API definition
export class UserApi extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("getUser", "/users/:id")
      .addSuccess(User)
      .addError(UserNotFound)
  )
  .add(
    HttpApiEndpoint.post("createUser", "/users")
      .addSuccess(User)
      .addError(ValidationError)
  )
{}

// HTTP handlers (actions that coordinate service calls)
export const UserHttpLive = Effect.gen(function* () {
  const service = yield* UserService

  const getUser = (request: { params: { id: string } }) =>
    Effect.gen(function* () {
      // CALCULATION: Transform string to UserId
      const userId = yield* Schema.decodeUnknown(UserIdFromString)(request.params.id)
      
      // ACTION: Get user from service
      const user = yield* service.getUserById(userId)
      
      return user
    }).pipe(Effect.withSpan("UserHttp.getUser"))

  const createUser = (request: { body: unknown }) =>
    Effect.gen(function* () {
      // ACTION: Create user via service
      const user = yield* service.createUser(request.body)
      
      return user
    }).pipe(Effect.withSpan("UserHttp.createUser"))

  return { getUser, createUser }
})
```

## 4. Combining the Paradigm: Complete Example

Here's how to structure a complete feature following the paradigm:

```typescript
// ===== DATA LAYER =====
// Domain/User.ts
export const UserId = Schema.Number.pipe(Schema.brand("UserId"))
export const Email = Schema.String.pipe(Schema.compose(EmailBrand))

export class User extends Model.Class<User>("User")({
  id: Model.Generated(UserId),
  email: Email,
  name: Schema.NonEmptyTrimmedString,
  age: Schema.Number.pipe(Schema.int(), Schema.positive()),
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate
}) {}

// Domain/Errors.ts
export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: UserId }
) {}

// ===== CALCULATIONS LAYER =====
// Domain/UserCalculations.ts
export const isEligibleForDiscount = (user: User): boolean => 
  user.age >= 65

export const calculateUserDiscount = (user: User, amount: number): number =>
  isEligibleForDiscount(user) ? amount * 0.15 : 0

export const canUserAccessResource = (user: User, resource: string): boolean =>
  user.permissions.includes(resource) || user.role === "admin"

// ===== ACTIONS LAYER =====
// Infrastructure/UserRepository.ts
export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    
    return {
      findById: (id: UserId) => 
        sql`SELECT * FROM users WHERE id = ${id}`.pipe(
          Effect.flatMap(Schema.decodeUnknown(User)),
          Effect.withSpan("UserRepository.findById")
        ),
      
      create: (user: User) =>
        sql`INSERT INTO users ${sql.insert(user)} RETURNING *`.pipe(
          Effect.flatMap(Schema.decodeUnknown(User)),
          Effect.withSpan("UserRepository.create")
        )
    }
  })
)

// Services/UserService.ts
export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const repo = yield* UserRepository
    const logger = yield* Logger.Logger
    
    return {
      getUserWithDiscount: (id: UserId, purchaseAmount: number) =>
        repo.findById(id).pipe(
          Effect.flatMap(Option.match({
            onNone: () => Effect.fail(new UserNotFound({ id })),
            onSome: Effect.succeed
          })),
          // CALCULATION: Apply pure business logic
          Effect.map(user => ({
            ...user,
            discountAmount: calculateUserDiscount(user, purchaseAmount)
          })),
          Effect.tap(result => logger.info(`Applied discount: ${result.discountAmount}`))
        )
    }
  })
)
```

## 5. Testing the Paradigm

### Testing Data (Pure)
```typescript
// Test data structures directly
import { describe, it, expect } from "vitest"

describe("User Data", () => {
  it("should validate email format", () => {
    const validEmail = "user@example.com"
    const result = Schema.decodeUnknownSync(Email)(validEmail)
    expect(result).toBe(validEmail)
  })
})
```

### Testing Calculations (Pure)
```typescript
describe("User Calculations", () => {
  it("should calculate discount for eligible users", () => {
    const user = { age: 70, email: "senior@example.com" }
    const discount = calculateUserDiscount(user, 100)
    expect(discount).toBe(15)
  })
  
  it("should not give discount to ineligible users", () => {
    const user = { age: 30, email: "young@example.com" }
    const discount = calculateUserDiscount(user, 100)
    expect(discount).toBe(0)
  })
})
```

### Testing Actions (With Mocks)
```typescript
describe("User Service Actions", () => {
  it("should get user by id", async () => {
    const mockRepo = {
      findById: vi.fn().mockReturnValue(Effect.succeed(Option.some(mockUser)))
    }
    
    const program = UserService.getUserById(UserId(1)).pipe(
      Effect.provide(Layer.succeed(UserRepository, mockRepo))
    )
    
    const result = await Effect.runPromise(program)
    expect(result).toEqual(mockUser)
  })
})
```

## 6. Benefits of This Approach

### 1. **Clear Separation of Concerns**
- Data models are pure and immutable
- Business logic is testable without side effects
- Side effects are explicit and controlled

### 2. **Type Safety**
- Compile-time verification of data flow
- Impossible to accidentally mix pure and impure code
- Clear error types that compose

### 3. **Testability**
- Data: Test schemas and validation directly
- Calculations: Test pure functions with simple inputs/outputs
- Actions: Test with mocks and dependency injection

### 4. **Maintainability**
- Changes to data don't affect calculations
- Changes to calculations don't affect actions
- Clear boundaries make refactoring safe

### 5. **Composability**
- Pure functions compose naturally
- Effects compose through the Effect system
- Layers provide clean dependency management

## 7. Best Practices

1. **Keep Data Pure**: Use Schema for validation, avoid methods on data classes
2. **Make Calculations Explicit**: Pure functions should be obviously pure
3. **Isolate Actions**: Use Effect types for all side effects
4. **Test Each Layer**: Different testing strategies for each layer
5. **Use Type Safety**: Let the compiler prevent mixing concerns
6. **Document Boundaries**: Make it clear which layer each function belongs to

### Schema Selection Guidelines

**For SQL Databases (PostgreSQL, MySQL, SQLite):**
- Use `Model.Class` for entities with auto-generated IDs and timestamps
- Use `Model.makeRepository()` for CRUD operations
- Leverage SQL-specific features like `Model.Generated`, `Model.DateTimeInsert`

**For Graph Databases (Neo4j):**
- Use `Schema.Struct` for simple node/relationship data
- Use `Schema.Class` when nodes need methods
- Never use `Model.Class` - it's SQL-specific
- Handle IDs as strings (typical for graph databases)

**For Document Databases (MongoDB, DynamoDB):**
- Use `Schema.Struct` for document schemas
- Use `Schema.Class` for documents with behavior
- Never use `Model.Class`

**For HTTP APIs:**
- Always use `Schema.Struct` for request/response validation
- Keep API schemas separate from database schemas

This paradigm, enforced by Effect's type system, leads to more maintainable, testable, and reasoning-friendly code that naturally follows functional programming principles.