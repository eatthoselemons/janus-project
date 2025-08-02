import { describe, it, expect } from '@effect/vitest';
import { Effect, Option, Exit, Schema, HashMap, Chunk } from 'effect';
import * as ContentService from './index';
import {
  Slug,
  ContentNodeId,
  ContentNodeVersionId,
} from '../../domain/types/branded';
import { InsertKey, InsertValue } from '../../domain/types/contentNode';
import { TestCase, LLMModel } from '../../domain/types/testCase';
import { NotFoundError, PersistenceError } from '../../domain/types/errors';
import {
  ContentTestWithData,
  ContentTestWithEmptyData,
  ContentTestWithNodeNoVersions,
} from './ContentService.test-layers';

describe('ContentService', () => {
  describe('createContentNode', () => {
    it.effect('should create a new content node', () =>
      Effect.gen(function* () {
        const name = Schema.decodeSync(Slug)('new-content');
        const node = yield* ContentService.createContentNode(
          name,
          'New content node description',
        );

        expect(node.name).toBe(name);
        expect(node.description).toBe('New content node description');
        expect(node.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
      }).pipe(Effect.provide(ContentTestWithData())),
    );

    it.effect('should fail on duplicate name', () =>
      Effect.gen(function* () {
        const name = Schema.decodeSync(Slug)('greeting-template');
        const result = yield* Effect.exit(
          ContentService.createContentNode(name, 'Duplicate'),
        );

        expect(Exit.isFailure(result)).toBe(true);
        if (Exit.isFailure(result)) {
          const cause = result.cause;
          if (cause._tag === 'Fail') {
            expect(cause.error).toBeInstanceOf(PersistenceError);
            expect((cause.error as PersistenceError).operation).toBe('create');
            expect((cause.error as PersistenceError).originalMessage).toContain(
              'already exists',
            );
          }
        }
      }).pipe(Effect.provide(ContentTestWithData())),
    );
  });

  describe('createContentNodeVersion', () => {
    it.effect('should create a new version with previous version', () =>
      Effect.gen(function* () {
        const nodeId = Schema.decodeSync(ContentNodeId)(
          '550e8400-e29b-41d4-a716-446655440001',
        );
        
        // Get the existing version that will become the previous version
        const previousVersion = yield* ContentService.getLatestContentNodeVersion(nodeId);
        expect(Option.isSome(previousVersion)).toBe(true);
        const previousVersionId = Option.isSome(previousVersion) ? previousVersion.value.id : '';
        
        // Create new version
        const version = yield* ContentService.createContentNodeVersion(
          nodeId,
          'New version content',
          'Test commit',
        );

        expect(version.content).toBe('New version content');
        expect(version.commitMessage).toBe('Test commit');
        expect(version.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(version.createdAt).toHaveProperty('epochMillis');
        
        // Verify it's not the same as the previous version
        expect(version.id).not.toBe(previousVersionId);
        
        // Get the latest version again to verify it's our new version
        const latestVersion = yield* ContentService.getLatestContentNodeVersion(nodeId);
        expect(Option.isSome(latestVersion)).toBe(true);
        if (Option.isSome(latestVersion)) {
          expect(latestVersion.value.id).toBe(version.id);
          expect(latestVersion.value.content).toBe('New version content');
        }
        
        // NOTE: The test layer now tracks previousVersionId when creating versions.
        // In a real implementation with Neo4j, we would query for the PREVIOUS_VERSION
        // relationship to verify it was created correctly.
      }).pipe(Effect.provide(ContentTestWithData())),
    );

    it.effect('should create first version without previous', () =>
      Effect.gen(function* () {
        const nodeId = Schema.decodeSync(ContentNodeId)(
          '550e8400-e29b-41d4-a716-446655440001',
        );
        const version = yield* ContentService.createContentNodeVersion(
          nodeId,
          'First version content',
          'Initial version',
        );

        expect(version.content).toBe('First version content');
        expect(version.commitMessage).toBe('Initial version');
      }).pipe(Effect.provide(ContentTestWithNodeNoVersions)),
    );

    it.effect('should create version with parent relationships', () =>
      Effect.gen(function* () {
        const nodeId = Schema.decodeSync(ContentNodeId)(
          '550e8400-e29b-41d4-a716-446655440001',
        );
        const parentVersionId = Schema.decodeSync(ContentNodeVersionId)(
          '650e8400-e29b-41d4-a716-446655440001',
        );

        const version = yield* ContentService.createContentNodeVersion(
          nodeId,
          'Child content',
          'Add child version',
          [
            {
              versionId: parentVersionId,
              operation: 'insert',
              key: 'childKey',
            },
          ],
        );

        expect(version.content).toBe('Child content');
        expect(version.commitMessage).toBe('Add child version');
      }).pipe(Effect.provide(ContentTestWithData())),
    );

    it.effect('should fail when node not found', () =>
      Effect.gen(function* () {
        const nodeId = Schema.decodeSync(ContentNodeId)(
          '550e8400-e29b-41d4-a716-446655440999',
        );
        const result = yield* Effect.exit(
          ContentService.createContentNodeVersion(
            nodeId,
            'Test content',
            'Test commit',
          ),
        );

        expect(Exit.isFailure(result)).toBe(true);
        if (Exit.isFailure(result)) {
          const cause = result.cause;
          if (cause._tag === 'Fail') {
            expect(cause.error).toBeInstanceOf(NotFoundError);
          }
        }
      }).pipe(Effect.provide(ContentTestWithData())),
    );
  });

  describe('findContentNodeByName', () => {
    it.effect('should find existing content node', () =>
      Effect.gen(function* () {
        const name = Schema.decodeSync(Slug)('greeting-template');
        const result = yield* ContentService.findContentNodeByName(name);

        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.name).toBe(name);
          expect(result.value.description).toBe('Greeting template');
        }
      }).pipe(Effect.provide(ContentTestWithData())),
    );

    it.effect('should return None for non-existent node', () =>
      Effect.gen(function* () {
        const name = Schema.decodeSync(Slug)('non-existent');
        const result = yield* ContentService.findContentNodeByName(name);

        expect(Option.isNone(result)).toBe(true);
      }).pipe(Effect.provide(ContentTestWithData())),
    );
  });

  describe('getNodeTags', () => {
    it.effect('should return empty array for node with no tags', () =>
      Effect.gen(function* () {
        const node = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('untagged-node'),
          'Node without tags',
        );

        const tags = yield* ContentService.getNodeTags(node.id);
        expect(tags).toEqual([]);
      }).pipe(Effect.provide(ContentTestWithEmptyData())),
    );

    it.effect('should return tags in alphabetical order', () =>
      Effect.gen(function* () {
        const node = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('ordered-tags-node'),
          'Node with ordered tags',
        );

        // Tag in non-alphabetical order
        yield* ContentService.tagContent(node.id, [
          Schema.decodeSync(Slug)('zebra'),
          Schema.decodeSync(Slug)('alpha'),
          Schema.decodeSync(Slug)('beta'),
        ]);

        const tags = yield* ContentService.getNodeTags(node.id);
        expect(tags).toEqual(['alpha', 'beta', 'zebra']);
      }).pipe(Effect.provide(ContentTestWithEmptyData())),
    );
  });

  describe('tagContent', () => {
    it.effect('should tag content node and verify relationships', () =>
      Effect.gen(function* () {
        // Create a content node first
        const node = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('test-node-for-tags'),
          'Test node for tagging',
        );

        const tagNames = [
          Schema.decodeSync(Slug)('new-tag'),
          Schema.decodeSync(Slug)('another-tag'),
        ];

        // Tag the content
        yield* ContentService.tagContent(node.id, tagNames);

        // Verify the tags were applied
        const appliedTags = yield* ContentService.getNodeTags(node.id);
        expect(appliedTags).toHaveLength(2);
        expect(appliedTags).toContain('new-tag');
        expect(appliedTags).toContain('another-tag');
      }).pipe(Effect.provide(ContentTestWithEmptyData())),
    );

    it.effect('should handle duplicate tags gracefully', () =>
      Effect.gen(function* () {
        // Create a content node
        const node = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('test-node-duplicate-tags'),
          'Test node for duplicate tags',
        );

        const tagName = Schema.decodeSync(Slug)('duplicate-tag');

        // Tag the content twice with the same tag
        yield* ContentService.tagContent(node.id, [tagName]);
        yield* ContentService.tagContent(node.id, [tagName]);

        // Verify only one relationship exists (MERGE prevents duplicates)
        const appliedTags = yield* ContentService.getNodeTags(node.id);
        expect(appliedTags).toHaveLength(1);
        expect(appliedTags).toContain('duplicate-tag');
      }).pipe(Effect.provide(ContentTestWithEmptyData())),
    );
  });

  describe('processContentFromId', () => {
    it.effect('should process content with parameter substitution', () =>
      Effect.gen(function* () {
        // Use the existing test data version ID
        const versionId = Schema.decodeSync(ContentNodeVersionId)(
          '650e8400-e29b-41d4-a716-446655440001',
        );

        // Process content with parameter substitution
        const result = yield* ContentService.processContentFromId(versionId);

        expect(result).toBe('Hello Alice, welcome to our service!');
      }).pipe(Effect.provide(ContentTestWithData())),
    );

    it.effect('should handle empty content', () =>
      Effect.gen(function* () {
        // Create a new node and version for this test
        const node = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('empty-content-test'),
          'Test node for empty content',
        );
        const version = yield* ContentService.createContentNodeVersion(
          node.id,
          undefined,
          'Empty content version',
        );

        const result = yield* ContentService.processContentFromId(version.id);
        expect(result).toBe('');
      }).pipe(Effect.provide(ContentTestWithEmptyData())),
    );

    it.effect('should process concatenation of children', () =>
      Effect.gen(function* () {
        // Create parent branch node
        const parent = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('parent-branch'),
          'Parent branch',
        );
        const parentVersion = yield* ContentService.createContentNodeVersion(
          parent.id,
          '',
          'Branch node',
        );

        // Create child nodes
        const child1 = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('child-1'),
          'First child',
        );
        yield* ContentService.createContentNodeVersion(
          child1.id,
          'First line',
          'First child content',
          [
            {
              versionId: parentVersion.id,
              operation: 'concatenate',
            },
          ],
        );

        const child2 = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('child-2'),
          'Second child',
        );
        yield* ContentService.createContentNodeVersion(
          child2.id,
          'Second line',
          'Second child content',
          [
            {
              versionId: parentVersion.id,
              operation: 'concatenate',
            },
          ],
        );

        // Process should concatenate children alphabetically
        const result = yield* ContentService.processContentFromId(
          parentVersion.id,
        );
        expect(result).toBe('First line\nSecond line');
      }).pipe(Effect.provide(ContentTestWithEmptyData())),
    );

    it.effect('should concatenate children in alphabetical order by node name', () =>
      Effect.gen(function* () {
        // Create parent branch node
        const parent = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('parent-alphabetical'),
          'Parent for alphabetical test',
        );
        const parentVersion = yield* ContentService.createContentNodeVersion(
          parent.id,
          '',
          'Branch node for alphabetical ordering',
        );

        // Create child nodes in non-alphabetical order
        const zebra = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('zebra-content'),
          'Zebra node',
        );
        yield* ContentService.createContentNodeVersion(
          zebra.id,
          'Zebra line',
          'Zebra content',
          [
            {
              versionId: parentVersion.id,
              operation: 'concatenate',
            },
          ],
        );

        const apple = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('apple-content'),
          'Apple node',
        );
        yield* ContentService.createContentNodeVersion(
          apple.id,
          'Apple line',
          'Apple content',
          [
            {
              versionId: parentVersion.id,
              operation: 'concatenate',
            },
          ],
        );

        const middle = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('middle-content'),
          'Middle node',
        );
        yield* ContentService.createContentNodeVersion(
          middle.id,
          'Middle line',
          'Middle content',
          [
            {
              versionId: parentVersion.id,
              operation: 'concatenate',
            },
          ],
        );

        // Process should concatenate children alphabetically by node name
        const result = yield* ContentService.processContentFromId(
          parentVersion.id,
        );
        expect(result).toBe('Apple line\nMiddle line\nZebra line');
      }).pipe(Effect.provide(ContentTestWithEmptyData())),
    );

    it.effect('should exclude versions based on options', () =>
      Effect.gen(function* () {
        const versionId = Schema.decodeSync(ContentNodeVersionId)(
          '650e8400-e29b-41d4-a716-446655440001',
        );

        const result = yield* ContentService.processContentFromId(
          versionId,
          HashMap.empty(),
          { excludeVersionIds: [versionId] },
        );

        expect(result).toBe('');
      }).pipe(Effect.provide(ContentTestWithData())),
    );
  });


  describe('listContentNodes', () => {
    it.effect('should list all content nodes ordered by name', () =>
      Effect.gen(function* () {
        const nodes = yield* ContentService.listContentNodes();

        expect(nodes).toHaveLength(4);
        expect(nodes[0].name).toBe('be-concise');
        expect(nodes[1].name).toBe('be-helpful');
        expect(nodes[2].name).toBe('greeting-template');
        expect(nodes[3].name).toBe('user-name');
      }).pipe(Effect.provide(ContentTestWithData())),
    );

    it.effect('should return empty array when no nodes exist', () =>
      Effect.gen(function* () {
        const nodes = yield* ContentService.listContentNodes();
        expect(nodes).toHaveLength(0);
      }).pipe(Effect.provide(ContentTestWithEmptyData())),
    );
  });

  describe('getChildren', () => {
    it.effect('should get children of a content node version', () =>
      Effect.gen(function* () {
        const parentId = Schema.decodeSync(ContentNodeVersionId)(
          '650e8400-e29b-41d4-a716-446655440001',
        );
        const children = yield* ContentService.getChildren(parentId);

        expect(children).toHaveLength(1);
        expect(children[0].edge.operation).toBe('insert');
        expect(children[0].edge.key).toBe('name');
      }).pipe(Effect.provide(ContentTestWithData())),
    );

    it.effect('should return empty array for node without children', () =>
      Effect.gen(function* () {
        const versionId = Schema.decodeSync(ContentNodeVersionId)(
          '650e8400-e29b-41d4-a716-446655440002',
        );
        const children = yield* ContentService.getChildren(versionId);

        expect(children).toHaveLength(0);
      }).pipe(Effect.provide(ContentTestWithData())),
    );
  });
});
