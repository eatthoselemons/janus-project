> **Audience:** LLM / AI Agent (Implementation & Reference)

# Essential Effect + Neo4j Guide

This guide ensures you implement Neo4j applications following the principles from three essential books:
- **"Grokking Simplicity"** by Eric Normand - Separate Data, Calculations, and Actions
- **"Type-Driven Development with Idris"** by Edwin Brady - Let types guide implementation
- **"Programming with Types"** by Vlad Riscutia - Avoid primitive obsession, use type composition

## Core Principles from All Three Books

### From "Grokking Simplicity":
1. **Stratified Design** - Build layers of abstraction
2. **Separate Actions, Calculations, and Data** - Actions have side effects, calculations are pure, data is immutable
3. **Minimize Actions** - Push logic into calculations
4. **Make Actions Atomic** - Group related side effects

### From "Type-Driven Development with Idris":
1. **Type, Define, Refine** - Start with types, implement, then improve
2. **Make illegal states unrepresentable** - Use types to prevent errors
3. **Total functions** - Handle all cases explicitly
4. **Types as specifications** - Types document intent

### From "Programming with Types":
1. **Avoid primitive obsession** - Wrap primitives in domain types
2. **Use composition over inheritance** - Build from functions, not classes
3. **Parse, don't validate** - Transform data once at boundaries
4. **Phantom types for compile-time guarantees** - Use brands
5. **Functions as values** - Compose behavior from small functions

## Implementation Pattern

Follow this order (Type-Define-Refine):
1. Define types that make illegal states impossible
2. Write function signatures using those types
3. Implement functions guided by types
4. Refine with more precise types if needed

## Composition Over Inheritance

**IMPORTANT**: TypeScript interfaces in this guide are used as type contracts, NOT for inheritance. Always prefer function composition:

```typescript
// ❌ WRONG: Class inheritance
class BaseRepository { ... }
class UserRepository extends BaseRepository { ... }

// ✅ CORRECT: Function composition
const makeBaseOperations = (db: Database) => ({
  findById: (id: Id) => ...,
  create: (entity: Entity) => ...
})

const makeUserRepository = (db: Database) => ({
  ...makeBaseOperations(db),
  findByEmail: (email: Email) => ...,
  // Additional user-specific operations
})
```

## Critical Schema Rules for Neo4j

**NEVER use Model.Class with Neo4j!** Model.Class is SQL-only.

```typescript
// ❌ WRONG for Neo4j
export class User extends Model.Class<User>("User")({...})

// ✅ CORRECT for Neo4j - avoiding primitive obsession
// Define branded types for domain concepts
export const NodeId = Schema.String.pipe(Schema.brand("NodeId"))
export type NodeId = typeof NodeId.Type

export const Email = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand("Email")
)
export type Email = typeof Email.Type

export const PersonName = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(100),
  Schema.brand("PersonName")
)
export type PersonName = typeof PersonName.Type

export const Label = Schema.String.pipe(Schema.brand("Label"))
export type Label = typeof Label.Type

export const UserNode = Schema.Struct({
  id: NodeId,
  email: Email,
  name: PersonName,
  labels: Schema.Array(Label)
})

// ✅ CORRECT for nodes with methods
export class UserNode extends Schema.Class<UserNode>("UserNode")({
  id: NodeId,
  name: PersonName,
  labels: Schema.Array(Label)
}) {
  hasLabel(label: Label): boolean {
    return this.labels.includes(label)
  }
}
```

## Complete Example Following All Three Books

Here's how to implement a feature following all principles:

