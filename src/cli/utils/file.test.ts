import { describe, it, expect } from '@effect/vitest';
import { nameToFileName, fileNameToName } from './file';

const SNIPPET_EXTENSION = '.snippet';

describe('File Utilities', () => {
  describe('Generic File Name Functions', () => {
    describe('nameToFileName', () => {
      it('should add extension to name', () => {
        expect(nameToFileName('my-file', '.txt')).toBe('my-file.txt');
        expect(nameToFileName('script', '.js')).toBe('script.js');
        expect(nameToFileName('readme', '.md')).toBe('readme.md');
      });

      it('should handle names with special characters', () => {
        expect(nameToFileName('special-name-123', '.ext')).toBe(
          'special-name-123.ext',
        );
      });

      it('should handle empty names', () => {
        expect(nameToFileName('', '.txt')).toBe('.txt');
      });

      it('should handle different extension formats', () => {
        expect(nameToFileName('file', '.txt')).toBe('file.txt');
        expect(nameToFileName('file', 'txt')).toBe('filetxt'); // No dot prefix
        expect(nameToFileName('file', '')).toBe('file'); // Empty extension
      });
    });

    describe('fileNameToName', () => {
      it('should remove specified extension', () => {
        expect(fileNameToName('my-file.txt', '.txt')).toBe('my-file');
        expect(fileNameToName('script.js', '.js')).toBe('script');
        expect(fileNameToName('readme.md', '.md')).toBe('readme');
      });

      it('should handle files without the specified extension', () => {
        expect(fileNameToName('my-file.txt', '.js')).toBe('my-file.txt');
        expect(fileNameToName('my-file', '.txt')).toBe('my-file');
      });

      it('should handle paths and return only basename processing', () => {
        expect(fileNameToName('/path/to/my-file.txt', '.txt')).toBe('my-file');
        expect(fileNameToName('relative/path/script.js', '.js')).toBe('script');
      });

      it('should handle files with multiple dots', () => {
        expect(fileNameToName('my.complex.name.txt', '.txt')).toBe(
          'my.complex.name',
        );
        expect(fileNameToName('my.complex.name.js', '.txt')).toBe(
          'my.complex.name.js',
        );
      });

      it('should handle edge cases', () => {
        expect(fileNameToName('.txt', '.txt')).toBe('');
        expect(fileNameToName('', '.txt')).toBe('');
        expect(fileNameToName('file.', '.txt')).toBe('file.');
      });
    });

    describe('Generic Round-trip Compatibility', () => {
      it('should maintain name consistency for various extensions', () => {
        const testCases = [
          { name: 'test-file', ext: '.txt' },
          { name: 'script-name', ext: '.js' },
          { name: 'documentation', ext: '.md' },
          { name: 'config-file', ext: '.json' },
        ];

        for (const { name, ext } of testCases) {
          const fileName = nameToFileName(name, ext);
          const extractedName = fileNameToName(fileName, ext);
          expect(extractedName).toBe(name);
        }
      });

      it('should handle different extension formats consistently', () => {
        const name = 'test-file';

        // With dot prefix
        const withDot = nameToFileName(name, '.txt');
        expect(fileNameToName(withDot, '.txt')).toBe(name);

        // Without dot prefix (though not recommended)
        const withoutDot = nameToFileName(name, 'txt');
        expect(fileNameToName(withoutDot, 'txt')).toBe(name);
      });
    });
  });

  describe('Snippet Extension Specific Usage', () => {
    it('should work with snippet extension using generic functions', () => {
      expect(nameToFileName('my-snippet', SNIPPET_EXTENSION)).toBe(
        'my-snippet.snippet',
      );
      expect(fileNameToName('my-snippet.snippet', SNIPPET_EXTENSION)).toBe(
        'my-snippet',
      );
    });

    it('should maintain round-trip compatibility for snippet files', () => {
      const testCases = [
        'simple',
        'with-dashes',
        'with123numbers',
        'a',
        'very-long-snippet-name-with-many-parts',
      ];

      for (const name of testCases) {
        const fileName = nameToFileName(name, SNIPPET_EXTENSION);
        const extractedName = fileNameToName(fileName, SNIPPET_EXTENSION);
        expect(extractedName).toBe(name);
      }
    });

    it('should handle snippet files with special cases', () => {
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

    it('should handle paths correctly for snippet files', () => {
      expect(
        fileNameToName('/path/to/my-snippet.snippet', SNIPPET_EXTENSION),
      ).toBe('my-snippet');
      expect(
        fileNameToName('relative/path/my-snippet.snippet', SNIPPET_EXTENSION),
      ).toBe('my-snippet');
      expect(
        fileNameToName('../../parent/my-snippet.snippet', SNIPPET_EXTENSION),
      ).toBe('my-snippet');
    });
  });
});
