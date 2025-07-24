name: "Snippet CLI Commands - Implementation PRP"
description: |

## Purpose

Implement CLI commands for snippet management following the established domain model and Effect-TS patterns, enabling users to interact with snippets via the command line.

## Core Principles

1. **Context is Complete but Focused**: Include ALL necessary documentation sections, specific examples, and discovered caveats by linking specific documents
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md
6. **Condense Repeated Code**: Refactor code that repeated

---

## Goal

Implement the `janus snippet` CLI commands (pull, push, list, search) that interact with the existing snippet persistence service and handle file system operations for managing snippet content locally.

## Why

- **Developer Productivity**: Enable developers to quickly pull snippets to their local environment for editing and push changes back to the database
- **Version Control Integration**: Allow snippets to be stored as files that can be tracked in git
- **Workflow Automation**: Support scripting and automation by providing command-line access to snippet management

## What

Implement four CLI subcommands under `janus snippet`:
- `janus snippet pull <snippet-name>`: Download a snippet's latest version to a local file
- `janus snippet push <file-path> -m <message>`: Create/update a snippet from a local file
- `janus snippet list`: Display all snippets in a table format
- `janus snippet search "<query>"`: Search snippets by name/description

### Success Criteria

- [ ] All four snippet commands implemented and working
- [ ] File operations handle errors gracefully (missing files, permissions)
- [ ] Integration with existing SnippetPersistence service
- [ ] Proper error messages and user feedback
- [ ] All tests passing and preflight check succeeds
- [ ] Commands follow Effect-TS patterns and project conventions

## All Needed Context

### Documentation & References (include complete sections that are directly relevant)

```yaml
# MUST READ - Include these specific sections in your context window
# ✅ Include: Complete relevant sections, not just snippets
# ❌ Avoid: Entire folders or unrelated documentation

- url: https://www.npmjs.com/package/@effect/cli
  sections: ['Basic Usage', 'Commands', 'Arguments and Options', 'Running Your CLI']
  why: Official @effect/cli documentation for building CLI applications
  discovered_caveat: Must use NodeContext.layer and NodeRuntime.runMain for proper execution

- file: /home/user/git/janus-project/examples/effect-official-examples/templates/cli/src/Cli.ts
  why: Basic CLI pattern with Command.make and Command.run
  gotcha: Shows proper entry point setup with process.argv handling

- file: /home/user/git/janus-project/examples/effect-official-examples/templates/monorepo/packages/cli/src/Cli.ts
  why: Complex CLI with subcommands pattern - exactly what we need
  gotcha: Shows how to structure subcommands and integrate with services

- file: /home/user/git/janus-project/src/services/snippet/SnippetPersistence.ts
  why: Existing snippet persistence methods we'll call from CLI
  critical: |
    - mustGetSnippetByName returns NotFoundError on missing snippet
    - mustGetLatestSnippetVersion returns NotFoundError if no versions
    - createSnippet checks for duplicate names

- url: https://effect.website/docs/guides/platform/file-system
  sections: ['FileSystem Service', 'Reading Files', 'Writing Files']
  why: Effect's FileSystem service for file I/O operations
  discovered_caveat: Must use @effect/platform-node for Node.js file system

- doc: /home/user/git/janus-project/docs/llms/effect/effect-compliance-checklist.md
  include_sections: ['Pre-Implementation Checklist', 'Implementation Checklist', 'Testing Checklist']
  skip_sections: ['Observability & Security Checklist'] # Will be minimal for CLI
```

### Context Inclusion Guidelines

- Include COMPLETE sections when they contain implementation details
- Include MULTIPLE examples if they show different use cases
- Include ALL caveats and warnings discovered during research
- Skip sections about: history, philosophy, future plans, unrelated features
- When in doubt, include it - but be specific about WHY it's needed

### Current Codebase tree (run `tree` in the root of the project) to get an overview of the codebase

