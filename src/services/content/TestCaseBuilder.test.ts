import { describe, it, expect } from '@effect/vitest';
import { Effect, Schema, HashMap, Chunk } from 'effect';
import * as ContentService from './index';
import { Slug, ContentNodeId } from '../../domain/types/branded';
import { InsertKey, InsertValue } from '../../domain/types/contentNode';
import { TestCase, LLMModel } from '../../domain/types/testCase';
import {
  ContentTestWithData,
  ContentTestWithEmptyData,
} from './ContentService.test-layers';

describe('TestCaseBuilder', () => {
  describe('buildConversationFromTestCase', () => {
    it.effect('should build conversation from test case', () =>
      Effect.gen(function* () {
        const testCase: TestCase = {
          id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
            '123e4567-e89b-12d3-a456-426614174001',
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
          parameters: HashMap.empty(),
        };

        const conversation =
          yield* ContentService.buildConversationFromTestCase(testCase);
        const messages = Chunk.toReadonlyArray(conversation);

        expect(messages).toHaveLength(2);
        expect(messages[0]).toMatchObject({
          role: 'system',
          content: expect.stringContaining('Be concise'),
        });
        expect(messages[1]).toMatchObject({
          role: 'user',
          content: 'Hello Alice, welcome to our service!',
        });
      }).pipe(Effect.provide(ContentTestWithData())),
    );

    it.effect('should support A/B testing with different roles', () =>
      Effect.gen(function* () {
        const testCaseA: TestCase = {
          id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
            '223e4567-e89b-12d3-a456-426614174001',
          ),
          name: 'Concise test',
          description: 'Test with concise instructions',
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
            '2024-01-01T00:00:00Z',
          ),
          llmModel: Schema.decodeSync(LLMModel)('gpt-4'),
          messageSlots: [{ role: 'system', tags: ['instruction'], sequence: 0 }],
          parameters: HashMap.empty(),
        };

        const testCaseB: TestCase = {
          id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
            '223e4567-e89b-12d3-a456-426614174002',
          ),
          name: 'Helpful test',
          description: 'Test with helpful instructions',
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
            '2024-01-01T00:00:00Z',
          ),
          llmModel: Schema.decodeSync(LLMModel)('gpt-4'),
          messageSlots: [{ role: 'system', tags: ['behavior'], sequence: 0 }],
          parameters: HashMap.empty(),
        };

        // Build conversations for both test cases
        const conversationA =
          yield* ContentService.buildConversationFromTestCase(testCaseA);
        const conversationB =
          yield* ContentService.buildConversationFromTestCase(testCaseB);

        // Should produce different system messages based on tags
        expect(Chunk.toReadonlyArray(conversationA)[0]).toMatchObject({
          role: 'system',
          content: expect.stringContaining('Be concise'),
        });
        expect(Chunk.toReadonlyArray(conversationB)[0]).toMatchObject({
          role: 'system',
          content: expect.stringContaining('Be helpful'),
        });
      }).pipe(Effect.provide(ContentTestWithData())),
    );

    it.effect('should build multi-turn conversations with parameter substitution', () =>
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

        // Create template node with placeholder
        const followup = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('user-followup'),
          'User followup',
        );
        yield* ContentService.tagContent(followup.id, [
          Schema.decodeSync(Slug)('followup'),
          Schema.decodeSync(Slug)('user-message'),
        ]);
        const followupVersion = yield* ContentService.createContentNodeVersion(
          followup.id,
          'I need help with {{topic}} and {{subtopic}}',
          'Followup with parameters',
        );

        // Create nodes that provide parameter values
        const topicNode = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('topic-provider'),
          'Provides topic value',
        );
        yield* ContentService.createContentNodeVersion(
          topicNode.id,
          'TypeScript',
          'Topic value',
          [
            {
              versionId: followupVersion.id,
              operation: 'insert',
              key: 'topic',
            },
          ],
        );

        const subtopicNode = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('subtopic-provider'),
          'Provides subtopic value',
        );
        yield* ContentService.createContentNodeVersion(
          subtopicNode.id,
          'generic types',
          'Subtopic value',
          [
            {
              versionId: followupVersion.id,
              operation: 'insert',
              key: 'subtopic',
            },
          ],
        );

        // Create a test case for the conversation
        const conversationTest: TestCase = {
          id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
            '323e4567-e89b-12d3-a456-426614174002',
          ),
          name: 'Support conversation',
          description: 'Multi-turn support conversation with parameter substitution',
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
            '2024-01-01T00:00:00Z',
          ),
          llmModel: Schema.decodeSync(LLMModel)('gpt-4'),
          messageSlots: [
            { role: 'user', tags: ['greeting'], sequence: 0 },
            { role: 'assistant', tags: ['greeting-response'], sequence: 1 },
            { role: 'user', tags: ['followup'], sequence: 2 },
          ],
          // Note: TestCase parameters don't affect substitution
          parameters: HashMap.empty(),
        };

        // Build conversation from test case
        const conversation =
          yield* ContentService.buildConversationFromTestCase(conversationTest);

        // Should create proper message array with substituted parameters
        expect(Chunk.toReadonlyArray(conversation)).toEqual([
          { role: 'user', content: 'Hello, can you help me?' },
          { role: 'assistant', content: "Hello! I'd be happy to help." },
          { role: 'user', content: 'I need help with TypeScript and generic types' },
        ]);
      }).pipe(Effect.provide(ContentTestWithEmptyData())),
    );

    it.effect('should handle parameter substitution in conversations', () =>
      Effect.gen(function* () {
        // Create a parent node with placeholder
        const templateNode = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('help-template'),
          'Help message template',
        );
        yield* ContentService.tagContent(templateNode.id, [
          Schema.decodeSync(Slug)('help-message'),
          Schema.decodeSync(Slug)('user-message'),
        ]);
        const templateVersion = yield* ContentService.createContentNodeVersion(
          templateNode.id,
          'I need help with {{topic}}',
          'Template with topic placeholder',
        );

        // Create a child node that provides the topic value
        const topicNode = yield* ContentService.createContentNode(
          Schema.decodeSync(Slug)('topic-value'),
          'Topic value provider',
        );
        const topicVersion = yield* ContentService.createContentNodeVersion(
          topicNode.id,
          'TypeScript generics',
          'Specific topic value',
          [
            {
              versionId: templateVersion.id,
              operation: 'insert',
              key: 'topic',
            },
          ],
        );

        // Create test case that uses the template
        const testCase: TestCase = {
          id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
            '523e4567-e89b-12d3-a456-426614174004',
          ),
          name: 'Help with substitution',
          description: 'Test parameter substitution in conversation',
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
            '2024-01-01T00:00:00Z',
          ),
          llmModel: Schema.decodeSync(LLMModel)('gpt-4'),
          messageSlots: [
            { role: 'user', tags: ['help-message'], sequence: 0 },
          ],
          // Note: TestCase parameters don't affect substitution - 
          // only insert relationships do
          parameters: HashMap.empty(),
        };

        // Build conversation
        const conversation =
          yield* ContentService.buildConversationFromTestCase(testCase);

        // Should have substituted the parameter
        expect(Chunk.toReadonlyArray(conversation)).toEqual([
          { role: 'user', content: 'I need help with TypeScript generics' },
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
          description: 'Test with non-existent tags',
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
            '2024-01-01T00:00:00Z',
          ),
          llmModel: Schema.decodeSync(LLMModel)('gpt-4'),
          messageSlots: [
            { role: 'system', tags: ['non-existent-tag'], sequence: 0 },
          ],
          parameters: HashMap.empty(),
        };

        const result = yield* Effect.either(
          ContentService.buildConversationFromTestCase(testCase),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left.message).toContain(
            'No content found for slot with role system',
          );
        }
      }).pipe(Effect.provide(ContentTestWithEmptyData())),
    );
  });
});