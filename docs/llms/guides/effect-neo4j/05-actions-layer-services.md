> **Audience:** LLM / AI Agent (Focused Guide)

# 5. Actions Layer - Effect Services

This section covers the Actions layer, including the Neo4j client, repositories, and service layer patterns.

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