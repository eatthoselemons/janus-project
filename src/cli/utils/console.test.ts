import { describe, it, expect } from '@effect/vitest';
import { Schema } from 'effect';
import { Snippet } from '../../domain/types/snippet';
import { Tag } from '../../domain/types/tag';
import { Parameter } from '../../domain/types/parameter';
import { Composition } from '../../domain/types/composition';
import {
  SnippetId,
  TagId,
  ParameterId,
  CompositionId,
  Slug,
} from '../../domain/types/branded';
import { formatNamedEntity, formatNamedEntityList } from './console';

describe('Console Utilities', () => {
  const testSnippets: readonly Snippet[] = [
    {
      id: Schema.decodeSync(SnippetId)('550e8400-e29b-41d4-a716-446655440001'),
      name: Schema.decodeSync(Slug)('greeting-snippet'),
      description: 'A snippet for greeting users',
    },
    {
      id: Schema.decodeSync(SnippetId)('550e8400-e29b-41d4-a716-446655440002'),
      name: Schema.decodeSync(Slug)('response-snippet'),
      description: 'A snippet for generating responses',
    },
  ];

  const testTags: readonly Tag[] = [
    {
      id: Schema.decodeSync(TagId)('650e8400-e29b-41d4-a716-446655440001'),
      name: Schema.decodeSync(Slug)('greeting-tag'),
      description: 'Tag for greeting-related content',
    },
    {
      id: Schema.decodeSync(TagId)('650e8400-e29b-41d4-a716-446655440002'),
      name: Schema.decodeSync(Slug)('system-tag'),
      description: 'Tag for system messages',
    },
  ];

  const testParameters: readonly Parameter[] = [
    {
      id: Schema.decodeSync(ParameterId)(
        '750e8400-e29b-41d4-a716-446655440001',
      ),
      name: Schema.decodeSync(Slug)('obligation-level'),
      description: 'Level of obligation for responses',
    },
  ];

  const testCompositions: readonly Composition[] = [
    {
      id: Schema.decodeSync(CompositionId)(
        '850e8400-e29b-41d4-a716-446655440001',
      ),
      name: Schema.decodeSync(Slug)('help-composition'),
      description: 'Composition for helpful responses',
    },
  ];

  describe('formatNamedEntity', () => {
    it('should format snippet correctly', () => {
      const formatted = formatNamedEntity(testSnippets[0]);
      expect(formatted).toBe('greeting-snippet - A snippet for greeting users');
    });

    it('should format tag correctly', () => {
      const formatted = formatNamedEntity(testTags[0]);
      expect(formatted).toBe('greeting-tag - Tag for greeting-related content');
    });

    it('should format parameter correctly', () => {
      const formatted = formatNamedEntity(testParameters[0]);
      expect(formatted).toBe(
        'obligation-level - Level of obligation for responses',
      );
    });

    it('should format composition correctly', () => {
      const formatted = formatNamedEntity(testCompositions[0]);
      expect(formatted).toBe(
        'help-composition - Composition for helpful responses',
      );
    });

    it('should handle entities with special characters', () => {
      const specialEntity = {
        name: 'special-entity',
        description: 'Description with "quotes" and | pipes and & ampersands',
      };

      const formatted = formatNamedEntity(specialEntity);
      expect(formatted).toBe(
        'special-entity - Description with "quotes" and | pipes and & ampersands',
      );
    });
  });

  describe('formatNamedEntityList', () => {
    it('should format list of snippets as table', () => {
      const formatted = formatNamedEntityList(
        testSnippets,
        'No snippets found.',
      );

      expect(formatted).toContain('NAME');
      expect(formatted).toContain('DESCRIPTION');
      expect(formatted).toContain('greeting-snippet');
      expect(formatted).toContain('response-snippet');
      expect(formatted).toContain('|');
      expect(formatted).toContain('-');

      const lines = formatted.split('\n');
      expect(lines).toHaveLength(4); // header + separator + 2 data rows
    });

    it('should format list of tags as table', () => {
      const formatted = formatNamedEntityList(testTags, 'No tags found.');

      expect(formatted).toContain('NAME');
      expect(formatted).toContain('DESCRIPTION');
      expect(formatted).toContain('greeting-tag');
      expect(formatted).toContain('system-tag');
      expect(formatted).toContain('|');
      expect(formatted).toContain('-');
    });

    it('should format list of parameters as table', () => {
      const formatted = formatNamedEntityList(
        testParameters,
        'No parameters found.',
      );

      expect(formatted).toContain('NAME');
      expect(formatted).toContain('DESCRIPTION');
      expect(formatted).toContain('obligation-level');
      expect(formatted).toContain('Level of obligation for responses');
    });

    it('should format list of compositions as table', () => {
      const formatted = formatNamedEntityList(
        testCompositions,
        'No compositions found.',
      );

      expect(formatted).toContain('NAME');
      expect(formatted).toContain('DESCRIPTION');
      expect(formatted).toContain('help-composition');
      expect(formatted).toContain('Composition for helpful responses');
    });

    it('should handle empty list with default message', () => {
      const formatted = formatNamedEntityList([]);
      expect(formatted).toBe('No items found.');
    });

    it('should handle empty list with custom message', () => {
      const formatted = formatNamedEntityList([], 'No tags found.');
      expect(formatted).toBe('No tags found.');
    });

    it('should align columns properly with varying name lengths', () => {
      const mixedEntities = [
        { name: 'a', description: 'Short name' },
        {
          name: 'very-long-entity-name-that-extends-beyond-normal',
          description: 'Long name',
        },
        { name: 'medium', description: 'Medium name' },
      ];

      const formatted = formatNamedEntityList(mixedEntities);
      const lines = formatted.split('\n');

      // Should maintain table structure
      expect(lines.length).toBe(5); // header + separator + 3 data rows
      expect(formatted).toContain('|');
      expect(formatted).toContain('-');

      // All lines should have consistent pipe positions
      const headerLine = lines[0];
      const headerPipePos = headerLine.indexOf('|', headerLine.indexOf('NAME'));
      expect(headerPipePos).toBeGreaterThan(0);

      for (const line of lines.slice(2)) {
        if (line.trim()) {
          const linePipePos = line.indexOf('|');
          expect(linePipePos).toBeGreaterThan(0);
        }
      }
    });

    it('should calculate correct column width', () => {
      const formatted = formatNamedEntityList(testSnippets);
      const lines = formatted.split('\n');
      const headerLine = lines[0];
      const separatorLine = lines[1];

      // The NAME column width should be based on the longest name or 'NAME' header
      const longestName = Math.max(
        ...testSnippets.map((s) => s.name.length),
        'NAME'.length,
      );

      // Check that the separator has the right number of dashes for the NAME column
      const nameColumnDashes = separatorLine.split(' | ')[0];
      expect(nameColumnDashes.length).toBe(longestName);

      // Check that header padding matches
      const nameColumnHeader = headerLine.split(' | ')[0];
      expect(nameColumnHeader.length).toBe(longestName);
    });

    it('should handle different entity types in same function call', () => {
      // Create a mixed array of different entity types (all have name + description)
      const mixedEntities = [
        testSnippets[0],
        testTags[0],
        testParameters[0],
        testCompositions[0],
      ];

      const formatted = formatNamedEntityList(mixedEntities);

      expect(formatted).toContain('greeting-snippet');
      expect(formatted).toContain('greeting-tag');
      expect(formatted).toContain('obligation-level');
      expect(formatted).toContain('help-composition');

      const lines = formatted.split('\n');
      expect(lines).toHaveLength(6); // header + separator + 4 data rows
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle entities with empty descriptions', () => {
      const emptyDescEntity = {
        name: 'empty-desc',
        description: '',
      };

      const formatted = formatNamedEntityList([emptyDescEntity]);
      expect(formatted).toContain('empty-desc');
      expect(formatted).toContain('|'); // Table structure should be maintained
    });

    it('should handle large lists efficiently', () => {
      // Generate a medium-sized list of entities (not too large for test performance)
      const largeList = Array.from({ length: 100 }, (_, i) => ({
        name: `entity-${i}`,
        description: `Description for entity ${i}`,
      }));

      // Should complete without timing out or crashing
      const formatted = formatNamedEntityList(largeList);

      expect(formatted).toContain('NAME');
      expect(formatted).toContain('DESCRIPTION');
      expect(formatted).toContain('entity-0');
      expect(formatted).toContain('entity-99');

      const lines = formatted.split('\n');
      expect(lines).toHaveLength(102); // header + separator + 100 data rows
    });

    it('should maintain consistency across different entity types', () => {
      // Test that all our domain entities work consistently
      const entityTests = [
        { entities: testSnippets, type: 'Snippet' },
        { entities: testTags, type: 'Tag' },
        { entities: testParameters, type: 'Parameter' },
        { entities: testCompositions, type: 'Composition' },
      ];

      for (const { entities } of entityTests) {
        const formatted = formatNamedEntityList(entities);

        // All should produce valid table output
        expect(formatted).toContain('NAME');
        expect(formatted).toContain('DESCRIPTION');
        expect(formatted).toContain('|');
        expect(formatted).toContain('-');

        // All should contain the entity's name and description
        expect(formatted).toContain(entities[0].name);
        expect(formatted).toContain(entities[0].description);
      }
    });
  });
});
