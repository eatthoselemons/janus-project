import { Effect, Context, Schema, Match } from 'effect';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Session } from 'neo4j-driver';
import {
  StorageService,
  type StorageImpl,
  type TransactionContext,
  type Query,
  type StructuredQuery,
  type StorageError,
} from '../Storage.service';
import { GitPersistenceError } from '../../../domain/types/errors';
import { CypherQuery, QueryParameters } from '../../../domain/types/database';

/**
 * Git storage configuration
 */
export interface GitStorageConfig {
  readonly dataPath: string;
  readonly mode: 'lossless' | 'lossy';
}

/**
 * Strategy interface for Git storage implementations
 */
export interface GitStorageStrategy {
  readonly runQuery: <T = unknown>(
    query: StructuredQuery,
    params?: QueryParameters,
  ) => Effect.Effect<T[], StorageError, never>;

  readonly runInTransaction: <A, E>(
    operations: (tx: TransactionContext) => Effect.Effect<A, E, never>,
  ) => Effect.Effect<A, E | StorageError, never>;
}

/**
 * Base Git storage implementation that delegates to strategies
 */
export class GitStorage implements StorageImpl {
  private constructor(
    private readonly config: GitStorageConfig,
    private readonly strategy: GitStorageStrategy,
  ) {}

  /**
   * Create a Git storage instance with the specified configuration
   */
  static create(
    config: GitStorageConfig,
  ): Effect.Effect<GitStorage, GitPersistenceError, never> {
    return Effect.gen(function* () {
      // Ensure data directory exists
      yield* Effect.tryPromise({
        try: () => fs.mkdir(config.dataPath, { recursive: true }),
        catch: (error) =>
          new GitPersistenceError({
            path: config.dataPath,
            operation: 'create',
            originalMessage: `Failed to create data directory: ${String(error)}`,
          }),
      });

      // Load the appropriate strategy based on mode
      const strategy: GitStorageStrategy = yield* Match.value(config.mode).pipe(
        Match.when('lossless', () => createLosslessStrategy(config)),
        Match.when('lossy', () => createLossyStrategy(config)),
        Match.exhaustive,
      );

      return new GitStorage(config, strategy);
    });
  }

  runQuery<T = unknown>(
    query: Query,
    params?: QueryParameters,
  ): Effect.Effect<T[], StorageError, never> {
    // Git backend only supports structured queries
    if (typeof query === 'string') {
      return Effect.fail(
        new GitPersistenceError({
          path: this.config.dataPath,
          operation: 'parse',
          originalMessage:
            'Git backend does not support Cypher queries. Use structured queries instead.',
        }),
      );
    }

    return this.strategy.runQuery<T>(query as StructuredQuery, params);
  }

  runInTransaction<A, E>(
    operations: (tx: TransactionContext) => Effect.Effect<A, E, never>,
  ): Effect.Effect<A, E | GitPersistenceError, never> {
    return this.strategy.runInTransaction(operations);
  }

  runBatch<T = unknown>(
    queries: Array<{ query: Query; params?: QueryParameters }>,
  ): Effect.Effect<T[][], StorageError, never> {
    return Effect.gen(
      function* (this: GitStorage) {
        const results: T[][] = [];

        // Process queries sequentially to maintain consistency
        for (const { query, params } of queries) {
          const result = yield* this.runQuery<T>(query, params);
          results.push(result);
        }

        return results;
      }.bind(this),
    );
  }

  withSession<A, E>(
    work: (session: Session) => Effect.Effect<A, E, never>,
  ): Effect.Effect<A, E | GitPersistenceError, never> {
    return Effect.fail(
      new GitPersistenceError({
        path: this.config.dataPath,
        operation: 'read',
        originalMessage: 'Git backend does not support Neo4j sessions',
      }),
    );
  }
}

/**
 * Create a lossless strategy that preserves full graph structure
 * This will be implemented in LosslessStrategy.ts
 */
const createLosslessStrategy = (
  config: GitStorageConfig,
): Effect.Effect<GitStorageStrategy, GitPersistenceError, never> => {
  // TODO: Import and create LosslessStrategy
  return Effect.succeed({
    runQuery: () =>
      Effect.fail(
        new GitPersistenceError({
          path: config.dataPath,
          operation: 'read',
          originalMessage: 'Lossless strategy not yet implemented',
        }),
      ),
    runInTransaction: () =>
      Effect.fail(
        new GitPersistenceError({
          path: config.dataPath,
          operation: 'create',
          originalMessage: 'Lossless strategy not yet implemented',
        }),
      ),
  });
};

/**
 * Create a lossy strategy optimized for text-based storage
 * This will be implemented in LossyStrategy.ts
 */
const createLossyStrategy = (
  config: GitStorageConfig,
): Effect.Effect<GitStorageStrategy, GitPersistenceError, never> => {
  // TODO: Import and create LossyStrategy
  return Effect.succeed({
    runQuery: () =>
      Effect.fail(
        new GitPersistenceError({
          path: config.dataPath,
          operation: 'read',
          originalMessage: 'Lossy strategy not yet implemented',
        }),
      ),
    runInTransaction: () =>
      Effect.fail(
        new GitPersistenceError({
          path: config.dataPath,
          operation: 'create',
          originalMessage: 'Lossy strategy not yet implemented',
        }),
      ),
  });
};

/**
 * Create a Git storage implementation
 */
export const createGitStorage = (
  config: GitStorageConfig,
): Effect.Effect<StorageImpl, GitPersistenceError, never> => {
  return GitStorage.create(config).pipe(
    Effect.map((gitStorage): StorageImpl => gitStorage)
  );
};
