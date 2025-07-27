import { describe, it, expect } from '@effect/vitest';
import { Effect, Schema, Option, Layer } from 'effect';
import * as GP from './GenericPersistence';
import { Neo4jTestWithGenericData } from './GenericPersistence.test-layers';
import { Snippet } from '../../domain/types/snippet';
import { Tag } from '../../domain/types/tag';
import { Parameter } from '../../domain/types/parameter';
import { Composition } from '../../domain/types/composition';
import { SnippetId, Slug } from '../../domain/types/branded';
import { Neo4jService } from '../neo4j';

describe('Generic Persistence Functions', () => {
  // Test schema that matches requirements for named entities
  const TestEntity = Schema.Struct({
    id: Schema.UUID.pipe(Schema.brand('TestId')),
    name: Slug,
    description: Schema.String,
    customField: Schema.String,
  });
  type TestEntity = typeof TestEntity.Type;

  // Test schema for versioned entities
  const TestVersion = Schema.Struct({
    id: Schema.UUID.pipe(Schema.brand('TestVersionId')),
    content: Schema.String,
    createdAt: Schema.DateTimeUtc,
    commit_message: Schema.String,
  });

  describe('createNamedEntity', () => {
    it.effect('should create entity with generated ID', () =>
      Effect.gen(function* () {
        const created = yield* GP.createNamedEntity('TestEntity', TestEntity, {
          name: Schema.decodeSync(Slug)('test-entity'),
          description: 'Test description',
          customField: 'custom value',
        });

        expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
        expect(created.name).toBe('test-entity');
        expect(created.description).toBe('Test description');
        expect(created.customField).toBe('custom value');
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should fail when entity with same name already exists', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(
          GP.createNamedEntity('Snippet', Snippet, {
            name: Schema.decodeSync(Slug)('existing-snippet'),
            description: 'Should fail',
          }),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('PersistenceError');
          expect(result.left.originalMessage).toContain('already exists');
        }
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should work with Snippet schema', () =>
      Effect.gen(function* () {
        const created = yield* GP.createNamedEntity('Snippet', Snippet, {
          name: Schema.decodeSync(Slug)('new-snippet'),
          description: 'Test snippet',
        });

        const isValid = Schema.is(Snippet)(created);
        expect(isValid).toBe(true);
        expect(created.name).toBe('new-snippet');
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should work with Tag schema', () =>
      Effect.gen(function* () {
        const created = yield* GP.createNamedEntity('Tag', Tag, {
          name: Schema.decodeSync(Slug)('new-tag'),
          description: 'Test tag',
        });

        const isValid = Schema.is(Tag)(created);
        expect(isValid).toBe(true);
        expect(created.name).toBe('new-tag');
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should work with Parameter schema', () =>
      Effect.gen(function* () {
        const created = yield* GP.createNamedEntity('Parameter', Parameter, {
          name: Schema.decodeSync(Slug)('new-parameter'),
          description: 'Test parameter',
        });

        const isValid = Schema.is(Parameter)(created);
        expect(isValid).toBe(true);
        expect(created.name).toBe('new-parameter');
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should work with Composition schema', () =>
      Effect.gen(function* () {
        const created = yield* GP.createNamedEntity(
          'Composition',
          Composition,
          {
            name: Schema.decodeSync(Slug)('new-composition'),
            description: 'Test composition',
          },
        );

        const isValid = Schema.is(Composition)(created);
        expect(isValid).toBe(true);
        expect(created.name).toBe('new-composition');
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );
  });

  describe('findByName', () => {
    it.effect('should find existing entity by name', () =>
      Effect.gen(function* () {
        const result = yield* GP.findByName(
          'Snippet',
          Snippet,
          Schema.decodeSync(Slug)('existing-snippet'),
        );

        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.name).toBe('existing-snippet');
          expect(result.value.description).toBe('An existing snippet');
        }
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should return None when entity not found', () =>
      Effect.gen(function* () {
        const result = yield* GP.findByName(
          'Snippet',
          Snippet,
          Schema.decodeSync(Slug)('non-existent-snippet'),
        );

        expect(Option.isNone(result)).toBe(true);
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should validate schema on returned data', () =>
      Effect.gen(function* () {
        // Mock Neo4j returning invalid data
        const mockNeo4j = Neo4jService.of({
          runQuery: () =>
            Effect.succeed([
              {
                n: {
                  id: '123', // Invalid UUID
                  name: 'INVALID NAME', // Invalid slug
                  description: 'Description',
                },
              },
            ]),
          runInTransaction: () => Effect.die('Not implemented'),
          runBatch: () => Effect.die('Not implemented'),
          withSession: () => Effect.die('Not implemented'),
        });

        const result = yield* Effect.either(
          GP.findByName(
            'Test',
            TestEntity,
            Schema.decodeSync(Slug)('test'),
          ).pipe(Effect.provide(Layer.succeed(Neo4jService, mockNeo4j))),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('PersistenceError');
          expect(result.left.originalMessage).toContain(
            'Schema validation failed',
          );
        }
      }),
    );
  });

  describe('mustFindByName', () => {
    it.effect('should return entity when found', () =>
      Effect.gen(function* () {
        const snippet = yield* GP.mustFindByName(
          'Snippet',
          'snippet',
          Snippet,
          Schema.decodeSync(Slug)('existing-snippet'),
        );

        expect(snippet.name).toBe('existing-snippet');
        expect(snippet.description).toBe('An existing snippet');
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should fail with NotFoundError when entity not found', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(
          GP.mustFindByName(
            'Snippet',
            'snippet',
            Snippet,
            Schema.decodeSync(Slug)('non-existent-snippet'),
          ),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('NotFoundError');
          expect(result.left.entityType).toBe('snippet');
          expect(result.left.slug).toBe('non-existent-snippet');
        }
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );
  });

  describe('listAll', () => {
    it.effect('should return all entities ordered by name', () =>
      Effect.gen(function* () {
        const snippets = yield* GP.listAll('Snippet', Snippet);

        expect(snippets.length).toBe(2);
        expect(snippets[0].name).toBe('existing-snippet');
        expect(snippets[1].name).toBe('test-snippet');
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should return empty array when no entities exist', () =>
      Effect.gen(function* () {
        const emptyData = {
          snippets: [],
          snippetVersions: [],
          tags: [],
          parameters: [],
          parameterOptions: [],
          compositions: [],
          compositionVersions: [],
        };

        const results = yield* GP.listAll('Snippet', Snippet).pipe(
          Effect.provide(Neo4jTestWithGenericData(emptyData)),
        );

        expect(results).toEqual([]);
      }),
    );

    it.effect('should validate all returned entities', () =>
      Effect.gen(function* () {
        const mockNeo4j = Neo4jService.of({
          runQuery: () =>
            Effect.succeed([
              {
                n: {
                  id: '550e8400-e29b-41d4-a716-446655440001',
                  name: 'valid-snippet',
                  description: 'Valid',
                },
              },
              {
                n: {
                  id: 'invalid-id',
                  name: 'invalid-snippet',
                  description: 'Invalid',
                },
              },
            ]),
          runInTransaction: () => Effect.die('Not implemented'),
          runBatch: () => Effect.die('Not implemented'),
          withSession: () => Effect.die('Not implemented'),
        });

        const result = yield* Effect.either(
          GP.listAll('Snippet', Snippet).pipe(
            Effect.provide(Layer.succeed(Neo4jService, mockNeo4j)),
          ),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('PersistenceError');
        }
      }),
    );
  });

  describe('Type Constraints', () => {
    it('should enforce schema constraints at compile time', () => {
      // This test verifies TypeScript compilation behavior
      // The following should fail TypeScript compilation:

      // Schema missing required 'description' field
      const BadSchema1 = Schema.Struct({
        id: SnippetId,
        name: Slug,
      });

      // @ts-expect-error - Schema missing required 'description' field
      const _invalidCall1 = GP.createNamedEntity('Bad', BadSchema1, {
        name: Schema.decodeSync(Slug)('test'),
      });

      // Schema missing required 'name' field
      const BadSchema2 = Schema.Struct({
        id: SnippetId,
        description: Schema.String,
      });

      // @ts-expect-error - Schema missing required 'name' field
      const _invalidCall2 = GP.findByName(
        'Bad',
        BadSchema2,
        Schema.decodeSync(Slug)('test'),
      );

      // This should pass TypeScript compilation
      const GoodSchema = Schema.Struct({
        id: SnippetId,
        name: Slug,
        description: Schema.String,
        extraField: Schema.String,
      });

      // This should compile successfully
      const _validCall = GP.createNamedEntity('Good', GoodSchema, {
        name: Schema.decodeSync(Slug)('test'),
        description: 'Test',
        extraField: 'Extra',
      });

      expect(true).toBe(true); // Test passes if compilation succeeds
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it.effect('should handle missing required fields', () =>
      Effect.gen(function* () {
        const mockNeo4j = Neo4jService.of({
          runQuery: () =>
            Effect.succeed([
              {
                n: {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  name: 'valid-name',
                  // missing description field
                },
              },
            ]),
          runInTransaction: () => Effect.die('Not implemented'),
          runBatch: () => Effect.die('Not implemented'),
          withSession: () => Effect.die('Not implemented'),
        });

        const result = yield* Effect.either(
          GP.mustFindByName(
            'Snippet',
            'snippet',
            Snippet,
            Schema.decodeSync(Slug)('valid-name'),
          ).pipe(Effect.provide(Layer.succeed(Neo4jService, mockNeo4j))),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('PersistenceError');
        }
      }),
    );

    it.effect('should handle extra fields gracefully', () =>
      Effect.gen(function* () {
        const mockNeo4j = Neo4jService.of({
          runQuery: () =>
            Effect.succeed([
              {
                n: {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  name: 'valid-name',
                  description: 'Valid description',
                  extraField: 'This should be ignored',
                },
              },
            ]),
          runInTransaction: () => Effect.die('Not implemented'),
          runBatch: () => Effect.die('Not implemented'),
          withSession: () => Effect.die('Not implemented'),
        });

        const snippet = yield* GP.mustFindByName(
          'Snippet',
          'snippet',
          Snippet,
          Schema.decodeSync(Slug)('valid-name'),
        ).pipe(Effect.provide(Layer.succeed(Neo4jService, mockNeo4j)));

        // Should succeed and ignore extra field
        expect(snippet.name).toBe('valid-name');
        expect('extraField' in snippet).toBe(false);
      }),
    );

    it.effect('should handle invalid slug format', () =>
      Effect.gen(function* () {
        const mockNeo4j = Neo4jService.of({
          runQuery: () =>
            Effect.succeed([
              {
                n: {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  name: 'INVALID NAME WITH SPACES', // Invalid slug
                  description: 'Description',
                },
              },
            ]),
          runInTransaction: () => Effect.die('Not implemented'),
          runBatch: () => Effect.die('Not implemented'),
          withSession: () => Effect.die('Not implemented'),
        });

        const result = yield* Effect.either(
          GP.findByName(
            'Snippet',
            Snippet,
            Schema.decodeSync(Slug)('test'),
          ).pipe(Effect.provide(Layer.succeed(Neo4jService, mockNeo4j))),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('PersistenceError');
          expect(result.left.originalMessage).toContain(
            'Schema validation failed',
          );
        }
      }),
    );
  });
});
