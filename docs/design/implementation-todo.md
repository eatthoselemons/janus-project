# Janus Implementation TODO List (v5 - Refined)

This document provides a detailed, exhaustive, and incremental plan for implementing the Janus project. It uses idiomatic `Effect-TS` terminology, referring to all dependencies, including data access layers, as "Services".

## Phase 1: Foundational Types & Core Services

This phase establishes the bedrock of the application: the type system, configuration, and essential services.

- [x] **1.1: Core Types & Schemas**
  - [x] **Branded IDs:** Define all branded ID types using `Schema.string.pipe(Schema.brand("..."))`:
    - `SnippetId`, `SnippetVersionId`, `ParameterId`, `ParameterOptionId`, `CompositionId`, `CompositionVersionId`, `TestRunId`, `DataPointId`, `TagId`.
  - [x] **Slug Type:** Create a `Slug` branded type with a custom validation function to enforce `lowercase-with-hyphens` format.
  - [x] **Entity Schemas:** Define `Schema.Struct` for all core entities as specified in `domain-model.md`:
    - `Snippet`, `SnippetVersion`, `Parameter`, `ParameterOption`, `Composition`, `CompositionVersion` (including `CompositionSnippet`), `TestRun`, `DataPoint`, `Tag`.

- [x] **1.2: Error Sub-Types**
  - [x] Define a base `JanusError` using `Data.TaggedError`.
  - [x] Define specific error subtypes that extend `JanusError`:
    - `PersistenceError` (for database query/connection failures).
    - `LlmApiError` (for failures from LLM providers).
    - `FileSystemError` (for file IO problems, e.g., `snippet pull/push`).
    - `NotFoundError` (for when an entity lookup by ID or slug fails).
    - `ConflictError` (for import conflicts).

- [x] **1.3: Typed Configuration Service**
  - [x] **Implementation:** Create a `Config` schema for all application settings (Neo4j URI, user, password; LLM provider API keys).
  - [x] **Implementation:** Use `Config.redacted` for all secrets (passwords, API keys).
  - [x] **Implementation:** Create a `ConfigLive` layer that provides the configuration from environment variables.
  - [x] **Testing:** Write a unit test for the `Config` schema, using `ConfigProvider.fromMap` to provide mock values and verify that the schema loads correctly.
  - [x] **Documentation:** Add a section to `README.md` explaining the required environment variables.

- [x] **1.4: Neo4j Client Service**
  - [x] **Implementation:** Create a `Neo4jClient` service (`Effect.Tag`) that wraps the `neo4j-driver`.
  - [x] **Implementation:** The service will expose `runQuery(query, params): Effect<Result, PersistenceError>` and a higher-level `transactionally(effect): Effect<A, E | PersistenceError>`.
  - [x] **Implementation:** Create a `Neo4jClientLive` layer that manages the driver's lifecycle using `Scope`.
  - [x] **Testing:** Write an integration test for the `Neo4jClientLive` layer that connects to a test database, runs a simple query, and verifies a transaction.

## Phase 2: Snippet Management

- [ ] **2.1: Snippet Persistence Service**
  - [ ] **Implementation:** Create `SnippetPersistence` service (`Effect.Tag`).
  - [ ] **Implementation:** Implement all required persistence methods:
    - `createSnippet(name: Slug, description: string): Effect<Snippet, PersistenceError>`
    - `createSnippetVersion(snippetId: SnippetId, content: string, commitMessage: string): Effect<SnippetVersion, PersistenceError>`
    - `findSnippetByName(name: Slug): Effect<Option<Snippet>, PersistenceError>`
    - `findLatestSnippetVersion(snippetId: SnippetId): Effect<Option<SnippetVersion>, PersistenceError>`
    - `listSnippets(): Effect<Snippet[], PersistenceError>`
    - `searchSnippets(query: string): Effect<Snippet[], PersistenceError>`
  - [ ] **Testing:** Write integration tests for each persistence method using a test Neo4j database.

- [ ] **2.2: Snippet CLI Commands**
  - [ ] **Implementation:** `janus snippet pull <snippet-name>`
  - [ ] **Implementation:** `janus snippet push <file-path> -m <message>`
  - [ ] **Implementation:** `janus snippet list`
  - [ ] **Implementation:** `janus snippet search "<query>"`
  - [ ] **Testing:** Write end-to-end tests for each CLI command.
  - [ ] **Documentation:** Write user documentation for the `janus snippet` commands.

## Phase 3: Parameter Management

- [ ] **3.1: Parameter Persistence Service**
  - [ ] **Implementation:** Create `ParameterPersistence` service (`Effect.Tag`).
  - [ ] **Implementation:** Implement all required persistence methods:
    - `createParameter(name: Slug, description: string): Effect<Parameter, PersistenceError>`
    - `createParameterOption(parameterId: ParameterId, value: string, commitMessage: string): Effect<ParameterOption, PersistenceError>`
    - `findParameterByName(name: Slug): Effect<Option<Parameter>, PersistenceError>`
    - `listParameters(): Effect<Parameter[], PersistenceError>`
    - `listParameterOptions(parameterId: ParameterId): Effect<ParameterOption[], PersistenceError>`
  - [ ] **Testing:** Write integration tests for each persistence method.

