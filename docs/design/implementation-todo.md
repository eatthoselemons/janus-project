# Janus Implementation TODO List (v5 - Refined)

This document provides a detailed, exhaustive, and incremental plan for implementing the Janus project. It uses idiomatic `Effect-TS` terminology, referring to all dependencies, including data access layers, as "Services".

## Phase 1: Foundational Types & Core Services

This phase establishes the bedrock of the application: the type system, configuration, and essential services.

- [x] **1.1: Core Types & Schemas**
  - [x] **Branded IDs:** Define all branded ID types using `Schema.string.pipe(Schema.brand("..."))`:
    - `ContentNodeId`, `ContentNodeVersionId`, `TestCaseId`, `TestRunId`, `DataPointId`, `TagId`.
  - [x] **Slug Type:** Create a `Slug` branded type with a custom validation function to enforce `lowercase-with-hyphens` format.
  - [x] **Entity Schemas:** Define `Schema.Struct` for all core entities as specified in `domain-model.md`:
    - `ContentNode`, `ContentNodeVersion`, `TestCase` (including `MessageSlot`), `TestRun`, `DataPoint`, `Tag`.

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

## Phase 2: Generic Persistence Foundation

- [x] **2.1: Generic Persistence Functions**
  - [x] **Implementation:** Create generic persistence functions following the patterns in `docs/llms/best-practices/generic-persistence-patterns.md`:
    - [x] Implement `createNamedEntity` generic function for entities with id/name/description
    - [x] Implement `findByName` (maybe pattern) generic function
    - [x] Implement `mustFindByName` (must pattern) generic function
    - [x] Implement `listAll` generic function for listing entities
    - [x] Implement `createVersion` generic function for versioned entities
    - [x] Implement `getLatestVersion` generic function
  - [x] **Testing:** Write comprehensive tests for the generic functions using test schemas
  - [x] **Documentation:** Update examples in the generic persistence patterns document with actual implementation

**IMPORTANT NOTE:** The generic persistence functions in `src/services/persistence/GenericPersistence.ts` handle all standard CRUD operations for entities. For the unified content model, use the ContentService for content-specific operations and generic functions for basic CRUD:
```typescript
// Examples:
ContentService.createContentNode(name, description)
ContentService.createContentNodeVersion(nodeId, content, commitMessage, parents)
ContentService.processContentFromId(versionId, parameters, options)
```
Only create entity-specific services if you need domain-specific operations beyond standard CRUD.

## Phase 3: Content Management

- [ ] **3.1: Content CLI Commands**
  - [ ] **Implementation:** `janus content pull <content-name>`
  - [ ] **Implementation:** `janus content push <file-path> -m <message>`
  - [ ] **Implementation:** `janus content list`
  - [ ] **Implementation:** `janus content search "<query>"`
  - [ ] **Implementation:** `janus content tag <content-name> <tag-name>`
  - [ ] **Testing:** Write end-to-end tests for each CLI command.
  - [ ] **Documentation:** Write user documentation for the `janus content` commands.

## Phase 4: Tag Management

- [ ] **4.1: Tag CLI Commands**
  - [ ] **Implementation:** `janus tag create <name>`
  - [ ] **Implementation:** `janus tag list`
  - [ ] **Implementation:** `janus tag search "<query>"`
  - [ ] **Testing:** Write end-to-end tests for each CLI command.
  - [ ] **Documentation:** Write user documentation for the `janus tag` commands.

## Phase 5: Test Case Management

- [ ] **5.1: Test Case CLI Commands**
  - [ ] **Implementation:** `janus test-case create <name> --model <llm-model>`
  - [ ] **Implementation:** `janus test-case add-slot <test-case-name> --role <role> --tags <tags> --sequence <number>`
  - [ ] **Implementation:** `janus test-case list`
  - [ ] **Implementation:** `janus test-case build <test-case-name>` (preview conversation)
  - [ ] **Testing:** Write end-to-end tests for each CLI command.
  - [ ] **Documentation:** Write user documentation for the `janus test-case` commands.

## Phase 6: Test Execution & Results

- [ ] **6.1: LLM API Service**
  - [ ] **Implementation:** Create an `LlmApi` service (`Effect.Tag`) to abstract LLM provider interactions.
  - [ ] **Implementation:** The service will expose `generate(conversation: conversation, model: string): Effect<string>, LlmApiError>`.
  - [ ] **Implementation:** Create a `LlmApiLive` layer that reads the provider and API key from the `Config` service.
  - [ ] **Testing:** Write an integration test for the `LlmApiLive` layer that makes a real API call (can be mocked in CI environments).

- [ ] **6.2: TestRun & DataPoint Persistence**
  - [ ] **Implementation:** Use the generic persistence functions for standard operations:
    - For TestRun: Use `GenericPersistence.createNamedEntity('TestRun', TestRun, {...})`
    - For TestRun listing: Use `GenericPersistence.listAll('TestRun', TestRun)`
  - [ ] **Implementation:** Only if needed, create a `TestRunPersistence` service for complex domain-specific operations:
    - `createDataPoint(...)` - This might need custom logic for linking to TestRun and TestCase
    - Any complex queries that can't be handled by generic functions
  - [ ] **Testing:** Write integration tests for any custom persistence methods.

- [ ] **6.3: Test Execution Service (Business Logic)**
  - [ ] **Implementation:** Create `TestExecutionService` (`Effect.Tag`). This is a business logic service, distinct from the persistence services.
  - [ ] **Implementation:** Define a `Schema` for the `test_config.yaml` file to ensure type-safe parsing and validation.
  - [ ] **Implementation:** Implement `runFromFile(configPath: string): Effect<TestRun, JanusError>`.
  - [ ] **Implementation:** This service will parse and validate the YAML, use the persistence services to create the `TestRun` and execute `TestCase`s, call the `LlmApi` service, and save `DataPoint`s.
  - [ ] **Testing:** Write integration tests for the service, providing test implementations of the persistence and `LlmApi` services.

- [ ] **6.4: Run CLI Commands**
  - [ ] **Implementation:** `janus run <config-file-path>`
  - [ ] **Implementation:** `janus run list`
  - [ ] **Testing:** Write end-to-end tests for the CLI commands.
  - [ ] **Documentation:** Write user documentation for the `janus run` commands and the `test_config.yaml` format.

## Phase 7: Import/Export

- [ ] **7.1: Export Service (Business Logic)**
  - [ ] **Implementation:** Create `ExportService` (`Effect.Tag`).
  - [ ] **Implementation:** Implement `exportTestRun(runId: TestRunId): Effect<string, JanusError>` which uses the persistence services to query the full graph for a test run and serializes it to the specified JSON format.
  - [ ] **Testing:** Write an integration test that creates a test run, exports it, and validates the JSON output against the schema.

- [ ] **7.2: Import Service (Business Logic)**
  - [ ] **Implementation:** Create `ImportService` (`Effect.Tag`).
  - [ ] **Implementation:** Implement `importTestRun(jsonContent: string, conflictNamespace: string): Effect<void, JanusError>` which parses the JSON and safely merges it into the database via the persistence services.
  - [ ] **Testing:** Write an integration test that imports a known JSON file and verifies the created entities in the database.

- [ ] **7.3: Global CLI Commands**
  - [ ] **Implementation:** `janus export --run-id <id> --output <file-path>`
  - [ ] **Implementation:** `janus import <file-path> --conflict-namespace <prefix>`
  - [ ] **Testing:** Write end-to-end tests for the import/export commands.
  - [ ] **Documentation:** Write user documentation for the `janus import` and `janus export` commands.
