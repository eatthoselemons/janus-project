import { describe, it, expect } from '@effect/vitest';
import { Effect, Option, Exit, Schema } from 'effect';
import * as SnippetPersistence from './SnippetPersistence';
import { Slug, SnippetId, SnippetVersionId } from '../../domain/types/branded';
import {
  NotFoundError,
  PersistenceError,
  Neo4jError,
} from '../../domain/types/errors';
import {
  Neo4jTestWithSnippetData,
  Neo4jTestWithEmptyData,
  Neo4jTestWithSnippetNoVersions,
} from './SnippetPersistence.test-layers';

describe('SnippetPersistence', () => {
  describe('createSnippet', () => {
    it.effect('should create a new snippet', () =>
      Effect.gen(function* () {
        const name = Schema.decodeSync(Slug)('new-snippet');
        const snippet = yield* SnippetPersistence.createSnippet(
          name,
          'New snippet description',
        );

        expect(snippet.name).toBe(name);
        expect(snippet.description).toBe('New snippet description');
        expect(snippet.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
      }).pipe(Effect.provide(Neo4jTestWithSnippetData())),
    );

    it.effect('should fail on duplicate name', () =>
      Effect.gen(function* () {
        // Note: 'existing-snippet' already exists in the test data (see SnippetPersistence.test-layers.ts)
        // This test verifies that creating a snippet with a duplicate name fails appropriately
        const name = Schema.decodeSync(Slug)('existing-snippet');
        const result = yield* Effect.exit(
          SnippetPersistence.createSnippet(name, 'Duplicate'),
        );

        expect(Exit.isFailure(result)).toBe(true);
        if (Exit.isFailure(result)) {
          const cause = result.cause;
          if (cause._tag === 'Fail') {
            expect(cause.error).toBeInstanceOf(PersistenceError);
            expect((cause.error as PersistenceError).operation).toBe('create');
            expect((cause.error as PersistenceError).originalMessage).toContain(
              'already exists',
            );
          }
        }
      }).pipe(Effect.provide(Neo4jTestWithSnippetData())),
    );
  });

  describe('createSnippetVersion', () => {
    it.effect('should create a new version with previous version', () =>
      Effect.gen(function* () {
        const snippetId = Schema.decodeSync(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440001',
        );
        const version = yield* SnippetPersistence.createSnippetVersion(
          snippetId,
          'New version content',
          'Test commit',
        );

        expect(version.content).toBe('New version content');
        expect(version.commit_message).toBe('Test commit');
        expect(version.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(version.createdAt).toHaveProperty('epochMillis');
      }).pipe(Effect.provide(Neo4jTestWithSnippetData())),
    );

    it.effect('should create first version without previous', () =>
      Effect.gen(function* () {
        const snippetId = Schema.decodeSync(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440001',
        );
        const version = yield* SnippetPersistence.createSnippetVersion(
          snippetId,
          'First version content',
          'Initial version',
        );

        expect(version.content).toBe('First version content');
        expect(version.commit_message).toBe('Initial version');
      }).pipe(Effect.provide(Neo4jTestWithSnippetNoVersions)),
    );

    it.effect('should fail when snippet not found', () =>
      Effect.gen(function* () {
        const snippetId = Schema.decodeSync(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440999',
        );
        const result = yield* Effect.exit(
          SnippetPersistence.createSnippetVersion(
            snippetId,
            'Content',
            'Message',
          ),
        );

        expect(Exit.isFailure(result)).toBe(true);
        if (Exit.isFailure(result)) {
          const cause = result.cause;
          if (cause._tag === 'Fail') {
            expect(cause.error).toBeInstanceOf(Neo4jError);
            expect((cause.error as Neo4jError).originalMessage).toContain(
              'not found',
            );
          }
        }
      }).pipe(Effect.provide(Neo4jTestWithEmptyData)),
    );
  });

  describe('maybeGetSnippetByName', () => {
    it.effect('should find existing snippet', () =>
      Effect.gen(function* () {
        const name = Schema.decodeSync(Slug)('existing-snippet');
        const result = yield* SnippetPersistence.maybeGetSnippetByName(name);

        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.name).toBe(name);
          expect(result.value.description).toBe('An existing snippet');
        }
      }).pipe(Effect.provide(Neo4jTestWithSnippetData())),
    );

    it.effect('should return None for non-existent snippet', () =>
      Effect.gen(function* () {
        const name = Schema.decodeSync(Slug)('non-existent');
        const result = yield* SnippetPersistence.maybeGetSnippetByName(name);

        expect(Option.isNone(result)).toBe(true);
      }).pipe(Effect.provide(Neo4jTestWithEmptyData)),
    );
  });

  describe('mustGetSnippetByName', () => {
    it.effect('should find existing snippet', () =>
      Effect.gen(function* () {
        const name = Schema.decodeSync(Slug)('existing-snippet');
        const snippet = yield* SnippetPersistence.mustGetSnippetByName(name);

        expect(snippet.name).toBe(name);
        expect(snippet.description).toBe('An existing snippet');
      }).pipe(Effect.provide(Neo4jTestWithSnippetData())),
    );

    it.effect('should fail with NotFoundError for non-existent snippet', () =>
      Effect.gen(function* () {
        const name = Schema.decodeSync(Slug)('non-existent');
        const result = yield* Effect.exit(
          SnippetPersistence.mustGetSnippetByName(name),
        );

        expect(Exit.isFailure(result)).toBe(true);
        if (Exit.isFailure(result)) {
          const cause = result.cause;
          if (cause._tag === 'Fail') {
            expect(cause.error).toBeInstanceOf(NotFoundError);
            expect((cause.error as NotFoundError).entityType).toBe('snippet');
            expect((cause.error as NotFoundError).slug).toBe(name);
          }
        }
      }).pipe(Effect.provide(Neo4jTestWithEmptyData)),
    );
  });

  describe('maybeGetLatestSnippetVersion', () => {
    it.effect('should find latest version', () =>
      Effect.gen(function* () {
        const snippetId = Schema.decodeSync(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440001',
        );
        const result =
          yield* SnippetPersistence.maybeGetLatestSnippetVersion(snippetId);

        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.content).toContain('provide a helpful response');
          expect(result.value.commit_message).toBe('Updated wording');
        }
      }).pipe(Effect.provide(Neo4jTestWithSnippetData())),
    );

    it.effect('should return None when no versions exist', () =>
      Effect.gen(function* () {
        const snippetId = Schema.decodeSync(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440001',
        );
        const result =
          yield* SnippetPersistence.maybeGetLatestSnippetVersion(snippetId);

        expect(Option.isNone(result)).toBe(true);
      }).pipe(Effect.provide(Neo4jTestWithSnippetNoVersions)),
    );
  });

  describe('mustGetLatestSnippetVersion', () => {
    it.effect('should find latest version', () =>
      Effect.gen(function* () {
        const snippetId = Schema.decodeSync(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440001',
        );
        const version =
          yield* SnippetPersistence.mustGetLatestSnippetVersion(snippetId);

        expect(version.content).toContain('provide a helpful response');
        expect(version.commit_message).toBe('Updated wording');
      }).pipe(Effect.provide(Neo4jTestWithSnippetData())),
    );

    it.effect('should fail with NotFoundError when no versions exist', () =>
      Effect.gen(function* () {
        const snippetId = Schema.decodeSync(SnippetId)(
          '550e8400-e29b-41d4-a716-446655440001',
        );
        const result = yield* Effect.exit(
          SnippetPersistence.mustGetLatestSnippetVersion(snippetId),
        );

        expect(Exit.isFailure(result)).toBe(true);
        if (Exit.isFailure(result)) {
          const cause = result.cause;
          if (cause._tag === 'Fail') {
            expect(cause.error).toBeInstanceOf(NotFoundError);
            expect((cause.error as NotFoundError).entityType).toBe('snippet');
            expect((cause.error as NotFoundError).id).toBe(snippetId);
          }
        }
      }).pipe(Effect.provide(Neo4jTestWithSnippetNoVersions)),
    );
  });

  describe('listSnippets', () => {
    it.effect('should list all snippets sorted by name', () =>
      Effect.gen(function* () {
        const snippets = yield* SnippetPersistence.listSnippets();

        expect(snippets).toHaveLength(3);
        expect(snippets[0].name).toBe('existing-snippet');
        expect(snippets[1].name).toBe('search-snippet');
        expect(snippets[2].name).toBe('test-snippet');
      }).pipe(Effect.provide(Neo4jTestWithSnippetData())),
    );

    it.effect('should return empty array when no snippets', () =>
      Effect.gen(function* () {
        const snippets = yield* SnippetPersistence.listSnippets();

        expect(snippets).toHaveLength(0);
      }).pipe(Effect.provide(Neo4jTestWithEmptyData)),
    );
  });

  describe('searchSnippets', () => {
    it.effect('should find snippets matching search term', () =>
      Effect.gen(function* () {
        const snippets = yield* SnippetPersistence.searchSnippets('search');

        expect(snippets).toHaveLength(1);
        expect(snippets[0].name).toBe('search-snippet');
        expect(snippets[0].description).toContain('searchable');
      }).pipe(Effect.provide(Neo4jTestWithSnippetData())),
    );

    it.effect('should return empty array when no matches', () =>
      Effect.gen(function* () {
        const snippets =
          yield* SnippetPersistence.searchSnippets('nonexistent');

        expect(snippets).toHaveLength(0);
      }).pipe(Effect.provide(Neo4jTestWithSnippetData())),
    );

    it.effect('should search case-insensitively', () =>
      Effect.gen(function* () {
        const snippets = yield* SnippetPersistence.searchSnippets('SEARCH');

        expect(snippets).toHaveLength(1);
        expect(snippets[0].name).toBe('search-snippet');
      }).pipe(Effect.provide(Neo4jTestWithSnippetData())),
    );
  });
});
