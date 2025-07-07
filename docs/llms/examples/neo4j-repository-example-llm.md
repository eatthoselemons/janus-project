> **Audience:** LLM / AI Agent (Implementation & Compliance)

# End-to-End Neo4j Repository Example

This document provides a complete, self-contained example of a repository layer for interacting with a Neo4j database using Effect. Use this as a reference for creating new repositories.

## 1. Core Dependencies and Client

First, define the Neo4j driver and the client service that will be used by repositories.

```typescript
import { Config, Context, Effect, Layer, Schema } from "effect"
import * as neo4j from "neo4j-driver"

// Define a configuration schema for Neo4j connection details
export const Neo4jConfig = Schema.Struct({
  url: Config.string("NEO4J_URL"),
  username: Config.string("NEO4J_USERNAME"),
  password: Config.redacted("NEO4J_PASSWORD")
})

// Define the Neo4j driver as a service for dependency injection
export class Neo4jDriver extends Context.Tag("Neo4jDriver")<
  Neo4jDriver,
  neo4j.Driver
>() {}

// Create a live layer for the Neo4j driver
// This layer handles the creation and disposal of the driver resource
export const Neo4jDriverLive = Layer.scoped(
  Neo4jDriver,
  Effect.gen(function*() {
    const config = yield* Config.all(Neo4jConfig)
    const driver = neo4j.driver(
      config.url,
      neo4j.auth.basic(config.username, Config.value(config.password))
    )
    
    // Ensure the driver is closed when the scope is released
    yield* Effect.addFinalizer(() => Effect.promise(() => driver.close()))
    
    return driver
  })
)

// Define a potential Neo4j error type
export class Neo4jError extends Schema.TaggedError<Neo4jError>()(
  "Neo4jError",
  { message: Schema.String }
) {}
```

## 2. Data and Schema Definitions

Define the domain types and schemas for the Neo4j nodes and relationships. **Never use `Model.Class` for Neo4j.**

```typescript
// Branded types to avoid primitive obsession
export const PersonId = Schema.String.pipe(Schema.brand("PersonId"))
export type PersonId = Schema.Schema.Type<typeof PersonId>

export const PersonName = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("PersonName")
)
export type PersonName = Schema.Schema.Type<typeof PersonName>

// Schema for a Person node in Neo4j
export const PersonNode = Schema.Struct({
  id: PersonId,
  name: PersonName,
  createdAt: Schema.Date, // Using Schema.Date for simplicity
  labels: Schema.Array(Schema.String)
})
export type PersonNode = Schema.Schema.Type<typeof PersonNode>
```

## 3. Repository Service and Implementation

Define the repository interface using `Context.Tag` and provide a live implementation in a `Layer`.

```typescript
// 1. Define the repository interface (the contract)
export interface PersonRepository {
  readonly findById: (
    id: PersonId
  ) => Effect.Effect<Option.Option<PersonNode>, Neo4jError>
  
  readonly create: (
    person: Omit<PersonNode, "createdAt" | "labels">
  ) => Effect.Effect<PersonNode, Neo4jError>
  
  readonly createFollowsRelationship: (
    fromId: PersonId,
    toId: PersonId
  ) => Effect.Effect<void, Neo4jError>
}

// 2. Create a Context.Tag for the repository
export const PersonRepository = Context.Tag<PersonRepository>("PersonRepository")

// 3. Create the live layer implementation
export const PersonRepositoryLive = Layer.effect(
  PersonRepository,
  Effect.gen(function*() {
    const driver = yield* Neo4jDriver

    // Helper to run a session and decode results
    const runQuery = <A>(
      query: string,
      params: Record<string, any>,
      decode: (value: unknown) => A
    ): Effect.Effect<A, Neo4jError> =>
      Effect.tryPromise({
        try: async () => {
          const session = driver.session()
          try {
            const result = await session.run(query, params)
            return decode(result)
          } finally {
            await session.close()
          }
        },
        catch: (error) => new Neo4jError({ message: String(error) })
      })

    return PersonRepository.of({
      findById: (id) =>
        runQuery(
          "MATCH (p:Person {id: $id}) RETURN p",
          { id },
          (result: neo4j.QueryResult) =>
            Option.fromNullable(result.records[0]?.get("p").properties).pipe(
              Option.flatMap((props) => Schema.decodeUnknownOption(PersonNode)(props))
            )
        ),
      
      create: (person) =>
        runQuery(
          "CREATE (p:Person {id: $id, name: $name, createdAt: datetime(), labels: ['Person']}) RETURN p",
          person,
          (result: neo4j.QueryResult) =>
            Schema.decodeUnknown(PersonNode)(
              result.records[0].get("p").properties
            )
        ),
        
      createFollowsRelationship: (fromId, toId) =>
        runQuery(
          `MATCH (a:Person {id: $fromId}), (b:Person {id: $toId})
           CREATE (a)-[r:FOLLOWS {since: datetime()}]->(b)`,
          { fromId, toId },
          () => undefined
        ).pipe(Effect.asVoid),
    })
  })
)
```

## 4. Composing and Using the Repository

Here is how you would provide the layers and use the repository in a program.

```typescript
// Example program that uses the PersonRepository
const program = Effect.gen(function*() {
  const repo = yield* PersonRepository
  
  const personId = PersonId("person-123")
  
  // Create a person
  const newPerson = yield* repo.create({ id: personId, name: PersonName("Alice") })
  console.log("Created Person:", newPerson)
  
  // Find the person
  const foundPerson = yield* repo.findById(personId)
  console.log("Found Person:", foundPerson)
})

// Create the full application layer, providing dependencies
const AppLayer = Layer.provide(PersonRepositoryLive, Neo4jDriverLive)

// Provide the layer to the program to make it runnable
const runnable = Effect.provide(program, AppLayer)

// To run this, you would need to set NEO4J_* environment variables
// and then execute: Effect.runPromise(runnable)
```
