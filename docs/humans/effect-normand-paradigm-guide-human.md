> **Audience:** Human Developers (Learning & Onboarding)

# Using Effect to Follow Eric Normand's "Data, Calculations, Actions" Paradigm (Human Learning Edition)

This guide shows how to use Effect to implement Eric Normand's paradigm from "Grokking Simplicity", with detailed explanations of why each pattern works and how it benefits your code.

## Overview of the Paradigm

Eric Normand's paradigm from "Grokking Simplicity" categorizes code into three types:

- **DATA**: Values that don't change (immutable data structures)
- **CALCULATIONS**: Pure functions that transform data (no side effects)
- **ACTIONS**: Functions that interact with the world (side effects)

**Why this matters:** This separation makes code easier to reason about, test, and maintain. Effect's type system enforces these boundaries, preventing you from accidentally mixing concerns.

## 1. DATA: Modeling Pure, Immutable Data

### Using Schema for Data Definition

**Why Schema is perfect for DATA:** Schema provides validation, transformation, and type safety all in one package. It ensures your data is always valid and provides clear error messages when it's not.

```typescript
import { Schema } from "@effect/schema"

// Branded types prevent primitive obsession
// This makes it impossible to accidentally pass a UserId where an AccountId is expected
export const UserId = Schema.Number.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

// Built-in validation ensures data integrity
// The pattern match happens at the type level, so invalid emails are caught early
export const Email = Schema.String.pipe(
  Schema.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  Schema.brand("Email")
)
export type Email = typeof Email.Type

// Complex data structures with validation
// Each field has its own validation rules, and the overall structure is type-safe
export const User = Schema.Struct({
  id: UserId,
  email: Email,
  name: Schema.NonEmptyTrimmedString,  // Automatically trims whitespace and validates non-empty
  age: Schema.Number.pipe(Schema.int(), Schema.positive()), // Must be positive integer
  createdAt: Schema.DateTimeUtc
})
export type User = typeof User.Type
```

**When to use:** Use Schema for any data that needs validation or transformation. It's especially valuable for data coming from external sources (APIs, databases, user input).

### Using Model Classes for Rich Data

**Why Model is better than plain objects:** Model classes provide both the structure of your data and metadata about how it should be stored and processed. They're immutable by default and compose naturally.

```typescript
import { Model } from "@effect/sql"

// Model classes provide structure plus metadata
// Model.Generated means the database generates this value
// Model.DateTimeInsert means it's set automatically on insert
export class User extends Model.Class<User>("User")({
  id: Model.Generated(UserId),
  email: Email,
  name: Schema.NonEmptyTrimmedString,
  age: Schema.Number.pipe(Schema.int(), Schema.positive()),
  createdAt: Model.DateTimeInsert,    // Automatically set on insert
  updatedAt: Model.DateTimeUpdate     // Automatically updated on change
}) {}

// Composition through field mixing - this is better than inheritance
// because you're explicit about what you're including and changing
export class UserWithProfile extends Model.Class<UserWithProfile>("UserWithProfile")({
  ...Model.fields(User),  // Include all User fields
  profile: Profile,       // Add profile information
  preferences: UserPreferences  // Add user preferences
}) {}
```

**When to use:** Use Model classes for domain entities that need to be persisted to a database. They provide the right abstraction for data that has both structure and behavior.

### Data Composition Patterns

**Why composition over inheritance:** Composition is more flexible than inheritance and doesn't create brittle hierarchies. You can combine data structures in any way that makes sense for your domain.

```typescript
// Option types handle nullable data safely
// This is better than null checks because the type system prevents null pointer exceptions
export const OptionalAddress = Schema.optional(Address)

// Union types for variants - the type system ensures you handle all cases
export const UserStatus = Schema.Literal("active", "inactive", "suspended")

// Nested data structures compose naturally
// Each level can have its own validation and transformation rules
export const UserProfile = Schema.Struct({
  user: User,
  address: OptionalAddress,
  status: UserStatus,
  metadata: Schema.Record(Schema.String, Schema.JsonValue)  // Flexible key-value store
})
```

