import { describe, expect, it } from '@effect/vitest';
import { Effect, Schema, HashMap, Option } from 'effect';
import {
  ContentNode,
  ContentNodeVersion,
  EdgeOperation,
  IncludesEdgeProperties,
  InsertKey,
  InsertValue,
} from '../contentNode';
import { Message, TestCase, MessageSlot, LLMModel } from '../testCase';

describe('ContentNode', () => {
  it.effect('should decode valid ContentNode', () =>
    Effect.gen(function* () {
      const validNode = {
        id: '123e4567-e89b-42d3-a456-426614174000',
        name: 'my-content',
        description: 'Test content node',
      };

      const result = yield* Schema.decode(ContentNode)(validNode);
      expect(result).toEqual(validNode);
    }),
  );

  it.effect('should reject ContentNode with invalid id', () =>
    Effect.gen(function* () {
      const invalidNode = {
        id: 'not-a-uuid',
        name: 'my-content',
        description: 'Test content node',
      };

      const result = yield* Effect.either(
        Schema.decode(ContentNode)(invalidNode),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  it.effect('should reject ContentNode with invalid name', () =>
    Effect.gen(function* () {
      const invalidNode = {
        id: '123e4567-e89b-42d3-a456-426614174000',
        name: 'My-Content', // uppercase not allowed
        description: 'Test content node',
      };

      const result = yield* Effect.either(
        Schema.decode(ContentNode)(invalidNode),
      );
      expect(result._tag).toBe('Left');
    }),
  );
});

describe('ContentNodeVersion', () => {
  const validDate = '2024-01-01T00:00:00Z';

  it.effect('should decode valid ContentNodeVersion with content', () =>
    Effect.gen(function* () {
      const validVersion = {
        id: '456e7890-e89b-42d3-a456-426614174001',
        content: 'Hello {{name}}, welcome!',
        createdAt: validDate,
        commitMessage: 'Initial version',
      };

      const result = yield* Schema.decode(ContentNodeVersion)(validVersion);
      expect(result.id).toBe(validVersion.id);
      expect(result.content).toBe(validVersion.content);
      expect(result.commitMessage).toBe(validVersion.commitMessage);
      expect(JSON.stringify(result.createdAt)).toBe(
        '"2024-01-01T00:00:00.000Z"',
      );
    }),
  );

  it.effect('should decode valid ContentNodeVersion without content', () =>
    Effect.gen(function* () {
      const validVersion = {
        id: '456e7890-e89b-42d3-a456-426614174001',
        createdAt: validDate,
        commitMessage: 'Branch node without content',
      };

      const result = yield* Schema.decode(ContentNodeVersion)(validVersion);
      expect(result.id).toBe(validVersion.id);
      expect(result.content).toBeUndefined();
      expect(result.commitMessage).toBe(validVersion.commitMessage);
    }),
  );

  it.effect('should reject ContentNodeVersion with invalid date', () =>
    Effect.gen(function* () {
      const invalidVersion = {
        id: '456e7890-e89b-42d3-a456-426614174001',
        content: 'Test content',
        createdAt: 'not-a-date',
        commitMessage: 'Test',
      };

      const result = yield* Effect.either(
        Schema.decode(ContentNodeVersion)(invalidVersion),
      );
      expect(result._tag).toBe('Left');
    }),
  );
});

describe('EdgeOperation', () => {
  it.effect('should decode insert operation', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(EdgeOperation)('insert');
      expect(result).toBe('insert');
    }),
  );

  it.effect('should decode concatenate operation', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(EdgeOperation)('concatenate');
      expect(result).toBe('concatenate');
    }),
  );

  it.effect('should reject invalid operation', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        Schema.decode(EdgeOperation)('invalid'),
      );
      expect(result._tag).toBe('Left');
    }),
  );
});

describe('IncludesEdgeProperties', () => {
  it.effect('should decode edge properties for insert operation', () =>
    Effect.gen(function* () {
      const edgeProps = {
        operation: 'insert',
        key: 'name',
      };

      const result = yield* Schema.decode(IncludesEdgeProperties)(edgeProps);
      expect(result).toEqual(edgeProps);
    }),
  );

  it.effect('should decode edge properties for concatenate operation', () =>
    Effect.gen(function* () {
      const edgeProps = {
        operation: 'concatenate',
      };

      const result = yield* Schema.decode(IncludesEdgeProperties)(edgeProps);
      expect(result.operation).toBe('concatenate');
      expect(result.key).toBeUndefined();
    }),
  );

  it.effect('should accept concatenate with unnecessary key', () =>
    Effect.gen(function* () {
      const edgeProps = {
        operation: 'concatenate',
        key: 'ignored', // key is optional, so this should still be valid
      };

      const result = yield* Schema.decode(IncludesEdgeProperties)(edgeProps);
      expect(result.operation).toBe('concatenate');
      expect(result.key).toBe('ignored');
    }),
  );
});

describe('InsertKey', () => {
  it.effect('should decode valid insert key', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(InsertKey)('validKey');
      expect(result).toBe('validKey');
    }),
  );

  it.effect('should decode insert key with underscores', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(InsertKey)('valid_key_name');
      expect(result).toBe('valid_key_name');
    }),
  );

  it.effect('should reject insert key starting with number', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(Schema.decode(InsertKey)('1key'));
      expect(result._tag).toBe('Left');
    }),
  );

  it.effect('should reject insert key with spaces', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        Schema.decode(InsertKey)('invalid key'),
      );
      expect(result._tag).toBe('Left');
    }),
  );
});

