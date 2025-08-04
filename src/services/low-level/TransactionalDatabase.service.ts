import { Effect, Context } from 'effect';
import { Session } from 'neo4j-driver';
import { CypherQuery, QueryParameters } from '../../domain/types/database';
import { Neo4jError } from '../../domain/types/errors';

export interface TransactionContext {
  readonly run: <T = unknown>(
    query: CypherQuery,
    params?: QueryParameters,
  ) => Effect.Effect<T[], Neo4jError>;
}

/**
 * A service that provides an abstraction over a transactional database.
 * This contract can be implemented by any database that supports transactions,
 * such as Neo4j or a traditional SQL database.
 */
export interface TransactionalDatabaseServiceImpl {
  readonly runQuery: <T = unknown>(
    query: CypherQuery,
    params?: QueryParameters,
  ) => Effect.Effect<T[], Neo4jError>;

  readonly runInTransaction: <A, E>(
    operations: (tx: TransactionContext) => Effect.Effect<A, E | Neo4jError>,
  ) => Effect.Effect<A, E | Neo4jError>;

  readonly runBatch: <T = unknown>(
    queries: Array<{
      query: CypherQuery;
      params?: QueryParameters;
    }>,
  ) => Effect.Effect<T[][], Neo4jError>;

  readonly withSession: <A, E>(
    work: (session: Session) => Effect.Effect<A, E | Neo4jError>,
  ) => Effect.Effect<A, E | Neo4jError>;
}

export class TransactionalDatabaseService extends Context.Tag(
  'TransactionalDatabaseService',
)<TransactionalDatabaseService, TransactionalDatabaseServiceImpl>() {}