**When to use:** Use composition patterns when you need different views of the same data or when you need to combine data from multiple sources.

## 2. CALCULATIONS: Pure Functions and Transformations

### Schema Transformations (Pure Calculations)

**Why transformations are calculations:** These functions don't have side effects - they take input and produce output without changing anything in the outside world. They're completely predictable and testable.

```typescript
// Pure transformation - given the same input, always produces the same output
// No database calls, no network requests, no file system access
export const UserIdFromString = Schema.NumberFromString.pipe(
  Schema.compose(UserId)
)

export const EmailFromString = Schema.String.pipe(
  Schema.compose(Email)
)

// Complex transformations can be built from simple ones
// This takes a JSON object and transforms it into a validated User
export const UserFromJson = Schema.Struct({
  id: Schema.NumberFromString.pipe(Schema.compose(UserId)),
  email: Schema.String.pipe(Schema.compose(Email)),
  name: Schema.NonEmptyTrimmedString,
  age: Schema.NumberFromString.pipe(Schema.int(), Schema.positive())
})
```

**When to use:** Use schema transformations for data that needs to be converted between different formats (JSON to domain objects, string IDs to typed IDs, etc.).

### Business Logic as Pure Functions

**Why business logic should be pure:** Pure business logic is easy to test, reason about, and reuse. It doesn't depend on external state, so it's predictable and reliable.

```typescript
import { pipe } from "effect"

// Pure calculation - no side effects, just logic
// This function is completely predictable and easy to test
export const isEligibleForDiscount = (user: User): boolean => {
  return user.age >= 65 || user.email.includes("student")
}

// Pure calculation that depends on another pure calculation
// The logic is clear and easy to understand
export const calculateDiscount = (amount: number, user: User): number => {
  if (!isEligibleForDiscount(user)) return 0
  return user.age >= 65 ? amount * 0.15 : amount * 0.10
}

// Pure function for presentation logic
export const formatUserDisplay = (user: User): string => {
  return `${user.name} (${user.email})`
}

// Pure data composition - combines data without side effects
export const enrichUserWithDiscount = (user: User, purchaseAmount: number) => ({
  ...user,
  eligibleForDiscount: isEligibleForDiscount(user),
  discountAmount: calculateDiscount(purchaseAmount, user)
})
```

**When to use:** Use pure functions for any business logic that doesn't need to read from or write to external systems. This includes calculations, validations, formatting, and data transformations.

### Validation as Pure Calculations

**Why validation is a calculation:** Validation takes data and returns either success or failure. It doesn't change the outside world - it just checks if data meets certain criteria.

```typescript
// Pure validation functions - no side effects, just logic
export const validateAge = (age: number): boolean => age >= 0 && age <= 150

export const validateEmail = (email: string): boolean => 
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)

// Validation that uses the Effect system for better error handling
// This is still a calculation because it doesn't change external state
export const validateUser = (userData: unknown): Effect.Effect<User, Schema.ParseError> =>
  Schema.decodeUnknown(User)(userData)
```

**When to use:** Use validation functions to ensure data integrity before processing. They should be pure so they can be tested easily and used in different contexts.

### Policy Logic as Pure Calculations

**Why policies are calculations:** Authorization policies are just logic - they take information about a user and a resource and return whether access should be granted. They don't perform the access themselves.

```typescript
// Pure authorization logic - no side effects, just decision-making
export const canUpdateUser = (actor: User, target: User): boolean => {
  return actor.id === target.id || actor.role === "admin"
}

export const canViewSensitiveData = (actor: User): boolean => {
  return actor.role === "admin" || actor.permissions.includes("view_sensitive")
}

// Policy composition - building complex policies from simple ones
export const hasPermission = (actor: User, action: string, resource: string): boolean => {
  const permission = `${action}:${resource}`
  return actor.permissions.includes(permission) || actor.role === "admin"
}
```

**When to use:** Use pure functions for authorization logic. The actual enforcement (allowing or denying access) is an action, but the decision-making is a calculation.

