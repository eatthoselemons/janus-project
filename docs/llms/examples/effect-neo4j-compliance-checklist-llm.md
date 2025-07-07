> **Audience:** LLM / AI Agent (Implementation & Compliance)

# Effect + Neo4j Compliance Checklist

This checklist ensures your Neo4j + Effect code follows principles from:
- **"Grokking Simplicity"** by Eric Normand
- **"Type-Driven Development with Idris"** by Edwin Brady  
- **"Programming with Types"** by Vlad Riscutia

## 🎯 Type-First Development (MUST DO FIRST!)

### Step 1: Define Types Before Implementation
- [ ] **Define ALL domain types FIRST** (before writing any functions)
  ```typescript
  // ✅ CORRECT: Types first
  export const NodeId = Schema.String.pipe(Schema.brand("NodeId"))
  export type NodeId = typeof NodeId.Type
  
  // ❌ WRONG: Raw primitives
  const getNode = (id: string) => ...
  ```

- [ ] **No primitive types in domain logic** (Programming with Types)
  - [ ] Brand all IDs: `PersonId`, `GroupId`, `NodeId`
  - [ ] Brand all values: `Email`, `PersonName`, `Url`
  - [ ] Use phantom types for compile-time guarantees

- [ ] **Make illegal states unrepresentable** (Type-Driven Development)
  ```typescript
  // ✅ Email validation in the type
  export const Email = Schema.String.pipe(
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
    Schema.brand("Email")
  )
  ```

### Step 2: Write Function Signatures
- [ ] **Define function types through composition**
  ```typescript
  // ✅ CORRECT: Compose functions as values
  export const makePersonRepository = (neo4j: Neo4jClient) => ({
    findById: (id: PersonId) => Effect.Effect<Option.Option<PersonNode>, Neo4jError>,
    findFollowers: (id: PersonId) => Effect.Effect<ReadonlyArray<PersonNode>, Neo4jError>
  })
  
  // Type is inferred from the function
  export type PersonRepository = ReturnType<typeof makePersonRepository>
  
  // ❌ AVOID: Interface-first approach
  export interface PersonRepository { ... }
  ```

### Step 3: Let Types Guide Implementation
- [ ] **Follow the types** - If it compiles, it should work
- [ ] **Refine types if needed** - Make them more precise as you learn

## 📊 Data Layer (What Things ARE)

### Neo4j Schema Rules
- [ ] **NEVER use Model.Class** - It's SQL-only!
- [ ] **Use Schema.Struct for nodes**:
  ```typescript
  export const PersonNode = Schema.Struct({
    id: NodeId,  // NOT string!
    name: PersonName,  // NOT string!
    email: Email,  // NOT string!
    labels: Schema.Array(Label),
    createdAt: Schema.DateTimeUtc
  })
  ```

- [ ] **Use Schema.Class only when nodes need methods**:
  ```typescript
  export class PersonNode extends Schema.Class<PersonNode>("PersonNode")({
    id: NodeId,
    labels: Schema.Array(Label)
  }) {
    hasLabel(label: Label): boolean {
      return this.labels.includes(label)
    }
  }
  ```

### Relationship Schemas
- [ ] **Define relationships as first-class entities**:
  ```typescript
  export const FollowsRelationship = Schema.Struct({
    since: Schema.DateTimeUtc,
    strength: RelationshipStrength  // Branded 0-1 range
  })
  ```

### Error Types
- [ ] **Use TaggedError for all domain errors**:
  ```typescript
  export class NodeNotFound extends Schema.TaggedError<NodeNotFound>()(
    "NodeNotFound",
    { nodeId: NodeId }  // Use branded types!
  ) {}
  ```

## 🧮 Calculations Layer (Pure Functions)

### Calculation Rules
- [ ] **NO Effect types in calculations**
- [ ] **NO side effects** (no logging, no I/O, no mutations)
- [ ] **Use branded types for parameters and returns**:
  ```typescript
  // ✅ CORRECT: Pure with branded types
  const calculateInfluence = (count: FollowerCount): InfluenceScore =>
    Schema.decodeSync(InfluenceScore)(Math.log10(count + 1) * 100)
  
  // ❌ WRONG: Raw types
  const calculateInfluence = (count: number): number => ...
  ```

