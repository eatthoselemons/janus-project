import { Effect, Option, Schema } from 'effect';
import { Neo4jService, TransactionContext } from '../neo4j';
import {
  NotFoundError,
  PersistenceError,
  Neo4jError,
} from '../../domain/types/errors';
import { cypher, queryParams } from '../../domain/types/database';
import {
  ContentNodeVersion,
  ContentNodeId,
  ContentNodeVersionId,
  EdgeOperation,
  IncludesEdgeProperties,
  ChildNode,
} from '../../domain/types/contentNode';
import {
  generateContentNodeVersion,
  verifyContentNodeExists,
  findPreviousContentNodeVersion,
  createVersionInNeo4j,
} from './ContentVersionHelpers';

/**
 * Create parent relationships for a ContentNodeVersion
 */
const createParentRelationships = (
  neo4j: any,
  version: ContentNodeVersion,
  parents: Array<{
    versionId: ContentNodeVersionId;
    operation: EdgeOperation;
    key?: string;
  }>,
): Effect.Effect<void, PersistenceError, never> =>
  neo4j
    .runInTransaction((tx: TransactionContext) =>
      Effect.gen(function* () {
        for (const parent of parents) {
          const query = cypher`
            MATCH (parent:ContentNodeVersion {id: $parentId})
            MATCH (child:ContentNodeVersion {id: $childId})
            CREATE (parent)-[:INCLUDES {operation: $operation, key: $key}]->(child)
          `;

          // Validate edge properties
          const edgeProps = yield* Schema.decodeUnknown(IncludesEdgeProperties)(
            {
              operation: parent.operation,
              key: parent.key,
            },
          ).pipe(
            Effect.mapError(
              () =>
                new Neo4jError({
                  originalMessage: 'Invalid edge properties',
                  query: '',
                }),
            ),
          );

          const params = yield* queryParams({
            parentId: parent.versionId,
            childId: version.id,
            operation: edgeProps.operation,
            key: edgeProps.key || null,
          }).pipe(
            Effect.mapError(
              (error) =>
                new Neo4jError({
                  originalMessage: error.message,
                  query: '',
                }),
            ),
          );
          yield* tx.run(query, params);
        }
      }),
    )
    .pipe(
      Effect.mapError((error) => {
        if (error instanceof Neo4jError) {
          return new PersistenceError({
            originalMessage: error.originalMessage,
            operation: 'connect',
            query: error.query,
          });
        }
        return new PersistenceError({
          originalMessage: String(error),
          operation: 'connect',
        });
      }),
    );

/**
 * Create a new ContentNodeVersion with optional parent relationships
 */
export const createContentNodeVersion = (
  nodeId: ContentNodeId,
  content: string | undefined,
  commitMessage: string,
  parents?: Array<{
    versionId: ContentNodeVersionId;
    operation: EdgeOperation;
    key?: string;
  }>,
): Effect.Effect<
  ContentNodeVersion,
  NotFoundError | PersistenceError,
  Neo4jService
> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    // Annotate span with context
    yield* Effect.annotateCurrentSpan({
      nodeId,
      hasContent: content !== undefined,
      parentCount: parents?.length ?? 0,
    });

    // Generate version with proper ID and timestamp
    const version = yield* generateContentNodeVersion(content, commitMessage);

    // Create version in Neo4j with proper relationships
    yield* neo4j
      .runInTransaction((tx) =>
        Effect.gen(function* () {
          yield* verifyContentNodeExists(tx, nodeId);

          const previousVersionId = yield* findPreviousContentNodeVersion(
            tx,
            nodeId,
          );

          // Create version node with relationships
          yield* createVersionInNeo4j(tx, nodeId, version, previousVersionId);
        }),
      )
      .pipe(
        Effect.mapError((error) => {
          if (error instanceof PersistenceError) {
            return error;
          }
          if (
            error instanceof Neo4jError &&
            error.originalMessage.includes('not found')
          ) {
            return new NotFoundError({
              entityType: 'content node',
              id: nodeId,
            });
          }
          return new PersistenceError({
            originalMessage: String(error),
            operation: 'create',
          });
        }),
      );

    // Create parent relationships if provided
    if (parents && parents.length > 0) {
      yield* createParentRelationships(neo4j, version, parents);
    }

    return version;
  }).pipe(Effect.withSpan('ContentService.createContentNodeVersion'));

