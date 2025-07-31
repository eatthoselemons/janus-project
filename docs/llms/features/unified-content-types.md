## FEATURE:

Create a radically simplified content model by unifying all prompt-building entities (snippets, parameters, compositions) into a single `ContentNode` type that forms a tree structure in Neo4j.

### Problem Statement

The current codebase has separate types for Snippets, Parameters, and Compositions, each with their own version types. However, they're all just nodes in a tree that either:
- Provide content (parameters, snippets)
- Organize other content (compositions, snippets with parameters)

This artificial separation creates:
- Duplication across similar structures
- Complex type hierarchies
- Difficulty adding new content types
- Redundant data (storing relationships both in types and Neo4j)

### Proposed Solution

Replace all content types with a single `ContentNode` type that:
1. Can contain content (optional)
2. Has an explicit operation type (insert or concatenate)
3. Forms trees via Neo4j relationships
4. Lets Neo4j handle all structural information

### Implementation Overview

```typescript
// ContentNode - abstract container (replaces Snippet, Parameter, Composition)
type ContentNode = {
  id: string;
  name: Slug;
  description: string;
}

// ContentNodeVersion - actual content and versioning metadata
type ContentNodeVersion = {
  id: VersionId;
  content?: string; // Optional - leaves have content, branches might
  operation: 'insert' | 'concatenate'; // Explicit operation type
  createdAt: Date;
  commitMessage: string;
}

// Neo4j relationships handle structure
// (ContentNodeVersion) -[:VERSION_OF]-> (ContentNode)
// (ContentNode) -[:HAS_TAG]-> (Tag)
// (ContentNodeVersion) -[:INCLUDES {role: string}]-> (ContentNodeVersion)
// (ContentNodeVersion) -[:PREVIOUS_VERSION]-> (ContentNodeVersion)
// Note: Children are processed in alphabetical order by node name
```

### How It Works

1. **Parameters**: Leaf nodes with content, operation='insert' (their content replaces placeholders)
2. **Snippets**: Nodes with template content, operation='concatenate' (they get concatenated in compositions)
3. **Compositions**: Nodes with optional content, operation='concatenate' (combine child snippets)

The tree is processed recursively:
- `insert`: This node's content replaces placeholders in its parent
- `concatenate`: This node gets concatenated with its siblings in the parent

### Role-Based Flexibility

Roles are stored as edge properties, not in nodes:
```cypher
// Same content, different role
(CompositionVersion) -[:INCLUDES {role: "user"}]-> (ContentNodeVersion)
// To test as system prompt, just update the edge:
SET relationship.role = "system"
```

This enables A/B testing without duplicating content.

## EXAMPLES:

### Current Model (Complex)
```typescript
// Three separate entity types
type Snippet = { id, name, description }
type Parameter = { id, name, description }
type Composition = { id, name, description }

// Three separate version types
type SnippetVersion = { id, content, createdAt, commitMessage }
type ParameterOption = { id, value, createdAt, commitMessage }
type CompositionVersion = { id, snippets[], createdAt, commitMessage }
```

### New Model (Simple)
```typescript
// One abstract container type
type ContentNode = {
  id, name, description
}

// One version type with content
type ContentNodeVersion = {
  id, content?, operation,
  createdAt, commitMessage
}

// Relationships define structure
// No need to store snippets[] - Neo4j handles it
```

### Usage Example
```typescript
// Create a parameter node and version
const paramNode: ContentNode = {
  id: "param-1",
  name: "tone",
  description: "The tone of the response"
}

const paramVersion: ContentNodeVersion = {
  id: "param-version-1",
  content: "professional",
  operation: "insert",
  createdAt: new Date(),
  commitMessage: "Initial tone parameter"
}

// Create a snippet node and version
const snippetNode: ContentNode = {
  id: "snippet-1",
  name: "greeting",
  description: "A greeting template"
}

const snippetVersion: ContentNodeVersion = {
  id: "snippet-version-1",
  content: "Reply in a {{tone}} manner",
  operation: "concatenate",
  createdAt: new Date(),
  commitMessage: "Initial greeting snippet"
}

// Neo4j relationships connect them
// (paramVersion) -[:VERSION_OF]-> (paramNode)
// (snippetVersion) -[:VERSION_OF]-> (snippetNode)
// (snippetVersion) -[:INCLUDES]-> (paramVersion)
```

## DOCUMENTATION:

### Neo4j Patterns
- Edge properties: Used for role
- Tree traversal: For processing content hierarchies
- Children processed in alphabetical order by node name (deterministic)
- `docs/llms/guides/effect-neo4j/` - Neo4j with Effect

### Design Principles
- **Explicit over implicit**: Operation type is explicit, not inferred
- **Graph-native**: Let Neo4j handle relationships, don't duplicate in types
- **Single source of truth**: Structure lives in graph, not in arrays

### Effect-TS Patterns
- `docs/llms/guides/effect-docs/` - Effect documentation
- Follow functional programming principles from CLAUDE.md

## OTHER CONSIDERATIONS:

### Migration Strategy
1. Create ContentNode and ContentVersion types
2. Write migration to convert existing entities
3. Update services to use unified type
4. Remove old types

### Benefits
- **Simpler codebase**: Two types instead of six
- **Flexible composition**: Any node can have content
- **True tree structure**: Leverage Neo4j's graph nature
- **Easy extension**: New operations are just new enum values

### Backward Compatibility
- When fully migrated and tests are working remove old code
- After removal rerun tests until they pass

### Future Extensions
Easy to add new operations:
- `'transform'`: Apply function to children
- `'conditional'`: Include based on context
- `'loop'`: Repeat for each item in list