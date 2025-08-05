import { Effect, Layer, Option, Schema } from 'effect';
import {
  ContentNode,
  ContentNodeId,
  ContentNodeVersion,
  ContentNodeVersionId,
  Slug,
  Tag,
  TagId,
} from '../../domain';
import { NotFoundError, PersistenceError } from '../../domain/types/errors';
import { cypher, queryParams } from '../../domain/types/database';
import { PersistenceService } from '../../services/persistence/Persistence.service';
import { TransactionalDatabaseService } from '../../services/low-level/TransactionalDatabase.service';

/**
 * Neo4j Persistence Layer
 * 
 * This layer implements the PersistenceService interface using Neo4j as the backend.
 * It translates high-level domain operations into Cypher queries.
 * 
 * ✅ PUBLIC EXPORT:
 * - Neo4jPersistenceLive - Use with Effect.provide() to implement PersistenceService
 * 
 * ⚠️ NOTE: The individual method implementations below are internal.
 * Access them through PersistenceService interface after providing this layer.
 */
/**
 * ✅ PUBLIC - USE THIS TO PROVIDE PERSISTENCE SERVICE
 * 
 * Example:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const persistence = yield* PersistenceService;
 *   return yield* persistence.findNodeByName(slug);
 * });
 * 
 * program.pipe(
 *   Effect.provide(Neo4jPersistenceLive),
 *   Effect.provide(TransactionalDatabaseLive)
 * )
 * ```
 * 
 * @public
 */
