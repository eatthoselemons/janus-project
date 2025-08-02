/**
 * Test Case types for the Janus Project
 *
 * Defines types for test cases that structure conversations and experiments
 * with LLM models, supporting A/B testing and parameter variations.
 */

import { Schema, HashMap, Chunk } from 'effect';
import { Slug, ContentNodeId, TagId, TestCaseId } from './branded';
import {
  ParameterKey,
  ParameterValue,
  ParameterHashMap,
  ContentRole,
} from './contentNode';

// LLM Model validation
export const LLMModel = Schema.String.pipe(
  Schema.pattern(/^(gpt-4|gpt-3\.5-turbo|claude-3|claude-2|llama).*$/),
  Schema.brand('LLMModel'),
);
export type LLMModel = typeof LLMModel.Type;

// Tag name alias for test cases
export const TestCaseTagName = Slug; // Tags use slug format
export type TestCaseTagName = typeof TestCaseTagName.Type;

// Message slot definition for test cases
export const MessageSlot = Schema.Struct({
  role: ContentRole,
  tags: Schema.optional(Schema.Array(Schema.Union(TagId, TestCaseTagName))),
  excludeNodes: Schema.optional(
    Schema.Array(Schema.Union(ContentNodeId, Slug)),
  ),
  includeNodes: Schema.optional(
    Schema.Array(Schema.Union(ContentNodeId, Slug)),
  ),
  sequence: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
});
export type MessageSlot = typeof MessageSlot.Type;

// Test Case schema
export const TestCase = Schema.Struct({
  id: TestCaseId,
  name: Schema.String,
  description: Schema.String,
  createdAt: Schema.DateTimeUtc,
  llmModel: LLMModel,
  messageSlots: Schema.Array(MessageSlot),
  parameters: Schema.optional(
    Schema.HashMap({
      key: ParameterKey,
      value: ParameterValue,
    }),
  ),
});
export type TestCase = typeof TestCase.Type;

// Message type for conversations
export const Message = Schema.Struct({
  role: ContentRole,
  content: Schema.String,
});
export type Message = typeof Message.Type;

// Conversation type
export type Conversation = Chunk.Chunk<Message>;
