# The Janus Project: Technical Conventions & Charter

This document outlines the core technical conventions, architectural principles, and design philosophy for the Janus Project. All contributions should adhere to these guidelines to ensure consistency, quality, and maintainability.

## 1. Project Mission

The Janus Project is an open-source framework for the rigorous, empathetic, and reproducible testing of Large Language Models. Its mission is to provide tools that enable deep research into the emergent cognitive and ethical behaviors of LLMs, facilitate robust red-teaming efforts, and foster open science through shareable, reproducible experiments.

## 2. Development Workflow

### Git Repository

-   The primary branch for this project is `main`.

### Building and Running

Before submitting any changes, it is crucial to validate them by running the full preflight check. This command will build the repository, run all tests, check for type errors, and lint the code.

```bash
pnpm run preflight
```

### Writing Tests

This project uses **Vitest** as its primary testing framework. Test files (`*.test.ts`) should be co-located with the source files they test. When writing tests, please follow the established patterns for mocking and test structure found in existing test files.

## 3. Core Technology Stack

-   **Language:** TypeScript
-   **Runtime:** Node.js
-   **Core Framework:** `Effect-TS`. The full Effect ecosystem is used for managing effects, streams, error handling, and dependency injection.
-   **Database:** Neo4j
-   **Testing Framework:** Vitest
-   **Containerization:** Docker and `docker-compose`

## 4. Code Style & Conventions

### Guiding Philosophy

The project adheres strictly to the principles of **Functional Programming** and **Type-Driven Development**.

-   **Core Principle (inspired by Eric Normand's "Grokking Simplicity"):** Code is strictly separated into three categories:
    1.  **Data:** Plain, immutable objects with structures defined by TypeScript `type` or `interface` declarations.
    2.  **Calculations:** Pure functions that take data as input and produce new data as output.
    3.  **Actions:** Managed effects using the `Effect-TS` system.
-   **Type-Driven Design (inspired by Edwin Brady's "Type-Driven Development with Idris"):** The type system is used to enforce constraints and make illegal states unrepresentable.

### TypeScript & JavaScript Best Practices

-   **Prefer Plain Objects over Classes:** Do not use `class` syntax for data structures. Use plain objects and `type`/`interface` declarations to promote immutability, simplify data flow, and reduce boilerplate.
-   **Use ES Modules for Encapsulation:** Use `export` to define the public API of a module. Anything not exported is considered private. This provides clear boundaries and enhances testability.
-   **Avoid `any`; Prefer `unknown`:** The `any` type is disallowed. For values of an unknown type, use `unknown` and perform safe type-narrowing before operating on the value.
-   **Use Type Assertions (`as Type`) Sparingly:** Type assertions should be avoided. Their use may indicate a flaw in the type model or an opportunity to refactor.
-   **Embrace Array Operators:** Use immutable array operators (`.map()`, `.filter()`, `.reduce()`, etc.) over imperative `for` loops for data transformation.
-   **Comments Policy:** Write high-value comments only when necessary to explain complex logic. Avoid comments that state the obvious.

### Formatting & Linting

-   **Formatter:** Prettier
-   **Linter:** ESLint

### Technical Guidance & Resources

-   **The `Effect-TS` Mandate:** This is our foundational framework. All asynchronous operations, error handling, and dependency management **MUST** be modeled using the `Effect` system.
-   **`Effect-TS` Documentation:** If you are unsure about a specific `Effect-TS` implementation, you are encouraged to consult the official LLM-optimized documentation.
    -   **Condensed:** `https://effect.website/llms-small.txt`
    -   **Full:** `https://effect.website/llms-full.txt`
    -   **Topics/Index:** `https://effect.website/llms.txt`