describe('Message', () => {
  it.effect('should decode system message', () =>
    Effect.gen(function* () {
      const message = {
        role: 'system',
        content: 'You are a helpful assistant.',
      };

      const result = yield* Schema.decode(Message)(message);
      expect(result).toEqual(message);
    }),
  );

  it.effect('should decode user message', () =>
    Effect.gen(function* () {
      const message = {
        role: 'user',
        content: 'Hello, can you help me?',
      };

      const result = yield* Schema.decode(Message)(message);
      expect(result).toEqual(message);
    }),
  );

  it.effect('should decode assistant message', () =>
    Effect.gen(function* () {
      const message = {
        role: 'assistant',
        content: 'Of course! How can I help you today?',
      };

      const result = yield* Schema.decode(Message)(message);
      expect(result).toEqual(message);
    }),
  );

  it.effect('should reject message with invalid role', () =>
    Effect.gen(function* () {
      const message = {
        role: 'invalid',
        content: 'Test content',
      };

      const result = yield* Effect.either(Schema.decode(Message)(message));
      expect(result._tag).toBe('Left');
    }),
  );
});

describe('TestCase', () => {
  const validDate = '2024-01-01T00:00:00Z';

  it.effect('should decode valid TestCase', () =>
    Effect.gen(function* () {
      const testCase = {
        id: '123e4567-e89b-42d3-a456-426614174000',
        name: 'Support conversation test',
        description: 'Test multi-turn support conversation',
        createdAt: validDate,
        llmModel: 'gpt-4',
        messageSlots: [
          { role: 'system', tags: ['instruction'], sequence: 0 },
          { role: 'user', tags: ['greeting'], sequence: 1 },
          { role: 'assistant', tags: ['response'], sequence: 2 },
        ],
      };

      const result = yield* Schema.decode(TestCase)(testCase);
      expect(result.name).toBe(testCase.name);
      expect(result.messageSlots).toHaveLength(3);
      expect(result.parameters).toBeUndefined();
    }),
  );

  it.effect('should decode TestCase with parameters', () =>
    Effect.gen(function* () {
      const key = yield* Schema.decode(InsertKey)('topic');
      const value = yield* Schema.decode(InsertValue)('TypeScript');

      // Use array form for Schema.HashMap encoding
      const testCase = {
        id: '123e4567-e89b-42d3-a456-426614174000',
        name: 'Parameterized test',
        description: 'Test with parameters',
        createdAt: validDate,
        llmModel: 'gpt-4',
        messageSlots: [{ role: 'user', sequence: 0 }],
        parameters: [[key, value]], // Array of key-value pairs for Schema.HashMap
      };

      const result = yield* Schema.decode(TestCase)(testCase);
      expect(result.parameters).toBeDefined();
      expect(HashMap.has(result.parameters!, key)).toBe(true);
      expect(HashMap.get(result.parameters!, key)).toEqual(Option.some(value));
    }),
  );

  it.effect('should reject TestCase with invalid LLM model', () =>
    Effect.gen(function* () {
      const testCase = {
        id: '123e4567-e89b-42d3-a456-426614174000',
        name: 'Invalid model test',
        description: 'Test with invalid model',
        createdAt: validDate,
        llmModel: 'invalid-model',
        messageSlots: [],
      };

      const result = yield* Effect.either(Schema.decode(TestCase)(testCase));
      expect(result._tag).toBe('Left');
    }),
  );
});

describe('MessageSlot', () => {
  it.effect('should decode MessageSlot with all fields', () =>
    Effect.gen(function* () {
      const slot = {
        role: 'user',
        tags: ['greeting', 'formal'],
        excludeNodes: ['old-greeting'],
        includeNodes: ['new-greeting'],
        sequence: 1,
      };

      const result = yield* Schema.decode(MessageSlot)(slot);
      expect(result).toEqual(slot);
    }),
  );

  it.effect('should decode MessageSlot with only required fields', () =>
    Effect.gen(function* () {
      const slot = {
        role: 'system',
        sequence: 0,
      };

      const result = yield* Schema.decode(MessageSlot)(slot);
      expect(result.role).toBe('system');
      expect(result.sequence).toBe(0);
      expect(result.tags).toBeUndefined();
      expect(result.excludeNodes).toBeUndefined();
      expect(result.includeNodes).toBeUndefined();
    }),
  );

  it.effect('should reject MessageSlot with negative sequence', () =>
    Effect.gen(function* () {
      const slot = {
        role: 'user',
        sequence: -1,
      };

      const result = yield* Effect.either(Schema.decode(MessageSlot)(slot));
      expect(result._tag).toBe('Left');
    }),
  );

  it.effect('should reject MessageSlot with decimal sequence', () =>
    Effect.gen(function* () {
      const slot = {
        role: 'user',
        sequence: 1.5,
      };

      const result = yield* Effect.either(Schema.decode(MessageSlot)(slot));
      expect(result._tag).toBe('Left');
    }),
  );
});

describe('LLMModel', () => {
  it.effect('should accept valid OpenAI models', () =>
    Effect.gen(function* () {
      const models = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      for (const model of models) {
        const result = yield* Schema.decode(LLMModel)(model);
        expect(result).toBe(model);
      }
    }),
  );

  it.effect('should accept valid Claude models', () =>
    Effect.gen(function* () {
      const models = ['claude-3', 'claude-3-opus', 'claude-2'];
      for (const model of models) {
        const result = yield* Schema.decode(LLMModel)(model);
        expect(result).toBe(model);
      }
    }),
  );

  it.effect('should accept llama models', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(LLMModel)('llama-2-70b');
      expect(result).toBe('llama-2-70b');
    }),
  );

  it.effect('should reject invalid model names', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        Schema.decode(LLMModel)('invalid-model'),
      );
      expect(result._tag).toBe('Left');
    }),
  );
});
