> **Audience:** LLM / AI Agent (Comprehensive Reference)

# Effect + Neo4j Complete Reference Guide

This comprehensive guide covers all aspects of building Neo4j applications with Effect-TS, following principles from three essential books:
- **"Grokking Simplicity"** by Eric Normand - Separate Data, Calculations, and Actions
- **"Type-Driven Development with Idris"** by Edwin Brady - Let types guide implementation
- **"Programming with Types"** by Vlad Riscutia - Avoid primitive obsession, use composition

## Table of Contents
1. [Core Principles](#core-principles)
2. [Type-Driven Development Workflow](#type-driven-development-workflow)
3. [Data Layer - Schema Design](#data-layer---schema-design)
4. [Calculations Layer - Pure Functions](#calculations-layer---pure-functions)
5. [Actions Layer - Effect Services](#actions-layer---effect-services)
6. [Service Architecture Patterns](#service-architecture-patterns)
7. [Testing Strategies](#testing-strategies)
8. [Common Patterns & Anti-Patterns](#common-patterns--anti-patterns)

## Core Principles

### From "Grokking Simplicity" (Eric Normand)
1. **Stratified Design** - Build layers of abstraction where each layer only knows about layers below
2. **Separate Actions, Calculations, and Data**:
   - **Data**: What things ARE (immutable values)
   - **Calculations**: Compute new data from existing data (pure functions)
   - **Actions**: Interact with the world (side effects wrapped in Effect)
3. **Minimize Actions** - Push as much logic as possible into pure calculations
4. **Make Actions Atomic** - Group related side effects together

### From "Type-Driven Development with Idris" (Edwin Brady)
1. **Type, Define, Refine** workflow:
   - **Type**: Define types that make illegal states impossible
   - **Define**: Write function signatures using those types
   - **Refine**: Implement functions guided by types, then refine types if needed
2. **Make illegal states unrepresentable** - Use the type system to prevent errors at compile time
3. **Total functions** - Handle all possible inputs explicitly
4. **Types as specifications** - Types document intent and constraints

### From "Programming with Types" (Vlad Riscutia)
1. **Avoid primitive obsession** - Wrap primitives in semantic domain types
2. **Use composition over inheritance** - Build behavior from small, composable functions
3. **Parse, don't validate** - Transform and validate data once at system boundaries
4. **Phantom types for compile-time guarantees** - Use branded types for type safety
5. **Functions as values** - Pass and return functions to build complex behavior

## Type-Driven Development Workflow

### Step 1: Define Domain Types (Type)
Start by defining types that capture your domain concepts and constraints:

```typescript
// Brand primitive types to prevent mixing
export const PersonId = Schema.String.pipe(
  Schema.pattern(/^person-[a-f0-9]{8}$/),
  Schema.brand("PersonId")
)
export type PersonId = typeof PersonId.Type

// Add domain constraints in the type
export const Email = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand("Email")
)
export type Email = typeof Email.Type

// Constrain numeric values
export const Age = Schema.Number.pipe(
  Schema.between(0, 150),
  Schema.int(),
  Schema.brand("Age")
)
export type Age = typeof Age.Type
```

### Step 2: Define Function Signatures (Define)
Write function signatures before implementation:

```typescript
// Define what operations are needed
type PersonOperations = {
  // Actions (side effects)
  findPerson: (id: PersonId) => Effect.Effect<Option.Option<Person>, DatabaseError>
  createPerson: (person: Person) => Effect.Effect<PersonId, DatabaseError>
  
  // Calculations (pure)
  isAdult: (age: Age) => boolean
  canVote: (person: Person) => boolean
}
```

### Step 3: Implement Guided by Types (Refine)
Let the types guide your implementation:

```typescript
// The types tell us exactly what we need to do
const isAdult = (age: Age): boolean => age >= 18

const canVote = (person: Person): boolean => 
  isAdult(person.age) && person.citizenship === "US"
```

## Data Layer - Schema Design

### Neo4j-Specific Schema Rules

**Critical**: NEVER use `Model.Class` with Neo4j - it's SQL-only!

```typescript
// ❌ WRONG - Model.Class is for SQL databases
export class Person extends Model.Class<Person>("Person")({...})

// ✅ CORRECT - Use Schema.Struct for Neo4j nodes
export const PersonNode = Schema.Struct({
  id: PersonId,
  name: PersonName,
  email: Email,
  age: Age,
  labels: Schema.Array(Label),
  createdAt: Schema.DateTimeUtc
})
export type PersonNode = typeof PersonNode.Type

// ✅ CORRECT - Use Schema.Class only when you need methods
export class PersonNode extends Schema.Class<PersonNode>("PersonNode")({
  id: PersonId,
  name: PersonName,
  labels: Schema.Array(Label)
}) {
  hasLabel(label: Label): boolean {
    return this.labels.includes(label)
  }
  
  get displayName(): string {
    return `${this.name} (${this.id})`
  }
}
```

### Relationship Schemas
Define relationships as first-class entities:

```typescript
export const FollowsRelationship = Schema.Struct({
  since: Schema.DateTimeUtc,
  strength: RelationshipStrength,
  mutual: Schema.Boolean
})
export type FollowsRelationship = typeof FollowsRelationship.Type

export const WorksAtRelationship = Schema.Struct({
  role: JobTitle,
  startDate: Schema.DateTimeUtc,
  endDate: Schema.Option(Schema.DateTimeUtc),
  department: Department
})
```

### Complex Node Types
For nodes with rich properties:

```typescript
export const CompanyNode = Schema.Struct({
  id: CompanyId,
  name: CompanyName,
  founded: Schema.DateTimeUtc,
  employees: EmployeeCount,
  revenue: Schema.Option(Revenue),
  industries: Schema.Array(Industry),
  headquarters: Address,
  metadata: Schema.Record(Schema.String, Schema.Unknown)
})
```

## Calculations Layer - Pure Functions

### Domain Calculations
Pure functions that operate on your domain types:

```typescript
// Simple calculations
export const isAdult = (age: Age): boolean => age >= 18

export const yearsUntilRetirement = (age: Age): number => 
  Math.max(0, 65 - age)

// Composite calculations
export const canRetire = (person: Person): boolean =>
  person.age >= 65 || 
  (person.age >= 60 && person.yearsOfService >= 30)

// Calculations with branded return types
export const calculateInfluence = (followers: FollowerCount): Effect.Effect<InfluenceScore, Schema.ParseError> =>
  Schema.decode(InfluenceScore)(Math.log10(followers + 1) * 100)

// Compose calculations
export const isInfluencer = (score: InfluenceScore): boolean => score > 300

export const checkInfluencer = (followers: FollowerCount): Effect.Effect<boolean, Schema.ParseError> =>
  Effect.map(calculateInfluence(followers), isInfluencer)
```

### Business Rule Calculations
Encode business rules as pure functions:

```typescript
// Relationship rules
export const canFollow = (follower: Person, target: Person): boolean =>
  follower.id !== target.id && !follower.blockedUsers.includes(target.id)

// Validation rules
export const isValidCompanyName = (name: CompanyName): boolean =>
  name.length >= 2 && !RESERVED_NAMES.includes(name)

// Complex business logic
export const calculateDiscount = (
  customer: Customer,
  order: Order
): Effect.Effect<DiscountPercentage, Schema.ParseError> => {
  const baseDiscount = customer.loyaltyTier === "Gold" ? 10 : 0
  const volumeDiscount = order.items.length > 10 ? 5 : 0
  const seasonalDiscount = isBlackFriday(order.date) ? 15 : 0
  
  return Schema.decode(DiscountPercentage)(
    Math.min(baseDiscount + volumeDiscount + seasonalDiscount, 30)
  )
}
```

## Actions Layer - Effect Services

### The Neo4j Client: A Context-Driven Approach

The foundation of our database interactions is a set of services that safely manage the Neo4j driver, sessions, and transactions as managed resources within the `Effect` context. This ensures that all database operations are part of the same computational graph and that resources are cleaned up automatically, even in the case of errors.

#### 1. Core Services Definition

We define three core services:
-   `Neo4jDriver`: A service that holds the global `neo4j.driver` instance. Its lifecycle is managed for the entire application.
-   `Neo4jTransaction`: A service that holds an active `neo4j.ManagedTransaction`. This service is only available *inside* a transactional context.
-   `Neo4jClient`: The primary service used by repositories. It provides a `run` method for executing queries and a `transaction` method for wrapping operations in a transaction.

```typescript
import * as neo4j from "neo4j-driver"

// Service to hold the raw neo4j driver
export class Neo4jDriver extends Context.Tag("Neo4jDriver")<
  Neo4jDriver,
  neo4j.Driver
>() {}

// A service to represent an active transaction
export class Neo4jTransaction extends Context.Tag("Neo4jTransaction")<
  Neo4jTransaction,
  neo4j.ManagedTransaction
>() {}

// The main client service
export class Neo4jClient extends Context.Tag("Neo4jClient")<
  Neo4jClient,
  {
    /**
     * Runs a query inside a transaction.
     * Requires a Neo4jTransaction to be in the context.
     */
    readonly run: <T extends neo4j.QueryResult>(
      query: string,
      params?: Record<string, unknown>
    ) => Effect.Effect<T, Neo4jError, Neo4jTransaction>

    /**
     * Wraps an Effect in a managed transaction. It provides the Neo4jTransaction
     * service to the effect, ensuring all `run` calls within it execute in the same transaction.
     */
    readonly transaction: <A, E, R>(
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E | Neo4jError, R | Neo4jDriver>
  }
>() {}
```

#### 2. Live Implementation

The `Live` implementations manage the lifecycle of these resources. `Neo4jDriverLive` creates and closes the driver. `Neo4jClientLive` provides the logic for creating sessions and running transactions.

**Critical:** The `transaction` function uses `session.executeWrite`. This function expects a callback that returns a `Promise`. We use `runtime.runPromise` to execute our `Effect` *within* the transaction boundary provided by the driver, but we provide the transaction object `tx` back into the `Effect` context. This correctly bridges the Effect world with the Neo4j driver's Promise-based transaction management without losing the benefits of Effect.

```typescript
// A layer to provide the driver, managing its lifecycle
export const Neo4jDriverLive = Layer.scoped(
  Neo4jDriver,
  Effect.gen(function*() {
    const config = yield* Config
    const driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
    )
    // Ensure the driver is closed when the application shuts down
    yield* Effect.addFinalizer(() => Effect.promise(() => driver.close()))
    return driver
  })
)

// The live implementation of the client
export const Neo4jClientLive = Layer.effect(
  Neo4jClient,
  Effect.gen(function* () {
    const driver = yield* Neo4jDriver
    const runtime = yield* Effect.runtime<any>()

    const transaction = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.scoped(
        Effect.acquireRelease(
          Effect.sync(() => driver.session({ database: "neo4j" })),
          (session) => Effect.sync(() => session.close())
        )
      ).pipe(
        Effect.flatMap((session) =>
          Effect.tryPromise({
            try: () =>
              session.executeWrite((tx) =>
                runtime.runPromise(
                  Effect.provideService(effect, Neo4jTransaction, tx)
                )
              ),
            catch: (e) => new Neo4jError({ message: String(e) }),
          })
        )
      )

    const run = <T extends neo4j.QueryResult>(query: string, params?: Record<string, unknown>) =>
      Effect.flatMap(Neo4jTransaction, (tx) =>
        Effect.tryPromise({
          try: () => tx.run(query, params) as Promise<T>,
          catch: (e) => new Neo4jError({ message: String(e) }),
        })
      )

    return Neo4jClient.of({ run, transaction })
  })
).pipe(Layer.provide(Neo4jDriverLive))
```

### Repository Pattern with the New Client

Repositories now depend on `Neo4jClient` and define functions that execute queries. Notice that repository functions like `findById` and `create` don't call `transaction` themselves. They simply `run` queries, which requires that a `Neo4jTransaction` is already available in the context. This makes them composable.

```typescript
// Build repository operations
export const makePersonRepository = Effect.gen(function* () {
  const neo4j = yield* Neo4jClient

  const findById = (id: PersonId) =>
    neo4j.run(`MATCH (p:Person {id: $id}) RETURN p`, { id }).pipe(
      Effect.map((result) => Option.fromNullable(result.records[0])),
      Effect.flatMap(Option.traverse(record => Option.fromNullable(record.get('p')))),
      Effect.flatMap(Option.traverse(Schema.decode(PersonNode)))
    )

  const create = (person: PersonNode) =>
    neo4j.run(
      `CREATE (p:Person $props)
       SET p.createdAt = datetime()
       RETURN p`,
      { props: person }
    ).pipe(
      Effect.map(result => result.records[0].get('p')),
      Effect.flatMap(Schema.decode(PersonNode))
    )

  const createFollowsRelationship = (
    fromId: PersonId,
    toId: PersonId,
    relationship: FollowsRelationship
  ) =>
    neo4j.run(
      `MATCH (a:Person {id: $fromId}), (b:Person {id: $toId})
       CREATE (a)-[r:FOLLOWS $props]->(b)
       RETURN r`,
      { fromId, toId, props: relationship }
    ).pipe(Effect.asVoid)

  return {
    findById,
    create,
    createFollowsRelationship
  } as const
})

// Derive type from implementation
export type PersonRepository = Effect.Effect.Success<typeof makePersonRepository>
export const PersonRepository = Context.Tag<PersonRepository>("PersonRepository")

// Create layer
export const PersonRepositoryLive = Layer.effect(
  PersonRepository,
  makePersonRepository
)
```

### Service Layer and Transaction Management

The **Service Layer** is responsible for orchestrating units of work. It injects the `Neo4jClient` and the repositories it needs. When a service method involves multiple database writes that must be atomic, it uses `neo4j.transaction` to wrap the entire workflow.

This is the "unit of work" pattern. The `followPerson` service method ensures that finding both people and creating the follow relationship all happen in a single, atomic transaction.

```typescript
// Build complete service
export const makePersonService = Effect.gen(function* () {
  const repo = yield* PersonRepository
  const neo4j = yield* Neo4jClient // Inject the client to manage transactions

  const followPerson = (followerId: PersonId, targetId: PersonId) =>
    // Wrap the entire operation in a single transaction
    neo4j.transaction(Effect.gen(function* () {
      // All `repo` calls here will run in the same transaction
      const follower = yield* repo.findById(followerId)
      const target = yield* repo.findById(targetId)

      if (Option.isNone(follower) || Option.isNone(target)) {
        return yield* Effect.fail(new UserNotFound({
          userId: Option.isNone(follower) ? followerId : targetId
        }))
      }

      if (!canFollow(follower.value, target.value)) {
        return yield* Effect.fail(new InvalidFollow({
          reason: "Cannot follow this user"
        }))
      }

      const relationship = yield* Schema.decode(FollowsRelationship)({
        since: new Date(),
        strength: 1.0,
        mutual: false
      })

      yield* repo.createFollowsRelationship(followerId, targetId, relationship)
    }))

  return {
    findPerson: (id: PersonId) => neo4j.transaction(repo.findById(id)),
    createPerson: (person: PersonNode) => neo4j.transaction(repo.create(person)),
    followPerson
  } as const
})

export type PersonService = Effect.Effect.Success<typeof makePersonService>
export const PersonService = Context.Tag<PersonService>("PersonService")

export const PersonServiceLive = Layer.effect(
  PersonService,
  makePersonService
)
```

## Service Architecture Patterns

### Layer Composition
Build your application in layers:

```typescript
// Infrastructure layer
export const InfrastructureLive = Layer.mergeAll(
  ConfigLive,
  Neo4jClientLive, // The new client layer
  LoggerLive
)

// Repository layer (depends on infrastructure)
export const RepositoryLive = Layer.mergeAll(
  PersonRepositoryLive,
  CompanyRepositoryLive,
  RelationshipRepositoryLive
).pipe(Layer.provide(InfrastructureLive))

// Service layer (depends on repositories)
export const ServiceLive = Layer.mergeAll(
  PersonServiceLive,
  CompanyServiceLive,
  RecommendationServiceLive
).pipe(Layer.provide(RepositoryLive))

// Application layer (top level)
export const ApplicationLive = ServiceLive
```

### Transaction Management
As shown in the `PersonService` example, transaction management is handled at the service layer by wrapping units of work with `neo4j.transaction`. This ensures atomicity for complex operations.

Here is another classic example: transferring funds between two accounts. The entire block of logic is wrapped in a transaction. If any step fails (e.g., insufficient funds), the entire operation is rolled back by the database.

```typescript
export const makeTransferService = Effect.gen(function* () {
  const neo4j = yield* Neo4jClient
  const accounts = yield* AccountRepository

  const transfer = (
    fromId: AccountId,
    toId: AccountId,
    amount: Money
  ) =>
    neo4j.transaction( // The whole transfer is one atomic unit
      Effect.gen(function* () {
        // All operations use the same transaction provided by the wrapper
        const from = yield* accounts.findById(fromId)
        const to = yield* accounts.findById(toId)

        if (from.balance < amount) {
          return yield* Effect.fail(new InsufficientFunds())
        }

        yield* accounts.updateBalance(fromId, from.balance - amount)
        yield* accounts.updateBalance(toId, to.balance + amount)
        yield* accounts.recordTransfer(fromId, toId, amount)
      })
    )

  return { transfer }
})
```

## Testing Strategies

### Unit Testing Calculations
Test pure functions directly:

```typescript
describe("Business Rules", () => {
  test("canFollow prevents self-following", () => {
    const person = createTestPerson({ id: "person-123" })
    expect(canFollow(person, person)).toBe(false)
  })
  
  test("calculateInfluence handles edge cases", () => Effect.runPromise(Effect.gen(function*() {
    const zero = yield* calculateInfluence(yield* Schema.decode(FollowerCount)(0))
    const large = yield* calculateInfluence(yield* Schema.decode(FollowerCount)(1000000))
    expect(zero).toBe(0)
    expect(large).toBeGreaterThan(500)
  })))
})
```

### Integration Testing with Test Layers
Create test implementations:

```typescript
export const PersonRepositoryTest = Layer.succeed(PersonRepository, {
  findById: (id) => 
    Effect.succeed(
      testData.people.has(id.value)
        ? Option.some(testData.people.get(id.value)!)
        : Option.none()
    ),
    
  create: (person) => {
    testData.people.set(person.id.value, person)
    return Effect.succeed(person)
  },
  
  findFollowers: (id) =>
    Effect.succeed(
      testData.follows
        .filter(f => f.targetId === id)
        .map(f => testData.people.get(f.followerId.value)!)
        .filter(Boolean)
    )
})

// Use in tests
test("follow operation", async () => {
  const result = await Effect.runPromise(
    personService.followPerson(userId1, userId2).pipe(
      Effect.provide(PersonServiceLive),
      Effect.provide(PersonRepositoryTest)
    )
  )
  
  expect(result).toBeUndefined()
})
```

### Testing Effect Programs
Test complete Effect programs:

```typescript
describe("PersonService", () => {
  const makeTestEnv = () =>
    Layer.mergeAll(
      PersonServiceLive,
      PersonRepositoryTest,
      ConfigTest
    )
  
  test("should handle missing users", () => Effect.runPromise(
    Effect.gen(function* () {
      const program = personService.followPerson(
        yield* Schema.decode(PersonId)("unknown-1"),
        yield* Schema.decode(PersonId)("unknown-2")
      )
      
      const result = yield* Effect.runPromiseExit(
        program.pipe(Effect.provide(makeTestEnv()))
      )
      
      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        expect(result.cause).toMatchObject({
          _tag: "Fail",
          error: { _tag: "UserNotFound" }
        })
      }
    })
  ))
})
```

## Common Patterns & Anti-Patterns

### ✅ Correct Patterns

#### Type-Safe Query Parameters
```typescript
// ✅ CORRECT - All parameters are typed
const findByEmail = (email: Email) =>
  neo4j.runQuery(
    `MATCH (p:Person {email: $email}) RETURN p`,
    { email }  // Email type ensures valid format
  )

// ❌ WRONG - Raw string parameter
const findByEmail = (email: string) =>
  neo4j.runQuery(
    `MATCH (p:Person {email: $email}) RETURN p`,
    { email }  // No validation!
  )
```

#### Parse at Boundaries
```typescript
// ✅ CORRECT - Parse immediately after query
const findPerson = (id: PersonId) =>
  neo4j.run(`MATCH (p:Person {id: $id}) RETURN p`, { id }).pipe(
    Effect.map(result => result.records[0]?.get('p')),
    Effect.flatMap(Schema.decode(PersonNode))  // Parse here
  )

// ❌ WRONG - Return raw data
const findPerson = (id: PersonId) =>
  neo4j.runQuery(`MATCH (p:Person {id: $id}) RETURN p`, { id }).pipe(
    Effect.map(result => result.records[0]?.get('p'))  // Raw Neo4j node
  )
```

#### Separate Concerns
```typescript
// ✅ CORRECT - Clear separation
// CALCULATION (pure)
const canPromote = (employee: Employee): boolean =>
  employee.yearsOfService >= 2 && 
  employee.performanceRating >= 4

// ACTION (effect)
const promoteEmployee = (id: EmployeeId) =>
  Effect.gen(function* () {
    const employee = yield* repo.findById(id)
    
    if (!canPromote(employee)) {
      return yield* Effect.fail(new IneligibleForPromotion())
    }
    
    yield* repo.updateRole(id, getNextRole(employee.role))
  })

// ❌ WRONG - Mixed concerns
const promoteEmployee = (id: EmployeeId) =>
  Effect.gen(function* () {
    const employee = yield* repo.findById(id)
    
    // Business logic mixed with effects
    if (employee.yearsOfService >= 2 && employee.performanceRating >= 4) {
      yield* repo.updateRole(id, getNextRole(employee.role))
    }
  })
```

### ❌ Common Anti-Patterns to Avoid

1. **Using Model.Class for Neo4j**
   ```typescript
   // ❌ NEVER DO THIS
   export class Person extends Model.Class<Person>("Person")({...})
   ```

2. **Primitive Parameters**
   ```typescript
   // ❌ WRONG
   findPerson(id: string)
   
   // ✅ CORRECT
   findPerson(id: PersonId)
   ```

3. **Effect in Calculations**
   ```typescript
   // ❌ WRONG
   const calculateTax = (income: Income): Effect.Effect<TaxAmount> => ...
   
   // ✅ CORRECT
   const calculateTax = (income: Income): TaxAmount => ...
   ```

4. **Parsing in Business Logic**
   ```typescript
   // ❌ WRONG
   const processUser = (data: unknown) =>
     Effect.gen(function* () {
       const user = yield* Schema.decodeUnknown(User)(data)  // Too late!
       // ... business logic
     })
   
   // ✅ CORRECT
   const processUser = (user: User) =>  // Already parsed
     Effect.gen(function* () {
       // ... business logic
     })
   ```

5. **Interface-First Design**
   ```typescript
   // ❌ WRONG
   interface UserService {
     findUser(id: UserId): Effect.Effect<User>
   }
   class UserServiceImpl implements UserService { ... }
   
   // ✅ CORRECT
   const makeUserService = (deps: Dependencies) => ({
     findUser: (id: UserId) => Effect.gen(function* () { ... })
   })
   type UserService = ReturnType<typeof makeUserService>
   ```

## Summary

This reference guide provides a complete foundation for building Neo4j applications with Effect-TS. Key takeaways:

1. **Always start with types** - Define your domain model with branded types
2. **Separate concerns strictly** - Data, Calculations, and Actions
3. **Use Schema.Struct for Neo4j** - Never Model.Class
4. **Compose from small functions** - Build complex behavior through composition
5. **Parse at boundaries** - Validate and transform data as early as possible
6. **Let types guide implementation** - Type-Define-Refine workflow

For quick lookups, see the companion quick-reference card. For compliance verification, use the separate checklist.

## Advanced Composition Patterns

While the patterns above cover the core of a database application, `Effect-TS` provides powerful composition patterns for all aspects of an application. The following are examples of how to compose other critical pieces of your system.

### Tagged Error Composition
Errors compose through tagged unions rather than inheritance. This allows services to return a clear, explicit set of possible errors that can be handled by the caller.

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

// A service can return a union of these errors
type MyServiceErrors = UserNotFound | GroupNotFound | Unauthorized
```

### API and Middleware Composition
For applications that expose an HTTP API, the `@effect/platform` library provides composition for endpoints and middleware.

```typescript
// Individual API groups
export class AccountsApi extends HttpApiGroup.make("accounts")
  .add(HttpApiEndpoint.patch("updateUser", "/users/:id"))
  .add(HttpApiEndpoint.get("getUserMe", "/users/me"))
  .middlewareEndpoints(Authentication) // Apply middleware to a group
  .annotate(OpenApi.Title, "Accounts")
{}

// Compose groups into a final API
export class Api extends HttpApi.empty
  .add(AccountsApi)
  .add(GroupsApi)
  .add(PeopleApi)
  .annotate(OpenApi.Title, "Groups API")
{}

// Compose middleware layers for the server
export const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(HttpApiBuilder.middlewareOpenApi()),
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(ApiLive), // Provide the composed API
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)
```

### Policy Composition
Business rules, especially authorization policies, can be composed as pure functions or higher-order Effects.

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