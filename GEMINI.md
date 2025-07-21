# The Janus Project: Technical Conventions & Charter

This document outlines the core technical conventions, architectural principles, and design philosophy for the Janus Project. All contributions should adhere to these guidelines to ensure consistency, quality, and maintainability.

## 1. Project Mission

The Janus Project is an open-source framework for the rigorous, empathetic, and reproducible testing of Large Language Models. Its mission is to provide tools that enable deep research into the emergent cognitive and ethical behaviors of LLMs, facilitate robust red-teaming efforts, and foster open science through shareable, reproducible experiments.

## 2. Development Workflow

### Git Repository

- The primary branch for this project is `main`.

### Building and Running

Before submitting any changes, it is crucial to validate them by running the full preflight check. This command will build the repository, run all tests, check for type errors, and lint the code.

```bash
pnpm run preflight
```

### Writing Tests

This project uses **Vitest** as its primary testing framework. Test files (`*.test.ts`) should be co-located with the source files they test. When writing tests, please follow the established patterns for mocking and test structure found in existing test files.

Test requirements:
- 1 test for expected use
- 1 edge case
- 1 failure case
- Additional test cases for complicated code

### Task Management

- Mark completed tasks in `TASK.md` immediately after finishing them
- Add new sub-tasks or TODOs discovered during development to `TASK.md` under a "Discovered During Work" section

## 3. Core Technology Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **Core Framework:** `Effect-TS`. The full Effect ecosystem is used for managing effects, streams, error handling, and dependency injection.
- **Database:** Neo4j
- **Testing Framework:** Vitest
- **Containerization:** Docker and `docker-compose`

## 4. Code Style & Conventions

### Guiding Philosophy

The project adheres strictly to the principles of **Functional Programming** and **Type-Driven Development**.

- **Core Principle (inspired by Eric Normand's "Grokking Simplicity"):** Code is strictly separated into three categories:
  1.  **Data:** Plain, immutable objects with structures defined by TypeScript `type` or `interface` declarations.
  2.  **Calculations:** Pure functions that take data as input and produce new data as output.
  3.  **Actions:** Managed effects using the `Effect-TS` system.
- **Type-Driven Design (inspired by Edwin Brady's "Type-Driven Development with Idris"):** The type system is used to enforce constraints and make illegal states unrepresentable.

### TypeScript & JavaScript Best Practices

- **Prefer Plain Objects over Classes:** Do not use `class` syntax for data structures. Use plain objects and `type`/`interface` declarations to promote immutability, simplify data flow, and reduce boilerplate.
- **Use ES Modules for Encapsulation:** Use `export` to define the public API of a module. Anything not exported is considered private. This provides clear boundaries and enhances testability.
- **Avoid `any`; Prefer `unknown`:** The `any` type is disallowed. For values of an unknown type, use `unknown` and perform safe type-narrowing before operating on the value.
- **Use Type Assertions (`as Type`) Sparingly:** Type assertions should be avoided. Their use may indicate a flaw in the type model or an opportunity to refactor.
- **Embrace Array Operators:** Use immutable array operators (`.map()`, `.filter()`, `.reduce()`, etc.) over imperative `for` loops for data transformation.
- **Use Effect's Immutable Data Structures:** Prefer `Chunk`, `HashMap`, and `HashSet` from Effect over native JavaScript arrays and objects for collections to ensure immutability and leverage performance optimizations.
- **Comments Policy:** Write high-value comments only when necessary to explain complex logic. Avoid comments that state the obvious.

### Code Organization

- **Never create files longer than 300 lines** - Refactor into modules if approaching this limit
- **Organize by feature or responsibility** - Clear module boundaries
- **Use consistent imports** - Prefer relative imports within packages

### Effect-TS Specific Notes

- Use `Schema.Struct` for Neo4j (not `Model.Class` which is for SQL databases)
- Use `pnpm test src` to run project tests (skips examples folder)

### Formatting & Linting

- **Formatter:** Prettier
- **Linter:** ESLint

### Technical Guidance & Resources

- **The `Effect-TS` Mandate:** This is our foundational framework. All asynchronous operations, error handling, and dependency management **MUST** be modeled using the `Effect` system.
- **`Effect-TS` Documentation:** If you are unsure about a specific `Effect-TS` implementation, you are encouraged to consult the official LLM-optimized documentation.
  - **Condensed:** `https://effect.website/llms-small.txt`
  - **Full:** `https://effect.website/llms-full.txt`
  - **Topics/Index:** `https://effect.website/llms.txt`

### Working with the Codebase

- **Never assume missing context** - Ask questions if uncertain
- **Never hallucinate libraries or functions** - Only use verified packages
- **Always confirm file paths and module names exist** before referencing them

## 5. Language Server Usage (MCP)

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
