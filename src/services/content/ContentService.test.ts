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

  describe('tagContent', () => {
    it.effect('should tag content node', () =>
      Effect.gen(function* () {
        const nodeId = Schema.decodeSync(ContentNodeId)(
          '550e8400-e29b-41d4-a716-446655440001',
        );
        const tagNames = [
          Schema.decodeSync(Slug)('new-tag'),
          Schema.decodeSync(Slug)('another-tag'),
        ];

        yield* ContentService.tagContent(nodeId, tagNames);

        // The mock doesn't persist state, so we just verify no errors
        expect(true).toBe(true);
      }).pipe(Effect.provide(ContentTestWithData())),
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

  describe('buildConversationFromTestCase', () => {
    it.effect('should build conversation from test case', () =>
      Effect.gen(function* () {
        const testCase: TestCase = {
          id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
            '123e4567-e89b-42d3-a456-426614174000',
          ),
          name: 'Test conversation',
          description: 'Test multi-turn conversation',
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
            '2024-01-01T00:00:00Z',
          ),
          llmModel: Schema.decodeSync(LLMModel)('gpt-4'),
          messageSlots: [
            { role: 'system', tags: ['instruction'], sequence: 0 },
            { role: 'user', tags: ['greeting'], sequence: 1 },
          ],
        };

        const conversation =
          yield* ContentService.buildConversationFromTestCase(testCase);
        const messages = Chunk.toReadonlyArray(conversation);

        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('system');
        expect(messages[1].role).toBe('user');
      }).pipe(Effect.provide(ContentTestWithData())),
    );

    it.effect('should support A/B testing with different roles', () =>
      Effect.gen(function* () {
        // Use existing test data which already has content with 'instruction' tag

        // Test A: Conciseness in system prompt
        const testCaseA: TestCase = {
          id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
            '123e4567-e89b-42d3-a456-426614174000',
          ),
          name: 'Concise instruction as system',
          description: 'Test with conciseness in system role',
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
            '2024-01-01T00:00:00Z',
          ),
          llmModel: Schema.decodeSync(LLMModel)('gpt-4'),
          messageSlots: [
            { role: 'system', tags: ['instruction'], sequence: 0 },
            { role: 'user', tags: ['greeting'], sequence: 1 },
          ],
        };

        // Test B: Conciseness in user prompt
        const testCaseB: TestCase = {
          id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
            '223e4567-e89b-12d3-a456-426614174001',
          ),
          name: 'Concise instruction as user',
          description: 'Test with conciseness in user role',
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
            '2024-01-01T00:00:00Z',
          ),
          llmModel: Schema.decodeSync(LLMModel)('gpt-4'),
          messageSlots: [
            { role: 'system', tags: ['behavior'], sequence: 0 },
            { role: 'user', tags: ['tone'], sequence: 1 },
          ],
        };

        // Build conversations for both test cases
        const conversationA =
          yield* ContentService.buildConversationFromTestCase(testCaseA);
        const conversationB =
          yield* ContentService.buildConversationFromTestCase(testCaseB);

        // Test A should have conciseness in system role
        expect(Chunk.toReadonlyArray(conversationA)[0]).toMatchObject({
          role: 'system',
          content: expect.stringContaining('Be concise'),
        });

        // Test B should have conciseness in user role
        expect(Chunk.toReadonlyArray(conversationB)[1]).toMatchObject({
          role: 'user',
          content: expect.stringContaining('Be concise'),
        });
      }).pipe(Effect.provide(ContentTestWithData())),
    );

    it.effect('should build multi-turn conversations', () =>
      Effect.gen(function* () {
        // Create content nodes with tags
        const greeting = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('user-greeting'),
          'User greeting',
        );
        yield* ContentService.tagContent(greeting.id, [
          Schema.decodeSync(Slug)('greeting'),
          Schema.decodeSync(Slug)('user-message'),
        ]);
        yield* ContentService.createContentNodeVersion(
          greeting.id,
          'Hello, can you help me?',
          'Initial greeting',
        );

        const response = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('assistant-response'),
          'Assistant response',
        );
        yield* ContentService.tagContent(response.id, [
          Schema.decodeSync(Slug)('greeting-response'),
          Schema.decodeSync(Slug)('assistant-message'),
        ]);
        yield* ContentService.createContentNodeVersion(
          response.id,
          "Hello! I'd be happy to help.",
          'Initial response',
        );

        const followup = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('user-followup'),
          'User followup',
        );
        yield* ContentService.tagContent(followup.id, [
          Schema.decodeSync(Slug)('followup'),
          Schema.decodeSync(Slug)('user-message'),
        ]);
        yield* ContentService.createContentNodeVersion(
          followup.id,
          'I need help with {{topic}}',
          'Followup with parameter',
        );

        // Create a test case for the conversation
        const conversationTest: TestCase = {
          id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
            '323e4567-e89b-12d3-a456-426614174002',
          ),
          name: 'Support conversation',
          description: 'Multi-turn support conversation',
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
            '2024-01-01T00:00:00Z',
          ),
          llmModel: Schema.decodeSync(LLMModel)('gpt-4'),
          messageSlots: [
            { role: 'user', tags: ['greeting'], sequence: 0 },
            { role: 'assistant', tags: ['greeting-response'], sequence: 1 },
            { role: 'user', tags: ['followup'], sequence: 2 },
          ],
          parameters: HashMap.make<InsertKey, InsertValue>([
            [
              Schema.decodeSync(InsertKey)('topic'),
              Schema.decodeSync(InsertValue)('TypeScript'),
            ],
          ]),
        };

        // Build conversation from test case
        const conversation =
          yield* ContentService.buildConversationFromTestCase(conversationTest);

        // Should create proper message array for LLM API
        expect(Chunk.toReadonlyArray(conversation)).toEqual([
          { role: 'user', content: 'Hello, can you help me?' },
          { role: 'assistant', content: "Hello! I'd be happy to help." },
          { role: 'user', content: 'I need help with {{topic}}' }, // Parameters only apply with insert operations
        ]);
      }).pipe(Effect.provide(ContentTestWithEmptyData())),
    );

    it.effect('should fail when no content found for slot', () =>
      Effect.gen(function* () {
        const testCase: TestCase = {
          id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
            '423e4567-e89b-12d3-a456-426614174003',
          ),
          name: 'Missing content test',
          description: 'Test with missing content',
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
            '2024-01-01T00:00:00Z',
          ),
          llmModel: Schema.decodeSync(LLMModel)('gpt-4'),
          messageSlots: [
            { role: 'system', tags: ['non-existent-tag'], sequence: 0 },
          ],
        };

        const result = yield* Effect.exit(
          ContentService.buildConversationFromTestCase(testCase),
        );

        expect(Exit.isFailure(result)).toBe(true);
        if (Exit.isFailure(result)) {
          const cause = result.cause;
          if (cause._tag === 'Fail') {
            expect(cause.error).toBeInstanceOf(Error);
            expect(cause.error.message).toContain('No content found');
          }
        }
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
