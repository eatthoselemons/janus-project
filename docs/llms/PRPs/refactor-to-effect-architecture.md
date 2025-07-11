
# PRP: Refactor to Align with Core Effect Architecture

## Abstract

This proposal outlines a refactoring plan to bring the current codebase into strict alignment with the project's foundational principles: "Data, Calculations, Actions" separation, type-driven development, and Effect-TS best practices. The core issues to be addressed are unmanaged side effects in data creation, bypassed schema validation in database repositories, and improper separation of concerns. The refactoring will focus on `src/core/model.ts` and `src/db/repositories.ts` to introduce proper effect management for side effects (`UUID` and `Clock`), enforce rigorous data validation on database outputs, and clarify the roles of each layer in the application.

## Background

An analysis of the `src` directory revealed several deviations from our architectural charter. While the `domain` and `neo4j` service layers are well-defined, the interaction between the business logic (`model.ts`) and the persistence layer (`repositories.ts`) is flawed.

### 1. Unmanaged Side Effects in Model Construction

In `src/core/model.ts`, the `build...` functions create entities using direct, unmanaged calls to side-effectful APIs:

```typescript
// From src/core/model.ts
export const buildSnippet = (data: CreateSnippetData): Snippet => ({
  id: crypto.randomUUID() as any, // Unmanaged side effect
  name: data.name,
  description: data.description,
  createdAt: new Date(), // Unmanaged side effect
  updatedAt: new Date()  // Unmanaged side effect
})
```

This violates the "Actions" principle. Generating a UUID and getting the current time are side effects that should be wrapped in `Effect` to make them explicit, testable, and controllable.

### 2. Bypassed Schema Validation in Repositories

In `src/db/repositories.ts`, data retrieved from Neo4j is cast directly to the domain type using `.make()`, which is an unsafe type assertion provided by `Schema.Class` (and in this case, it seems to be used on a `Struct` which is even more incorrect).

```typescript
// From src/db/repositories.ts
const findById = (id: SnippetId): Effect.Effect<Option.Option<Snippet>, RepositoryError> =>
  neo4j.runQuery<Snippet>(
    `MATCH (s:Snippet {id: $id}) RETURN s`,
    { id }
  ).pipe(
    // Incorrect: This is an unsafe cast, not a validation.
    Effect.map(records => records.length > 0 ? Option.some(Snippet.make(records[0])) : Option.none()), 
    // ...
  )
```

The data returned from the database is of type `unknown` and must be validated against the `Snippet` schema using `Schema.decodeUnknown(Snippet)`. The current implementation completely bypasses this safety check, defeating a primary benefit of using `Effect.Schema`.

### 3. Improper Separation of Concerns

The repositories currently handle the creation of entity properties (like IDs and timestamps) within their Cypher queries.

```cypher
# From src/db/repositories.ts
CREATE (s:Snippet {id: randomUUID(), name: $name, ... createdAt: datetime()})
```

A repository's responsibility should be limited to persisting data it receives. The business logic for creating that data, including its identity and timestamps, belongs in a higher-level service (an Action).

## Proposal

To address these issues, I propose a four-step refactoring process.

### Step 1: Introduce `Clock` and `Uuid` Services

We will introduce `Clock` and `Uuid` services to manage time and UUID generation as proper Effects. The `build...` functions in `src/core/model.ts` will be refactored into two distinct types of functions:

1.  **Pure `create` functions**: These will be pure calculations that take all data, including `id` and `createdAt`, as arguments.
2.  **Impure `build` functions (Actions)**: These will be the new "constructors". They will use the `Clock` and `Uuid` services to get the current time and a new UUID, and then call the pure `create` function.

**Example Refactoring (`src/core/model.ts`):**

```typescript
// Before
export const buildSnippet = (data: CreateSnippetData): Snippet => ({
  id: crypto.randomUUID() as any,
  // ...
  createdAt: new Date(),
  updatedAt: new Date()
})

// After
import { Clock, Effect, Data } from "effect"
import { Uuid } from "effect-contrib/Uuid"

// Pure Calculation
export const createSnippet = (data: CreateSnippetData & { id: SnippetId, createdAt: Date, updatedAt: Date }): Snippet => {
  return Snippet.make(data)
}

// Action
export const buildSnippet = (data: CreateSnippetData): Effect.Effect<Snippet, never, Clock | Uuid> => 
  Effect.gen(function*() {
    const now = yield* Clock.currentTimeMillis
    const id = yield* Uuid.v4
    return createSnippet({
      ...data,
      id: id as SnippetId,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    })
  })
```

### Step 2: Refactor Repositories to Use Schema Decoding

All repository methods that retrieve data from Neo4j will be updated to use `Schema.decodeUnknown` to safely validate the data against the domain schema.

**Example Refactoring (`src/db/repositories.ts`):**

```typescript
// Before
const findById = (id: SnippetId) =>
  neo4j.runQuery<Snippet>(/* ... */).pipe(
    Effect.map(records => records.length > 0 ? Option.some(Snippet.make(records[0])) : Option.none()),
    // ...
  )

// After
const findById = (id: SnippetId) =>
  neo4j.runQuery<unknown>(/* ... */).pipe(
    Effect.map(records => Option.fromNullable(records[0])),
    Effect.flatMap(Option.traverse(Schema.decodeUnknown(Snippet))), // Safe decoding
    Effect.mapError(cause => new RepositoryError({
      // ...
    })),
    // ...
  )
```

### Step 3: Refactor Repository `create` Methods

The `create` methods in repositories will be simplified. They will now accept a complete, pre-built entity object and pass its properties to the Cypher query.

**Example Refactoring (`src/db/repositories.ts`):**

```typescript
// Before
const create = (snippet: CreateSnippetData) =>
  neo4j.runQuery<Snippet>(
    `CREATE (s:Snippet {id: randomUUID(), name: $name, ...}) RETURN s`,
    { name: snippet.name, ... }
  )

// After
const create = (snippet: Snippet) => // Takes the full Snippet object
  neo4j.runQuery<unknown>(
    `CREATE (s:Snippet $props) RETURN s`,
    { props: snippet } // Pass the whole object as properties
  ).pipe(
    Effect.map(records => records[0]),
    Effect.flatMap(Schema.decodeUnknown(Snippet)),
    // ...
  )
```

### Step 4: Update Tests

All relevant unit and integration tests will be updated to reflect these changes. Tests for actions will now require providing `Clock.Test` and `Uuid.Test` layers, allowing for deterministic testing.

## Rationale

These changes will yield significant benefits:

1.  **Correctness & Safety**: By validating data from the database, we prevent invalid data shapes from ever entering the application, eliminating a large class of potential bugs.
2.  **Testability**: By managing side effects with `Effect`, we can easily provide mock implementations for `Clock` and `Uuid` in our tests, making our business logic deterministic and verifiable.
3.  **Clarity & Maintainability**: Strictly adhering to the "Data, Calculations, Actions" paradigm makes the codebase easier to reason about. The role of each function and module becomes unambiguous.
4.  **Adherence to Charter**: This refactoring brings the codebase into full compliance with the project's documented architectural principles.

## Disadvantages

-   There will be a minor increase in boilerplate due to the use of `Clock` and `Uuid` services and the need to provide them in the application's `Layer`. However, this is a standard practice in `Effect-TS` applications and the trade-off for correctness and testability is well worth it.
