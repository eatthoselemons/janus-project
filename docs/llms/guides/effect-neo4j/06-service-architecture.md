> **Audience:** LLM / AI Agent (Focused Guide)

# 6. Service Architecture Patterns

This section covers high-level architectural patterns for composing your application from layers.

### Layer Composition

Build your application in layers, where each layer provides services to the layers above it.

```typescript
// Infrastructure layer
export const InfrastructureLive = Layer.mergeAll(
  ConfigLive,
  Neo4jClientLive, // The new client layer
  LoggerLive,
);

// Repository layer (depends on infrastructure)
export const RepositoryLive = Layer.mergeAll(
  PersonRepositoryLive,
  CompanyRepositoryLive,
  RelationshipRepositoryLive,
).pipe(Layer.provide(InfrastructureLive));

// Service layer (depends on repositories)
export const ServiceLive = Layer.mergeAll(
  PersonServiceLive,
  CompanyServiceLive,
  RecommendationServiceLive,
).pipe(Layer.provide(RepositoryLive));

// Application layer (top level)
export const ApplicationLive = ServiceLive;
```

### Transaction Management

As shown in the `PersonService` example, transaction management is handled at the service layer by wrapping units of work with `neo4j.transaction`. This ensures atomicity for complex operations.

Here is another classic example: transferring funds between two accounts. The entire block of logic is wrapped in a transaction. If any step fails (e.g., insufficient funds), the entire operation is rolled back by the database.

```typescript
export const makeTransferService = Effect.gen(function* () {
  const neo4j = yield* Neo4jClient;
  const accounts = yield* AccountRepository;

  const transfer = (fromId: AccountId, toId: AccountId, amount: Money) =>
    neo4j.transaction(
      // The whole transfer is one atomic unit
      Effect.gen(function* () {
        // All operations use the same transaction provided by the wrapper
        const from = yield* accounts.findById(fromId);
        const to = yield* accounts.findById(toId);

        if (from.balance < amount) {
          return yield* Effect.fail(new InsufficientFunds());
        }

        yield* accounts.updateBalance(fromId, from.balance - amount);
        yield* accounts.updateBalance(toId, to.balance + amount);
        yield* accounts.recordTransfer(fromId, toId, amount);
      }),
    );

  return { transfer };
});
```
