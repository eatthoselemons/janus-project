import { Effect, Schema, HashMap } from 'effect';
import { Neo4jService } from '../neo4j';
import { NotFoundError, PersistenceError } from '../../domain/types/errors';
import { cypher, queryParams } from '../../domain/types/database';
import {
  ContentNodeVersion,
  ContentNodeVersionId,
  IncludesEdgeProperties,
  ParameterKey,
  ParameterValue,
  ParameterHashMap,
  ProcessingOptions,
  ChildNode,
} from '../../domain/types/contentNode';

/**
 * Helper to map any error to PersistenceError
 */
const mapToPersistenceError = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, PersistenceError | NotFoundError, R> =>
  effect.pipe(
    Effect.mapError((error) => {
      if (
        error instanceof PersistenceError ||
        error instanceof NotFoundError
      ) {
        return error;
      }
      return new PersistenceError({
        originalMessage: String(error),
        operation: 'read',
      });
    }),
  );

/**
 * Process a node, fetching its own children as needed
 */
const processNode = (
  nodeVersion: ContentNodeVersion,
  parameterHashMap: ParameterHashMap,
  options: ProcessingOptions,
): Effect.Effect<string, PersistenceError | NotFoundError, Neo4jService> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    // Fetch children for this node
    const childrenQuery = cypher`
      MATCH (node:ContentNodeVersion {id: $versionId})-[r:INCLUDES]->(child:ContentNodeVersion)
      RETURN child, r as edge
    `;

    const childrenParams = yield* mapToPersistenceError(
      queryParams({ versionId: nodeVersion.id }),
    );
    const childrenResult = yield* mapToPersistenceError(
      neo4j.runQuery<{
        child: unknown;
        edge: unknown;
      }>(childrenQuery, childrenParams),
    );

    const children = yield* mapToPersistenceError(
      Effect.forEach(childrenResult, (item) =>
        Effect.gen(function* () {
          const child = yield* Schema.decodeUnknown(ContentNodeVersion)(
            item.child,
          );
          const edge = yield* Schema.decodeUnknown(IncludesEdgeProperties)(
            item.edge,
          );
          return { node: child, edge };
        }),
      ),
    );

    // Build context from insert operations
    const insertChildren = children.filter(
      (c) => c.edge.operation === 'insert',
    );
    const updatedContext = yield* Effect.reduce(
      insertChildren,
      parameterHashMap,
      (ctx, child) =>
        Effect.gen(function* () {
          if (!child.edge.key) {
            return ctx; // Skip if no key specified
          }
          const key = yield* Schema.decodeUnknown(ParameterKey)(
            child.edge.key,
          ).pipe(
            Effect.mapError(
              (error) =>
                new PersistenceError({
                  originalMessage: `Invalid parameter key: ${error.message}`,
                  operation: 'read',
                }),
            ),
          );
          const value = yield* processContentFromId(
            child.node.id,
            ctx,
            options,
          );
          const paramValue = yield* Schema.decodeUnknown(ParameterValue)(
            value,
          ).pipe(
            Effect.mapError(
              (error) =>
                new PersistenceError({
                  originalMessage: `Invalid parameter value: ${error.message}`,
                  operation: 'read',
                }),
            ),
          );
          return HashMap.set(ctx, key, paramValue);
        }),
    );

    // Apply context to current node's content
    let processed = nodeVersion.content || '';
    HashMap.forEach(updatedContext, (value, key) => {
      processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    // Process concatenation children
    const concatChildren = children
      .filter((c) => c.edge.operation === 'concatenate')
      .sort((a, b) => {
        // Sort by createdAt to maintain insertion order
        // createdAt is already a timestamp value
        const timeA = a.node.createdAt.epochMillis;
        const timeB = b.node.createdAt.epochMillis;
        return timeA - timeB;
      });

    const concatenated = yield* Effect.forEach(concatChildren, (child) =>
      processContentFromId(child.node.id, updatedContext, options),
    ).pipe(Effect.map((results) => results.filter(Boolean).join('\n')));

    // Only add newline if processed has content
    if (processed && concatenated) {
      return processed + '\n' + concatenated;
    }
    return processed || concatenated || '';
  });

/**
 * Process content from a specific version ID
 */
export const processContentFromId = (
  versionId: ContentNodeVersionId,
  context: ParameterHashMap = HashMap.empty<ParameterKey, ParameterValue>(),
  options: ProcessingOptions = {},
): Effect.Effect<string, PersistenceError | NotFoundError, Neo4jService> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    // Annotate span with processing context
    yield* Effect.annotateCurrentSpan({
      versionId,
      contextSize: HashMap.size(context),
      hasExclusions: !!options.excludeVersionIds?.length,
    });

    // Check if this version should be excluded
    if (options.excludeVersionIds?.includes(versionId)) {
      return '';
    }

    // Get just this node - no children
    const query = cypher`
      MATCH (node:ContentNodeVersion {id: $versionId})
      RETURN node
    `;

    const params = yield* mapToPersistenceError(queryParams({ versionId }));
    const result = yield* mapToPersistenceError(
      neo4j.runQuery<{
        node: unknown;
      }>(query, params),
    );

    if (result.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({
          entityType: 'content node',
          id: versionId,
        }),
      );
    }

    const nodeVersion = yield* mapToPersistenceError(
      Schema.decodeUnknown(ContentNodeVersion)(result[0].node),
    );

    // Process the node (it will fetch its own children)
    return yield* processNode(nodeVersion, context, options);
  })
    .pipe(mapToPersistenceError)
    .pipe(Effect.withSpan('ContentService.processContentFromId'));

/**
 * Get content tree structure for visualization
 */
export const getContentTree = (
  versionId: ContentNodeVersionId,
  maxDepth: number = 10,
): Effect.Effect<
  ContentTreeNode,
  PersistenceError | NotFoundError,
  Neo4jService
> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    // Recursive CTE to get full tree structure
    const query = cypher`
      MATCH (root:ContentNodeVersion {id: $versionId})
      CALL {
        WITH root
        MATCH path = (root)-[:INCLUDES*0..]-(descendant)
        WHERE length(path) <= $maxDepth
        RETURN descendant, path
      }
      RETURN root, collect({node: descendant, depth: length(path)}) as descendants
    `;

    const params = yield* mapToPersistenceError(
      queryParams({ versionId, maxDepth }),
    );
    const result = yield* mapToPersistenceError(
      neo4j.runQuery<{
        root: unknown;
        descendants: Array<{ node: unknown; depth: number }>;
      }>(query, params),
    );

    if (result.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({
          entityType: 'content node',
          id: versionId,
        }),
      );
    }

    // Build tree structure
    return yield* buildTreeFromResult(result[0]);
  })
    .pipe(mapToPersistenceError)
    .pipe(Effect.withSpan('ContentService.getContentTree'));

// Helper types
export interface ContentTreeNode {
  version: ContentNodeVersion;
  children: ContentTreeNode[];
}

const buildTreeFromResult = (result: {
  root: unknown;
  descendants: Array<{ node: unknown; depth: number }>;
}): Effect.Effect<ContentTreeNode, PersistenceError | NotFoundError, never> =>
  mapToPersistenceError(
    Effect.gen(function* () {
      const root = yield* Schema.decodeUnknown(ContentNodeVersion)(result.root);
      // Simplified tree building - in real implementation would need proper parent-child mapping
      return {
        version: root,
        children: [],
      };
    }),
  );