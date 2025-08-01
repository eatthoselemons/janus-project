import { Effect } from 'effect';
import { Neo4jService } from './Neo4j.service';
import { Neo4jTest } from '../../layers/neo4j';
import { Neo4jError } from '../../domain/types/errors';
import { describe, it, expect } from 'vitest';

describe('Neo4jService', () => {
  it('should return data from the test database using runQuery', async () => {
    const testData = new Map([
      ['MATCH (n) RETURN n LIMIT 1', [{ n: { id: 1, name: 'Test Node' } }]],
    ]);

    const program = Effect.gen(function* () {
      const neo4j = yield* Neo4jService;
      return yield* neo4j.runQuery('MATCH (n) RETURN n LIMIT 1');
    });

    const runnable = program.pipe(Effect.provide(Neo4jTest(testData)));

    const result = await Effect.runPromise(runnable);
    expect(result).toEqual([{ n: { id: 1, name: 'Test Node' } }]);
  });

  it('should handle errors when query is not found in test data', async () => {
    const testData = new Map();

    const program = Effect.gen(function* () {
      const neo4j = yield* Neo4jService;
      return yield* neo4j.runQuery('MATCH (n) RETURN n');
    });

    const runnable = program.pipe(Effect.provide(Neo4jTest(testData)));

    const result = await Effect.runPromise(runnable);
    expect(result).toEqual([]);
  });

  it('should work with the use method for custom session operations', async () => {
    const testData = new Map([
      ['CREATE (n:Person {name: $name}) RETURN n', [{ n: { name: 'Alice' } }]],
    ]);

    const program = Effect.gen(function* () {
      const neo4j = yield* Neo4jService;
      return yield* neo4j.withSession((session) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () =>
              session.run('CREATE (n:Person {name: $name}) RETURN n', {
                name: 'Alice',
              }),
            catch: (error) =>
              new Neo4jError({
                message: 'Failed to run query',
                cause: error,
              }),
          });
          return result.records.map((r) => r.toObject());
        }),
      );
    });

    const runnable = program.pipe(Effect.provide(Neo4jTest(testData)));

    const result = await Effect.runPromise(runnable);
    expect(result).toEqual([{ n: { name: 'Alice' } }]);
  });

  it('should handle errors in the withSession method', async () => {
    const program = Effect.gen(function* () {
      const neo4j = yield* Neo4jService;
      return yield* neo4j.withSession(() =>
        Effect.fail(
          new Neo4jError({
            query: 'SESSION_OPERATION',
            originalMessage: 'Session operation failed',
          }),
        ),
      );
    });

    const runnable = program.pipe(Effect.provide(Neo4jTest()));

    await expect(Effect.runPromise(runnable)).rejects.toThrow();

    // Alternative: use Effect.runPromiseExit to check the error
    const exit = await Effect.runPromiseExit(runnable);
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') {
      const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
      expect(error).toBeInstanceOf(Neo4jError);
      expect(error?.originalMessage).toBe('Session operation failed');
    }
  });

  it('should handle async operations in the withSession method', async () => {
    const program = Effect.gen(function* () {
      const neo4j = yield* Neo4jService;
      return yield* neo4j.withSession(() =>
        Effect.fail(
          new Neo4jError({
            query: 'ASYNC_SESSION_OPERATION',
            originalMessage: 'Async operation failed',
          }),
        ),
      );
    });

    const runnable = program.pipe(Effect.provide(Neo4jTest()));

    await expect(Effect.runPromise(runnable)).rejects.toThrow();

    // Alternative: use Effect.runPromiseExit to check the error
    const exit = await Effect.runPromiseExit(runnable);
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') {
      const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
      expect(error).toBeInstanceOf(Neo4jError);
      expect(error?.originalMessage).toBe('Async operation failed');
    }
  });

  it('should support multiple queries with different test data', async () => {
    const testData = new Map([
      [
        'MATCH (n:Person) RETURN n',
        [{ n: { name: 'Alice' } }, { n: { name: 'Bob' } }],
      ],
      ['MATCH (n:Company) RETURN n', [{ n: { name: 'Acme Corp' } }]],
    ]);

    const program = Effect.gen(function* () {
      const neo4j = yield* Neo4jService;
      const [people, companies] = yield* Effect.all([
        neo4j.runQuery('MATCH (n:Person) RETURN n'),
        neo4j.runQuery('MATCH (n:Company) RETURN n'),
      ]);
      return { people, companies };
    });

    const runnable = program.pipe(Effect.provide(Neo4jTest(testData)));

    const result = await Effect.runPromise(runnable);
    expect(result.people).toHaveLength(2);
    expect(result.companies).toHaveLength(1);
    expect(result.people[0]).toEqual({ n: { name: 'Alice' } });
    expect(result.companies[0]).toEqual({ n: { name: 'Acme Corp' } });
  });

  it('should support transactions with runInTransaction', async () => {
    const testData = new Map([
      ['CREATE (u:User {name: $name}) RETURN u', [{ u: { name: 'John' } }]],
      ['CREATE (p:Post {title: $title}) RETURN p', [{ p: { title: 'Hello' } }]],
    ]);

    const program = Effect.gen(function* () {
      const neo4j = yield* Neo4jService;
      return yield* neo4j.runInTransaction((tx) =>
        Effect.gen(function* () {
          const [user] = yield* tx.run(
            'CREATE (u:User {name: $name}) RETURN u',
            {
              name: 'John',
            },
          );
          const [post] = yield* tx.run(
            'CREATE (p:Post {title: $title}) RETURN p',
            {
              title: 'Hello',
            },
          );
          return { user, post };
        }),
      );
    });

    const runnable = program.pipe(Effect.provide(Neo4jTest(testData)));

    const result = await Effect.runPromise(runnable);
    expect(result.user).toEqual({ u: { name: 'John' } });
    expect(result.post).toEqual({ p: { title: 'Hello' } });
  });

  it('should support batch queries with runBatch', async () => {
    const testData = new Map([
      ['MATCH (n:User) RETURN n', [{ n: { name: 'Alice' } }]],
      ['MATCH (n:Post) RETURN n', [{ n: { title: 'Post 1' } }]],
      ['MATCH (n:Comment) RETURN n', [{ n: { text: 'Nice!' } }]],
    ]);

    const program = Effect.gen(function* () {
      const neo4j = yield* Neo4jService;
      return yield* neo4j.runBatch([
        { query: 'MATCH (n:User) RETURN n' },
        { query: 'MATCH (n:Post) RETURN n' },
        { query: 'MATCH (n:Comment) RETURN n' },
      ]);
    });

    const runnable = program.pipe(Effect.provide(Neo4jTest(testData)));

    const [users, posts, comments] = await Effect.runPromise(runnable);
    expect(users).toEqual([{ n: { name: 'Alice' } }]);
    expect(posts).toEqual([{ n: { title: 'Post 1' } }]);
    expect(comments).toEqual([{ n: { text: 'Nice!' } }]);
  });

  it('should support withSession for complex operations', async () => {
    const testData = new Map([
      ['MATCH (n) RETURN count(n) as count', [{ count: 42 }]],
    ]);

    const program = Effect.gen(function* () {
      const neo4j = yield* Neo4jService;
      return yield* neo4j.withSession((session) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () => session.run('MATCH (n) RETURN count(n) as count'),
            catch: (e) =>
              new Neo4jError({
                query: 'COUNT_NODES',
                originalMessage: String(e),
              }),
          });
          return result.records[0].toObject();
        }),
      );
    });

    const runnable = program.pipe(Effect.provide(Neo4jTest(testData)));

    const result = await Effect.runPromise(runnable);
    expect(result).toEqual({ count: 42 });
  });
});
