> **Audience:** LLM / AI Agent (Focused Guide)

# 7. Testing Strategies

This section covers strategies for testing the different layers of your application.

### Unit Testing Calculations

Test pure functions directly. Since they have no side effects, they can be tested with simple inputs and expected outputs.

```typescript
describe('Business Rules', () => {
  test('canFollow prevents self-following', () => {
    const person = createTestPerson({ id: 'person-123' });
    expect(canFollow(person, person)).toBe(false);
  });

  test('calculateInfluence handles edge cases', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const zero = yield* calculateInfluence(
          yield* Schema.decode(FollowerCount)(0),
        );
        const large = yield* calculateInfluence(
          yield* Schema.decode(FollowerCount)(1000000),
        );
        expect(zero).toBe(0);
        expect(large).toBeGreaterThan(500);
      }),
    ));
});
```

### Integration Testing with Test Layers

For services and repositories, create test implementations of their dependencies. Test utilities should be in separate `.test-layers.ts` files:

```typescript
// In PersonRepository.test-layers.ts
export const PersonRepositoryTest = Layer.succeed(PersonRepository, {
  findById: (id) =>
    Effect.succeed(
      testData.people.has(id.value)
        ? Option.some(testData.people.get(id.value)!)
        : Option.none(),
    ),

  create: (person) => {
    testData.people.set(person.id.value, person);
    return Effect.succeed(person);
  },

  findFollowers: (id) =>
    Effect.succeed(
      testData.follows
        .filter((f) => f.targetId === id)
        .map((f) => testData.people.get(f.followerId.value)!)
        .filter(Boolean),
    ),
});

// Create reusable test layers for common scenarios
export const PersonRepositoryTestWithData = (data: TestData) =>
  Layer.succeed(PersonRepository, {
    // Implementation using provided test data
  });

// Use in tests
test('follow operation', async () => {
  const result = await Effect.runPromise(
    personService
      .followPerson(userId1, userId2)
      .pipe(
        Effect.provide(PersonServiceLive),
        Effect.provide(PersonRepositoryTest),
      ),
  );

  expect(result).toBeUndefined();
});

// When using branded types in tests, always construct them properly
test('branded type construction in tests', async () => {
  const personId = Schema.decodeSync(PersonId)('person-12345678');
  const email = Schema.decodeSync(Email)('test@example.com');

  // Never use raw strings where branded types are expected
  const person = {
    id: personId, // ✅ Proper branded type
    email: email, // ✅ Proper branded type
    // id: 'person-12345678', // ❌ Raw string
  };
});
```

### Testing Effect Programs

Test complete Effect programs by providing a test environment and running the program to completion, then inspecting the `Exit` state.

```typescript
describe('PersonService', () => {
  const makeTestEnv = () =>
    Layer.mergeAll(PersonServiceLive, PersonRepositoryTest, ConfigTest);

  test('should handle missing users', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const program = personService.followPerson(
          yield* Schema.decode(PersonId)('unknown-1'),
          yield* Schema.decode(PersonId)('unknown-2'),
        );

        const result = yield* Effect.runPromiseExit(
          program.pipe(Effect.provide(makeTestEnv())),
        );

        expect(Exit.isFailure(result)).toBe(true);
        if (Exit.isFailure(result)) {
          expect(result.cause).toMatchObject({
            _tag: 'Fail',
            error: { _tag: 'UserNotFound' },
          });
        }
      }),
    ));
});
```
