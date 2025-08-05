import { describe, it, expect } from '@effect/vitest';
import { Effect, Layer, Option, Schema } from 'effect';
import { PersistenceService } from '../../services/persistence/Persistence.service';
import { Neo4jPersistenceLive } from '../../layers/persistence/Neo4jPersistence.layer';
import { Neo4jTest } from '../../layers/low-level/Neo4jTransactionalDatabase.layer';
import { Slug, ContentNodeId } from '../../domain/types/branded';
import { ContentNode } from '../../domain';

describe('PersistenceService with Neo4j Backend', () => {
  describe('createNode', () => {
    it.effect('should create a new content node', () =>
      Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const name = Schema.decodeSync(Slug)('new-node');
        const description = 'A new node for testing';

        // This is the data our mock DB will return
        const returnedNode = {
          id: '123e4567-e89b-42d3-a456-426614174000',
          name: 'new-node',
          description: 'A new node for testing',
        };

        const node = yield* persistence.createNode({ name, description });

        expect(node.name).toBe(name);
        expect(node.description).toBe(description);
        expect(node.id).toBe(returnedNode.id);
      }).pipe(
        Effect.provide(
          Neo4jPersistenceLive.pipe(
            Layer.provide(
              Neo4jTest(
                new Map([
                  [
                    'CREATE (n:ContentNode $props) RETURN n',
                    [
                      {
                        n: {
                          id: '123e4567-e89b-42d3-a456-426614174000',
                          name: 'new-node',
                          description: 'A new node for testing',
                        },
                      },
                    ],
                  ],
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  });

  describe('findNodeByName', () => {
    it.effect('should find an existing node', () =>
      Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const name = Schema.decodeSync(Slug)('existing-node');
        const id = Schema.decodeSync(ContentNodeId)(
          '223e4567-e89b-42d3-a456-426614174000',
        );

        const node = yield* persistence.findNodeByName(name);

        expect(node.name).toBe(name);
        expect(node.id).toBe(id);
      }).pipe(
        Effect.provide(
          Neo4jPersistenceLive.pipe(
            Layer.provide(
              Neo4jTest(
                new Map([
                  [
                    'MATCH (n:ContentNode {name: $name}) RETURN n',
                    [
                      {
                        n: {
                          id: '223e4567-e89b-42d3-a456-426614174000',
                          name: 'existing-node',
                          description: 'test',
                        },
                      },
                    ],
                  ],
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  });

  describe('addVersion', () => {
    it.effect('should add a new version to a node', () =>
      Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const nodeId = '223e4567-e89b-42d3-a456-426614174000';
        const versionData = {
          content: 'version content',
          commitMessage: 'feat: initial version',
        };

        const version = yield* persistence.addVersion(nodeId, versionData);

        expect(version.content).toBe(versionData.content);
        expect(version.commitMessage).toBe(versionData.commitMessage);
      }).pipe(
        Effect.provide(
          Neo4jPersistenceLive.pipe(
            Layer.provide(
              Neo4jTest(
                new Map([
                  // Match the exact multiline query format from the persistence layer
                  [
                    `
          MATCH (p:ContentNode {id: $nodeId})
          CREATE (v:ContentNodeVersion $version)
          CREATE (v)-[:VERSION_OF]->(p)
          RETURN v
        `,
                    [
                      {
                        v: {
                          content: 'version content',
                          commitMessage: 'feat: initial version',
                          id: '323e4567-e89b-42d3-a456-426614174001',
                          createdAt: new Date().toISOString(),
                        },
                      },
                    ],
                  ],
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  });
});