/**
 * Get the latest version of a ContentNode
 */
export const getLatestContentNodeVersion = (
  nodeId: ContentNodeId,
): Effect.Effect<
  Option.Option<ContentNodeVersion>,
  PersistenceError,
  Neo4jService
> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`
      MATCH (p:ContentNode {id: $parentId})<-[:VERSION_OF]-(v:ContentNodeVersion)
      RETURN v ORDER BY v.createdAt DESC LIMIT 1
    `;
    const params = yield* queryParams({ parentId: nodeId }).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            originalMessage: error.message,
            operation: 'read',
            query: '',
          }),
      ),
    );
    const results = yield* neo4j.runQuery<{ v: unknown }>(query, params).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            originalMessage: error.originalMessage,
            operation: 'read',
            query: error.query,
          }),
      ),
    );

    if (results.length === 0) return Option.none();

    const version = yield* Schema.decodeUnknown(ContentNodeVersion)(
      results[0].v,
    ).pipe(
      Effect.mapError(
        (error) =>
          new PersistenceError({
            originalMessage: `Schema validation failed: ${error.message}`,
            operation: 'read' as const,
            query: query,
          }),
      ),
    );
    return Option.some(version);
  }).pipe(Effect.withSpan('ContentService.getLatestContentNodeVersion'));

/**
 * Get children of a ContentNodeVersion
 */
export const getChildren = (
  nodeVersionId: ContentNodeVersionId,
): Effect.Effect<readonly ChildNode[], PersistenceError, Neo4jService> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`
      MATCH (parent:ContentNodeVersion {id: $parentId})-[r:INCLUDES]->(child:ContentNodeVersion)
      RETURN child, r
      ORDER BY child.createdAt
    `;
    const params = yield* queryParams({ parentId: nodeVersionId });
    const results = yield* neo4j.runQuery<{ child: unknown; r: unknown }>(
      query,
      params,
    );

    // Decode and validate edge properties
    return yield* Effect.forEach(results, (result) =>
      Effect.gen(function* () {
        const child = yield* Schema.decodeUnknown(ContentNodeVersion)(
          result.child,
        );
        const edgeProps = yield* Schema.decodeUnknown(IncludesEdgeProperties)(
          result.r,
        );
        return { node: child, edge: edgeProps } satisfies ChildNode;
      }),
    );
  })
    .pipe(
      Effect.mapError((error) => {
        if (error instanceof PersistenceError) {
          return error;
        }
        return new PersistenceError({
          originalMessage: String(error),
          operation: 'read',
        });
      }),
    )
    .pipe(Effect.withSpan('ContentService.getChildren'));

/**
 * Type-safe link creation between ContentNodeVersions
 */
export const linkNodes = (
  parentId: ContentNodeVersionId,
  childId: ContentNodeVersionId,
  props: IncludesEdgeProperties,
): Effect.Effect<void, PersistenceError, Neo4jService> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    // Validate properties
    const validProps = yield* Schema.decodeUnknown(IncludesEdgeProperties)(
      props,
    );

    const query = cypher`
      MATCH (parent:ContentNodeVersion {id: $parentId})
      MATCH (child:ContentNodeVersion {id: $childId})
      CREATE (parent)-[:INCLUDES {operation: $operation, key: $key}]->(child)
    `;

    const params = yield* queryParams({
      parentId,
      childId,
      operation: validProps.operation,
      key: validProps.key || null,
    });

    yield* neo4j.runQuery(query, params);
  })
    .pipe(
      Effect.mapError((error) => {
        if (error instanceof PersistenceError) {
          return error;
        }
        return new PersistenceError({
          originalMessage: String(error),
          operation: 'connect',
        });
      }),
    )
    .pipe(Effect.withSpan('ContentService.linkNodes'));
