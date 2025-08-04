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

export const Neo4jPersistenceLive = Layer.effect(
  PersistenceService,
  Effect.gen(function* () {
    const database = yield* TransactionalDatabaseService;

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

    const listNodes = () =>
      Effect.gen(function* () {
        const query = cypher`MATCH (n:ContentNode) RETURN n ORDER BY n.name`;
        const results = yield* database.runQuery<{ n: unknown }>(query);
        return yield* Effect.forEach(results, (result) =>
          Schema.decodeUnknown(ContentNode)(result.n),
        );
      });

    const createTag = (tagData: Omit<Tag, 'id'>) =>
      Effect.gen(function* () {
        const query = cypher`CREATE (t:Tag $props) RETURN t`;
        const id = Schema.decodeSync(TagId)(crypto.randomUUID());
        const props = { ...tagData, id };
        const params = yield* queryParams({ props });
        const results = yield* database.runQuery<{ t: unknown }>(query, params);
        return yield* Schema.decodeUnknown(Tag)(results[0].t);
      });

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

    const listTags = () =>
      Effect.gen(function* () {
        const query = cypher`MATCH (t:Tag) RETURN t ORDER BY t.name`;
        const results = yield* database.runQuery<{ t: unknown }>(query);
        return yield* Effect.forEach(results, (result) =>
          Schema.decodeUnknown(Tag)(result.t),
        );
      });

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