export const Neo4jPersistenceLive = Layer.effect(
  PersistenceService,
  Effect.gen(function* () {
    const database = yield* TransactionalDatabaseService;

    /**
     * ⚠️ INTERNAL - Access via PersistenceService.findNodeByName
     * 
     * Finds a ContentNode by its unique slug name.
     * 
     * @param name - The slug identifier of the node
     * @returns The ContentNode if found
     * @throws NotFoundError if no node exists with the given name
     * @throws PersistenceError if schema validation fails
     * @internal
     */
    const findNodeByName = (name: Slug) =>
      Effect.gen(function* () {
        const query = cypher`MATCH (n:ContentNode {name: $name}) RETURN n`;
        const params = yield* queryParams({ name });
        const results = yield* database.runQuery<{ n: unknown }>(query, params);

        if (results.length === 0) {
          return yield* Effect.fail(
            new NotFoundError({ entityType: 'content node', slug: name }),
          );
        }

        return yield* Schema.decodeUnknown(ContentNode)(results[0].n).pipe(
          Effect.mapError(
            (error) =>
              new PersistenceError({
                originalMessage: `Schema validation failed: ${error.message}`,
                operation: 'read',
                query,
              }),
          ),
        );
      });

    /**
     * ⚠️ INTERNAL - Access via PersistenceService.createNode
     * 
     * Creates a new ContentNode with an auto-generated ID.
     * 
     * @param nodeData - Node data without the ID field
     * @returns The created ContentNode with generated ID
     * @throws PersistenceError if creation or validation fails
     * @internal
     */
    const createNode = (nodeData: Omit<ContentNode, 'id'>) =>
      Effect.gen(function* () {
        const query = cypher`CREATE (n:ContentNode $props) RETURN n`;
        const id = Schema.decodeSync(ContentNodeId)(crypto.randomUUID());
        const props = { ...nodeData, id };
        const params = yield* queryParams({ props });
        const results = yield* database.runQuery<{ n: unknown }>(query, params);
        return yield* Schema.decodeUnknown(ContentNode)(results[0].n).pipe(
          Effect.mapError(
            (error) =>
              new PersistenceError({
                originalMessage: `Schema validation failed: ${error.message}`,
                operation: 'create',
                query,
              }),
          ),
        );
      });

    /**
     * ⚠️ INTERNAL - Access via PersistenceService.addVersion
     * 
     * Adds a new version to an existing ContentNode.
     * 
     * Auto-generates:
     * - Version ID (UUID v4)
     * - Creation timestamp
     * 
     * @param nodeId - ID of the ContentNode to add version to
     * @param versionData - Version data without ID and timestamp
     * @returns The created ContentNodeVersion
     * @throws NotFoundError if the parent node doesn't exist
     * @throws PersistenceError if creation or validation fails
     * @internal
     */
    const addVersion = (
      nodeId: string,
      versionData: Omit<ContentNodeVersion, 'id' | 'createdAt'>,
    ) =>
      Effect.gen(function* () {
        const id = Schema.decodeSync(ContentNodeVersionId)(crypto.randomUUID());
        const createdAt = new Date();
        const version = { ...versionData, id, createdAt };

        const query = cypher`
          MATCH (p:ContentNode {id: $nodeId})
          CREATE (v:ContentNodeVersion $version)
          CREATE (v)-[:VERSION_OF]->(p)
          RETURN v
        `;
        const params = yield* queryParams({ nodeId, version });
        const results = yield* database.runQuery<{ v: unknown }>(query, params);

        if (results.length === 0) {
          return yield* Effect.fail(
            new NotFoundError({ entityType: 'content node', id: nodeId }),
          );
        }

        return yield* Schema.decodeUnknown(ContentNodeVersion)(
          results[0].v,
        ).pipe(
          Effect.mapError(
            (error) =>
              new PersistenceError({
                originalMessage: `Schema validation failed: ${error.message}`,
                operation: 'create',
                query,
              }),
          ),
        );
      });

    /**
     * ⚠️ INTERNAL - Access via PersistenceService.getLatestVersion
     * 
     * Retrieves the most recent version of a ContentNode.
     * 
     * Orders versions by createdAt timestamp descending.
     * 
     * @param nodeId - ID of the ContentNode
     * @returns Option.some(version) if versions exist, Option.none() otherwise
     * @throws PersistenceError if query or validation fails
     * @internal
     */
    const getLatestVersion = (nodeId: string) =>
      Effect.gen(function* () {
        const query = cypher`
          MATCH (p:ContentNode {id: $nodeId})<-[:VERSION_OF]-(v:ContentNodeVersion)
          RETURN v ORDER BY v.createdAt DESC LIMIT 1
        `;
        const params = yield* queryParams({ nodeId });
        const results = yield* database.runQuery<{ v: unknown }>(query, params);

        if (results.length === 0) {
          return Option.none();
        }

        const version = yield* Schema.decodeUnknown(ContentNodeVersion)(
          results[0].v,
        );
        return Option.some(version);
      });

    /**
     * ⚠️ INTERNAL - Access via PersistenceService.listNodes
     * 
     * Lists all ContentNodes ordered by name.
     * 
     * @returns Array of all ContentNodes in the system
     * @throws PersistenceError if query or validation fails
     * @internal
     */
    const listNodes = () =>
      Effect.gen(function* () {
        const query = cypher`MATCH (n:ContentNode) RETURN n ORDER BY n.name`;
        const results = yield* database.runQuery<{ n: unknown }>(query);
        return yield* Effect.forEach(results, (result) =>
          Schema.decodeUnknown(ContentNode)(result.n),
        );
      });

    /**
     * ⚠️ INTERNAL - Access via PersistenceService.createTag
     * 
     * Creates a new Tag with an auto-generated ID.
     * 
     * @param tagData - Tag data without the ID field
     * @returns The created Tag with generated ID
     * @throws PersistenceError if creation or validation fails
     * @internal
     */
    const createTag = (tagData: Omit<Tag, 'id'>) =>
      Effect.gen(function* () {
        const query = cypher`CREATE (t:Tag $props) RETURN t`;
        const id = Schema.decodeSync(TagId)(crypto.randomUUID());
        const props = { ...tagData, id };
        const params = yield* queryParams({ props });
        const results = yield* database.runQuery<{ t: unknown }>(query, params);
        return yield* Schema.decodeUnknown(Tag)(results[0].t);
      });

    /**
     * ⚠️ INTERNAL - Access via PersistenceService.findTagByName
     * 
     * Finds a Tag by its unique slug name.
     * 
     * @param name - The slug identifier of the tag
     * @returns The Tag if found
     * @throws NotFoundError if no tag exists with the given name
     * @throws PersistenceError if query or validation fails
     * @internal
     */
    const findTagByName = (name: Slug) =>
      Effect.gen(function* () {
        const query = cypher`MATCH (t:Tag {name: $name}) RETURN t`;
        const params = yield* queryParams({ name });
        const results = yield* database.runQuery<{ t: unknown }>(query, params);

        if (results.length === 0) {
          return yield* Effect.fail(
            new NotFoundError({ entityType: 'tag', slug: name }),
          );
        }

        return yield* Schema.decodeUnknown(Tag)(results[0].t);
      });

    /**
     * ⚠️ INTERNAL - Access via PersistenceService.listTags
     * 
     * Lists all Tags ordered by name.
     * 
     * @returns Array of all Tags in the system
     * @throws PersistenceError if query or validation fails
     * @internal
     */
    const listTags = () =>
      Effect.gen(function* () {
        const query = cypher`MATCH (t:Tag) RETURN t ORDER BY t.name`;
        const results = yield* database.runQuery<{ t: unknown }>(query);
        return yield* Effect.forEach(results, (result) =>
          Schema.decodeUnknown(Tag)(result.t),
        );
      });

    /**
     * ⚠️ INTERNAL - Access via PersistenceService.tagNode
     * 
     * Attaches a Tag to a ContentNode.
     * 
     * Uses MERGE to ensure the relationship is created only once.
     * 
     * @param nodeId - ID of the ContentNode
     * @param tagId - ID of the Tag
     * @throws PersistenceError if the operation fails
     * @internal
     */
    const tagNode = (nodeId: string, tagId: string) =>
      Effect.gen(function* () {
        const query = cypher`
          MATCH (n:ContentNode {id: $nodeId})
          MATCH (t:Tag {id: $tagId})
          MERGE (n)-[:HAS_TAG]->(t)
        `;
        const params = yield* queryParams({ nodeId, tagId });
        yield* database.runQuery(query, params);
      });

    return PersistenceService.of({
      findNodeByName,
      createNode,
      addVersion,
      getLatestVersion,
      listNodes,
      createTag,
      findTagByName,
      listTags,
      tagNode,
    });
  }),
);
