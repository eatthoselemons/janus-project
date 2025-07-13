> **Audience:** LLM / AI Agent (Focused Guide)

# 8. Common Patterns & Anti-Patterns

This section provides a quick reference for correct patterns to follow and common anti-patterns to avoid.

### ✅ Correct Patterns

#### Type-Safe Query Parameters

```typescript
// ✅ CORRECT - All parameters are typed
const findByEmail = (email: Email) =>
  neo4j.runQuery(
    `MATCH (p:Person {email: $email}) RETURN p`,
    { email }, // Email type ensures valid format
  );
```

#### Parse at Boundaries

```typescript
// ✅ CORRECT - Parse immediately after query
const findPerson = (id: PersonId) =>
  neo4j.run(`MATCH (p:Person {id: $id}) RETURN p`, { id }).pipe(
    Effect.map((result) => result.records[0]?.get('p')),
    Effect.flatMap(Schema.decode(PersonNode)), // Parse here
  );
```

#### Separate Concerns

```typescript
// ✅ CORRECT - Clear separation
// CALCULATION (pure)
const canPromote = (employee: Employee): boolean =>
  employee.yearsOfService >= 2 && employee.performanceRating >= 4;

// ACTION (effect)
const promoteEmployee = (id: EmployeeId) =>
  Effect.gen(function* () {
    const employee = yield* repo.findById(id);

    if (!canPromote(employee)) {
      return yield* Effect.fail(new IneligibleForPromotion());
    }

    yield* repo.updateRole(id, getNextRole(employee.role));
  });
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
       const user = yield* Schema.decodeUnknown(User)(data); // Too late!
       // ... business logic
     });

   // ✅ CORRECT
   const processUser = (
     user: User, // Already parsed
   ) =>
     Effect.gen(function* () {
       // ... business logic
     });
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
