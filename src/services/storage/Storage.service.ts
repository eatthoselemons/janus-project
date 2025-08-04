import { Effect, Context } from 'effect';
import type { Session } from 'neo4j-driver';
import { CypherQuery, QueryParameters } from '../../domain/types/database';
import { Neo4jError, GitPersistenceError } from '../../domain/types/errors';

/**
 * Storage error type - union of all storage backend errors
 * This allows users to identify which backend caused the error
 */
export type StorageError = Neo4jError | GitPersistenceError;

/**
 * Query type that can be either Cypher for Neo4j or structured query for other backends
 */
export type Query = CypherQuery | StructuredQuery;

/**
 * Structured query for non-Cypher backends like Git
 */
export type StructuredQuery = {
  readonly type: 'structured';
  readonly operation: 'match' | 'create' | 'update' | 'delete' | 'connect';
  readonly entityType:
    | 'ContentNode'
    | 'ContentNodeVersion'
    | 'Tag'
    | 'TestCase'
    | 'TestRun'
    | 'DataPoint';
  readonly filters?: Record<string, unknown>;
  readonly data?: Record<string, unknown>;
  readonly relationships?: Array<{
    readonly type: string;
    readonly direction: 'in' | 'out';
    readonly properties?: Record<string, unknown>;
  }>;
};

/**
 * Transaction context for executing queries within a transaction
 */
export interface TransactionContext {
  /**
   * Run a query within the transaction
   */
  readonly run: <T = unknown>(
    query: Query,
    params?: QueryParameters,
  ) => Effect.Effect<T[], StorageError, never>;
}

/**
 * StorageService provides managed access to storage backend with multiple access patterns
 * This abstracts away the underlying storage implementation (Neo4j, Git, etc.)
 *
 * @example
 * ```ts
 * // Simple query
 * const nodes = yield* storage.runQuery("MATCH (n:ContentNode) RETURN n")
 *
 * // Transaction
 * const result = yield* storage.runInTransaction((tx) =>
 *   Effect.gen(function* () {
 *     yield* tx.run("CREATE (n:ContentNode {name: $name})", { name })
 *     yield* tx.run("CREATE (v:ContentNodeVersion {content: $content})", { content })
 *   })
 * )
 *
 * // Batch queries
 * const [nodes, versions] = yield* storage.runBatch([
 *   { query: "MATCH (n:ContentNode) RETURN n" },
 *   { query: "MATCH (v:ContentNodeVersion) RETURN v" }
 * ])
 * ```
 */
export interface StorageImpl {
  /**
   * Execute a single query - best for simple operations
   * @param query Query string (Cypher or structured)
   * @param params Query parameters
   * @returns Effect containing query results as plain objects
   */
  readonly runQuery: <T = unknown>(
    query: Query,
    params?: QueryParameters,
  ) => Effect.Effect<T[], StorageError, never>;

  /**
   * Execute multiple operations in a transaction
   * Automatically commits on success, rolls back on failure
   * @param operations Function that receives a transaction context
   * @returns Effect containing the result of the operations
   */
  readonly runInTransaction: <A, E>(
    operations: (tx: TransactionContext) => Effect.Effect<A, E, never>,
  ) => Effect.Effect<A, E | StorageError, never>;

  /**
   * Execute multiple queries efficiently with the same session
   * @param queries Array of queries to execute
   * @returns Effect containing array of results for each query
   */
  readonly runBatch: <T = unknown>(
    queries: Array<{
      query: Query;
      params?: QueryParameters;
    }>,
  ) => Effect.Effect<T[][], StorageError, never>;

  /**
   * For complex operations that need full session control
   * @param work Function that receives a session
   * @returns Effect containing the result of the work
   */
  readonly withSession: <A, E>(
    work: (session: Session) => Effect.Effect<A, E, never>,
  ) => Effect.Effect<A, E | StorageError, never>;
}

export class StorageService extends Context.Tag('StorageService')<
  StorageService,
  StorageImpl
>() {}
