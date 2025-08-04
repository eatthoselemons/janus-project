import { Effect, Context } from 'effect';
import type { Driver, Session } from 'neo4j-driver';
import { Neo4jService, type Neo4jImpl } from '../../neo4j';
import {
  StorageService,
  type StorageImpl,
  type TransactionContext,
  type Query,
} from '../Storage.service';
import { Neo4jError } from '../../../domain/types/errors';
import { CypherQuery, QueryParameters } from '../../../domain/types/database';

/**
 * Create a Neo4j storage implementation that wraps the existing Neo4jService
 * This implementation lets Neo4j errors bubble up naturally so users know
 * which backend caused the error.
 */
export const createNeo4jStorage = (neo4j: Neo4jImpl): StorageImpl => ({
  runQuery: <T = unknown>(query: Query, params?: QueryParameters) => {
    // For Neo4j backend, we only accept Cypher queries
    if (typeof query !== 'string') {
      return Effect.fail(
        new Neo4jError({
          query: '',
          originalMessage: 'Neo4j backend only supports Cypher queries',
        }),
      );
    }

    return neo4j.runQuery<T>(query as CypherQuery, params);
  },

  runInTransaction: <A, E>(
    operations: (tx: TransactionContext) => Effect.Effect<A, E, never>,
  ) => {
    // Pass through to Neo4j's transaction handling
    return neo4j.runInTransaction(operations);
  },

  runBatch: <T = unknown>(
    queries: Array<{
      query: Query;
      params?: QueryParameters;
    }>,
  ) => {
    // Validate all queries are Cypher
    for (const { query } of queries) {
      if (typeof query !== 'string') {
        return Effect.fail(
          new Neo4jError({
            query: '',
            originalMessage: 'Neo4j backend only supports Cypher queries',
          }),
        );
      }
    }

    return neo4j.runBatch<T>(
      queries.map((q) => ({
        query: q.query as CypherQuery,
        params: q.params || {},
      })),
    );
  },

  withSession: <A, E>(
    work: (session: Session) => Effect.Effect<A, E, never>,
  ) => {
    return neo4j.withSession(work);
  },
});