```typescript
// STEP 1: Type-Driven Development (Edwin Brady)
// Define types FIRST, making illegal states unrepresentable

// Programming with Types (Vlad Riscutia) - No primitive obsession
export const UserId = Schema.String.pipe(
  Schema.pattern(/^user-[a-f0-9]{8}$/),
  Schema.brand("UserId")
)
export type UserId = typeof UserId.Type

// Make invalid emails impossible
export const Email = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand("Email")
)
export type Email = typeof Email.Type

// Composite type with constraints
export const User = Schema.Struct({
  id: UserId,
  email: Email,
  verified: Schema.Boolean
})
export type User = typeof User.Type

// STEP 2: Function signatures before implementation
export interface UserOperations {
  // Grokking Simplicity - This is an ACTION (database side effect)
  findUser: (id: UserId) => Effect.Effect<Option.Option<User>, DatabaseError>
  
  // This is a CALCULATION (pure)
  canSendEmail: (user: User) => boolean
  
  // This is an ACTION (sends email)
  sendWelcomeEmail: (user: User) => Effect.Effect<void, EmailError>
}

// STEP 3: Implement guided by types
// Grokking Simplicity - Separate calculations from actions
const canSendEmail = (user: User): boolean => user.verified

// Stratified design - Layer actions over calculations
const sendWelcomeEmailIfAllowed = (user: User) => 
  canSendEmail(user) 
    ? sendWelcomeEmail(user)
    : Effect.succeed(undefined)
```

## Data, Calculations, Actions Pattern

### 1. DATA (Immutable Schemas with Type-Driven Design)
```typescript
// Type-driven approach: Define domain types first
export const PersonId = Schema.String.pipe(Schema.brand("PersonId"))
export type PersonId = typeof PersonId.Type

export const PersonName = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(100),
  Schema.brand("PersonName")
)
export type PersonName = typeof PersonName.Type

// Constrain strength to valid range
export const RelationshipStrength = Schema.Number.pipe(
  Schema.between(0, 1),
  Schema.brand("RelationshipStrength")
)
export type RelationshipStrength = typeof RelationshipStrength.Type

// Node schemas using domain types
export const PersonNode = Schema.Struct({
  id: PersonId,
  name: PersonName,
  createdAt: Schema.DateTimeUtc
})
export type PersonNode = typeof PersonNode.Type

// Relationship schemas with proper types
export const FollowsRel = Schema.Struct({
  since: Schema.DateTimeUtc,
  strength: RelationshipStrength
})
export type FollowsRel = typeof FollowsRel.Type
```

### 2. CALCULATIONS (Pure Functions with Type Safety)
```typescript
// Define domain-specific types for calculations
export const FollowerCount = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand("FollowerCount")
)
export type FollowerCount = typeof FollowerCount.Type

export const InfluenceScore = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand("InfluenceScore")
)
export type InfluenceScore = typeof InfluenceScore.Type

// Type-safe calculations
const canFollow = (follower: PersonNode, target: PersonNode): boolean =>
  follower.id !== target.id

const calculateInfluence = (count: FollowerCount): InfluenceScore =>
  Schema.decodeSync(InfluenceScore)(Math.log10(count + 1) * 100)

const isInfluencer = (score: InfluenceScore): boolean =>
  score > 300

// Compose calculations safely
const checkInfluencer = (count: FollowerCount): boolean =>
  isInfluencer(calculateInfluence(count))
```