```bash
src/
├── domain/
│   ├── errors/
│   │   ├── index.ts
│   │   └── tests/
│   │       └── errors.test.ts
│   └── types/
│       ├── Composition.ts
│       ├── DataPoint.ts
│       ├── Parameter.ts
│       ├── Snippet.ts
│       ├── Tag.ts
│       ├── TestRun.ts
│       ├── index.ts
│       └── tests/
│           ├── Composition.test.ts
│           ├── DataPoint.test.ts
│           ├── Parameter.test.ts
│           ├── Snippet.test.ts
│           ├── Tag.test.ts
│           └── TestRun.test.ts
├── layers/
│   ├── configuration/
│   │   ├── Configuration.layer.ts
│   │   ├── Configuration.staticLayers.ts
│   │   ├── Configuration.test.ts
│   │   └── index.ts
│   └── neo4j/
│       ├── Neo4j.layer.ts
│       ├── Neo4j.staticLayers.ts
│       ├── Neo4j.test.ts
│       └── index.ts
└── services/
    ├── configuration/
    │   ├── Configuration.ts
    │   ├── index.ts
    │   └── tests/
    │       └── Configuration.test.ts
    ├── neo4j/
    │   ├── Neo4jService.ts
    │   ├── cypher.ts
    │   ├── index.ts
    │   └── tests/
    │       └── Neo4jService.test.ts
    └── snippet/
        ├── SnippetPersistence.ts
        ├── index.ts
        └── tests/
            └── SnippetPersistence.test.ts
```

### Desired Codebase tree with files to be added and responsibility of file

```bash
src/
├── cli/                                  # NEW: CLI-related code
│   ├── index.ts                         # Main CLI entry point with command composition
│   ├── snippet/                         # Snippet-related CLI commands
│   │   ├── index.ts                    # Snippet command with subcommands
│   │   ├── pull.ts                     # Pull command implementation
│   │   ├── push.ts                     # Push command implementation
│   │   ├── list.ts                     # List command implementation
│   │   ├── search.ts                   # Search command implementation
│   │   └── tests/
│   │       ├── pull.test.ts
│   │       ├── push.test.ts
│   │       ├── list.test.ts
│   │       └── search.test.ts
│   └── bin.ts                          # CLI executable entry point
├── services/
│   └── filesystem/                      # NEW: FileSystem service
│       ├── FileSystemService.ts         # File I/O operations service
│       ├── index.ts
│       └── tests/
│           └── FileSystemService.test.ts
└── layers/
    └── filesystem/                      # NEW: FileSystem layers
        ├── FileSystem.layer.ts          # Live implementation
        ├── FileSystem.staticLayers.ts   # Test implementation
        ├── FileSystem.test.ts
        └── index.ts

package.json                             # UPDATE: Add bin entry for CLI
```

### Domain Structure & Naming Conventions

```
src/
├── domain/
│   └── types/              # Domain types and schemas
│       ├── <type>.ts       # Type definitions using Schema.Struct
│       └── tests/
│           └── <type>.test.ts
├── services/
│   └── <service-name>/
│       └── index.ts
└── layers/
    └── <layer-domain>/
        ├── <LayerName>.layer.ts         # Live/production implementation
        ├── <LayerName>.staticLayers.ts  # Test implementation with static data
        ├── <LayerName>.test.ts          # Tests for the layers
        └── index.ts                     # Re-exports
```

**Key Naming Conventions:**

- `*.layer.ts` - Production layers that may have side effects
- `*.staticLayers.ts` - Test layers with hardcoded static data (no side effects)
- `*.test.ts` - Test files that test the layers

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: @effect/cli requires specific runtime setup
// Example: Must use NodeContext.layer and NodeRuntime.runMain
// Example: Commands must be composed with Command.withSubcommands for nested structure
// Example: File paths in CLI args should use Args.file() or Args.directory() validators
// Example: Always use Effect.gen with function* syntax, not async/await
// Example: SnippetPersistence methods return branded types (Snippet, SnippetVersion)
// Example: File operations must handle both ENOENT (not found) and EACCES (permission) errors
// Example: Schema.decode returns an Effect, not a plain value
// Example: We use Effect v3 and Schema.Struct for Neo4j (not Model.Class)
```

## Implementation Blueprint

### Data models and structure

Create the core data models, we ensure type safety and consistency.

```typescript
Examples:
 - FileSystemError subtypes for file operations (FileNotFound, PermissionDenied)
 - File path validation using branded types
 - CLI output formatting types (table, json, plain)
 - Service definitions with Context.Tag for FileSystemService

