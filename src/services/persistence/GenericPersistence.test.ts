import { describe, it, expect } from '@effect/vitest';
import { Effect, Schema, Option, Layer } from 'effect';
import * as GenericPersistence from './GenericPersistence';
import {
  Neo4jTestWithGenericData,
  generateTestSnippet,
  generateTestSnippetVersion,
  generateTestSnippetVersionRaw,
  generateTestComposition,
  generateTestParameter,
  QueryTracker,
} from './GenericPersistence.test-layers';
import { Snippet, SnippetVersion } from '../../domain/types/snippet';
import { Tag } from '../../domain/types/tag';
import { Parameter, ParameterOption } from '../../domain/types/parameter';
import { Composition, CompositionVersion } from '../../domain/types/composition';
import { SnippetId, ParameterId, CompositionId, Slug } from '../../domain/types/branded';
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
        const created = yield* GenericPersistence.createNamedEntity(
          'TestEntity',
          TestEntity,
          {
            name: Schema.decodeSync(Slug)('test-entity'),
            description: 'Test description',
            customField: 'custom value',
          },
        );

        expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
        expect(created.name).toBe('test-entity');
        expect(created.description).toBe('Test description');
        expect(created.customField).toBe('custom value');
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should fail when entity with same name already exists', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(
          GenericPersistence.createNamedEntity('Snippet', Snippet, {
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
        const created = yield* GenericPersistence.createNamedEntity(
          'Snippet',
          Snippet,
          {
            name: Schema.decodeSync(Slug)('new-snippet'),
            description: 'Test snippet',
          },
        );

        const isValid = Schema.is(Snippet)(created);
        expect(isValid).toBe(true);
        expect(created.name).toBe('new-snippet');
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should work with Tag schema', () =>
      Effect.gen(function* () {
        const created = yield* GenericPersistence.createNamedEntity(
          'Tag',
          Tag,
          {
            name: Schema.decodeSync(Slug)('new-tag'),
            description: 'Test tag',
          },
        );

        const isValid = Schema.is(Tag)(created);
        expect(isValid).toBe(true);
        expect(created.name).toBe('new-tag');
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should work with Parameter schema', () =>
      Effect.gen(function* () {
        const created = yield* GenericPersistence.createNamedEntity(
          'Parameter',
          Parameter,
          {
            name: Schema.decodeSync(Slug)('new-parameter'),
            description: 'Test parameter',
          },
        );

        const isValid = Schema.is(Parameter)(created);
        expect(isValid).toBe(true);
        expect(created.name).toBe('new-parameter');
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should work with Composition schema', () =>
      Effect.gen(function* () {
        const created = yield* GenericPersistence.createNamedEntity(
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
        const result = yield* GenericPersistence.findByName(
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
        const result = yield* GenericPersistence.findByName(
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
          GenericPersistence.findByName(
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
        const snippet = yield* GenericPersistence.mustFindByName(
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
          GenericPersistence.mustFindByName(
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
        const snippets = yield* GenericPersistence.listAll('Snippet', Snippet);

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

        const results = yield* GenericPersistence.listAll(
          'Snippet',
          Snippet,
        ).pipe(Effect.provide(Neo4jTestWithGenericData(emptyData)));

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
          GenericPersistence.listAll('Snippet', Snippet).pipe(
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
      const _invalidCall1 = GenericPersistence.createNamedEntity(
        'Bad',
        BadSchema1,
        {
          name: Schema.decodeSync(Slug)('test'),
        },
      );

      // Schema missing required 'name' field
      const BadSchema2 = Schema.Struct({
        id: SnippetId,
        description: Schema.String,
      });

      // @ts-expect-error - Schema missing required 'name' field
      const _invalidCall2 = GenericPersistence.findByName(
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
      const _validCall = GenericPersistence.createNamedEntity(
        'Good',
        GoodSchema,
        {
          name: Schema.decodeSync(Slug)('test'),
          description: 'Test',
          extraField: 'Extra',
        },
      );

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
          GenericPersistence.mustFindByName(
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

        const snippet = yield* GenericPersistence.mustFindByName(
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
          GenericPersistence.findByName(
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

  describe('createVersion', () => {
    it.effect('should create first version without previous link', () =>
      Effect.gen(function* () {
        const queryTracker: QueryTracker = { queries: [] };
        
        // Set up test data with an existing snippet but no versions
        const testData = {
          snippets: [
            generateTestSnippet(
              '550e8400-e29b-41d4-a716-446655440001',
              'test-snippet',
            ),
          ],
          snippetVersions: [], // No existing versions
          tags: [],
          parameters: [],
          parameterOptions: [],
          compositions: [],
          compositionVersions: [],
        };

        const snippetId = Schema.decodeSync(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440001',
        );

        const version = yield* GenericPersistence.createVersion(
          'SnippetVersion',
          'Snippet',
          snippetId,
          SnippetVersion,
          {
            content: 'New snippet content',
            commit_message: 'Initial version',
          },
        ).pipe(Effect.provide(Neo4jTestWithGenericData(testData, queryTracker)));

        expect(version.content).toBe('New snippet content');
        expect(version.commit_message).toBe('Initial version');
        
        // Verify the queries executed by the actual implementation
        expect(queryTracker.queries.length).toBeGreaterThan(0);
        
        // Find the CREATE query
        const createQuery = queryTracker.queries.find(q => 
          q.query.includes('CREATE (v:SnippetVersion')
        );
        expect(createQuery).toBeDefined();
        
        // Most importantly: verify NO PREVIOUS_VERSION relationship was created
        expect(createQuery?.query).not.toContain('PREVIOUS_VERSION');
        expect(createQuery?.query).toContain('VERSION_OF');
        
        // Verify it's the simpler create query without previous version matching
        expect(createQuery?.query).not.toContain('MATCH (prev:SnippetVersion');
      }),
    );

    it.effect(
      'should create version with previous link when versions exist',
      () =>
        Effect.gen(function* () {
          const queryTracker: QueryTracker = { queries: [] };
          
          // Set up test data with existing version
          const testData = {
            snippets: [
              generateTestSnippet(
                '550e8400-e29b-41d4-a716-446655440001',
                'test-snippet',
              ),
            ],
            snippetVersions: [
              {
                version: {
                  ...generateTestSnippetVersionRaw(
                    '650e8400-e29b-41d4-a716-446655440001',
                    'Old content',
                    'Previous version',
                    '2024-01-01T00:00:00.000Z',
                  ),
                } as any,
                snippetId: Schema.decodeSync(SnippetId)(
                  '550e8400-e29b-41d4-a716-446655440001',
                ),
              },
            ],
            tags: [],
            parameters: [],
            parameterOptions: [],
            compositions: [],
            compositionVersions: [],
          };

          const snippetId = Schema.decodeSync(SnippetId)(
            '550e8400-e29b-41d4-a716-446655440001',
          );

          const version = yield* GenericPersistence.createVersion(
            'SnippetVersion',
            'Snippet',
            snippetId,
            SnippetVersion,
            {
              content: 'Updated content',
              commit_message: 'Update content',
            },
          ).pipe(Effect.provide(Neo4jTestWithGenericData(testData, queryTracker)));

          expect(version.content).toBe('Updated content');
          expect(version.commit_message).toBe('Update content');
          
          // Verify the queries executed by the actual implementation
          const queries = queryTracker.queries.map(q => q.query);
          
          // Should have multiple queries in a transaction
          expect(queries.length).toBeGreaterThanOrEqual(3);
          
          // 1. Check parent exists
          const parentCheckQuery = queries.find(q => 
            q.includes('MATCH (p:Snippet {id: $') && q.includes('}) RETURN p')
          );
          expect(parentCheckQuery).toBeDefined();
          
          // 2. Find previous version
          const findPrevQuery = queries.find(q => 
            q.includes('VERSION_OF') && q.includes('ORDER BY v.createdAt DESC')
          );
          expect(findPrevQuery).toBeDefined();
          
          // 3. Create with previous link
          const createQuery = queries.find(q => 
            q.includes('CREATE (v:SnippetVersion')
          );
          expect(createQuery).toBeDefined();
          
          // Verify it uses the more complex query with previous version
          expect(createQuery).toContain('MATCH (prev:SnippetVersion');
          expect(createQuery).toContain('PREVIOUS_VERSION');
          expect(createQuery).toContain('VERSION_OF');
          
          // Check that prevId was passed correctly
          const createQueryData = queryTracker.queries.find(q => 
            q.query.includes('CREATE (v:SnippetVersion')
          );
          expect(createQueryData?.params.prevId).toBe('650e8400-e29b-41d4-a716-446655440001');
        }),
    );

    it.effect('should fail with NotFoundError when parent does not exist', () =>
      Effect.gen(function* () {
        const nonExistentId = Schema.decodeSync(SnippetId)(
          '999e8400-e29b-41d4-a716-446655440999',
        );

        const result = yield* Effect.either(
          GenericPersistence.createVersion(
            'SnippetVersion',
            'Snippet',
            nonExistentId,
            SnippetVersion,
            {
              content: 'Content',
              commit_message: 'Message',
            },
          ),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('NotFoundError');
          expect(result.left.entityType).toBe('snippet');
        }
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should work with Parameter and ParameterOption', () =>
      Effect.gen(function* () {
        const parameterId = Schema.decodeSync(ParameterId)(
          '850e8400-e29b-41d4-a716-446655440001',
        );

        const option = yield* GenericPersistence.createVersion(
          'ParameterOption',
          'Parameter',
          parameterId,
          ParameterOption,
          {
            value: 'should',
            commit_message: 'Add should option',
          },
        );

        expect(option.value).toBe('should');
        expect(option.commit_message).toBe('Add should option');
        const isValid = Schema.is(ParameterOption)(option);
        expect(isValid).toBe(true);
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );
  });

  describe('getLatestVersion', () => {
    it.effect('should return latest version when versions exist', () =>
      Effect.gen(function* () {
        const snippetId = Schema.decodeSync(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440001',
        );

        const result = yield* GenericPersistence.getLatestVersion(
          'SnippetVersion',
          'Snippet',
          snippetId,
          SnippetVersion,
        );

        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          // Should get the latest version (2024-01-02)
          expect(result.value.content).toBe(
            'You {{obligation_level}} provide a helpful response',
          );
          expect(result.value.commit_message).toBe('Updated wording');
        }
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should return None when no versions exist', () =>
      Effect.gen(function* () {
        const snippetId = Schema.decodeSync(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440002', // Snippet with no versions
        );

        const result = yield* GenericPersistence.getLatestVersion(
          'SnippetVersion',
          'Snippet',
          snippetId,
          SnippetVersion,
        );

        expect(Option.isNone(result)).toBe(true);
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should return None when parent does not exist', () =>
      Effect.gen(function* () {
        const nonExistentId = Schema.decodeSync(SnippetId)(
          '999e8400-e29b-41d4-a716-446655440999',
        );

        const result = yield* GenericPersistence.getLatestVersion(
          'SnippetVersion',
          'Snippet',
          nonExistentId,
          SnippetVersion,
        );

        expect(Option.isNone(result)).toBe(true);
      }).pipe(Effect.provide(Neo4jTestWithGenericData())),
    );

    it.effect('should correctly order versions by createdAt', () =>
      Effect.gen(function* () {
        const testData = {
          snippets: [
            generateTestSnippet(
              '550e8400-e29b-41d4-a716-446655440003',
              'test-snippet',
            ),
          ],
          snippetVersions: [
            {
              version: {
                ...generateTestSnippetVersionRaw(
                  '650e8400-e29b-41d4-a716-446655440003',
                  'First version',
                  'First',
                  '2024-01-01T00:00:00.000Z',
                ),
              } as any,
              snippetId: Schema.decodeSync(SnippetId)(
                '550e8400-e29b-41d4-a716-446655440003',
              ),
            },
            {
              version: {
                ...generateTestSnippetVersionRaw(
                  '650e8400-e29b-41d4-a716-446655440005',
                  'Latest version',
                  'Latest',
                  '2024-01-03T00:00:00.000Z',
                ),
              } as any,
              snippetId: Schema.decodeSync(SnippetId)(
                '550e8400-e29b-41d4-a716-446655440003',
              ),
            },
            {
              version: {
                ...generateTestSnippetVersionRaw(
                  '650e8400-e29b-41d4-a716-446655440004',
                  'Middle version',
                  'Middle',
                  '2024-01-02T00:00:00.000Z',
                ),
              } as any,
              snippetId: Schema.decodeSync(SnippetId)(
                '550e8400-e29b-41d4-a716-446655440003',
              ),
            },
          ],
          tags: [],
          parameters: [],
          parameterOptions: [],
          compositions: [],
          compositionVersions: [],
        };

        const snippetId = Schema.decodeSync(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440003',
        );
        const result = yield* GenericPersistence.getLatestVersion(
          'SnippetVersion',
          'Snippet',
          snippetId,
          SnippetVersion,
        ).pipe(Effect.provide(Neo4jTestWithGenericData(testData)));

        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.content).toBe('Latest version');
          expect(result.value.commit_message).toBe('Latest');
        }
      }),
    );
  });
});
