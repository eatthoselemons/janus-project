import { describe, expect, it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import { Snippet, SnippetVersion } from '../snippet';

describe('Snippet', () => {
  it.effect('should decode valid snippet', () =>
    Effect.gen(function* () {
      const validSnippet = {
        id: '123e4567-e89b-42d3-a456-426614174000',
        name: 'my-snippet',
        description: 'A test snippet for validation',
      };

      const result = yield* Schema.decode(Snippet)(validSnippet);
      expect(result).toEqual(validSnippet);
    }),
  );

  it.effect('should reject snippet with invalid id', () =>
    Effect.gen(function* () {
      const invalidSnippet = {
        id: 'not-a-uuid',
        name: 'my-snippet',
        description: 'A test snippet',
      };

      const result = yield* Effect.either(
        Schema.decode(Snippet)(invalidSnippet),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  it.effect('should reject snippet with invalid name', () =>
    Effect.gen(function* () {
      const invalidSnippet = {
        id: '123e4567-e89b-42d3-a456-426614174000',
        name: 'My-Snippet', // uppercase not allowed
        description: 'A test snippet',
      };

      const result = yield* Effect.either(
        Schema.decode(Snippet)(invalidSnippet),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  it.effect('should reject snippet with missing fields', () =>
    Effect.gen(function* () {
      const invalidSnippet = {
        id: '123e4567-e89b-42d3-a456-426614174000',
        name: 'my-snippet',
        // missing description
      };

      const result = yield* Effect.either(
        Schema.decode(Snippet)(invalidSnippet),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  it.effect('should accept empty description', () =>
    Effect.gen(function* () {
      const validSnippet = {
        id: '123e4567-e89b-42d3-a456-426614174000',
        name: 'my-snippet',
        description: '',
      };

      const result = yield* Schema.decode(Snippet)(validSnippet);
      expect(result.description).toBe('');
    }),
  );
});

describe('SnippetVersion', () => {
  const validDate = '2024-01-01T00:00:00Z';

  it.effect('should decode valid snippet version', () =>
    Effect.gen(function* () {
      const validVersion = {
        id: '456e7890-e89b-42d3-a456-426614174001',
        content: 'You {{obligation_level}} answer the question',
        createdAt: validDate,
        commit_message: 'Initial version',
      };

      const result = yield* Schema.decode(SnippetVersion)(validVersion);
      expect(result.id).toBe(validVersion.id);
      expect(result.content).toBe(validVersion.content);
      expect(result.commit_message).toBe(validVersion.commit_message);
      // DateTimeUtc returns an object that serializes to ISO string
      expect(JSON.stringify(result.createdAt)).toBe(
        '"2024-01-01T00:00:00.000Z"',
      );
    }),
  );

  it.effect('should accept template content with multiple variables', () =>
    Effect.gen(function* () {
      const validVersion = {
        id: '456e7890-e89b-42d3-a456-426614174001',
        content:
          'As a {{role}}, you {{obligation_level}} {{action}} when {{condition}}',
        createdAt: validDate,
        commit_message: 'Added multiple template variables',
      };

      const result = yield* Schema.decode(SnippetVersion)(validVersion);
      expect(result.content).toContain('{{role}}');
      expect(result.content).toContain('{{obligation_level}}');
      expect(result.content).toContain('{{action}}');
      expect(result.content).toContain('{{condition}}');
      expect(JSON.stringify(result.createdAt)).toBe(
        '"2024-01-01T00:00:00.000Z"',
      );
    }),
  );

  it.effect('should accept plain text content without variables', () =>
    Effect.gen(function* () {
      const validVersion = {
        id: '456e7890-e89b-42d3-a456-426614174001',
        content: 'This is plain text without any template variables',
        createdAt: validDate,
        commit_message: 'Plain text version',
      };

      const result = yield* Schema.decode(SnippetVersion)(validVersion);
      expect(result.content).toBe(
        'This is plain text without any template variables',
      );
      expect(JSON.stringify(result.createdAt)).toBe(
        '"2024-01-01T00:00:00.000Z"',
      );
    }),
  );

  it.effect('should reject version with invalid date', () =>
    Effect.gen(function* () {
      const invalidVersion = {
        id: '456e7890-e89b-42d3-a456-426614174001',
        content: 'Test content',
        createdAt: 'not-a-date',
        commit_message: 'Test',
      };

      const result = yield* Effect.either(
        Schema.decode(SnippetVersion)(invalidVersion),
      );
      expect(result._tag).toBe('Left');
    }),
  );

  it.effect('allows version with empty commit message', () =>
    Effect.gen(function* () {
      const invalidVersion = {
        id: '456e7890-e89b-42d3-a456-426614174001',
        content: 'Test content',
        createdAt: validDate,
        commit_message: '',
      };

      const result = yield* Schema.decode(SnippetVersion)(invalidVersion);
      // Empty string is still a valid string, so this should pass
      expect(result.commit_message).toBe('');
      expect(JSON.stringify(result.createdAt)).toBe(
        '"2024-01-01T00:00:00.000Z"',
      );
    }),
  );

  it.effect('should handle multiline content', () =>
    Effect.gen(function* () {
      const multilineContent = `You are an AI assistant.
Your primary goal is to {{action}}.
You {{obligation_level}} follow these guidelines:
- Be helpful
- Be accurate
- Be concise`;

      const validVersion = {
        id: '456e7890-e89b-42d3-a456-426614174001',
        content: multilineContent,
        createdAt: validDate,
        commit_message: 'Added multiline template',
      };

      const result = yield* Schema.decode(SnippetVersion)(validVersion);
      expect(result.content).toBe(multilineContent);
      expect(JSON.stringify(result.createdAt)).toBe(
        '"2024-01-01T00:00:00.000Z"',
      );
    }),
  );
});
