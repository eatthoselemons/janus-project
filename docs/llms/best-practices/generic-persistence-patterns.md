# Generic Persistence Patterns for Effect-TS + Neo4j

This document describes the recommended patterns for creating generic persistence functions in the Janus project while maintaining Effect-TS best practices and type safety.

## Core Principles

1. **Use pure functions, not classes** - Effect-TS favors functional composition over OOP
2. **Work with Schema types directly** - Leverage Effect's Schema system for runtime validation
3. **Maintain type safety** - Use TypeScript's type system to ensure schemas have required fields
4. **Follow Effect patterns** - Use `Effect.gen`, `yield*`, and proper error handling

## Generic Function Pattern

### Type-Safe Generic Functions with Schema Constraints

When creating generic persistence functions, use TypeScript intersection types to ensure schemas contain required fields:

```typescript
// Example: Generic function for entities with name and description
export const createNamedEntity = <A, I, R>(
  nodeLabel: string,
  schema: Schema.Schema<A, I, R> & {
    Type: { id: Brand<string>; name: Slug; description: string }
  },
  entity: Omit<Schema.Schema.Type<typeof schema>, 'id'>
) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    
    // Check uniqueness by name
    const existing = yield* findByName(nodeLabel, schema, entity.name);
    if (Option.isSome(existing)) {
      return yield* Effect.fail(
        new PersistenceError({
          originalMessage: `${nodeLabel} with name '${entity.name}' already exists`,
          operation: 'create' as const,
        })
      );
    }
    
    // Generate ID and create
    const id = yield* generateId();
    const fullEntity = { ...entity, id } as Schema.Schema.Type<typeof schema>;
    
    const query = cypher`CREATE (n:${nodeLabel} $props) RETURN n`;
    const params = yield* queryParams({ props: fullEntity });
    const results = yield* neo4j.runQuery<{ n: unknown }>(query, params);
    
    return yield* Schema.decode(schema)(results[0].n);
  });
```

### Key Benefits of This Pattern

1. **Type Safety**: The constraint `& { Type: { id: Brand<string>; name: Slug; description: string } }` ensures only compatible schemas can be passed
2. **Schema Validation**: Uses Effect's Schema.decode for runtime validation
3. **Reusability**: One function works for all entities with the required fields
4. **Maintainability**: Changes to persistence logic only need updates in one place

## Common Generic Patterns

### 1. Named Entity Pattern (id, name, description)

Applies to: Snippet, Composition, Parameter, Tag

```typescript
// Find by name (maybe pattern)
export const findByName = <A, I, R>(
  nodeLabel: string,
  schema: Schema.Schema<A, I, R> & {
    Type: { name: Slug }
  },
  name: Slug
) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`MATCH (n:${nodeLabel} {name: $name}) RETURN n`;
    const params = yield* queryParams({ name });
    const results = yield* neo4j.runQuery<{ n: unknown }>(query, params);
    
    if (results.length === 0) return Option.none();
    
    const entity = yield* Schema.decode(schema)(results[0].n);
    return Option.some(entity);
  });

// Find by name (must pattern)
export const mustFindByName = <A, I, R>(
  nodeLabel: string,
  entityType: string,
  schema: Schema.Schema<A, I, R> & {
    Type: { name: Slug }
  },
  name: Slug
) =>
  findByName(nodeLabel, schema, name).pipe(
    Effect.flatMap(Option.match({
      onNone: () => Effect.fail(
        new NotFoundError({ entityType, slug: name })
      ),
      onSome: Effect.succeed
    }))
  );

// List all entities
export const listAll = <A, I, R>(
  nodeLabel: string,
  schema: Schema.Schema<A, I, R> & {
    Type: { name: Slug }
  }
) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    const query = cypher`MATCH (n:${nodeLabel}) RETURN n ORDER BY n.name`;
    const results = yield* neo4j.runQuery<{ n: unknown }>(query);
    
    return yield* Effect.forEach(
      results,
      result => Schema.decode(schema)(result.n)
    );
  });
```

### 2. Versioned Entity Pattern

Applies to: SnippetVersion, CompositionVersion, ParameterOption

