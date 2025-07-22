# Service Layer Patterns in Effect

## Single Layer vs Multiple Layers

### Single Layer with Multiple Pieces (Recommended)

```typescript
// ✅ Recommended: One service, one layer
export class Neo4jService extends Context.Tag('Neo4jService')<
  Neo4jService,
  Neo4jImpl
>() {}

const make = (config: Config) =>
  Effect.gen(function* () {
    // Setup resources
    const driver = yield* createDriver(config);

    // Return service with all methods
    return Neo4jService.of({
      runQuery: runQueryImpl(driver),
      runInTransaction: runTransactionImpl(driver),
      runBatch: runBatchImpl(driver),
      withSession: withSessionImpl(driver),
    });
  });

export const Neo4jServiceLive = Layer.scoped(Neo4jService, make);
```

**Benefits:**

- Simple dependency graph
- Easy to understand and use
- One import for consumers
- Clear service boundaries
- Easier testing (one service to mock)

### Multiple Layers (Usually Overkill)

```typescript
// ❌ Usually unnecessary complexity
class Neo4jDriver extends Context.Tag('Neo4jDriver')<...>() {}
class Neo4jSession extends Context.Tag('Neo4jSession')<...>() {}
class Neo4jTransaction extends Context.Tag('Neo4jTransaction')<...>() {}
class Neo4jClient extends Context.Tag('Neo4jClient')<...>() {}

// Complex layer composition
const Neo4jFullStack = Layer.mergeAll(
  Neo4jDriverLive,
  Neo4jSessionLive,
  Neo4jTransactionLive,
  Neo4jClientLive
);
```

**Drawbacks:**

- Complex dependency management
- More boilerplate
- Harder to understand the relationships
- Overkill for most applications

## When to Use Multiple Layers

Multiple layers make sense when:

1. **Different implementations needed at different levels**

   ```typescript
   // Example: Different cache strategies
   const RedisCacheLive = Layer.succeed(Cache, redisImpl);
   const MemoryCacheLive = Layer.succeed(Cache, memoryImpl);
   ```

2. **Services have truly independent lifecycles**

   ```typescript
   // Example: Database and message queue
   const DatabaseLive = createDatabaseLayer();
   const MessageQueueLive = createQueueLayer();
   // These can be provided independently
   ```

3. **You need to swap implementations dynamically**
   ```typescript
   // Example: Feature flags determining implementation
   const StorageLive = useS3 ? S3StorageLive : LocalStorageLive;
   ```

## Best Practices

1. **Start with a single layer** - You can always split later if needed
2. **Use helper functions** to break up complex initialization
3. **Keep the service interface cohesive** - Methods should be related
4. **Consider the consumer's perspective** - Make it easy to use

## Example: Well-Structured Single Layer

```typescript
// Service definition
export interface Neo4jService {
  readonly runQuery: <T>(query: string, params?: any) => Effect.Effect<T[], Neo4jError>;
  readonly runInTransaction: <A>(work: TransactionWork<A>) => Effect.Effect<A, Neo4jError>;
  readonly runBatch: <T>(queries: Query[]) => Effect.Effect<T[][], Neo4jError>;
  readonly withSession: <A>(work: SessionWork<A>) => Effect.Effect<A, Neo4jError>;
}

// Helper functions for organization
const createDriver = (config: Config) => ...
const setupQueryMethods = (driver: Driver) => ...
const setupTransactionMethods = (driver: Driver) => ...

// Clean service construction
const make = (config: Config) => Effect.gen(function* () {
  const driver = yield* Effect.acquireRelease(
    createDriver(config),
    closeDriver
  );

  return Neo4jService.of({
    ...setupQueryMethods(driver),
    ...setupTransactionMethods(driver),
  });
});

// Single, simple layer
export const Neo4jServiceLive = Layer.scoped(Neo4jService, make);
```

This approach gives you:

- Clean separation of concerns through helper functions
- Single point of configuration
- Easy testing and mocking
- Simple usage: `Effect.provide(program, Neo4jServiceLive)`