## 3. ACTIONS: Side Effects with the Effect System

### Database Actions

**Why database operations are actions:** Database calls change the state of the world (by reading from or writing to persistent storage). Effect makes these side effects explicit and manageable.

```typescript
import { Effect, Context } from "effect"
import { SqlClient } from "@effect/sql"

// Interface defines what actions are available
// This separates the contract from the implementation
export interface UserRepository {
  findById: (id: UserId) => Effect.Effect<Option.Option<User>, SqlError>
  create: (user: User) => Effect.Effect<User, SqlError>
  update: (id: UserId, user: Partial<User>) => Effect.Effect<User, SqlError>
  delete: (id: UserId) => Effect.Effect<void, SqlError>
}

// Context tag makes dependency injection type-safe
export const UserRepository = Context.GenericTag<UserRepository>("UserRepository")

// Implementation of database actions
// Notice how each operation is wrapped in Effect to make side effects explicit
export const UserRepositoryLive = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const findById = (id: UserId): Effect.Effect<Option.Option<User>, SqlError> =>
    sql`SELECT * FROM users WHERE id = ${id}`.pipe(
      Effect.map(Schema.decodeUnknown(User)),
      Effect.map(Option.fromNullable),
      Effect.withSpan("UserRepository.findById")  // For observability
    )

  const create = (user: User): Effect.Effect<User, SqlError> =>
    sql`INSERT INTO users ${sql.insert(user)} RETURNING *`.pipe(
      Effect.flatMap(Schema.decodeUnknown(User)),
      Effect.withSpan("UserRepository.create")
    )

  return { findById, create, update, delete } satisfies UserRepository
})
```

**When to use:** Use repository actions for all database operations. They provide a clean boundary between your domain logic and data persistence.

### Service Actions (Business Logic + Side Effects)

**Why services combine calculations and actions:** Services orchestrate business processes that involve both pure logic and side effects. They're the bridge between your domain logic and the outside world.

```typescript
// Service interface - defines what business operations are available
export interface UserService {
  getUserById: (id: UserId) => Effect.Effect<User, UserNotFound | SqlError>
  createUser: (userData: unknown) => Effect.Effect<User, ValidationError | SqlError>
  updateUser: (id: UserId, userData: unknown) => Effect.Effect<User, UserNotFound | ValidationError | SqlError>
}

export const UserService = Context.GenericTag<UserService>("UserService")

// Service implementation combines calculations and actions
export const UserServiceLive = Effect.gen(function* () {
  const repo = yield* UserRepository
  const logger = yield* Logger.Logger

  const getUserById = (id: UserId): Effect.Effect<User, UserNotFound | SqlError> =>
    repo.findById(id).pipe(
      Effect.flatMap(Option.match({
        onNone: () => Effect.fail(new UserNotFound({ id })),
        onSome: Effect.succeed
      })),
      Effect.tap(user => logger.info(`Retrieved user: ${user.id}`)),  // ACTION: Logging
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

**When to use:** Use services for business operations that involve multiple steps, combine data from multiple sources, or need to coordinate between different systems.

### HTTP Actions

**Why HTTP operations are actions:** HTTP requests and responses involve communication with external systems. Effect makes these interactions explicit and provides structured error handling.

```typescript
import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"

// HTTP API definition - pure data that describes the API
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

// HTTP handlers coordinate between HTTP and business logic
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

**When to use:** Use HTTP handlers to translate between HTTP requests/responses and your business logic. Keep them thin - most logic should be in services.

## 4. Combining the Paradigm: Complete Example

**Why this architecture works:** By separating data, calculations, and actions, each part can be understood, tested, and modified independently. The type system ensures all the pieces fit together correctly.

