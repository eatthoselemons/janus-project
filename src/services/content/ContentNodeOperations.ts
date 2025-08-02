import { Effect, Option } from 'effect';
import { Neo4jService } from '../neo4j';
import { NotFoundError, PersistenceError } from '../../domain/types/errors';
import { cypher, queryParams } from '../../domain/types/database';
import {
  ContentNode,
  ContentNodeId,
} from '../../domain/types/contentNode';
import { TestCaseTagName } from '../../domain/types/testCase';
import { Slug } from '../../domain/types/branded';
import {
  createNamedEntity,
  findEntityByName,
  mustFindByName,
  listAll,
} from '../persistence/GenericPersistence';

/**
 * Create a new ContentNode
 */
export const createContentNode = (
  name: Slug,
  description: string,
): Effect.Effect<ContentNode, PersistenceError, Neo4jService> =>
  createNamedEntity('ContentNode', ContentNode, {
    name,
    description,
  }).pipe(Effect.withSpan('ContentService.createContentNode'));

/**
 * Find a ContentNode by name
 */
export const findContentNodeByName = (
  name: Slug,
): Effect.Effect<Option.Option<ContentNode>, PersistenceError, Neo4jService> =>
  findEntityByName('ContentNode', ContentNode, name).pipe(
    Effect.withSpan('ContentService.findContentNodeByName'),
  );

/**
 * Get a ContentNode by name (fails if not found)
 */
export const mustFindContentNodeByName = (
  name: Slug,
): Effect.Effect<ContentNode, NotFoundError | PersistenceError, Neo4jService> =>
  mustFindByName('ContentNode', 'content node', ContentNode, name).pipe(
    Effect.withSpan('ContentService.mustFindContentNodeByName'),
  );

/**
 * List all ContentNodes
 */
export const listContentNodes = (): Effect.Effect<
  readonly ContentNode[],
  PersistenceError,
  Neo4jService
> =>
  listAll('ContentNode', ContentNode).pipe(
    Effect.withSpan('ContentService.listContentNodes'),
  );

/**
 * Tag content for organization
 */
export const tagContent = (
  nodeId: ContentNodeId,
  tagNames: TestCaseTagName[],
): Effect.Effect<void, PersistenceError, Neo4jService> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    yield* Effect.forEach(tagNames, (tagName) =>
      Effect.gen(function* () {
        const query = cypher`
          MERGE (t:Tag {name: $tagName})
          WITH t
          MATCH (n:ContentNode {id: $nodeId})
          MERGE (n)-[:HAS_TAG]->(t)
        `;

        const params = yield* queryParams({ tagName, nodeId });
        yield* neo4j.runQuery(query, params);
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
          operation: 'connect',
        });
      }),
    )
    .pipe(Effect.withSpan('ContentService.tagContent'));

/**
 * Get all tags associated with a content node
 */
export const getNodeTags = (
  nodeId: ContentNodeId,
): Effect.Effect<string[], PersistenceError, Neo4jService> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    
    const query = cypher`
      MATCH (n:ContentNode {id: $nodeId})-[:HAS_TAG]->(t:Tag)
      RETURN t.name as tagName
      ORDER BY t.name
    `;
    
    const params = yield* queryParams({ nodeId });
    const result = yield* neo4j.runQuery<{ tagName: string }>(query, params);
    
    return result.map((r) => r.tagName);
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
    .pipe(Effect.withSpan('ContentService.getNodeTags'));