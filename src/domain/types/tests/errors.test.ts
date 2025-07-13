import { describe, expect, it } from '@effect/vitest';
import { Effect, Either, Schema } from 'effect';
import {
  JanusError,
  PersistenceError,
  LlmApiError,
  FileSystemError,
  NotFoundError,
  ConflictError,
} from '../errors';
import {
  SnippetId,
  SnippetVersionId,
  ParameterId,
  CompositionId,
  TagId,
  Slug,
} from '../branded';

describe('Error Types', () => {
  describe('JanusError', () => {
    it('should create base error with message', () => {
      const error = new JanusError({ message: 'Base error occurred' });
      expect(error._tag).toBe('JanusError');
      expect(error.message).toBe('Base error occurred');
    });
  });

  describe('PersistenceError', () => {
    it.effect('should create error with all properties', () =>
      Effect.gen(function* () {
        const error = new PersistenceError({
          originalMessage: 'Connection timeout',
          operation: 'create',
          query: 'CREATE (n:Snippet {id: $id})',
        });

        expect(error._tag).toBe('PersistenceError');
        expect(error.message).toBe(
          'Database create failed: Connection timeout',
        );
        expect(error.operation).toBe('create');
        expect(error.query).toBe('CREATE (n:Snippet {id: $id})');
      }),
    );

    it.effect('should create error without optional query', () =>
      Effect.gen(function* () {
        const error = new PersistenceError({
          originalMessage: 'Network error',
          operation: 'read',
        });

        expect(error._tag).toBe('PersistenceError');
        expect(error.message).toBe('Database read failed: Network error');
        expect(error.query).toBeUndefined();
      }),
    );

    it.effect('should validate operation literals', () =>
      Effect.gen(function* () {
        // Test invalid operation by trying to create error with invalid literal
        const createInvalidError = () =>
          new PersistenceError({
            originalMessage: 'Test',
            operation: 'invalid' as any,
          });

        // This should throw when the schema validation happens
        const result = yield* Effect.try({
          try: () => createInvalidError(),
          catch: () => new Error('Invalid operation'),
        }).pipe(Effect.either);
        expect(result._tag).toBe('Left');
      }),
    );

    it.effect('should accept all valid operations', () =>
      Effect.gen(function* () {
        const operations = [
          'create',
          'read',
          'update',
          'delete',
          'connect',
        ] as const;

        for (const op of operations) {
          const error = new PersistenceError({
            originalMessage: 'Test',
            operation: op,
          });
          expect(error.operation).toBe(op);
        }
      }),
    );
  });

  describe('LlmApiError', () => {
    it.effect('should create error with status code', () =>
      Effect.gen(function* () {
        const error = new LlmApiError({
          provider: 'OpenAI',
          statusCode: 429,
          originalMessage: 'Rate limit exceeded',
        });

        expect(error._tag).toBe('LlmApiError');
        expect(error.message).toBe(
          'LLM API error from OpenAI (429): Rate limit exceeded',
        );
        expect(error.provider).toBe('OpenAI');
        expect(error.statusCode).toBe(429);
      }),
    );

    it.effect('should create error without status code', () =>
      Effect.gen(function* () {
        const error = new LlmApiError({
          provider: 'Anthropic',
          originalMessage: 'Network timeout',
        });

        expect(error._tag).toBe('LlmApiError');
        expect(error.message).toBe(
          'LLM API error from Anthropic: Network timeout',
        );
        expect(error.statusCode).toBeUndefined();
      }),
    );

    it.effect('should truncate long error messages', () =>
      Effect.gen(function* () {
        const longMessage = 'A'.repeat(150); // 150 characters
        const error = new LlmApiError({
          provider: 'OpenAI',
          originalMessage: longMessage,
        });

        expect(error._tag).toBe('LlmApiError');
        expect(error.message).toBe(
          `LLM API error from OpenAI: ${'A'.repeat(100)}...`,
        );
        expect(error.originalMessage).toBe(longMessage); // Original is preserved
      }),
    );
  });

  describe('FileSystemError', () => {
    it.effect('should create error with all properties', () =>
      Effect.gen(function* () {
        const error = new FileSystemError({
          path: '/path/to/file.txt',
          operation: 'read',
          originalMessage: 'Permission denied',
        });

        expect(error._tag).toBe('FileSystemError');
        expect(error.message).toBe(
          'File system read error at /path/to/file.txt: Permission denied',
        );
        expect(error.path).toBe('/path/to/file.txt');
        expect(error.operation).toBe('read');
      }),
    );

    it.effect('should validate operation literals', () =>
      Effect.gen(function* () {
        const operations = ['read', 'write', 'delete', 'mkdir'] as const;

        for (const op of operations) {
          const error = new FileSystemError({
            path: '/test',
            operation: op,
            originalMessage: 'Test',
          });
          expect(error.operation).toBe(op);
        }
      }),
    );
  });

  describe('NotFoundError', () => {
    it.effect('should create error with branded ID', () =>
      Effect.gen(function* () {
        const id = yield* Schema.decode(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440000',
        );
        const error = new NotFoundError({
          entityType: 'snippet',
          id: id,
        });

        expect(error._tag).toBe('NotFoundError');
        expect(error.message).toBe(`snippet not found: ${id}`);
        expect(error.id).toBe(id);
        expect(error.slug).toBeUndefined();
      }),
    );

    it.effect('should create error with slug', () =>
      Effect.gen(function* () {
        const slug = yield* Schema.decode(Slug)('my-test-snippet');
        const error = new NotFoundError({
          entityType: 'parameter',
          slug: slug,
        });

        expect(error._tag).toBe('NotFoundError');
        expect(error.message).toBe(`parameter not found: ${slug}`);
        expect(error.slug).toBe(slug);
        expect(error.id).toBeUndefined();
      }),
    );

    it.effect('should create error without identifier', () =>
      Effect.gen(function* () {
        const error = new NotFoundError({
          entityType: 'composition',
        });

        expect(error._tag).toBe('NotFoundError');
        expect(error.message).toBe('composition not found: unknown');
        expect(error.id).toBeUndefined();
        expect(error.slug).toBeUndefined();
      }),
    );

    it.effect('should validate entity type literals', () =>
      Effect.gen(function* () {
        const entityTypes = [
          'snippet',
          'parameter',
          'composition',
          'tag',
          'test-run',
          'data-point',
        ] as const;

        for (const type of entityTypes) {
          const error = new NotFoundError({ entityType: type });
          expect(error.entityType).toBe(type);
        }
      }),
    );

    it.effect('should accept any ID type', () =>
      Effect.gen(function* () {
        // Test with a version ID
        const versionId = yield* Schema.decode(SnippetVersionId)(
          '990e8400-e29b-41d4-a716-446655440000',
        );
        const error = new NotFoundError({
          entityType: 'snippet',
          id: versionId,
        });

        expect(error._tag).toBe('NotFoundError');
        expect(error.id).toBe(versionId);
      }),
    );
  });

  describe('ConflictError', () => {
    it.effect('should create error with all properties', () =>
      Effect.gen(function* () {
        const existingId = yield* Schema.decode(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440000',
        );
        const importingId = yield* Schema.decode(SnippetId)(
          '660e8400-e29b-41d4-a716-446655440001',
        );

        const error = new ConflictError({
          entityType: 'snippet',
          existingId: existingId,
          importingId: importingId,
          conflictField: 'name',
          originalMessage: "Snippet with name 'test-snippet' already exists",
        });

        expect(error._tag).toBe('ConflictError');
        expect(error.message).toBe(
          `Import conflict for snippet: Snippet with name 'test-snippet' already exists ` +
            `(existing: ${existingId}, importing: ${importingId}, field: name)`,
        );
        expect(error.existingId).toBe(existingId);
        expect(error.importingId).toBe(importingId);
        expect(error.conflictField).toBe('name');
      }),
    );

    it.effect('should validate entity type literals', () =>
      Effect.gen(function* () {
        const entityTypes = [
          'snippet',
          'parameter',
          'composition',
          'tag',
        ] as const;

        for (const type of entityTypes) {
          // Use appropriate ID type based on entity type
          const existingId = yield* type === 'snippet'
            ? Schema.decode(SnippetId)('550e8400-e29b-41d4-a716-446655440000')
            : type === 'parameter'
              ? Schema.decode(ParameterId)(
                  '550e8400-e29b-41d4-a716-446655440001',
                )
              : type === 'composition'
                ? Schema.decode(CompositionId)(
                    '550e8400-e29b-41d4-a716-446655440002',
                  )
                : Schema.decode(TagId)('550e8400-e29b-41d4-a716-446655440003');
          const importingId = yield* type === 'snippet'
            ? Schema.decode(SnippetId)('660e8400-e29b-41d4-a716-446655440000')
            : type === 'parameter'
              ? Schema.decode(ParameterId)(
                  '660e8400-e29b-41d4-a716-446655440001',
                )
              : type === 'composition'
                ? Schema.decode(CompositionId)(
                    '660e8400-e29b-41d4-a716-446655440002',
                  )
                : Schema.decode(TagId)('660e8400-e29b-41d4-a716-446655440003');

          const error = new ConflictError({
            entityType: type,
            existingId: existingId,
            importingId: importingId,
            conflictField: 'name',
            originalMessage: 'Test conflict',
          });
          expect(error.entityType).toBe(type);
        }
      }),
    );

    it.effect('should accept version IDs for conflicts', () =>
      Effect.gen(function* () {
        const existingVersionId = yield* Schema.decode(SnippetVersionId)(
          '770e8400-e29b-41d4-a716-446655440000',
        );
        const importingVersionId = yield* Schema.decode(SnippetVersionId)(
          '880e8400-e29b-41d4-a716-446655440001',
        );

        const error = new ConflictError({
          entityType: 'snippet-version',
          existingId: existingVersionId,
          importingId: importingVersionId,
          conflictField: 'content',
          originalMessage: 'Version content conflict',
        });

        expect(error._tag).toBe('ConflictError');
        expect(error.entityType).toBe('snippet-version');
        expect(error.existingId).toBe(existingVersionId);
        expect(error.importingId).toBe(importingVersionId);
      }),
    );
  });

  describe('Error Composition', () => {
    it('should have distinct tags for each error type', () => {
      const errors = [
        new JanusError({ message: 'test' }),
        new PersistenceError({ originalMessage: 'test', operation: 'read' }),
        new LlmApiError({ provider: 'test', originalMessage: 'test' }),
        new FileSystemError({
          path: '/test',
          operation: 'read',
          originalMessage: 'test',
        }),
        new NotFoundError({ entityType: 'snippet' }),
        (() => {
          // Use a valid UUID for the test
          const id1 = Schema.decodeSync(SnippetId)(
            '550e8400-e29b-41d4-a716-446655440000',
          );
          const id2 = Schema.decodeSync(SnippetId)(
            '660e8400-e29b-41d4-a716-446655440001',
          );
          return new ConflictError({
            entityType: 'snippet',
            existingId: id1,
            importingId: id2,
            conflictField: 'name',
            originalMessage: 'test',
          });
        })(),
      ];

      const tags = errors.map((e) => e._tag);
      const uniqueTags = new Set(tags);

      expect(uniqueTags.size).toBe(errors.length);
      expect(tags).toEqual([
        'JanusError',
        'PersistenceError',
        'LlmApiError',
        'FileSystemError',
        'NotFoundError',
        'ConflictError',
      ]);
    });
  });
});