```typescript
// ===== DATA LAYER =====
// Pure data structures with validation
// These never change once created and have no behavior
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

// Domain errors are also data - they carry information about what went wrong
export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: UserId }
) {}

// ===== CALCULATIONS LAYER =====
// Pure functions that transform data
// These are completely predictable and have no side effects
export const isEligibleForDiscount = (user: User): boolean => 
  user.age >= 65

export const calculateUserDiscount = (user: User, amount: number): number =>
  isEligibleForDiscount(user) ? amount * 0.15 : 0

export const canUserAccessResource = (user: User, resource: string): boolean =>
  user.permissions.includes(resource) || user.role === "admin"

// ===== ACTIONS LAYER =====
// Side effects are explicit and managed by the Effect system
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

// Services combine calculations and actions
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

**When to use:** Use this complete pattern for any feature that involves data persistence, business logic, and external interfaces.

## 5. Testing the Paradigm

### Testing Data (Pure)

**Why testing data is simple:** Data structures are pure - they either validate correctly or they don't. There are no side effects to worry about.

```typescript
import { describe, it, expect } from "vitest"

// Test data structures directly - no mocking needed
describe("User Data", () => {
  it("should validate email format", () => {
    const validEmail = "user@example.com"
    const result = Schema.decodeUnknownSync(Email)(validEmail)
    expect(result).toBe(validEmail)
  })
  
  it("should reject invalid email format", () => {
    const invalidEmail = "not-an-email"
    expect(() => Schema.decodeUnknownSync(Email)(invalidEmail)).toThrow()
  })
})
```

**When to use:** Test data validation for all your domain types. These tests are fast and catch data integrity issues early.

### Testing Calculations (Pure)

**Why testing calculations is straightforward:** Pure functions are deterministic - given the same input, they always produce the same output. No setup or teardown required.

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
  
  it("should grant access to admin users", () => {
    const adminUser = { role: "admin", permissions: [] }
    const hasAccess = canUserAccessResource(adminUser, "sensitive-data")
    expect(hasAccess).toBe(true)
  })
})
```

**When to use:** Test all your business logic with pure function tests. These tests are fast, reliable, and easy to understand.

### Testing Actions (With Mocks)

**Why testing actions requires mocks:** Actions interact with external systems, so you need to replace those systems with predictable test doubles.

```typescript
describe("User Service Actions", () => {
  it("should get user by id", async () => {
    // Mock repository returns predictable data
    const mockRepo = {
      findById: vi.fn().mockReturnValue(Effect.succeed(Option.some(mockUser)))
    }
    
    const program = UserService.getUserById(UserId(1)).pipe(
      Effect.provide(Layer.succeed(UserRepository, mockRepo))
    )
    
    const result = await Effect.runPromise(program)
    expect(result).toEqual(mockUser)
  })
  
  it("should fail when user not found", async () => {
    const mockRepo = {
      findById: vi.fn().mockReturnValue(Effect.succeed(Option.none()))
    }
    
    const program = UserService.getUserById(UserId(999)).pipe(
      Effect.provide(Layer.succeed(UserRepository, mockRepo))
    )
    
    await expect(Effect.runPromise(program)).rejects.toThrow(UserNotFound)
  })
})
```

**When to use:** Test actions with mocks to verify they handle success and failure cases correctly. Focus on the coordination logic, not the external dependencies.

## Benefits of This Approach

### 1. **Clear Separation of Concerns**
**Why it helps:** When data, calculations, and actions are separate, you can understand each part in isolation. Changes to one part don't unexpectedly affect others.

### 2. **Type Safety**
**Why it matters:** The type system prevents you from accidentally mixing pure and impure code. You can't call a database function from a pure calculation - the types won't compile.

### 3. **Testability**
**Why it's better:** Each type of code needs different testing strategies. Pure functions are easy to test, while actions need mocking. The separation makes testing strategies clear.

### 4. **Maintainability**
**Why it lasts:** Pure functions don't break when external systems change. Actions are isolated, so changes to external APIs only affect the action layer.

### 5. **Composability**
**Why it scales:** Pure functions compose naturally. Actions compose through the Effect system. The patterns work at any scale.

This paradigm, enforced by Effect's type system, leads to more maintainable, testable, and reasoning-friendly code that naturally follows functional programming principles while still being practical for real-world applications.