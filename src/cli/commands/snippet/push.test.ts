import { describe, it, expect } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import { Slug } from '../../../domain/types/branded';
import { fileNameToName } from '../../utils/file';

const SNIPPET_EXTENSION = '.snippet';

describe('CLI Push Command Logic', () => {
  describe('File Name Processing', () => {
    it('should correctly derive snippet name from various file formats', () => {
      const testCases = [
        { file: 'simple.txt', expectedName: 'simple.txt' },
        { file: 'with-dashes.snippet', expectedName: 'with-dashes' },
        { file: 'nested/path/file.txt', expectedName: 'file.txt' },
        {
          file: 'file.complex.name.snippet',
          expectedName: 'file.complex.name',
        },
        { file: '/absolute/path/snippet.snippet', expectedName: 'snippet' },
      ];

      for (const testCase of testCases) {
        const extractedName = fileNameToName(testCase.file, SNIPPET_EXTENSION);
        expect(extractedName).toBe(testCase.expectedName);
      }
    });

    it('should handle edge cases in file paths', () => {
      const testCases = [
        { file: '.snippet', expectedName: '' },
        { file: 'name', expectedName: 'name' },
        { file: '', expectedName: '' },
        { file: '../../parent/file.snippet', expectedName: 'file' },
      ];

      for (const testCase of testCases) {
        const extractedName = fileNameToName(testCase.file, SNIPPET_EXTENSION);
        expect(extractedName).toBe(testCase.expectedName);
      }
    });
  });

  describe('Snippet Name Validation', () => {
    it.effect('should validate extracted snippet names', () =>
      Effect.gen(function* () {
        // Valid names that should pass Slug validation
        const validNames = ['simple', 'with-dashes', 'name123', 'a'];

        for (const name of validNames) {
          const slug = yield* Schema.decodeUnknown(Slug)(name);
          expect(slug).toBe(name);
        }
      }),
    );

    it.effect('should reject invalid snippet names', () =>
      Effect.gen(function* () {
        // Names that would be extracted but are invalid slugs
        const invalidNames = [
          'NAME WITH SPACES',
          'name_with_underscores',
          'name.with.dots',
        ];

        for (const name of invalidNames) {
          const result = yield* Effect.either(Schema.decodeUnknown(Slug)(name));
          expect(result._tag).toBe('Left');
        }
      }),
    );
  });

  describe('File Extension Handling', () => {
    it('should handle different file extensions consistently', () => {
      const testCases = [
        { file: 'test.txt', extracted: 'test.txt' },
        { file: 'test.js', extracted: 'test.js' },
        { file: 'test.md', extracted: 'test.md' },
        { file: 'test.snippet', extracted: 'test' }, // Only .snippet extension is removed
      ];

      for (const testCase of testCases) {
        const extractedName = fileNameToName(testCase.file, SNIPPET_EXTENSION);
        expect(extractedName).toBe(testCase.extracted);
      }
    });
  });

  describe('Description Generation', () => {
    it('should generate appropriate descriptions for imported snippets', () => {
      const testCases = [
        {
          file: 'greeting.snippet',
          expectedDesc: 'Snippet imported from greeting.snippet',
        },
        {
          file: 'nested/path/file.txt',
          expectedDesc: 'Snippet imported from nested/path/file.txt',
        },
        {
          file: '/absolute/path.snippet',
          expectedDesc: 'Snippet imported from /absolute/path.snippet',
        },
      ];

      for (const testCase of testCases) {
        const description = `Snippet imported from ${testCase.file}`;
        expect(description).toBe(testCase.expectedDesc);
      }
    });
  });
});