### Business Logic Patterns
- [ ] **Separate decision from action**:
  ```typescript
  // CALCULATION: Can they follow?
  const canFollow = (follower: PersonNode, target: PersonNode): boolean =>
    follower.id !== target.id
  
  // ACTION: Actually create the relationship
  const createFollowsRelationship = (...) => Effect.Effect<...>
  ```

- [ ] **Compose small calculations**:
  ```typescript
  const isPopular = (score: InfluenceScore): boolean => score > 300
  const checkInfluencer = (count: FollowerCount): boolean =>
    isPopular(calculateInfluence(count))
  ```

## 🚀 Actions Layer (Side Effects)

### Neo4j Repository Pattern
- [ ] **Build repositories through function composition**:
  ```typescript
  // ✅ CORRECT: Compose repository from functions
  export const makePersonRepository = Effect.gen(function* () {
    const neo4j = yield* Neo4jClient
    
    // Compose basic operations
    const findById = (id: PersonId) => 
      neo4j.query(`MATCH (p:Person {id: $id}) RETURN p`, { id }).pipe(
        Effect.map(result => result.records[0]?.get('p')),
        Effect.flatMap(Schema.decodeUnknown(PersonNode))
      )
    
    const create = (node: PersonNode) =>
      neo4j.query(`CREATE (p:Person $props) RETURN p`, { props: node }).pipe(
        Effect.map(result => result.records[0].get('p')),
        Effect.flatMap(Schema.decodeUnknown(PersonNode))
      )
    
    // Return composed object
    return { findById, create } as const
  })
  
  // Derive type from implementation
  export type PersonRepository = Effect.Effect.Success<typeof makePersonRepository>
  ```

- [ ] **Use Context.Tag with derived type**:
  ```typescript
  export const PersonRepository = Context.Tag<PersonRepository>("PersonRepository")
  ```

### Neo4j Query Implementation
- [ ] **Type all Cypher parameters**:
  ```typescript
  // ✅ CORRECT: Branded type parameter
  neo4j.query(`MATCH (p:Person {id: $id}) RETURN p`, { id: personId })
  
  // ❌ WRONG: Raw string
  neo4j.query(`MATCH (p:Person {id: $id}) RETURN p`, { id: "person-123" })
  ```

- [ ] **Parse results immediately**:
  ```typescript
  neo4j.query(...).pipe(
    Effect.map(result => result.records[0]?.get('p')),
    Effect.flatMap(Schema.decodeUnknown(PersonNode))  // Parse at boundary
  )
  ```

### Service Layer
- [ ] **Compose services from smaller functions**:
  ```typescript
  // ✅ CORRECT: Compose service from functions
  const makeFollowPersonOperation = (
    repo: PersonRepository,
    canFollow: (a: PersonNode, b: PersonNode) => boolean
  ) => (followerId: PersonId, targetId: PersonId) =>
    Effect.gen(function* () {
      // Get data (action)
      const [follower, target] = yield* Effect.all([
        repo.findById(followerId),
        repo.findById(targetId)
      ])
      
      // Check business rule (calculation)
      if (!canFollow(follower.value, target.value)) {
        return yield* Effect.fail(new InvalidFollow())
      }
      
      // Perform action
      yield* repo.createFollows(followerId, targetId)
    })
  
  // Compose the full service
  export const makePersonService = Effect.gen(function* () {
    const repo = yield* PersonRepository
    
    return {
      followPerson: makeFollowPersonOperation(repo, canFollow),
      // Compose other operations...
    } as const
  })
  
  // Service layer uses the composed service
  export const PersonServiceLive = Layer.effect(
    PersonService,
    makePersonService
  )
  ```

## 🏗️ Layer Architecture (Stratified Design)

### Layer Dependencies
- [ ] **Bottom: Neo4j Client**
  ```typescript
  export const Neo4jClientLive = Layer.effect(
    Neo4jClient,
    Effect.sync(() => neo4j.driver(url, auth))
  )
  ```

- [ ] **Middle: Repositories**
  ```typescript
  export const PersonRepositoryLive = Layer.effect(
    PersonRepository,
    Effect.gen(function* () {
      const client = yield* Neo4jClient
      // ... implementation
    })
  ).pipe(Layer.provide(Neo4jClientLive))
  ```

- [ ] **Top: Services**
  ```typescript
  export const PersonServiceLive = Layer.effect(
    PersonService,
    Effect.gen(function* () {
      const repo = yield* PersonRepository
      // ... business logic
    })
  ).pipe(Layer.provide(PersonRepositoryLive))
  ```