### 3. ACTIONS (Services with Effect)
```typescript
// Repository built through composition
export const makePersonRepository = Effect.gen(function* () {
  const neo4j = yield* Neo4jClient
  
  // Compose basic query functions
  const runQuery = <T>(query: string, params: Record<string, unknown>) =>
    neo4j.query(query, params)
  
  const decodeNode = <T>(schema: Schema.Schema<T>) => (record: any) =>
    Schema.decodeUnknown(schema)(record)
  
  // Build repository operations
  const findById = (id: PersonId) =>
    runQuery(`MATCH (p:Person {id: $id}) RETURN p`, { id }).pipe(
      Effect.map(result => result.records[0]?.get('p')),
      Effect.map(Option.fromNullable),
      Effect.flatMap(Option.traverse(decodeNode(PersonNode)))
    )
  
  const create = (person: PersonNode) =>
    runQuery(`CREATE (p:Person $props) RETURN p`, { props: person }).pipe(
      Effect.map(result => result.records[0].get('p')),
      Effect.flatMap(decodeNode(PersonNode))
    )
  
  return { findById, create, /* other operations */ } as const
})

// Derive type from implementation
export type PersonRepository = Effect.Effect.Success<typeof makePersonRepository>
export const PersonRepository = Context.Tag<PersonRepository>("PersonRepository")

// Implementation
export const PersonRepositoryLive = Layer.effect(
  PersonRepository,
  Effect.gen(function* () {
    const neo4j = yield* Neo4jClient
    
    return {
      findById: (id) =>
        // Type system ensures we can only pass PersonId, not any string
        neo4j.query(`MATCH (p:Person {id: $id}) RETURN p`, { id }).pipe(
          Effect.map(result => result.records[0]?.get('p')),
          Effect.map(Option.fromNullable),
          Effect.flatMap(Option.traverse(Schema.decodeUnknown(PersonNode)))
        ),
        
      create: (person) =>
        neo4j.query(`CREATE (p:Person $props) RETURN p`, { props: person }).pipe(
          Effect.map(result => result.records[0].get('p')),
          Effect.flatMap(Schema.decodeUnknown(PersonNode))
        ),
        
      findFollowers: (id) =>
        neo4j.query(
          `MATCH (follower:Person)-[:FOLLOWS]->(p:Person {id: $id}) RETURN follower`,
          { id }
        ).pipe(
          Effect.map(result => result.records.map(r => r.get('follower'))),
          Effect.flatMap(Schema.decodeUnknown(Schema.Array(PersonNode)))
        ),
        
      createFollows: (fromId, toId) =>
        neo4j.query(
          `MATCH (a:Person {id: $fromId}), (b:Person {id: $toId})
           CREATE (a)-[:FOLLOWS {since: datetime()}]->(b)`,
          { fromId, toId }
        ).pipe(Effect.asVoid)
    }
  })
)

// Better: Use function composition
export const PersonRepositoryLive = Layer.effect(
  PersonRepository,
  makePersonRepository
)
```

## Service Layer Pattern

```typescript
// Service built through function composition
const makeFollowPersonOperation = (
  findById: (id: PersonId) => Effect.Effect<Option.Option<PersonNode>, Neo4jError>,
  createFollows: (from: PersonId, to: PersonId) => Effect.Effect<void, Neo4jError>,
  canFollow: (a: PersonNode, b: PersonNode) => boolean
) => (followerId: PersonId, targetId: PersonId) =>
  Effect.gen(function* () {
    const [follower, target] = yield* Effect.all([
      findById(followerId),
      findById(targetId)
    ])
    
    if (Option.isNone(follower) || Option.isNone(target)) {
      return yield* Effect.fail(new UserNotFound())
    }
    
    if (!canFollow(follower.value, target.value)) {
      return yield* Effect.fail(new InvalidFollow())
    }
    
    yield* createFollows(followerId, targetId)
  })

// Compose the service from operations
export const makePersonService = Effect.gen(function* () {
  const repo = yield* PersonRepository
  
  return {
    followPerson: makeFollowPersonOperation(
      repo.findById,
      repo.createFollows,
      canFollow
    ),
    getInfluencers: makeGetInfluencersOperation(repo)
  } as const
})

// Derive type from implementation
export type PersonService = Effect.Effect.Success<typeof makePersonService>
export const PersonService = Context.Tag<PersonService>("PersonService")

// Layer uses the composed service
export const PersonServiceLive = Layer.effect(
  PersonService,
  makePersonService
)
        
      getInfluencers: () =>
        Effect.gen(function* () {
          const allPeople = yield* repo.findAll()
          
          // Use calculation to filter influencers with type safety
          const influencers = yield* Effect.all(
            allPeople.map(person =>
              repo.findFollowers(person.id).pipe(
                Effect.map(followers => {
                  // Types ensure we can't pass negative counts
                  const count = Schema.decodeSync(FollowerCount)(followers.length)
                  const score = calculateInfluence(count)
                  return {
                    person,
                    isInfluencer: isInfluencer(score)
                  }
                })
              )
            )
          )
          
          return influencers
            .filter(({ isInfluencer }) => isInfluencer)
            .map(({ person }) => person)
        })
    }
  })
)
```

## Error Handling

