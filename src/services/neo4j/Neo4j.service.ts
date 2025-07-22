import { Effect, Context } from 'effect';
import type { Session } from 'neo4j-driver';
import { Neo4jError } from '../../domain/types/errors';

/**
 * Neo4jService provides managed access to Neo4j database sessions
 * Following the wrapper pattern to handle session lifecycle and error handling
 */
export interface Neo4jImpl {
  /**
   * Execute a function with a Neo4j session, handling lifecycle and errors
   * @param fn Function that receives a Neo4j session
   * @returns Effect containing the result or Neo4jError
   */
  readonly use: <T>(
    fn: (session: Session) => T,
  ) => Effect.Effect<Awaited<T>, Neo4jError, never>;

  /**
   * Execute a Cypher query with parameters
   * @param query Cypher query string
   * @param params Query parameters
   * @returns Effect containing query results or Neo4jError
   */
  readonly runQuery: <T = any>(
    query: string,
    params?: Record<string, any>,
  ) => Effect.Effect<T[], Neo4jError, never>;
}

export class Neo4jService extends Context.Tag('Neo4jService')<
  Neo4jService,
  Neo4jImpl
>() {}
