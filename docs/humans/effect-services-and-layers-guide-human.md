
# Using Services and Layers in Effect: A Guide to Actions, Calculations, and Data

This guide explains how to use Effect's `Services` and `Layers` to structure your application according to the principles of "actions, calculations, and data," as described in Eric Normand's "Grokking Simplicity." We'll use examples from this repository to illustrate these concepts.

## The Core Principles

*   **Data:** Immutable data structures that represent the state of your application.
*   **Calculations:** Pure functions that take data as input and produce new data as output. They have no side effects.
*   **Actions:** Operations that interact with the outside world, such as reading from a database, making an API call, or writing to the console. Actions are where side effects live.

By separating these three concerns, we can build applications that are easier to reason about, test, and maintain.

## Services as Actions

In Effect, **Services** are the natural way to represent **actions**. A service is a collection of functions that perform side effects. We can define a service using `Context.Tag`.

Let's look at an example from `examples/http-server/src/Domain/User.ts`:

```typescript
import { Context, Effect } from "effect"

// ... other imports

export class CurrentUser extends Context.Tag("Domain/User/CurrentUser")<
  CurrentUser,
  {
    readonly _: unique symbol
    readonly id: string
    readonly email: string
    readonly name: string
  }
>() {}
```

Here, `CurrentUser` is a service that provides information about the currently logged-in user. It's defined as a `Context.Tag` with a unique identifier `"Domain/User/CurrentUser"`. The second type parameter defines the shape of the service's implementation.

This service represents an **action** because it depends on the external context of an HTTP request to determine the current user. It's not a pure calculation.

## Layers: Providing Implementations for Services

A **Layer** provides a concrete implementation for a service. This is how we connect our abstract service definitions (actions) to the real world.

We can create layers that provide live implementations (e.g., fetching a user from a database) or test implementations (e.g., returning a hard-coded user).

Here's an example of a utility function from `examples/http-server/src/lib/Layer.ts` that creates a test layer for any service:

```typescript
import { Context, Layer } from "effect"

export const makeTestLayer = <I, S extends object>(tag: Context.Tag<I, S>) => (service: Partial<S>): Layer.Layer<I> =>
  Layer.succeed(tag, tag.of(service as S))
```

This function, `makeTestLayer`, takes a service `tag` and a partial implementation of that service. It then creates a `Layer` that provides the full service by merging the partial implementation with the service's interface.

We can use this to provide a test implementation of our `CurrentUser` service like this:

```typescript
import { Effect, Layer } from "effect"
import { CurrentUser } from "examples/http-server/src/Domain/User.ts"
import { makeTestLayer } from "examples/http-server/src/lib/Layer.ts"

const testUserLayer = makeTestLayer(CurrentUser)({
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
})

const program = Effect.gen(function*(_) {
  const user = yield* _(CurrentUser)
  console.log(`The current user is ${user.name}`)
})

const runnable = Effect.provide(program, testUserLayer)

Effect.runPromise(runnable)
```

In this example:

1.  `testUserLayer` is a `Layer` that provides a concrete implementation of the `CurrentUser` service.
2.  `program` is an `Effect` that depends on the `CurrentUser` service.
3.  `Effect.provide(program, testUserLayer)` injects the `testUserLayer` into the `program`, satisfying its dependency on `CurrentUser`.

## Calculations: The Glue Between Actions

**Calculations** are pure functions that operate on data. In an Effect application, calculations are often represented by functions that take data as input and return an `Effect` that describes a computation. These `Effect`s can then be composed with our services (actions).

For example, let's imagine a function that determines if a user is an administrator:

```typescript
import { Effect } from "effect"
import { CurrentUser } from "examples/http-server/src/Domain/User.ts"

const isAdministrator = (user: CurrentUser): boolean => {
  return user.email.endsWith("@example.com")
}

const program = Effect.gen(function*(_) {
  const user = yield* _(CurrentUser)
  if (isAdministrator(user)) {
    console.log("Welcome, administrator!")
  } else {
    console.log("Welcome, user!")
  }
})
```

Here, `isAdministrator` is a pure **calculation**. It takes a `CurrentUser` (data) and returns a `boolean` (data). It has no side effects. The `program` then uses this calculation to decide what to do.

## Real-World Example: Database Services

Let's look at how to structure database services, particularly for Neo4j (graph database) since this project uses Neo4j. The key principle is that database operations are **actions** (they have side effects), while the data schemas and business logic are **data** and **calculations**.

### Defining Data with Schema (Not Model.Class!)

For Neo4j and other non-SQL databases, use `Schema.Struct` or `Schema.Class`, NOT `Model.Class` (which is SQL-specific):

```typescript
import { Schema } from "@effect/schema"

// Data: Define your node schema
export const UserNode = Schema.Struct({
  id: Schema.String,  // Neo4j uses string IDs
  email: Schema.String.pipe(Schema.nonEmpty()),
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})
export type UserNode = typeof UserNode.Type

// Data: Define relationship schema  
export const FollowsRelationship = Schema.Struct({
  since: Schema.DateTimeUtc,
  strength: Schema.Number.pipe(Schema.between(0, 1))
})
```

### Creating a Repository Service (Actions)