```typescript
// Tagged errors for type safety
export class Neo4jError extends Schema.TaggedError<Neo4jError>()(
  "Neo4jError",
  { message: Schema.String }
) {}

export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { userId: PersonId }
) {}

export class InvalidFollow extends Schema.TaggedError<InvalidFollow>()(
  "InvalidFollow",
  { reason: Schema.String }
) {}
```

## Testing with Layers

```typescript
// Test implementation with proper types
export const PersonRepositoryTest = Layer.succeed(PersonRepository, {
  findById: (id) => Effect.succeed(
    id === Schema.decodeSync(PersonId)("test-1")
      ? Option.some({
          id: Schema.decodeSync(PersonId)("test-1"),
          name: Schema.decodeSync(PersonName)("Test User"),
          createdAt: new Date()
        })
      : Option.none()
  ),
  create: (person) => Effect.succeed(person),
  findFollowers: () => Effect.succeed([]),
  createFollows: () => Effect.succeed(void 0)
})

// Usage with proper types
const program = Effect.gen(function* () {
  const service = yield* PersonService
  const user1 = yield* Schema.decode(PersonId)("user-1")
  const user2 = yield* Schema.decode(PersonId)("user-2")
  yield* service.followPerson(user1, user2)
})

// Test
const test = program.pipe(
  Effect.provide(PersonServiceLive),
  Effect.provide(PersonRepositoryTest)
)

// Production
const live = program.pipe(
  Effect.provide(PersonServiceLive),
  Effect.provide(PersonRepositoryLive),
  Effect.provide(Neo4jClientLive)
)
```

## Implementation Checklist

When implementing ANY feature, follow this order:

### 1. Type-Driven Development (Edwin Brady)
- [ ] Define types FIRST
- [ ] Make illegal states unrepresentable
- [ ] Write function signatures before implementation
- [ ] Let types guide the implementation

### 2. Programming with Types (Vlad Riscutia)
- [ ] Replace ALL primitives with branded types
- [ ] Use composition, not inheritance
- [ ] Parse data at boundaries (Effect.flatMap(Schema.decode))
- [ ] Never pass raw strings or numbers

### 3. Grokking Simplicity (Eric Normand)
- [ ] Identify what is Data, Calculation, or Action
- [ ] Keep calculations pure (no Effect)
- [ ] Minimize actions (push logic to calculations)
- [ ] Layer actions over calculations

## Key Rules Summary

1. **Always Start with Types**
   ```typescript
   // WRONG: Implementation first
   const getUser = (id: string) => { ... }
   
   // RIGHT: Types first
   export const UserId = Schema.String.pipe(Schema.brand("UserId"))
   export type UserId = typeof UserId.Type
   const getUser = (id: UserId) => { ... }
   ```

2. **Separate Concerns Strictly**
   ```typescript
   // DATA: What things ARE
   export const Person = Schema.Struct({ id: PersonId, name: Name })
   
   // CALCULATIONS: What to DO with data (pure)
   const isAdult = (age: Age): boolean => age >= 18
   
   // ACTIONS: HOW to do it (Effect)
   const savePerson = (person: Person): Effect.Effect<...> => ...
   ```

3. **Neo4j-Specific Rules**
   - NEVER use Model.Class (SQL only!)
   - Use Schema.Struct/Class for nodes
   - Brand all IDs and domain values
   - Type all Cypher query parameters

4. **Layer Architecture** (Stratified Design)
   - Infrastructure: Neo4jClient (bottom)
   - Data Access: Repositories (middle)  
   - Business Logic: Services (top)
   - Each layer only knows about layers below

5. **Type Safety Throughout**
   - No `any` or `unknown` in business logic
   - Parse external data immediately
   - Use Option for nullable values
   - Use Either/Effect for errors

By following these principles from all three books, you create code that is:
- **Impossible to misuse** (Type-Driven Development)
- **Easy to understand** (Grokking Simplicity)
- **Built from composable functions** (Programming with Types)
- **No inheritance hierarchies** - Only function composition
- **Types derived from implementations** - Not interface-first design