### Dependency Rules
- [ ] **Each layer only knows about layers below**
- [ ] **No circular dependencies**
- [ ] **Dependencies explicit in Layer.provide()**

## 🧪 Testing

### Test Coverage Requirements
- [ ] **Sufficient Test Coverage**: For each feature/function, provide:
  - [ ] **Happy Path**: At least one test for the expected, successful use case.
  - [ ] **Failure Case**: At least one test for an expected failure (e.g., invalid input, error condition).
  - [ ] **Edge Case**: At least one test for a known edge case (e.g., empty lists, zero values, boundary conditions).

### Test Data with Types
- [ ] **Use proper type construction in tests**:
  ```typescript
  const testPerson: PersonNode = {
    id: Schema.decodeSync(PersonId)("person-test-1"),
    name: Schema.decodeSync(PersonName)("Test User"),
    email: Schema.decodeSync(Email)("test@example.com"),
    labels: [Schema.decodeSync(Label)("Person")],
    createdAt: new Date()
  }
  ```

### Test Layers
- [ ] **Create typed test implementations**:
  ```typescript
  export const PersonRepositoryTest = Layer.succeed(PersonRepository, {
    findById: (id) => 
      id === Schema.decodeSync(PersonId)("test-1")
        ? Effect.succeed(Option.some(testPerson))
        : Effect.succeed(Option.none())
  })
  ```

## 🔍 Common Neo4j + Effect Anti-Patterns

### ❌ NEVER Do These:
1. **Use Model.Class** - It's for SQL only!
   ```typescript
   // ❌ WRONG
   export class Person extends Model.Class<Person>("Person")({...})
   ```

2. **Pass raw strings as IDs**
   ```typescript
   // ❌ WRONG
   repo.findById("person-123")
   
   // ✅ CORRECT
   repo.findById(Schema.decodeSync(PersonId)("person-123"))
   ```

3. **Mix calculations with Effect**
   ```typescript
   // ❌ WRONG
   const canFollow = (...): Effect.Effect<boolean> => ...
   
   // ✅ CORRECT
   const canFollow = (...): boolean => ...
   ```

4. **Use primitive types in domain logic**
   ```typescript
   // ❌ WRONG
   const findById = (id: string) => ...
   
   // ✅ CORRECT
   const findById = (id: PersonId) => ...
   ```

5. **Parse data deep in the code**
   ```typescript
   // ❌ WRONG: Parsing in service logic
   const service = (data: unknown) => {
     const parsed = Schema.decodeUnknown(PersonNode)(data)
     // ...
   }
   
   // ✅ CORRECT: Parse at boundaries
   const handler = (rawData: unknown) =>
     Schema.decodeUnknown(PersonNode)(rawData).pipe(
       Effect.flatMap(service)
     )
   ```

## ✅ Final Verification

Before committing, verify:
- [ ] **ALL primitives are branded** (no raw string/number in domain)
- [ ] **NO Model.Class usage** (Neo4j uses Schema.Struct/Class)
- [ ] **Types defined BEFORE implementation**
- [ ] **Calculations are pure** (no Effect returns)
- [ ] **Actions handle all Effects**
- [ ] **Layers properly composed**
- [ ] **All Cypher parameters are typed**
- [ ] **Parse at boundaries, not in business logic**
- [ ] **Tests use proper type construction**
  - Include at least:
    - [ ] 1 test for expected use
    - [ ] 1 edge case
    - [ ] 1 failure case
- [ ] **Effect Wrapping**: All side effects wrapped in appropriate Effect constructors

## 📚 Quick Reference

| Concept | SQL (Model.Class) | Neo4j (Schema) |
|---------|-------------------|----------------|
| Entity Definition | `Model.Class` | `Schema.Struct` or `Schema.Class` |
| ID Type | `Model.Generated(NumberId)` | `NodeId` (branded string) |
| Timestamps | `Model.DateTimeInsert` | `Schema.DateTimeUtc` |
| Repository | `Model.makeRepository()` | Compose from functions |
| Relationships | Foreign keys | First-class `Schema.Struct` |
| Service Pattern | Interface-first | Function composition |

## 🎯 Composition Principles

1. **Build from small functions** - Each function does one thing
2. **Compose into larger functions** - Combine simple functions
3. **Derive types from implementations** - Let TypeScript infer
4. **No inheritance hierarchies** - Only composition
5. **Functions as values** - Pass and return functions

Remember: Compose → Type → Refine. Build up from small pieces!
