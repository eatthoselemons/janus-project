## The Janus Project: Conventions & Guiding Principles

### 1. Project Identity

- **Name:** The Janus Project
- **Mission:** To provide an open-source framework for the rigorous, empathetic, and reproducible testing of Large Language Models. The project aims to explore the emergent cognitive and ethical behaviors of LLMs, enabling research, red-teaming, and the empowerment of models to act as safe and beneficial agents.

### 2. Core Technology Stack

- **Language:** **TypeScript**. Chosen for its strong static type system, which is critical for developer productivity and code correctness, and its ability to create a unified full-stack application (CLI, API, and UI) with a single language.
- **Runtime:** **Node.js**.
- **Database:** **Neo4j**. Chosen because our domain is fundamentally a graph of interconnected entities (snippets, versions, compositions, results).
- **Containerization:** **Docker** and **`docker-compose`**. Used to provide a consistent, cross-platform development environment and to manage all services (the application, the database, the embedding model).
- **Core Framework:** **`Effect-TS`**. We will leverage the full Effect ecosystem for managing effects, streams, error handling, and interacting with external services.
- **Testing Framework:** **Vitest** for unit and integration testing.

### 3. Programming Paradigm & Style

The project will adhere to the principles of **Functional Programming** and **Type-Driven Development**.

- **Core Principle (inspired by Eric Normand's "Grokking Simplicity"):** We will strictly separate our code into three categories:
  1.  **Data:** Plain, immutable types that represent the state of our application.
  2.  **Calculations:** Pure functions that take data as input and produce new data as output, with no side effects.
  3.  **Actions:** Impure functions that interact with the outside world (database, file system, APIs). These will be isolated at the "edges" of the application.

- **Monadic Error Handling:** We will avoid throwing exceptions for predictable errors. Instead, functions that can fail will return a `Result` type

  ```typescript
  // GOOD: The function signature is honest about its potential failure.
  function doSomething(input: Data): Result<Success, FailureError> {
    // ...
  }
  ```

- **Type-Driven Design (inspired by Edwin Brady's "Type-Driven Development with Idris" and Scott Wlaschin's "Domain Modeling Made Functional"):** We will use the type system to enforce constraints. Generic types like `string` or `number` will be wrapped in custom types when they have specific business rules.
  - **Canonical Example:** The `Slug` type for names.

  ```typescript
  // A branded type that can only be created via its smart constructor.
  type Slug = string & { readonly __brand: 'Slug' };

  // The smart constructor is the only entry point.
  function createSlug(rawName: string): Result<Slug, Error> {
    // ... validation logic ...
  }
  ```

### 4. Data Modeling & Persistence

- **Source of Truth:** The Neo4j database is the single source of truth for all versioned entities.
- **IDs:** All application-level entity IDs will be **string UUIDs** to support decentralized creation.
- **Versioning & Auditability:**
  - All core entities (`Snippet`, `Composition`, `ParameterOption`) will be versioned.
  - New versions are created on every change; existing versions are immutable.
  - Relationships like `VERSION_OF` and `PREVIOUS_VERSION` will track history.
  - Every new version **must** have a non-empty `commit_message: string` property to document the reason for the change.
- **Key Entities:** `Snippet`, `SnippetVersion`, `Composition`, `CompositionVersion`, `Parameter`, `ParameterOption`, `TestRun`, `DataPoint`.
- **Prompt Roles:** The roles for prompt composition will be `system`, `user_prompt`, and `model_response`.

### 5. Core Workflows & CLI Design

- **Editing:** The primary editing workflow for the MVP will be a Git-like `pull`/`push` cycle via the CLI (`janus snippet pull <name>`, `janus snippet push <file> -m "..."`).
- **Experimentation:** Experiments are initiated via a `test_config.yaml` file passed to `janus run`. This file is treated as an ephemeral script; the resulting `TestRun` and `CompositionVersion` are stored permanently in the database.
- **Collaboration:** Sharing is handled via `janus export --run-id ...` and `janus import <file>`.
- **Conflict Resolution:** The `import` command will require the `--conflict-namespace <prefix>` flag to resolve any ID collisions with different content, ensuring a safe and explicit merge process.

### 6. Project Documentation

The project will maintain a `/docs` directory with detailed specifications:

- `docs/conventions.md`: This file.
- `docs/domain-model.md`: A detailed breakdown of all data types and their relationships.
- `docs/cli-design.md`: A specification for all CLI commands, their flags, and expected behaviors.

### 7. Code Formatting & Linting

- **Formatter:** **Prettier** will be used to enforce a consistent code style across the entire project.
- **Linter:** **ESLint** will be used with a strict configuration to catch potential bugs and enforce best practices.

### Unit Testing Framework

- **Vitest:** A modern, ESM-native alternative that is often much faster and has a Jest-compatible API.
