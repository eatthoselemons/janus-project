> **Audience:** LLM / AI Agent (Focused Guide)

# 5. Actions Layer - Effect Services (Updated)

This section covers the Actions layer with the updated patterns from our implementation.

### The Neo4j Service: Modern Pattern

Our Neo4j service provides multiple access patterns for different use cases:

```typescript
export interface Neo4jImpl {
  /**
   * Execute a single query - best for simple operations
   */
  readonly runQuery: <T = unknown>(
    query: CypherQuery,
    params?: QueryParameters,
  ) => Effect.Effect<T[], Neo4jError, never>;

  /**
   * Execute multiple operations in a transaction
   * Automatically commits on success, rolls back on failure
   */
  readonly runInTransaction: <A>(
    operations: (tx: TransactionContext) => Effect.Effect<A, Neo4jError, never>,
  ) => Effect.Effect<A, Neo4jError, never>;

  /**
   * Execute multiple queries efficiently with the same session
   */
  readonly runBatch: <T = unknown>(
    queries: Array<{
      query: CypherQuery;
      params?: QueryParameters;
    }>,
  ) => Effect.Effect<T[][], Neo4jError, never>;

  /**
   * For complex operations that need full session control
   */
  readonly withSession: <A>(
    work: (session: Session) => Effect.Effect<A, Neo4jError, never>,
  ) => Effect.Effect<A, Neo4jError, never>;
}

export class Neo4jService extends Context.Tag('Neo4jService')<
  Neo4jService,
  Neo4jImpl
>() {}
```

### Key Patterns and Best Practices

#### 1. Branded Types for Query Safety

Always use branded types for queries and parameters:

```typescript
// Helper function for template literal queries
export const cypher = (
  strings: TemplateStringsArray,
  ...values: unknown[]
): CypherQuery => {
  const query = strings.reduce((acc, str, i) => {
    return acc + str + (values[i] !== undefined ? String(values[i]) : '');
  }, '');
  return Schema.decodeSync(CypherQuery)(query);
};

// Helper for query parameters with error handling
export const queryParams = (
  params: Record<string, unknown>,
): Effect.Effect<QueryParameters, UndefinedQueryParameterError> =>
  Effect.gen(function* () {
    const result: QueryParameters = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        return yield* Effect.fail(
          new UndefinedQueryParameterError({
            parameterName: key,
            message: `Query parameter '${key}' has undefined value. Use null for absent values in Neo4j queries.`,
          }),
        );
      }
      result[Schema.decodeSync(QueryParameterName)(key)] = value;
    }
    return result;
  });
```

#### 2. Repository/Data Access Patterns

There are two valid approaches in Effect for organizing data access functions:

**Option A: Individual Function Exports (More Functional)**

This approach exports each function individually, which is more aligned with functional programming principles:

```typescript
// In personDataAccess.ts
export const findPersonById = (id: PersonId) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`MATCH (p:Person {id: ${id}}) RETURN p`;
    const params = yield* queryParams({ id });
    const results = yield* neo4j.runQuery<{ p: unknown }>(query, params);

    if (results.length === 0) return Option.none();

    const person = yield* Schema.decode(PersonNode)(results[0].p);
    return Option.some(person);
  });

export const createPerson = (person: PersonNode) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`
      CREATE (p:Person $props)
      SET p.createdAt = datetime()
      RETURN p
    `;
    const params = yield* queryParams({ props: person });
    const results = yield* neo4j.runQuery<{ p: unknown }>(query, params);

    return yield* Schema.decode(PersonNode)(results[0].p);
  });

export const createFollowsRelationship = (
  followerId: PersonId,
  targetId: PersonId,
  relationship: FollowsRelationship,
) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`
      MATCH (follower:Person {id: $followerId})
      MATCH (target:Person {id: $targetId})
      CREATE (follower)-[r:FOLLOWS $props]->(target)
      RETURN r
    `;
    const params = yield* queryParams({
      followerId,
      targetId,
      props: relationship,
    });
    yield* neo4j.runQuery(query, params);
  });
```

**Option B: Grouped Repository Pattern**

This approach groups related operations, useful when you want to swap implementations for testing:

```typescript
export const makePersonRepository = Effect.gen(function* () {
  const neo4j = yield* Neo4jService;

  const findById = (id: PersonId) =>
    Effect.gen(function* () {
      const query = cypher`MATCH (p:Person {id: ${id}}) RETURN p`;
      const params = yield* queryParams({ id });
      const results = yield* neo4j.runQuery<{ p: unknown }>(query, params);

      if (results.length === 0) return Option.none();

      const person = yield* Schema.decode(PersonNode)(results[0].p);
      return Option.some(person);
    });

  const create = (person: PersonNode) =>
    Effect.gen(function* () {
      const query = cypher`
        CREATE (p:Person $props)
        SET p.createdAt = datetime()
        RETURN p
      `;
      const params = yield* queryParams({ props: person });
      const results = yield* neo4j.runQuery<{ p: unknown }>(query, params);

      return yield* Schema.decode(PersonNode)(results[0].p);
    });

  const createFollowsRelationship = (
    followerId: PersonId,
    targetId: PersonId,
    relationship: FollowsRelationship,
  ) =>
    Effect.gen(function* () {
      const query = cypher`
        MATCH (follower:Person {id: $followerId})
        MATCH (target:Person {id: $targetId})
        CREATE (follower)-[r:FOLLOWS $props]->(target)
        RETURN r
      `;
      const params = yield* queryParams({
        followerId,
        targetId,
        props: relationship,
      });
      yield* neo4j.runQuery(query, params);
    });

  return { findById, create, createFollowsRelationship };
});

// If using the grouped pattern, you might want to create a service:
export type PersonRepository = Effect.Effect.Success<
  typeof makePersonRepository
>;
export const PersonRepository =
  Context.Tag<PersonRepository>('PersonRepository');
export const PersonRepositoryLive = Layer.effect(
  PersonRepository,
  makePersonRepository,
);
```

