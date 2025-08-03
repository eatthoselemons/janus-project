import { describe, it, expect } from 'vitest';
import { Effect, Exit, Match } from 'effect';
import { StorageService, type StorageError } from './Storage.service';
import { Neo4jError, GitPersistenceError } from '../../domain/types/errors';
import { StorageBackend } from '../../domain/types/config';
import { StorageTestWithGenericData } from '../persistence/GenericPersistence.test-layers';

describe('StorageError Union Type', () => {
  it('should handle Neo4j errors when using Neo4j backend', async () => {
    const layer = StorageTestWithGenericData({}, undefined, 'neo4j');
    
    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
      // withSession is not implemented in test layer and should fail
      return yield* storage.withSession(() => Effect.succeed('test'));
    });

    const result = await Effect.runPromiseExit(program.pipe(Effect.provide(layer)));
    
    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      const error = result.cause._tag === 'Fail' ? result.cause.error : null;
      expect(error).toBeInstanceOf(Neo4jError);
      expect(error?._tag).toBe('Neo4jError');
    }
  });

  it('should handle Git errors when using Git backend', async () => {
    const layer = StorageTestWithGenericData({}, undefined, 'git');
    
    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
      // withSession is not implemented in test layer and should fail
      return yield* storage.withSession(() => Effect.succeed('test'));
    });

    const result = await Effect.runPromiseExit(program.pipe(Effect.provide(layer)));
    
    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      const error = result.cause._tag === 'Fail' ? result.cause.error : null;
      expect(error).toBeInstanceOf(GitPersistenceError);
      expect(error?._tag).toBe('GitPersistenceError');
    }
  });

  it('should allow pattern matching on StorageError', async () => {
    const handleStorageError = (error: StorageError): string =>
      Match.value(error).pipe(
        Match.tag('Neo4jError', (err) => `Neo4j error: ${err.originalMessage}`),
        Match.tag('GitPersistenceError', (err) => `Git error at ${err.path}: ${err.originalMessage}`),
        Match.exhaustive
      );

    const neo4jError = new Neo4jError({
      query: 'MATCH (n) RETURN n',
      originalMessage: 'Connection failed',
    });

    const gitError = new GitPersistenceError({
      path: '/repo/data.json',
      operation: 'read',
      originalMessage: 'File not found',
    });

    expect(handleStorageError(neo4jError)).toBe('Neo4j error: Connection failed');
    expect(handleStorageError(gitError)).toBe('Git error at /repo/data.json: File not found');
  });
});