import { describe, expect, it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import { Tag } from '../tag';

describe('Tag', () => {
  it.effect('should decode valid tag', () =>
    Effect.gen(function* () {
      const validTag = {
        id: '890bc123-e89b-42d3-a456-426614174012',
        name: 'customer-support',
        description: 'Tags for customer support related items',
      };

      const result = yield* Schema.decode(Tag)(validTag);
      expect(result).toEqual(validTag);
    }),
  );

  it.effect('should accept various valid tag names', () =>
    Effect.gen(function* () {
      const validNames = [
        'production',
        'test',
        'v2',
        'beta-release',
        'high-priority',
        '2024-q1',
        'feature-123',
        'bug-fix',
      ];

      for (const name of validNames) {
        const tag = {
          id: '890bc123-e89b-42d3-a456-426614174012',
          name,
          description: `Description for ${name} tag`,
        };

        const result = yield* Schema.decode(Tag)(tag);
        expect(result.name).toBe(name);
      }
    }),
  );

  it.effect('should reject tag with invalid name format', () =>
    Effect.gen(function* () {
      const invalidNames = [
        'Customer Support', // uppercase
        'customer_support', // underscore
        'customer support', // space
        'customer-support!', // special character
        'customer-support-', // trailing hyphen
        '-customer-support', // leading hyphen
        '', // empty
        'a'.repeat(101), // too long
      ];

      for (const name of invalidNames) {
        const tag = {
          id: '890bc123-e89b-42d3-a456-426614174012',
          name,
          description: 'Valid description',
        };

        const result = yield* Effect.either(Schema.decode(Tag)(tag));
        expect(result._tag).toBe('Left');
      }
    }),
  );

  it.effect('should reject tag with invalid id', () =>
    Effect.gen(function* () {
      const invalidTag = {
        id: 'not-a-valid-uuid',
        name: 'valid-name',
        description: 'Valid description',
      };

      const result = yield* Effect.either(Schema.decode(Tag)(invalidTag));
      expect(result._tag).toBe('Left');
    }),
  );

  it.effect('should accept single character tag name', () =>
    Effect.gen(function* () {
      const validTag = {
        id: '890bc123-e89b-42d3-a456-426614174012',
        name: 'a',
        description: 'Single character tag for testing',
      };

      const result = yield* Schema.decode(Tag)(validTag);
      expect(result.name).toBe('a');
    }),
  );

  it.effect('should accept numeric tag names', () =>
    Effect.gen(function* () {
      const numericNames = ['1', '42', '2024', '123456'];

      for (const name of numericNames) {
        const tag = {
          id: '890bc123-e89b-42d3-a456-426614174012',
          name,
          description: `Numeric tag ${name}`,
        };

        const result = yield* Schema.decode(Tag)(tag);
        expect(result.name).toBe(name);
      }
    }),
  );

  it.effect('should accept maximum length tag name', () =>
    Effect.gen(function* () {
      // Create a 100 character slug (max length)
      const longName = 'a'.repeat(50) + '-' + 'b'.repeat(49);
      expect(longName.length).toBe(100);

      const validTag = {
        id: '890bc123-e89b-42d3-a456-426614174012',
        name: longName,
        description: 'Tag with maximum length name',
      };

      const result = yield* Schema.decode(Tag)(validTag);
      expect(result.name).toBe(longName);
    }),
  );

  it.effect('should reject tag with missing name', () =>
    Effect.gen(function* () {
      const incompleteTag = {
        id: '890bc123-e89b-42d3-a456-426614174012',
        description: 'Has description but missing name',
        // missing name
      };

      const result = yield* Effect.either(Schema.decode(Tag)(incompleteTag));
      expect(result._tag).toBe('Left');
    }),
  );

  it.effect('should reject tag with missing description', () =>
    Effect.gen(function* () {
      const incompleteTag = {
        id: '890bc123-e89b-42d3-a456-426614174012',
        name: 'valid-name',
        // missing description
      };

      const result = yield* Effect.either(Schema.decode(Tag)(incompleteTag));
      expect(result._tag).toBe('Left');
    }),
  );

  it.effect('should accept empty description', () =>
    Effect.gen(function* () {
      const tagWithEmptyDescription = {
        id: '890bc123-e89b-42d3-a456-426614174012',
        name: 'valid-name',
        description: '',
      };

      const result = yield* Schema.decode(Tag)(tagWithEmptyDescription);
      expect(result.description).toBe('');
    }),
  );
});
