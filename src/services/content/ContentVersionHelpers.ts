import { Effect, Option, Schema } from 'effect';
import * as crypto from 'crypto';
import { TransactionContext, type StorageError } from '../storage';
import { PersistenceError } from '../../domain/types/errors';
import { cypher, queryParams } from '../../domain/types/database';
import {
  ContentNodeVersion,
  ContentNodeId,
  ContentNodeVersionId,
} from '../../domain/types/contentNode';

/**
 * Generate a new ContentNodeVersion with proper ID and timestamp
 */
export const generateContentNodeVersion = (
  content: string | undefined,
  commitMessage: string,
): Effect.Effect<ContentNodeVersion, PersistenceError, never> =>
  Effect.gen(function* () {
    const versionId = yield* Schema.decode(ContentNodeVersionId)(
      crypto.randomUUID(),
    ).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            originalMessage: `Invalid version ID: ${error.message}`,
            operation: 'create',
          }),
      ),
    );
    const createdAt = yield* Schema.decode(Schema.DateTimeUtc)(
      new Date().toISOString(),
    ).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            originalMessage: `Invalid timestamp: ${error.message}`,
            operation: 'create',
          }),
      ),
    );

    return {
      id: versionId,
      content,
      createdAt,
      commitMessage,
    };
  });

/**
 * Verify that a ContentNode exists
 */
export const verifyContentNodeExists = (
  tx: TransactionContext,
  nodeId: ContentNodeId,
): Effect.Effect<void, PersistenceError | StorageError, never> =>
  Effect.gen(function* () {
    const parentQuery = cypher`MATCH (p:ContentNode {id: $id}) RETURN p`;
    const parentParams = yield* queryParams({ id: nodeId }).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            operation: 'read' as const,
            originalMessage: error.message,
            query: '',
          }),
      ),
    );
    const parentResults = yield* tx.run(parentQuery, parentParams);
    if (parentResults.length === 0) {
      return yield* Effect.fail(
        new PersistenceError({
          operation: 'read' as const,
          originalMessage: `ContentNode with id ${nodeId} not found`,
          query: parentQuery,
        }),
      );
    }
  });

/**
 * Find the previous version of a ContentNode
 */
export const findPreviousContentNodeVersion = (
  tx: TransactionContext,
  nodeId: ContentNodeId,
): Effect.Effect<Option.Option<ContentNodeVersionId>, PersistenceError | StorageError, never> =>
  Effect.gen(function* () {
    const previousQuery = cypher`
      MATCH (p:ContentNode {id: $parentId})<-[:VERSION_OF]-(v:ContentNodeVersion)
      RETURN v ORDER BY v.createdAt DESC LIMIT 1
    `;
    const previousParams = yield* queryParams({ parentId: nodeId }).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            operation: 'read' as const,
            originalMessage: error.message,
            query: '',
          }),
      ),
    );
    const previousResults = yield* tx.run(previousQuery, previousParams);

    if (previousResults.length === 0) {
      return Option.none();
    }

    const versionRecord = previousResults[0] as { v: { id: string } };
    const previousId = Schema.decodeSync(ContentNodeVersionId)(
      versionRecord.v.id,
    );
    return Option.some(previousId);
  });

/**
 * Create version node in Neo4j with proper relationships
 */
export const createVersionInNeo4j = (
  tx: TransactionContext,
  nodeId: ContentNodeId,
  version: ContentNodeVersion,
  previousVersionId: Option.Option<ContentNodeVersionId>,
): Effect.Effect<void, PersistenceError | StorageError, never> =>
  Effect.gen(function* () {
    const createQuery = Option.isSome(previousVersionId)
      ? cypher`
        MATCH (p:ContentNode {id: $parentId})
        MATCH (prev:ContentNodeVersion {id: $previousId})
        CREATE (v:ContentNodeVersion $props)
        CREATE (v)-[:VERSION_OF]->(p)
        CREATE (v)-[:PREVIOUS_VERSION]->(prev)
        RETURN v
      `
      : cypher`
        MATCH (p:ContentNode {id: $parentId})
        CREATE (v:ContentNodeVersion $props)
        CREATE (v)-[:VERSION_OF]->(p)
        RETURN v
      `;

    const createParams = yield* queryParams({
      parentId: nodeId,
      previousId: Option.isSome(previousVersionId)
        ? previousVersionId.value
        : null,
      props: {
        id: version.id,
        content: version.content,
        createdAt: JSON.parse(JSON.stringify(version.createdAt)),
        commitMessage: version.commitMessage,
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            operation: 'read' as const,
            originalMessage: error.message,
            query: '',
          }),
      ),
    );

    yield* tx.run(createQuery, createParams);
  });
