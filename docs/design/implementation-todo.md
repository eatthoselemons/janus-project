# Janus Implementation TODO List (v2 - Effect-Optimized)

This document breaks down the implementation of the Janus project into small, incremental features. This revised plan incorporates advanced and idiomatic patterns from the full Effect documentation to ensure a robust, maintainable, and performant system.

## Phase 1: Core Domain, Types, and Configuration (The "Data" Layer)

This phase focuses on establishing the core, immutable data structures and a typed configuration system for the application.

-   [ ] **1.1: Typed Configuration Service:**
    -   [ ] Create a `Config` schema for the application settings (e.g., `LogLevel`, Neo4j connection details).
    -   [ ] Use `Config.redacted` for sensitive values like the Neo4j password.
    -   [ ] Use `Config.nested` to group related configurations (e.g., `neo4j.uri`, `neo4j.user`).
    -   [ ] Create a `ConfigLive` layer that provides the application configuration from environment variables.

-   [ ] **1.2: Core Error Types:**
    -   [ ] Define all potential business-level errors as `Data.TaggedError`.
    -   [ ] Create `Neo4jError` for database-related failures.
    -   [ ] Create `LlmApiError` for failures in communication with LLM providers.
    -   [ ] Create `ValidationError` for failures in data validation.

-   [ ] **1.3: Project and Core Identifiers:**
    -   [ ] Define `ProjectId`, `ModelId`, `DatasetId`, etc., as branded types (`Schema.brand`).
    -   [ ] Define `ProjectName`, `ModelName`, etc., with appropriate constraints (`Schema.string.pipe(Schema.nonEmpty())`).
    -   [ ] Define `Timestamp` as a branded `Date` type.
    -   [ ] Define the `Project` schema.

-   [ ] **1.4: Model, Dataset, TestRun, and Analysis Schemas:**
    -   [ ] Define the schemas for `Model`, `Dataset`, `TestCase`, `TestRun`, `TestResult`, and `Analysis` using the branded types and error types defined above.
    -   [ ] Use `Schema.Json` for flexible fields like `Metadata` and `Evaluation`.
    -   [ ] Use `Schema.literal` for status enums (`RunStatus`, `AnalysisStatus`).

## Phase 2: Neo4j Repositories & LLM Service (The "Actions" Layer)

This phase implements the persistence and external API interactions.

-   [ ] **2.1: Neo4j Client Service:**
    -   [ ] Create a `Neo4jClient` service (`Effect.Tag`) that wraps the `neo4j-driver`.
    -   [ ] The service should expose methods like `runQuery(query, params)` that return `Effect<Result, Neo4jError>`.
    -   [ ] Create a `Neo4jClientLive` layer that creates the driver instance and provides it to the service. Manage the driver's lifecycle with `Scope`.

-   [ ] **2.2: LLM API Service (with Request Batching & Caching):**
    -   [ ] Define `LlmApiRequest` as a `Request.Request` schema, capturing the prompt, model, and configuration.
    -   [ ] Create a batched `RequestResolver` (`LlmApiResolver`) for these requests. This resolver will handle the actual HTTP calls to the LLM provider's API.
    -   [ ] Create an `LlmApiService` (`Effect.Tag`) with a method `generate(request: LlmApiRequest): Effect<Response, LlmApiError>`.
    -   [ ] The `generate` method will use `Effect.request(request, LlmApiResolver)` and enable caching with `Effect.withRequestCaching(true)`.
    -   [ ] Create a `LlmApiServiceLive` layer.

-   [ ] **2.3: Aggregate Repositories:**
    -   [ ] For each aggregate root (`Project`, `Model`, `Dataset`, `TestRun`, `Analysis`), create a corresponding repository service using `Effect.Tag`.
    -   [ ] Implement the live layers (`ProjectRepositoryLive`, etc.) for these services. They will depend on the `Neo4jClient` service.
    -   [ ] All repository methods (`create`, `findById`, etc.) will be composed of calls to the `Neo4jClient` service.

## Phase 3: Core Services (Orchestration)

This phase focuses on the business logic, implemented as services that compose repositories and other action-oriented services.

-   [ ] **3.1: Project, Model, and Dataset Services:**
    -   [ ] Create services (`ProjectService`, `ModelService`, `DatasetService`) using `Effect.Tag`.
    -   [ ] These services will orchestrate the repositories to enforce business rules (e.g., ensuring unique names, handling dataset imports).
    -   [ ] Provide live layers for each service.

-   [ ] **3.2: Test Execution Service:**
    -   [ ] Create `TestExecutionService` (`Effect.Tag`).
    -   [ ] Implement a `startTestRun` method that takes a `TestRunId`.
    -   [ ] This method will fetch the `TestRun`, `Model`, and `Dataset`, then iterate through `TestCase`s.
    -   [ ] For each `TestCase`, it will call the `LlmApiService.generate` method. The batching and caching will be handled automatically by the `Effect` runtime.
    -   [ ] It will save results using the `TestRunRepository`.

-   [ ] **3.3: Analysis Service:**
    -   [ ] Create `AnalysisService` (`Effect.Tag`).
    -   [ ] Implement logic for analyzing a completed `TestRun`.

## Phase 4: CLI (The User Interface)

This phase builds the user-facing CLI.

-   [ ] **4.1: CLI Framework and Effect Runtime:**
    -   [ ] Set up `oclif` or a similar framework.
    -   [ ] Create a `ManagedRuntime` for the application by composing all the `Live` layers (`ConfigLive`, `Neo4jClientLive`, `ProjectRepositoryLive`, etc.).
    -   [ ] Each CLI command will use this runtime to execute the `Effect` workflows.

-   [ ] **4.2: Implement `janus` Commands:**
    -   [ ] Implement all the `janus <noun> <verb>` commands as outlined in the design documents.
    -   [ ] Each command will be a small `Effect` program that calls the appropriate service (e.g., `janus project create` calls `ProjectService.createProject`).

## Phase 5: Testing, Documentation, and CI/CD

-   [ ] **5.1: Unit & Integration Tests:**
    -   [ ] Write unit tests for all pure "Calculation" functions.
    -   [ ] Write integration tests for services using `Layer.provide` with test implementations of dependencies.
    -   [ ] Use `ConfigProvider.fromMap` to provide mock configurations in tests.
    -   [ ] Use `TestClock` to test any time-dependent logic (e.g., timeouts, scheduling).
    -   [ ] Create a `Neo4jClientTest` layer that mocks the database interactions for repository tests.

-   [ ] **5.2: Documentation:**
    -   [ ] Write user documentation for the CLI.
    -   [ ] Document the domain model, architecture, and the `Effect` patterns used.

-   [ ] **5.3: CI/CD:**
    -   [ ] Set up a CI/CD pipeline.
    -   [ ] The pipeline should run `pnpm run preflight` to ensure all tests, linting, and type checks pass.