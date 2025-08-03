import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Effect, Exit } from 'effect';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GitStorage, createGitStorage } from './GitStorage';
import { GitPersistenceError } from '../../../domain/types/errors';

describe('GitStorage', () => {
  const testDataPath = './test-git-data';

  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(testDataPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore error if directory doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(testDataPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore error if directory doesn't exist
    }
  });

  it('should create data directory if it does not exist', async () => {
    const config = {
      dataPath: testDataPath,
      mode: 'lossy' as const,
    };

    const result = await Effect.runPromiseExit(createGitStorage(config));

    expect(Exit.isSuccess(result)).toBe(true);

    // Check that directory was created
    const stats = await fs.stat(testDataPath);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should reject Cypher queries', async () => {
    const config = {
      dataPath: testDataPath,
      mode: 'lossy' as const,
    };

    const program = Effect.gen(function* () {
      const storage = yield* createGitStorage(config);
      return yield* storage.runQuery('MATCH (n) RETURN n');
    });

    const result = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      const error = result.cause._tag === 'Fail' ? result.cause.error : null;
      expect(error).toBeInstanceOf(GitPersistenceError);
      expect(error?.operation).toBe('parse');
      expect(error?.originalMessage).toContain(
        'does not support Cypher queries',
      );
    }
  });

  it('should reject withSession calls', async () => {
    const config = {
      dataPath: testDataPath,
      mode: 'lossy' as const,
    };

    const program = Effect.gen(function* () {
      const storage = yield* createGitStorage(config);
      return yield* storage.withSession(() => Effect.succeed('test'));
    });

    const result = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      const error = result.cause._tag === 'Fail' ? result.cause.error : null;
      expect(error).toBeInstanceOf(GitPersistenceError);
      expect(error?.originalMessage).toContain(
        'does not support Neo4j sessions',
      );
    }
  });

  it('should fail with not implemented for lossless strategy', async () => {
    const config = {
      dataPath: testDataPath,
      mode: 'lossless' as const,
    };

    const program = Effect.gen(function* () {
      const storage = yield* createGitStorage(config);
      return yield* storage.runQuery({
        type: 'structured',
        operation: 'match',
        entityType: 'ContentNode',
      });
    });

    const result = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      const error = result.cause._tag === 'Fail' ? result.cause.error : null;
      expect(error).toBeInstanceOf(GitPersistenceError);
      expect(error?.originalMessage).toContain(
        'Lossless strategy not yet implemented',
      );
    }
  });

  it('should fail with not implemented for lossy strategy', async () => {
    const config = {
      dataPath: testDataPath,
      mode: 'lossy' as const,
    };

    const program = Effect.gen(function* () {
      const storage = yield* createGitStorage(config);
      return yield* storage.runQuery({
        type: 'structured',
        operation: 'match',
        entityType: 'ContentNode',
      });
    });

    const result = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      const error = result.cause._tag === 'Fail' ? result.cause.error : null;
      expect(error).toBeInstanceOf(GitPersistenceError);
      expect(error?.originalMessage).toContain(
        'Lossy strategy not yet implemented',
      );
    }
  });

  it('should process batch queries sequentially', async () => {
    const config = {
      dataPath: testDataPath,
      mode: 'lossy' as const,
    };

    const program = Effect.gen(function* () {
      const storage = yield* createGitStorage(config);
      return yield* storage.runBatch([
        {
          query: {
            type: 'structured',
            operation: 'match',
            entityType: 'ContentNode',
          },
        },
        {
          query: {
            type: 'structured',
            operation: 'match',
            entityType: 'Tag',
          },
        },
      ]);
    });

    const result = await Effect.runPromiseExit(program);

    // Should fail because strategies are not implemented
    expect(Exit.isFailure(result)).toBe(true);
  });
});