```

### list of tasks to be completed to fullfill the PRP in the order they should be completed

```yaml
Task 1: Create FileSystemService
CREATE src/services/filesystem/FileSystemService.ts:
  - MIRROR pattern from: src/services/neo4j/Neo4jService.ts
  - Define FileSystemService tag
  - Implement readFile, writeFile, ensureDirectory methods
  - Use @effect/platform FileSystem with proper error handling
  - Convert platform errors to domain FileSystemError types

CREATE src/services/filesystem/index.ts:
  - Export FileSystemService and types

CREATE src/services/filesystem/tests/FileSystemService.test.ts:
  - Test readFile with existing and non-existent files
  - Test writeFile with valid paths and permission errors
  - Test ensureDirectory creation

Task 2: Create FileSystem layers
CREATE src/layers/filesystem/FileSystem.layer.ts:
  - MIRROR pattern from: src/layers/neo4j/Neo4j.layer.ts
  - Provide FileSystemService using @effect/platform-node FileSystem
  - Handle resource lifecycle if needed

CREATE src/layers/filesystem/FileSystem.staticLayers.ts:
  - Mock file system operations with in-memory storage
  - Support testing without actual file I/O

CREATE src/layers/filesystem/FileSystem.test.ts:
  - Test both live and static layer implementations

CREATE src/layers/filesystem/index.ts:
  - Export layers

Task 3: Create CLI structure and main entry
CREATE src/cli/index.ts:
  - Define main janus command using Command.make
  - Import snippet subcommand (to be created)
  - Setup command composition

CREATE src/cli/bin.ts:
  - MIRROR pattern from: examples/effect-official-examples/templates/cli/src/bin.ts
  - Import and run CLI with NodeContext and required layers
  - Handle process.argv

UPDATE package.json:
  - ADD bin entry: "bin": { "janus": "./dist/cli/bin.js" }
  - Ensure proper build configuration

Task 4: Implement snippet pull command
CREATE src/cli/snippet/pull.ts:
  - Define Args.text for snippet-name
  - Create pull command handler
  - Use SnippetPersistence to get snippet and latest version
  - Use FileSystemService to write content to file
  - Handle NotFoundError with user-friendly message

Task 5: Implement snippet push command  
CREATE src/cli/snippet/push.ts:
  - Define Args.file for file-path
  - Define Options.text for commit message (-m)
  - Create push command handler
  - Read file content using FileSystemService
  - Extract snippet name from filename (without extension)
  - Try to find existing snippet, create if not found
  - Create new version with content and message

Task 6: Implement snippet list command
CREATE src/cli/snippet/list.ts:
  - Create list command (no arguments)
  - Use SnippetPersistence.listSnippets
  - Format output as table (name, description, id)
  - Use Console service for output

Task 7: Implement snippet search command
CREATE src/cli/snippet/search.ts:
  - Define Args.text for search query
  - Create search command handler
  - Use SnippetPersistence.searchSnippets
  - Format results same as list command

Task 8: Compose snippet commands
CREATE src/cli/snippet/index.ts:
  - Import all snippet subcommands
  - Create main snippet command with Command.make
  - Use Command.withSubcommands to add pull, push, list, search
  - Export for use in main CLI

Task 9: Write comprehensive tests
CREATE src/cli/snippet/tests/pull.test.ts:
  - Test successful pull to file
  - Test snippet not found error
  - Test file write errors

CREATE src/cli/snippet/tests/push.test.ts:
  - Test creating new snippet from file
  - Test updating existing snippet
  - Test file not found error
  - Test missing commit message

CREATE src/cli/snippet/tests/list.test.ts:
  - Test listing multiple snippets
  - Test empty list

