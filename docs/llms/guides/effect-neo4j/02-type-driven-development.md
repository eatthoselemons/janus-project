> **Audience:** LLM / AI Agent (Focused Guide)

# 2. Type-Driven Development Workflow

The Type-Driven Development workflow consists of three steps: Type, Define, and Refine.

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