```typescript
import { Context, Effect, Layer } from "effect"
import * as Neo4j from "neo4j-driver"

// Define the repository interface (what actions can we perform?)
export interface UserRepository {
  findById: (id: string) => Effect.Effect<Option.Option<UserNode>, Neo4jError>
  create: (user: UserNode) => Effect.Effect<UserNode, Neo4jError>
  findFollowers: (userId: string) => Effect.Effect<ReadonlyArray<UserNode>, Neo4jError>
  createFollowsRelationship: (followerId: string, followeeId: string) => Effect.Effect<void, Neo4jError>
}

// Create a Context.Tag for dependency injection
export const UserRepository = Context.Tag<UserRepository>("UserRepository")

// Live implementation that talks to Neo4j
export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function*(_) {
    const driver = yield* _(Neo4jDriver)  // Assume we have a Neo4jDriver service
    
    return {
      findById: (id: string) =>
        Effect.tryPromise({
          try: async () => {
            const session = driver.session()
            try {
              const result = await session.run(
                'MATCH (u:User {id: $id}) RETURN u',
                { id }
              )
              const record = result.records[0]
              return record ? Option.some(Schema.decodeUnknownSync(UserNode)(record.get('u'))) : Option.none()
            } finally {
              await session.close()
            }
          },
          catch: (error) => new Neo4jError({ message: String(error) })
        }),
        
      create: (user: UserNode) =>
        Effect.tryPromise({
          try: async () => {
            const session = driver.session()
            try {
              const result = await session.run(
                'CREATE (u:User $props) RETURN u',
                { props: user }
              )
              return Schema.decodeUnknownSync(UserNode)(result.records[0].get('u'))
            } finally {
              await session.close()
            }
          },
          catch: (error) => new Neo4jError({ message: String(error) })
        }),
        
      findFollowers: (userId: string) =>
        Effect.tryPromise({
          try: async () => {
            const session = driver.session()
            try {
              const result = await session.run(
                'MATCH (follower:User)-[:FOLLOWS]->(u:User {id: $userId}) RETURN follower',
                { userId }
              )
              return result.records.map(r => 
                Schema.decodeUnknownSync(UserNode)(r.get('follower'))
              )
            } finally {
              await session.close()
            }
          },
          catch: (error) => new Neo4jError({ message: String(error) })
        }),
        
      createFollowsRelationship: (followerId: string, followeeId: string) =>
        Effect.tryPromise({
          try: async () => {
            const session = driver.session()
            try {
              await session.run(
                'MATCH (a:User {id: $followerId}), (b:User {id: $followeeId}) CREATE (a)-[:FOLLOWS {since: datetime()}]->(b)',
                { followerId, followeeId }
              )
            } finally {
              await session.close()
            }
          },
          catch: (error) => new Neo4jError({ message: String(error) })
        })
    }
  })
)

// Test implementation for unit tests
export const UserRepositoryTest = Layer.succeed(UserRepository, {
  findById: (id) => Effect.succeed(
    id === "123" 
      ? Option.some({ id: "123", email: "test@example.com", name: "Test User", createdAt: new Date() })
      : Option.none()
  ),
  create: (user) => Effect.succeed(user),
  findFollowers: () => Effect.succeed([]),
  createFollowsRelationship: () => Effect.succeed(undefined)
})
```

### Using Services with Calculations

```typescript
// Calculation: Pure function to check if user can follow another
const canFollow = (follower: UserNode, followee: UserNode): boolean => {
  return follower.id !== followee.id  // Can't follow yourself
}

// Calculation: Determine if a user is popular
const isPopularUser = (followerCount: number): boolean => {
  return followerCount > 1000
}

// Action that combines calculations with database operations
export const followUser = (followerId: string, followeeId: string) =>
  Effect.gen(function*(_) {
    const repo = yield* _(UserRepository)
    
    // Get both users (actions)
    const follower = yield* _(repo.findById(followerId))
    const followee = yield* _(repo.findById(followeeId))
    
    // Check if both exist
    if (Option.isNone(follower) || Option.isNone(followee)) {
      return yield* _(Effect.fail(new Error("User not found")))
    }
    
    // Apply business rule (calculation)
    if (!canFollow(follower.value, followee.value)) {
      return yield* _(Effect.fail(new Error("Cannot follow this user")))
    }
    
    // Create the relationship (action)
    yield* _(repo.createFollowsRelationship(followerId, followeeId))
    
    // Check if followee is now popular (calculation + action)
    const followers = yield* _(repo.findFollowers(followeeId))
    if (isPopularUser(followers.length)) {
      console.log(`${followee.value.name} is now a popular user!`)
    }
  })

// Running the program with dependency injection
const program = followUser("123", "456")

// In production
const runnable = Effect.provide(program, UserRepositoryLive)

// In tests
const testRunnable = Effect.provide(program, UserRepositoryTest)
```

## Putting It All Together

By using `Services` to define our **actions**, `Layers` to provide their implementations, and pure functions for our **calculations**, we can build Effect applications that are:

*   **Testable:** We can easily swap out live layers with test layers to test our business logic in isolation.
*   **Maintainable:** The separation of concerns makes it easier to understand and modify our code.
*   **Composable:** Effect's powerful composition operators allow us to build complex applications from small, reusable pieces.

This approach aligns perfectly with the principles of "actions, calculations, and data," and provides a solid foundation for building robust and scalable applications with Effect.

### Key Takeaways for Database Services

1. **For Neo4j/Graph DBs:** Use `Schema.Struct` or `Schema.Class`, never `Model.Class`
2. **Services are Actions:** Database operations are always actions (side effects)
3. **Keep Calculations Pure:** Business logic should be separate pure functions
4. **Use Layers for DI:** Swap between live and test implementations easily
5. **Data is Immutable:** Define your schemas as immutable data structures