CREATE src/cli/snippet/tests/search.test.ts:
  - Test search with results
  - Test search with no results

Task 10: Integration and documentation
UPDATE README.md:
  - Add CLI installation instructions
  - Document all snippet commands with examples
  - Add troubleshooting section

Run validation and fix any issues:
  - pnpm run preflight
  - Manual testing of all commands
```

### Per task pseudocode as needed added to each task

```typescript
// Task 1 - FileSystemService
import { Context, Effect, Layer } from 'effect';
import { FileSystem } from '@effect/platform';
import { FileSystemError, FileNotFoundError, PermissionDeniedError } from '@/domain/errors';

export class FileSystemService extends Context.Tag('FileSystemService')<
  FileSystemService,
  {
    readFile: (path: string) => Effect.Effect<string, FileSystemError>;
    writeFile: (path: string, content: string) => Effect.Effect<void, FileSystemError>;
    ensureDirectory: (path: string) => Effect.Effect<void, FileSystemError>;
  }
>() {}

// Implementation pattern
const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  
  const readFile = (path: string) =>
    pipe(
      fs.readFileString(path),
      Effect.mapError((error) => {
        // Map platform errors to domain errors
        if (error._tag === 'SystemError' && error.reason === 'NotFound') {
          return new FileNotFoundError({ path });
        }
        // Handle other error types
      })
    );
    
  return { readFile, writeFile, ensureDirectory };
});

// Task 4 - Pull command
const pullCommand = Command.make(
  'pull',
  {
    snippetName: Args.text({ name: 'snippet-name' }).pipe(
      Args.withDescription('Name of the snippet to pull')
    ),
  },
  ({ snippetName }) =>
    Effect.gen(function* () {
      const snippetPersistence = yield* SnippetPersistence;
      const fileSystem = yield* FileSystemService;
      
      // PATTERN: Decode slug from string
      const slug = yield* Schema.decode(Slug)(snippetName);
      
      // Get snippet and version - will fail with NotFoundError if missing
      const snippet = yield* snippetPersistence.mustGetSnippetByName(slug);
      const version = yield* snippetPersistence.mustGetLatestSnippetVersion(snippet.id);
      
      // Write to file with .snippet extension
      const filename = `${snippetName}.snippet`;
      yield* fileSystem.writeFile(filename, version.content);
      
      yield* Console.log(`Pulled snippet '${snippetName}' to ${filename}`);
    }).pipe(
      // Handle specific errors with user-friendly messages
      Effect.catchTag('NotFoundError', (error) =>
        Console.error(`Snippet '${snippetName}' not found`)
      )
    )
);

// Task 5 - Push command pattern
const pushCommand = Command.make(
  'push',
  {
    filePath: Args.file({ name: 'file-path', exists: 'yes' }),
    message: Options.text('message').pipe(
      Options.withAlias('m'),
      Options.withDescription('Commit message for this version')
    ),
  },
  ({ filePath, message }) =>
    Effect.gen(function* () {
      // Extract snippet name from filename
      const snippetName = path.basename(filePath, path.extname(filePath));
      
      // Read file content
      const content = yield* fileSystem.readFile(filePath);
      
      // Try to find existing snippet
      const existingSnippet = yield* snippetPersistence.maybeGetSnippetByName(slug);
      
      const snippet = yield* Option.match(existingSnippet, {
        onNone: () => 
          // Create new snippet
          snippetPersistence.createSnippet(slug, `Snippet created from ${filePath}`),
        onSome: (s) => Effect.succeed(s),
      });
      
      // Create new version
      yield* snippetPersistence.createSnippetVersion(snippet.id, content, message);
    })
);
```

### Integration Points

```yaml
DATABASE:
  - Uses existing SnippetPersistence service
  - No new database changes needed

CONFIG:
  - No new configuration needed for basic implementation
  - Future: could add default snippet directory config

PACKAGE.JSON:
  - add to: package.json
  - pattern: "bin": { "janus": "./dist/cli/bin.js" }