```typescript
export const createVersion = <A, I, R>(
  versionLabel: string,
  parentLabel: string,
  parentId: Brand<string>,
  schema: Schema.Schema<A, I, R> & {
    Type: { id: Brand<string>; createdAt: Date; commit_message: string }
  },
  versionData: Omit<Schema.Schema.Type<typeof schema>, 'id' | 'createdAt'>
) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    
    return yield* neo4j.runInTransaction((tx) =>
      Effect.gen(function* () {
        // Verify parent exists
        const parentQuery = cypher`MATCH (p:${parentLabel} {id: $id}) RETURN p`;
        const parentParams = yield* queryParams({ id: parentId });
        const parentResults = yield* tx.run(parentQuery, parentParams);
        
        if (parentResults.length === 0) {
          return yield* Effect.fail(
            new NotFoundError({ entityType: parentLabel.toLowerCase(), id: parentId })
          );
        }
        
        // Find previous version
        const prevQuery = cypher`
          MATCH (p:${parentLabel} {id: $parentId})<-[:VERSION_OF]-(v:${versionLabel})
          RETURN v ORDER BY v.createdAt DESC LIMIT 1
        `;
        const prevResults = yield* tx.run(prevQuery, parentParams);
        
        // Create new version
        const id = yield* generateId();
        const fullVersion = {
          ...versionData,
          id,
          createdAt: new Date()
        } as Schema.Schema.Type<typeof schema>;
        
        // Create with or without previous link
        if (prevResults.length > 0) {
          const prevId = prevResults[0].v.id;
          const createQuery = cypher`
            MATCH (p:${parentLabel} {id: $parentId})
            MATCH (prev:${versionLabel} {id: $prevId})
            CREATE (v:${versionLabel} $props)
            CREATE (v)-[:VERSION_OF]->(p)
            CREATE (v)-[:PREVIOUS_VERSION]->(prev)
            RETURN v
          `;
          const params = yield* queryParams({ 
            parentId, 
            prevId, 
            props: fullVersion 
          });
          const results = yield* tx.run(createQuery, params);
          return yield* Schema.decode(schema)(results[0].v);
        } else {
          const createQuery = cypher`
            MATCH (p:${parentLabel} {id: $parentId})
            CREATE (v:${versionLabel} $props)
            CREATE (v)-[:VERSION_OF]->(p)
            RETURN v
          `;
          const params = yield* queryParams({ 
            parentId, 
            props: fullVersion 
          });
          const results = yield* tx.run(createQuery, params);
          return yield* Schema.decode(schema)(results[0].v);
        }
      })
    );
  });
```

## Usage Examples

### Creating Specific Functions from Generics

```typescript
// Snippet operations
export const createSnippet = (name: Slug, description: string) =>
  createNamedEntity('Snippet', Snippet, { name, description });

export const findSnippetByName = (name: Slug) =>
  findByName('Snippet', Snippet, name);

export const mustGetSnippetByName = (name: Slug) =>
  mustFindByName('Snippet', 'snippet', Snippet, name);

export const listAllSnippets = () =>
  listAll('Snippet', Snippet);

// Version operations
export const createSnippetVersion = (
  snippetId: SnippetId,
  content: string,
  commit_message: string
) =>
  createVersion(
    'SnippetVersion',
    'Snippet',
    snippetId,
    SnippetVersion,
    { content, commit_message }
  );
```

## When NOT to Use Generic Functions

Avoid generic functions for:

1. **Complex domain-specific queries** - When business logic is deeply integrated
2. **Performance-critical operations** - When specific optimizations are needed
3. **Unique relationship patterns** - When the relationships don't fit standard patterns
4. **Multi-step transactions** - When operations require complex transaction logic

Example of when to write custom functions:

```typescript
// This requires domain-specific logic that doesn't fit generic patterns
export const composeSnippets = (
  compositionId: CompositionId,
  snippetConfigs: Array<{ snippetVersionId: SnippetVersionId; role: Role; sequence: number }>
) =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    
    return yield* neo4j.runInTransaction((tx) =>
      Effect.gen(function* () {
        // Verify all snippets exist
        for (const config of snippetConfigs) {
          const query = cypher`MATCH (sv:SnippetVersion {id: $id}) RETURN sv`;
          const params = yield* queryParams({ id: config.snippetVersionId });
          const results = yield* tx.run(query, params);
          if (results.length === 0) {
            return yield* Effect.fail(
              new NotFoundError({ 
                entityType: 'snippetVersion', 
                id: config.snippetVersionId 
              })
            );
          }
        }
        
        // Create composition with specific relationships
        // ... custom logic here
      })
    );
  });
```

## Testing Generic Functions

### Testing Type Safety and Schema Validation

When testing generic persistence functions, it's critical to verify not just that data is stored, but that it's retrieved with the correct type and validated through the Schema system:

```typescript
describe('Generic Persistence Functions', () => {
  const TestEntity = Schema.Struct({
    id: Schema.UUID,
    name: Slug,
    description: Schema.String,
    customField: Schema.String
  });
  
  it.effect('should create entity with generated ID', () =>
    Effect.gen(function* () {
      const created = yield* createNamedEntity(
        'TestEntity',
        TestEntity,
        { 
          name: 'test-entity' as Slug,
          description: 'Test description',
          customField: 'custom value'
        }
      );
      
      expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
      expect(created.name).toBe('test-entity');
    }).pipe(Effect.provide(TestNeo4jLayer))
  );
});
```

### Testing Specific Entity Types

For each entity type, create tests that verify the correct type is returned and validated:

```typescript
describe('Snippet Persistence Type Safety', () => {
  it.effect('should return properly typed Snippet from createSnippet', () =>
    Effect.gen(function* () {
      const created = yield* createSnippet(
        'test-snippet' as Slug,
        'Test snippet description'
      );
      
      // TypeScript compile-time check
      const _typeCheck: Snippet = created;
      
      // Runtime Schema validation happens automatically
      // If the data doesn't match Snippet schema, it would fail
      expect(created).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f]{8}-/),
        name: 'test-snippet',
        description: 'Test snippet description'
      });
      
      // Verify it's actually a Snippet type by checking schema
      const isValid = yield* Schema.is(Snippet)(created);
      expect(isValid).toBe(true);
    }).pipe(Effect.provide(TestNeo4jLayer))
  );
  
  it.effect('should fail when database returns invalid Snippet data', () =>
    Effect.gen(function* () {
      // Mock Neo4j to return invalid data
      const mockNeo4j = Neo4jService.of({
        runQuery: () => Effect.succeed([{
          s: {
            id: '123',
            name: 'INVALID NAME WITH SPACES', // Invalid slug
            description: 'Description'
          }
        }])
      });
      
      const result = yield* Effect.either(
        mustGetSnippetByName('test' as Slug).pipe(
          Effect.provide(Layer.succeed(Neo4jService, mockNeo4j))
        )
      );
      
      // Should fail because the name doesn't match Slug schema
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('PersistenceError');
      }
    })
  );
});

describe('Type Differentiation Tests', () => {
  it.effect('should correctly differentiate between entity types', () =>
    Effect.gen(function* () {
      // Create different entities
      const snippet = yield* createSnippet(
        'test-snippet' as Slug,
        'Snippet description'
      );
      const tag = yield* createTag(
        'test-tag' as Slug,
        'Tag description'
      );
      
      // Verify they are different types
      const isSnippet = yield* Schema.is(Snippet)(snippet);
      const isTag = yield* Schema.is(Tag)(snippet);
      
      expect(isSnippet).toBe(true);
      expect(isTag).toBe(false);
      
      // TypeScript should catch this at compile time
      // @ts-expect-error - snippet is not a Tag
      const _invalid: Tag = snippet;
    }).pipe(Effect.provide(TestNeo4jLayer))
  );
});

describe('Schema Validation Edge Cases', () => {
  it.effect('should handle missing required fields', () =>
    Effect.gen(function* () {
      const mockNeo4j = Neo4jService.of({
        runQuery: () => Effect.succeed([{
          s: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'valid-name'
            // missing description field
          }
        }])
      });
      
      const result = yield* Effect.either(
        mustGetSnippetByName('valid-name' as Slug).pipe(
          Effect.provide(Layer.succeed(Neo4jService, mockNeo4j))
        )
      );
      
      expect(result._tag).toBe('Left');
    })
  );
  
  it.effect('should handle extra fields gracefully', () =>
    Effect.gen(function* () {
      const mockNeo4j = Neo4jService.of({
        runQuery: () => Effect.succeed([{
          s: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'valid-name',
            description: 'Valid description',
            extraField: 'This should be ignored'
          }
        }])
      });
      
      const snippet = yield* mustGetSnippetByName('valid-name' as Slug).pipe(
        Effect.provide(Layer.succeed(Neo4jService, mockNeo4j))
      );
      
      // Should succeed and ignore extra field
      expect(snippet.name).toBe('valid-name');
      expect((snippet as any).extraField).toBeUndefined();
    })
  );
});
```

## Summary

This generic function approach:
- ✅ Maintains Effect-TS idioms (pure functions, Effect.gen, proper error handling)
- ✅ Provides full type safety with Schema constraints
- ✅ Reduces code duplication across similar entities
- ✅ Allows easy testing and maintenance
- ✅ Follows the patterns seen in Effect documentation

Always prefer these generic patterns for standard CRUD operations, and only write custom functions when domain-specific logic is required.