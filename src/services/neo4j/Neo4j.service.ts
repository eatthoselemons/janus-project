import { Effect, Context } from 'effect';
import type { Session } from 'neo4j-driver';
import { Neo4jError } from '../../domain/types/errors';
import { CypherQuery, QueryParameters } from '../../domain/types/database';

/**
 * Transaction context for executing queries within a transaction
 */
export interface TransactionContext {
  /**
   * Run a query within the transaction
   */
  readonly run: <T = unknown>(
    query: CypherQuery,
    params?: QueryParameters,
  ) => Effect.Effect<T[], Neo4jError, never>;
}

/**
 * Neo4jService provides managed access to Neo4j database with multiple access patterns
 *
 * @example
 * ```ts
 * // Simple query
 * const users = yield* neo4j.runQuery("MATCH (u:User) RETURN u")
 *
 * // Transaction
 * const result = yield* neo4j.runInTransaction((tx) =>
 *   Effect.gen(function* () {
 *     yield* tx.run("CREATE (u:User {name: $name})", { name })
 *     yield* tx.run("CREATE (p:Post {title: $title})", { title })
 *   })
 * )
 *
 * // Batch queries
 * const [users, posts] = yield* neo4j.runBatch([
 *   { query: "MATCH (u:User) RETURN u" },
 *   { query: "MATCH (p:Post) RETURN p" }
 * ])
 * ```
 */
export interface Neo4jImpl {
  /**
   * Execute a single query - best for simple operations
   * @param query Cypher query string
   * @param params Query parameters
   * @returns Effect containing query results as plain objects
   */
  readonly runQuery: <T = unknown>(
    query: CypherQuery,
    params?: QueryParameters,
  ) => Effect.Effect<T[], Neo4jError, never>;

  /**
   * Execute multiple operations in a transaction
   * Automatically commits on success, rolls back on failure
   * @param operations Function that receives a transaction context
   * @returns Effect containing the result of the operations
   */
  readonly runInTransaction: <A>(
    operations: (tx: TransactionContext) => Effect.Effect<A, Neo4jError, never>,
  ) => Effect.Effect<A, Neo4jError, never>;

  /**
   * Execute multiple queries efficiently with the same session
   * @param queries Array of queries to execute
   * @returns Effect containing array of results for each query
   */
  readonly runBatch: <T = unknown>(
    queries: Array<{
      query: CypherQuery;
      params?: QueryParameters;
    }>,
  ) => Effect.Effect<T[][], Neo4jError, never>;

  /**
   * For complex operations that need full session control
   * @param work Function that receives a Neo4j session
   * @returns Effect containing the result of the work
   */
  readonly withSession: <A>(
    work: (session: Session) => Effect.Effect<A, Neo4jError, never>,
  ) => Effect.Effect<A, Neo4jError, never>;
}

export class Neo4jService extends Context.Tag('Neo4jService')<
  Neo4jService,
  Neo4jImpl
>() {}
