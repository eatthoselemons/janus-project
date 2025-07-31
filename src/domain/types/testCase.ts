/**
 * Test Case types for the Janus Project
 *
 * Defines types for test cases that structure conversations and experiments
 * with LLM models, supporting A/B testing and parameter variations.
 */

import { Schema, HashMap, Chunk } from 'effect';
import { Slug, ContentNodeId, TagId } from './branded';
import {
  ParameterKey,
  ParameterValue,
  ParameterContext,
  ContentRole,
} from './contentNode';

// LLM Model validation
export const LLMModel = Schema.String.pipe(
  Schema.pattern(/^(gpt-4|gpt-3\.5-turbo|claude-3|claude-2|llama).*$/),
  Schema.brand('LLMModel'),
);
export type LLMModel = typeof LLMModel.Type;

// Test Case ID
export const TestCaseId = Schema.String.pipe(
  Schema.pattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ),
  Schema.brand('TestCaseId'),
);
export type TestCaseId = typeof TestCaseId.Type;

// Tag name alias for test cases
export const TagName = Slug; // Tags use slug format
export type TagName = typeof TagName.Type;

// Message slot definition for test cases
export const MessageSlot = Schema.Struct({
  role: ContentRole,
  tags: Schema.optional(Schema.Array(Schema.Union(TagId, TagName))),
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
  parameters: Schema.optional(Schema.Unknown), // Will be validated as ParameterContext at runtime
});
export type TestCase = Omit<typeof TestCase.Type, 'parameters'> & {
  parameters?: ParameterContext;
};

// Message type for conversations
export const Message = Schema.Struct({
  role: ContentRole,
  content: Schema.String,
});
export type Message = typeof Message.Type;

// Conversation type
export type Conversation = Chunk.Chunk<Message>;
