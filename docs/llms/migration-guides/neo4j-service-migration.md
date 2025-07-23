# Neo4j Service Migration Guide

## Overview

This guide explains how to migrate from the current Neo4j service implementation to the recommended pattern that follows Effect-TS best practices.

## Current State

### Files to Modify

1. `/src/services/neo4j/Neo4j.service.ts` - Service definition
2. `/src/layers/neo4j/Neo4j.layer.ts` - Layer implementation

### Current Implementation Issues

- Uses old-style Context.GenericTag pattern
- Has complex test layer setup with partial implementations
- Session management could be cleaner

## Target State

### Goal

Implement the pattern from `/src/services/neo4j/Neo4j.recommended.ts` which provides:

- Transaction support for data integrity
- Batch operations for efficient test runs
- Session reuse for complex graph traversals
- Clean helper function organization

## Step-by-Step Migration

### Step 1: Update Service Definition

Replace the contents of `/src/services/neo4j/Neo4j.service.ts` with:

```typescript
import { Context, Effect } from 'effect';
import { type Session } from 'neo4j-driver';
import { Neo4jError } from '../../domain/types/errors';

export interface Neo4jService {
  readonly runQuery: <T = any>(
    query: string,
    params?: Record<string, any>,
  ) => Effect.Effect<T[], Neo4jError>;

  readonly runInTransaction: <A>(
    operations: (tx: {
      run: <T = any>(
        query: string,
        params?: Record<string, any>,
      ) => Effect.Effect<T[], Neo4jError>;
    }) => Effect.Effect<A, Neo4jError>,
  ) => Effect.Effect<A, Neo4jError>;

  readonly runBatch: <T = any>(
    queries: Array<{
      query: string;
      params?: Record<string, any>;
    }>,
  ) => Effect.Effect<T[][], Neo4jError>;

  readonly withSession: <A>(
    work: (session: Session) => Effect.Effect<A, Neo4jError>,
  ) => Effect.Effect<A, Neo4jError>;
}

export class Neo4jService extends Context.Tag('Neo4jService')<
  Neo4jService,
  Neo4jService
>() {}
```

### Step 2: Update Layer Implementation

Replace the contents of `/src/layers/neo4j/Neo4j.layer.ts` with the implementation from `Neo4j.recommended.ts`, keeping these modifications:

1. **Keep existing exports**:

   ```typescript
   export { Neo4jLive } from './Neo4j.recommended';
   export const fromEnv = Neo4jServiceLive; // Alias for backward compatibility
   ```

2. **Update imports** to match current project structure:
   ```typescript
   import { Context, Effect, Layer, Redacted } from 'effect';
   import neo4j from 'neo4j-driver';
   import { Neo4jError } from '../../domain/types/errors';
   import { ConfigService } from '../../services/config';
   import { Neo4jService } from '../../services/neo4j';
   ```

### Step 3: Update Test Layers

In the same file, update the test layer implementation:

```typescript
import { makeTestLayerFor } from '../../lib/test-utils';

export const Neo4jTest = makeTestLayerFor(Neo4jService);

// For backward compatibility
export const Neo4jTestPartial = Neo4jTest;
```

### Step 4: Remove Deprecated Files

After verification, remove:

- `/src/services/neo4j/Neo4j.advanced.example.ts`
- `/src/services/neo4j/Neo4j.session-patterns.example.ts`
- `/src/services/neo4j/Neo4j.recommended.ts` (after copying its content)

## Key Implementation Details

### Helper Functions Structure

The implementation uses helper functions to break up complexity:

1. **createDriver** - Initializes Neo4j driver with configuration
2. **closeDriver** - Handles graceful shutdown
3. **verifyDriverConnectivity** - Validates connection
4. **runQueryWithSession** - Single query execution
5. **createTransactionContext** - Transaction wrapper creation
6. **runInTransactionWithSession** - Transaction management
7. **runBatchWithSession** - Batch query execution
8. **withSessionScoped** - Custom session operations

### Error Handling Pattern

All database operations use consistent error handling:

```typescript
Effect.tryPromise({
  try: () => neo4jOperation(),
  catch: (e) =>
    new Neo4jError({
      query: queryString,
      originalMessage: e instanceof Error ? e.message : String(e),
    }),
});
```

### Resource Management

The service uses Effect's resource management:

```typescript
Effect.acquireRelease(
  createDriver(config), // Acquire
  closeDriver, // Release
);
```

### Session Lifecycle

Each operation manages its session:

```typescript
const session = driver.session();
try {
  // Do work
} finally {
  yield *
    Effect.promise(() => session.close()).pipe(
      Effect.catchAll(() => Effect.void),
    );
}
```

## Testing the Migration

### 1. Run Type Checks

```bash
pnpm run typecheck
```

### 2. Run Tests

```bash
pnpm test src/services/neo4j
pnpm test src/layers/neo4j
```

### 3. Run Preflight

```bash
pnpm run preflight
```

### 4. Test Usage Example

```typescript
import { Effect } from 'effect';
import { Neo4jService } from './services/neo4j';

const program = Effect.gen(function* () {
  const neo4j = yield* Neo4jService;

  // Test simple query
  const users = yield* neo4j.runQuery('MATCH (u:User) RETURN u LIMIT 5');

  // Test transaction
  const result = yield* neo4j.runInTransaction((tx) =>
    Effect.gen(function* () {
      yield* tx.run('CREATE (u:User {name: $name})', { name: 'Test' });
      return { created: true };
    }),
  );

  return { users, result };
});
```

## Common Issues and Solutions

### Issue: Import errors

**Solution**: Ensure all imports use the project's path structure, not relative paths from the recommended file.

### Issue: Type mismatches with existing code

**Solution**: The new service interface is backward compatible. If you have type issues, check that you're using the Effect return types consistently.

### Issue: Test layer compatibility

**Solution**: The new test layer uses `makeTestLayerFor` which works with class-based tags. Update test imports to use the new pattern.

## Verification Checklist

- [ ] All existing code using Neo4jService still compiles
- [ ] Tests pass with the new implementation
- [ ] `pnpm run preflight` passes
- [ ] Transaction support works correctly
- [ ] Batch operations perform efficiently
- [ ] No regression in existing functionality