BUILD:
  - Ensure TypeScript compiles CLI entry points
  - Add shebang to bin.ts: #!/usr/bin/env node

LAYERS:
  - CLI commands need: Neo4jClientLive, SnippetPersistenceLive, FileSystemLive
  - Compose in bin.ts entry point
```

## Validation Loop

### Level 1: Syntax & Type Checking

```bash
# Run these FIRST - fix any errors before proceeding
pnpm run build                    # TypeScript compilation
pnpm run lint                     # ESLint checking

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests each new feature/file/function use existing test patterns

```typescript
// Example test for pull command - src/cli/snippet/tests/pull.test.ts
import { describe, it, expect } from '@effect/vitest';
import { Effect, Option, Layer, Exit } from 'effect';
import { pullCommand } from '../pull';

describe('snippet pull command', () => {
  it.effect('should pull snippet to file', () =>
    Effect.gen(function* () {
      // Setup test layers with mock data
      const testLayers = Layer.mergeAll(
        SnippetPersistence.Test.withSnippets([
          { name: 'test-snippet', content: 'test content' }
        ]),
        FileSystemService.Test.withMemoryFs()
      );
      
      // Run command
      yield* pullCommand.handler({ snippetName: 'test-snippet' }).pipe(
        Effect.provide(testLayers)
      );
      
      // Verify file was written
      const fileSystem = yield* FileSystemService;
      const content = yield* fileSystem.readFile('test-snippet.snippet');
      expect(content).toBe('test content');
    })
  );

  it.effect('should handle snippet not found', () =>
    Effect.gen(function* () {
      const testLayers = Layer.mergeAll(
        SnippetPersistence.Test.empty(),
        FileSystemService.Test.withMemoryFs()
      );
      
      const exit = yield* Effect.exit(
        pullCommand.handler({ snippetName: 'missing' }).pipe(
          Effect.provide(testLayers)
        )
      );
      
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});
```

```bash
# Run and iterate until passing:
pnpm test src/cli/snippet/tests/
# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Integration Test

```bash
# Build the CLI
pnpm run build

# Test the CLI commands
./dist/cli/bin.js snippet list
# Expected: List of snippets (or empty if none)

# Create a test snippet file
echo "console.log('Hello, Janus!');" > test.snippet

# Push the snippet
./dist/cli/bin.js snippet push test.snippet -m "Initial version"
# Expected: Success message

# Pull it back
rm test.snippet
./dist/cli/bin.js snippet pull test
# Expected: File created with same content

# Search for it
./dist/cli/bin.js snippet search "test"
# Expected: Shows the test snippet

# If any errors: Check console output for Effect stack trace
```

## Final validation Checklist

- [ ] All tests pass: `pnpm test`
- [ ] No linting errors: `pnpm run lint`
- [ ] No type errors: `pnpm run build`
- [ ] Preflight passes: `pnpm run preflight`
- [ ] Manual test successful: All four CLI commands work as expected
- [ ] Error cases handled with proper Effect error types
- [ ] All Effect compliance checklist items followed
- [ ] Documentation updated in README.md

---

## Anti-Patterns to Avoid

- ❌ Don't use async/await - use Effect.gen with yield*
- ❌ Don't use try/catch - use Effect error handling
- ❌ Don't use console.log directly - use Console service
- ❌ Don't use native fs module - use @effect/platform FileSystem
- ❌ Don't return promises from commands - return Effects
- ❌ Don't skip branded type validation - always decode inputs
- ❌ Don't use Model.Class - use Schema.Struct for domain types
- ❌ Don't create long files - keep under 300 lines
- ❌ Don't duplicate code - use composition and layers

## Confidence Score

**Score: 9/10**

High confidence due to:
- Clear existing patterns in the codebase to follow
- Well-documented Effect CLI library with examples
- Existing persistence layer already implemented
- Comprehensive test strategy included
- All dependencies already installed

Minor uncertainty (-1) for:
- First CLI implementation in this project (no existing CLI patterns to follow exactly)
- FileSystem service needs to be created from scratch