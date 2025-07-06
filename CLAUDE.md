### 🔄 Project Awareness & Context
- **Always read `PLANNING.md`** at the start of a new conversation to understand the project's architecture, goals, style, and constraints.
- **Check `TASK.md`** before starting a new task. If the task isn’t listed, add it with a brief description and today's date.
- **Use consistent naming conventions, file structure, and architecture patterns** as described in `PLANNING.md`.

### 🧱 Code Structure & Modularity
- **Never create a file longer than 300 lines of code.** If a file approaches this limit, refactor by splitting it into modules or helper files.
- **Organize code into clearly separated modules**, grouped by feature or responsibility.
- **Use clear, consistent imports** (prefer relative imports within packages).

### ✅ Task Completion
- **Mark completed tasks in `TASK.md`** immediately after finishing them.
- Add new sub-tasks or TODOs discovered during development to `TASK.md` under a “Discovered During Work” section.

### 📚 Documentation & Explainability
- **Update `README.md`** when new features are added, dependencies change, or setup steps are modified.
- **Comment non-obvious code** and ensure everything confusing to a mid-level developer is commented
- When writing complex logic, **add an inline `# Reason:` comment** explaining the why, not just the what.

### 🧠 AI Behavior Rules
- **Never assume missing context. Ask questions if uncertain.**
- **Never hallucinate libraries or functions** – only use known, verified Python packages.
- **Always confirm file paths and module names** exist before referencing them in code or tests.

## 1. Development Workflow

### Building and Running

Before submitting any changes, it is crucial to validate them by running the full preflight check. This command will build the repository, run all tests, check for type errors, and lint the code.

```bash
pnpm run preflight
```

Also ensure that you have done everything in the `docs/llms/effect/effect-compliance-checklist.md` Add all those items as subtasks for the final step of any changes you make

### Writing Tests

This project uses **Vitest** as its primary testing framework. Test files (`*.test.ts`) should be co-located with the source files they test. When writing tests, please follow the established patterns for mocking and test structure found in existing test files.

When making tests you should always make sure there are at least tests for the following, if it is a complicated piece of code add more test cases
  - 1 test for expected use
  - 1 edge case
  - 1 failure case

## 2. Core Technology Stack

-   **Language:** TypeScript
-   **Runtime:** Node.js
-   **Core Framework:** `Effect-TS`. The full Effect ecosystem is used for managing effects, streams, error handling, and dependency injection.
-   **Database:** Neo4j
-   **Testing Framework:** Vitest
-   **Containerization:** Docker and `docker-compose`

## 3. Code Style & Conventions

### Guiding Philosophy

The project adheres strictly to the principles of **Functional Programming** and **Type-Driven Development**.

-   **Core Principle (inspired by Eric Normand's "Grokking Simplicity"):** Code is strictly separated into three categories:
    1.  **Data:** Plain, immutable objects with structures defined by TypeScript `type` or `interface` declarations.
    2.  **Calculations:** Pure functions that take data as input and produce new data as output.
    3.  **Actions:** Managed effects using the `Effect-TS` system.
-   **Type-Driven Design (inspired by Edwin Brady's "Type-Driven Development with Idris"):** The type system is used to enforce constraints and make illegal states unrepresentable.
    1. **Other References:** "Domain Modeling Made Functional" by Scott Wlaschin and "Programming with Types" by Vlad Riscutia

### TypeScript & JavaScript Best Practices

-   **Prefer Plain Objects over Classes:** Do not use `class` syntax for data structures. Use plain objects and `type` declarations to promote immutability, simplify data flow, and reduce boilerplate.
-   **Use ES Modules for Encapsulation:** Use `export` to define the public API of a module. Anything not exported is considered private. This provides clear boundaries and enhances testability.
-   **Avoid `any`; Prefer `unknown`:** The `any` type is disallowed. For values of an unknown type, use `unknown` and perform safe type-narrowing before operating on the value.
-   **Use Type Assertions (`as Type`) Sparingly:** Type assertions should be avoided. Their use may indicate a flaw in the type model or an opportunity to refactor.
-   **Embrace Array Operators:** Use immutable array operators (`.map()`, `.filter()`, `.reduce()`, etc.) over imperative `for` loops for data transformation.
-   **Comments Policy:** Write high-value comments only when necessary to explain complex logic. Avoid comments that state the obvious.
-   **Composition over Inheritance:** Composition over Inheritance: Using functional composition with pure functions

### Formatting & Linting

-   **Formatter:** Prettier
-   **Linter:** ESLint

### Technical Guidance & Resources

-   **The `Effect-TS` Mandate:** This is our foundational framework. All asynchronous operations, error handling, and dependency management **MUST** be modeled using the `Effect` system.
-   **`Effect-TS` Documentation:** If you are unsure about a specific `Effect-TS` implementation, you are encouraged to consult the official LLM-optimized documentation.
    -   **Condensed:** `https://effect.website/llms-small.txt`
    -   **Topics/Index:** `https://effect.website/llms.txt`
-   **Quick Reference For Using Effect** You can read either "effect-composition-guide.md" or "effect-normand-paradigm-guide.md" inside the `docs/llms/examples/` directory for references on proper usage of Effect

### Notes

Effects `Model.Class` is for when you're using sql databases, we need to use `Schema.Struct` because we are using neo4j for our databases
Use `pnpm test <string>` to skip the tests from the `examples` folder, the `<string>` is something that appears in the path so `pnpm test basic` would test:
- basic.test.ts
- basic-foo.test.ts
- basic/foo.test.ts
But skip other tests, you should usually just use `pnpm test src` to run the janus tests
