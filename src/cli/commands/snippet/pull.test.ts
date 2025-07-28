import { describe, it, expect } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import { Slug } from '../../../domain/types/branded';
import { nameToFileName } from '../../utils/file';

const SNIPPET_EXTENSION = '.snippet';

describe('CLI Pull Command Logic', () => {
  describe('Input Validation', () => {
    it.effect('should validate snippet name format', () =>
      Effect.gen(function* () {
        const validSlug =
          yield* Schema.decodeUnknown(Slug)('valid-snippet-name');
        expect(validSlug).toBe('valid-snippet-name');

        const result = yield* Effect.either(
          Schema.decodeUnknown(Slug)('INVALID SNIPPET NAME'),
        );
        expect(result._tag).toBe('Left');
      }),
    );

    it.effect('should handle edge cases in snippet names', () =>
      Effect.gen(function* () {
        const testCases = [
          'a',
          'simple-name',
          'name-with-123-numbers',
          'very-long-snippet-name-with-many-parts-and-dashes',
        ];

        for (const testCase of testCases) {
          const slug = yield* Schema.decodeUnknown(Slug)(testCase);
          expect(slug).toBe(testCase);
        }
      }),
    );
  });

  describe('File Name Generation', () => {
    it('should generate correct filename from snippet name', () => {
      const testCases = [
        { input: 'simple', expected: 'simple.snippet' },
        { input: 'with-dashes', expected: 'with-dashes.snippet' },
        { input: 'name123', expected: 'name123.snippet' },
      ];

      for (const testCase of testCases) {
        const filename = nameToFileName(testCase.input, SNIPPET_EXTENSION);
        expect(filename).toBe(testCase.expected);
      }
    });
  });

  describe('Error Handling', () => {
    it.effect('should handle invalid slug formats', () =>
      Effect.gen(function* () {
        const invalidNames = [
          'NAME WITH SPACES',
          'name_with_underscores',
          'name.with.dots',
          '',
        ];

        for (const invalidName of invalidNames) {
          const result = yield* Effect.either(
            Schema.decodeUnknown(Slug)(invalidName),
          );
          expect(result._tag).toBe('Left');
        }
      }),
    );
  });
});