- [ ] **3.2: Parameter CLI Commands**
  - [ ] **Implementation:** `janus parameter create <name> --description "<desc>"`
  - [ ] **Implementation:** `janus parameter add-option --parameter-name <name> <value> -m <message>`
  - [ ] **Implementation:** `janus parameter list`
  - [ ] **Implementation:** `janus parameter list-options <parameter-name>`
  - [ ] **Testing:** Write end-to-end tests for each CLI command.
  - [ ] **Documentation:** Write user documentation for the `janus parameter` commands.

## Phase 4: Composition Management

- [ ] **4.1: Composition Persistence Service**
  - [ ] **Implementation:** Create `CompositionPersistence` service (`Effect.Tag`).
  - [ ] **Implementation:** Implement all required persistence methods:
    - `createCompositionVersion(from: { compositionId: CompositionId } | { groupName: Slug }, message: string, snippets: { snippetId: SnippetId, versionId: SnippetVersionId, order: number }[]): Effect<CompositionVersion, PersistenceError>`
    - `listCompositions(): Effect<Composition[], PersistenceError>`
  - [ ] **Testing:** Write integration tests for each persistence method.

- [ ] **4.2: Composition CLI Commands**
  - [ ] **Implementation:** `janus composition create-version --from-composition <id> | --from-group <name> -m <message>`
  - [ ] **Implementation:** `janus composition list`
  - [ ] **Testing:** Write end-to-end tests for each CLI command.
  - [ ] **Documentation:** Write user documentation for the `janus composition` commands.

## Phase 5: Test Execution & Results

- [ ] **5.1: LLM API Service**
  - [ ] **Implementation:** Create an `LlmApi` service (`Effect.Tag`) to abstract LLM provider interactions.
  - [ ] **Implementation:** The service will expose `generate(prompt: string, model: string): Effect<string, LlmApiError>`.
  - [ ] **Implementation:** Create a `LlmApiLive` layer that reads the provider and API key from the `Config` service.
  - [ ] **Testing:** Write an integration test for the `LlmApiLive` layer that makes a real API call (can be mocked in CI environments).

- [ ] **5.2: TestRun & DataPoint Persistence Service**
  - [ ] **Implementation:** Create `TestRunPersistence` service (`Effect.Tag`).
  - [ ] **Implementation:** Implement methods:
    - `createTestRun(name: string, llmProvider: string, llmModel: string, metadata: Record<string, any>): Effect<TestRun, PersistenceError>`
    - `createDataPoint(testRunId: TestRunId, compositionVersionId: CompositionVersionId, finalPrompt: string, responseText: string, metrics: Record<string, any>): Effect<DataPoint, PersistenceError>`
    - `listTestRuns(): Effect<TestRun[], PersistenceError>`
  - [ ] **Testing:** Write integration tests for each persistence method.

- [ ] **5.3: Test Execution Service (Business Logic)**
  - [ ] **Implementation:** Create `TestExecutionService` (`Effect.Tag`). This is a business logic service, distinct from the persistence services.
  - [ ] **Implementation:** Define a `Schema` for the `test_config.yaml` file to ensure type-safe parsing and validation.
  - [ ] **Implementation:** Implement `runFromFile(configPath: string): Effect<TestRun, JanusError>`.
  - [ ] **Implementation:** This service will parse and validate the YAML, use the persistence services to create the `TestRun` and `CompositionVersion`, call the `LlmApi` service, and save `DataPoint`s.
  - [ ] **Testing:** Write integration tests for the service, providing test implementations of the persistence and `LlmApi` services.

- [ ] **5.4: Run CLI Commands**
  - [ ] **Implementation:** `janus run <config-file-path>`
  - [ ] **Implementation:** `janus run list`
  - [ ] **Testing:** Write end-to-end tests for the CLI commands.
  - [ ] **Documentation:** Write user documentation for the `janus run` commands and the `test_config.yaml` format.

## Phase 6: Import/Export

- [ ] **6.1: Export Service (Business Logic)**
  - [ ] **Implementation:** Create `ExportService` (`Effect.Tag`).
  - [ ] **Implementation:** Implement `exportTestRun(runId: TestRunId): Effect<string, JanusError>` which uses the persistence services to query the full graph for a test run and serializes it to the specified JSON format.
  - [ ] **Testing:** Write an integration test that creates a test run, exports it, and validates the JSON output against the schema.

- [ ] **6.2: Import Service (Business Logic)**
  - [ ] **Implementation:** Create `ImportService` (`Effect.Tag`).
  - [ ] **Implementation:** Implement `importTestRun(jsonContent: string, conflictNamespace: string): Effect<void, JanusError>` which parses the JSON and safely merges it into the database via the persistence services.
  - [ ] **Testing:** Write an integration test that imports a known JSON file and verifies the created entities in the database.

- [ ] **6.3: Global CLI Commands**
  - [ ] **Implementation:** `janus export --run-id <id> --output <file-path>`
  - [ ] **Implementation:** `janus import <file-path> --conflict-namespace <prefix>`
  - [ ] **Testing:** Write end-to-end tests for the import/export commands.
  - [ ] **Documentation:** Write user documentation for the `janus import` and `janus export` commands.