**When to use each pattern:**

- **Individual functions**: Better for pure FP style, easier to test individual functions, more tree-shakeable
- **Grouped repository**: Better when you need to swap implementations (test vs production), want to enforce consistent patterns across operations

````

#### 3. Service Layer with Transactions

For business logic, prefer individual function exports over grouped services:

```typescript
// Option A: Individual function exports (PREFERRED for business logic)
export const followPerson = (followerId: PersonId, targetId: PersonId) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    return yield* neo4j.runInTransaction((tx) =>
      Effect.gen(function* () {
        // All queries in this block run in the same transaction
        const followerQuery = cypher`MATCH (p:Person {id: ${followerId}}) RETURN p`;
        const followerParams = yield* queryParams({ id: followerId });
        const followerResults = yield* tx.run<{ p: unknown }>(
          followerQuery,
          followerParams,
        );

        if (followerResults.length === 0) {
          return yield* Effect.fail(
            new UserNotFound({ userId: followerId }),
          );
        }

        const targetQuery = cypher`MATCH (p:Person {id: ${targetId}}) RETURN p`;
        const targetParams = yield* queryParams({ id: targetId });
        const targetResults = yield* tx.run<{ p: unknown }>(
          targetQuery,
          targetParams,
        );

        if (targetResults.length === 0) {
          return yield* Effect.fail(
            new UserNotFound({ userId: targetId }),
          );
        }

        const follower = yield* Schema.decode(PersonNode)(followerResults[0].p);
        const target = yield* Schema.decode(PersonNode)(targetResults[0].p);

        if (!canFollow(follower, target)) {
          return yield* Effect.fail(
            new InvalidFollow({ reason: 'Cannot follow this user' }),
          );
        }

        const createQuery = cypher`
          MATCH (follower:Person {id: $followerId})
          MATCH (target:Person {id: $targetId})
          CREATE (follower)-[r:FOLLOWS {since: datetime(), strength: 1.0}]->(target)
          RETURN r
        `;
        const createParams = yield* queryParams({ followerId, targetId });
        yield* tx.run(createQuery, createParams);
      }),
    );
  });

// Import and use individual functions directly
// In another file:
import { followPerson, findPersonById, createPerson } from './personOperations';

// Use directly without service objects
const program = Effect.gen(function* () {
  const person = yield* findPersonById(userId);
  if (Option.isSome(person)) {
    yield* followPerson(currentUserId, userId);
  }
});
````

### Testing with Test Layers

Create test layers for the Neo4j service:

```typescript
export const Neo4jTest = (mockData: Map<string, unknown[]> = new Map()) =>
  Layer.succeed(
    Neo4jService,
    Neo4jService.of({
      runQuery: <T = unknown>(
        query: CypherQuery,
        _params: QueryParameters = {},
      ) =>
        Effect.gen(function* () {
          const data = mockData.get(query) || [];
          yield* Effect.logDebug(`Mock query: ${query}`);
          return data as T[];
        }),

      runInTransaction: (operations) =>
        Effect.gen(function* () {
          const txContext: TransactionContext = {
            run: <T = unknown>(
              query: CypherQuery,
              _params: QueryParameters = {},
            ) =>
              Effect.gen(function* () {
                const data = mockData.get(query) || [];
                yield* Effect.logDebug(`Mock transaction query: ${query}`);
                return data as T[];
              }),
          };
          return yield* operations(txContext);
        }),

      runBatch: <T = unknown>(
        queries: Array<{ query: CypherQuery; params?: QueryParameters }>,
      ) =>
        Effect.gen(function* () {
          const results: T[][] = [];
          for (const { query } of queries) {
            const data = mockData.get(query) || [];
            yield* Effect.logDebug(`Mock batch query: ${query}`);
            results.push(data as T[]);
          }
          return results;
        }),

      withSession: (work) =>
        Effect.gen(function* () {
          const mockSession = createMockSession(mockData);
          return yield* work(mockSession);
        }),
    }),
  );
```

### Important Notes

1. **No Currying**: Service methods use standard parameter passing, not currying, for better ergonomics with optional parameters
2. **Error Handling**: Undefined query parameters result in explicit errors, not silent failures
3. **Resource Management**: Use `Layer.scoped` for driver lifecycle management
4. **Type Safety**: All queries and parameters use branded types
5. **Effect Context**: Use `Effect.gen` with `yield*` inside Effect context, never `async/await`
6. **Function Organization**:
   - Infrastructure services (Neo4j, HTTP clients) can use grouped methods as they manage resources
   - Business logic should prefer individual function exports for better FP style
   - Data access can use either pattern depending on whether you need test swapping
