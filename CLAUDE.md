# The Janus Project: Development Guidelines

This document outlines the development guidelines, conventions, and best practices for the Janus Project. All contributions should adhere to these guidelines to ensure consistency, quality, and maintainability.

## 1. Development Workflow

### Building and Running

Before submitting any changes, validate them by running the full preflight check:

```bash
pnpm run preflight
```

This command will build the repository, run all tests, check for type errors, and lint the code.

Also ensure that you have completed everything in `docs/llms/effect/effect-compliance-checklist.md`. Add all those items as subtasks for the final step of any changes you make.

### Writing Tests

This project uses **Vitest** as its primary testing framework. Test files (`*.test.ts`) should be co-located with the source files they test. Follow the established patterns for mocking and test structure found in existing test files.

Test requirements:
- 1 test for expected use
- 1 edge case
- 1 failure case
- Additional test cases for complicated code

### Task Management

- Create a task file in `docs/humans/tasks/` (e.g., `feature-name.md`)
- Use the template at `docs/humans/tasks/TASK-TEMPLATE.md`
- Update progress as you work (⏳ pending, 🔄 in progress, ✅ completed)
- Keep task file updated with clear summary of changes for PR description
- task file is for the pull request description
- document issues and fixes made after the initial PRP in a document in `docs/humans/fixes/{feature-number}-{feature-name}.md` for review of how to improve prps

## 2. Core Technology Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **Core Framework:** Effect-TS (full ecosystem for effects, streams, error handling, dependency injection)
- **Database:** Neo4j
- **Testing Framework:** Vitest
- **Containerization:** Docker and docker-compose

## 3. Code Style & Conventions

### Guiding Philosophy

The project adheres strictly to **Functional Programming** and **Type-Driven Development**:

1. **Code Separation** (Eric Normand's "Grokking Simplicity"):
   - **Data:** Plain, immutable objects with TypeScript `type` declarations
   - **Calculations:** Pure functions that transform data
   - **Actions:** Managed effects using the Effect-TS system

2. **Type-Driven Design** (Edwin Brady's "Type-Driven Development with Idris"):
   - Use the type system to enforce constraints
   - Make illegal states unrepresentable
   - References: "Domain Modeling Made Functional" (Scott Wlaschin), "Programming with Types" (Vlad Riscutia)

### TypeScript Best Practices

- **Prefer Plain Objects over Classes** - Use plain objects and `type` declarations
- **Use ES Modules for Encapsulation** - Export only the public API
- **Avoid `any`; Prefer `unknown`** - Perform safe type-narrowing
- **Minimize Type Assertions** - Their use may indicate a type model flaw
- **Embrace Array Operators** - Use `.map()`, `.filter()`, `.reduce()` over loops
- **Use Effect's Immutable Data Structures** - Prefer `Chunk`, `HashMap`, and `HashSet` from Effect over native JavaScript arrays and objects for collections to ensure immutability and leverage performance optimizations.
- **High-Value Comments Only** - Explain the why with `# Reason:` comments
- **Composition over Inheritance** - Use functional composition

### Code Organization

- **Never create files longer than 300 lines** - Refactor into modules
- **Organize by feature or responsibility** - Clear module boundaries
- **Use consistent imports** - Prefer relative imports within packages

### Formatting & Linting

- **Formatter:** Prettier
- **Linter:** ESLint

### Effect-TS Specific Notes

- Use `Schema.Struct` for Neo4j (not `Model.Class` which is for SQL databases)
- Use `pnpm test src` to run project tests (skips examples folder)
- Leave newlines at end of files

## 4. Development Best Practices

### Documentation

- Update `README.md` when adding features, changing dependencies, or modifying setup
- Comment non-obvious code that would confuse a mid-level developer
- Add inline `# Reason:` comments for complex logic

### Working with the Codebase

- **Never assume missing context** - Ask questions if uncertain
- **Never hallucinate libraries or functions** - Only use verified packages
- **Always confirm file paths and module names exist** before referencing them

### Notes When Making Tests

- Use the language server mcp often to check types when you get errors in tests
- Build errors usually are not descriptive enough
- Poke around with the language server

## 5. Core Principles Checklist

Ensure code always follows these ideals:

1. Follows "Programming with Types" by Vlad Riscutia
2. Follows "Type-Driven Development with Idris" by Edwin Brady
3. Follows "Grokking Simplicity" by Eric Normand
4. Does composition over inheritance
5. Follows Effect best practices (documentation: `docs/llms/guides/effect-docs`)
6. Is tailored for Neo4j as database (not SQL)
7. Avoids code duplication - condense repeated sections

## 6. Language Server Usage (MCP)

Use the MCP language server tools frequently to verify Effect-TS types and catch errors early:

### Type Verification During Development

**When to use**: After writing any Effect-TS code, especially:
- Effect pipelines (`pipe`, `Effect.gen`, `Layer.effect`)
- Schema definitions and transformations
- Service implementations with complex dependencies

**How to use**:
```
1. Hover (mcp__language-server__hover): Check types of Effect constructs
   - Verify Effect<A, E, R> signatures match expectations
   - Confirm service dependencies are correctly inferred
   
2. Diagnostics (mcp__language-server__diagnostics): Catch type errors immediately
   - Run after completing each function, pipeline, or service method
   - Run before moving to test/implement the next feature
   - Pay attention to Effect-specific errors (missing Context, incorrect error types)
```

### Common Patterns to Verify

- **Effect Pipelines**: Hover over `pipe` chains to ensure type flow
- **Layer Composition**: Check that `Layer.provide` correctly satisfies dependencies
- **Schema Validations**: Verify Schema.Struct fields match your domain types
- **Service Tags**: Ensure Tag definitions match interface types

### Other Useful Commands

- **References** (mcp__language-server__references): Find all uses of a Tag or Schema
- **Rename** (mcp__language-server__rename_symbol): Safely rename services/types across codebase
- **Edit** (mcp__language-server__edit_file): Apply quick fixes for import paths

**Note**: The `definition` feature (go to definition) currently doesn't work due to MCP implementation limitations - it fails with "No Project" error. This is not a configuration issue. Use VS Code or other IDEs for definition lookup instead.

**Pro tip**: Run diagnostics before running `pnpm preflight` to catch issues faster!
