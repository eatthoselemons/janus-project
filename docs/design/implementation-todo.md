
# Janus Implementation TODO List

This document breaks down the implementation of the Janus project into small, incremental features, following the principles of Type-Driven Development and "Grokking Simplicity".

## Phase 1: Core Domain & Types (The "Data" Layer)

This phase focuses on establishing the core, immutable data structures of the application. All types should be defined using `Schema` from `Effect-TS` to ensure validation and type safety.

-   [ ] **1.1: Project and Core Identifiers:**
    -   [ ] Define `ProjectId` as a branded UUID string.
    -   [ ] Define `ProjectName` as a non-empty string.
    -   [ ] Define `ProjectDescription` as a string.
    -   [ ] Define `Timestamp` as a branded `Date` type.
    -   [ ] Define the `Project` schema using the types above.

-   [ ] **1.2: Model Types:**
    -   [ ] Define `ModelId` as a branded UUID string.
    -   [ ] Define `ModelName` as a non-empty string.
    -   [ ] Define `ModelProvider` as a Schema `literal` or `enum` of supported providers (e.g., "OpenAI", "Anthropic").
    -   [ ] Define `ModelConfiguration` as a `Schema.Struct` for model parameters (e.g., temperature).
    -   [ ] Define `Credentials` as a `Schema.Redacted` string.
    -   [ ] Define the `Model` schema.

-   [ ] **1.3: Dataset and TestCase Types:**
    -   [ ] Define `DatasetId` as a branded UUID string.
    -   [ ] Define `DatasetName` as a non-empty string.
    -   [ ] Define `DatasetDescription` as a string.
    -   [ ] Define `Prompt` as a non-empty string.
    -   [ ] Define `ExpectedOutcome` as a `Schema.Json`.
    -   [ ] Define `Metadata` as a `Schema.Json`.
    -   [ ] Define `TestCaseId` as a branded UUID string.
    -   [ ] Define the `TestCase` schema.
    -   [ ] Define the `Dataset` schema, including an array of `TestCase`s.

-   [ ] **1.4: TestRun and TestResult Types:**
    -   [ ] Define `TestRunId` as a branded UUID string.
    -   [ ] Define `RunStatus` as a `Schema.literal` ("pending", "running", "completed", "failed").
    -   [ ] Define `ModelResponse` as a string.
    -   [ ] Define `Evaluation` as a `Schema.Json`.
    -   [ ] Define `Metrics` as a `Schema.Json`.
    -   [ ] Define `TestResultId` as a branded UUID string.
    -   [ ] Define the `TestResult` schema.
    -   [ ] Define the `TestRun` schema, including an array of `TestResult`s.

-   [ ] **1.5: Analysis Types:**
    -   [ ] Define `AnalysisId` as a branded UUID string.
    -   [ ] Define `AnalysisStatus` as a `Schema.literal` ("pending", "running", "completed", "failed").
    -   [ ] Define `AnalysisSummary` as a string.
    -   [ ] Define `AnalysisReport` as a `Schema.Json`.
    -   [ ] Define the `Analysis` schema.

## Phase 2: Neo4j Repositories (The "Actions" Layer)

This phase implements the persistence layer using Neo4j. Each repository will be an `Effect.Service` that handles all database interactions for a specific aggregate root.

-   [ ] **2.1: Neo4j Client Service:**
    -   [ ] Create a `Neo4jClient` service that wraps the `neo4j-driver`.
    -   [ ] The service should expose methods for running queries and managing sessions/transactions.
    -   [ ] All methods must return `Effect` types, properly handling connection errors and query failures.

-   [ ] **2.2: Project Repository:**
    -   [ ] Create `ProjectRepository` service.
    -   [ ] Implement `create(project: Project)`.
    -   [ ] Implement `findById(id: ProjectId)`.
    -   [ ] Implement `findByName(name: ProjectName)`.
    -   [ ] Implement `update(project: Project)`.
    -   [ ] Implement `delete(id: ProjectId)`.

-   [ ] **2.3: Model Repository:**
    -   [ ] Create `ModelRepository` service.
    -   [ ] Implement methods for `create`, `findById`, `findByName`, `update`, and `delete` for `Model`s within a `Project`.

-   [ ] **2.4: Dataset Repository:**
    -   [ ] Create `DatasetRepository` service.
    -   [ ] Implement methods for `create`, `findById`, `findByName`, `update`, and `delete` for `Dataset`s.
    -   [ ] Implement methods to add/remove/update `TestCase`s within a `Dataset`.

-   [ ] **2.5: TestRun Repository:**
    -   [ ] Create `TestRunRepository` service.
    -   [ ] Implement methods for `create`, `findById`, `updateStatus`, and `delete` for `TestRun`s.
    -   [ ] Implement methods to add `TestResult`s to a `TestRun`.

-   [ ] **2.6: Analysis Repository:**
    -   [ ] Create `AnalysisRepository` service.
    -   [ ] Implement methods for `create`, `findById`, and `update` for `Analysis`.

## Phase 3: Core Services (The "Calculations" and "Actions" Orchestration)

This phase focuses on the business logic of the application, implemented as `Effect.Service`s that compose repositories and other services.

-   [ ] **3.1: Project Service:**
    -   [ ] Create `ProjectService` that uses `ProjectRepository`.
    -   [ ] Implement business logic for managing projects, such as ensuring unique project names.

-   [ ] **3.2: Model Service:**
    -   [ ] Create `ModelService` that uses `ModelRepository`.
    -   [ ] Implement logic for managing models, including credential encryption/decryption.

-   [ ] **3.3: Dataset Service:**
    -   [ ] Create `DatasetService` that uses `DatasetRepository`.
    -   [ ] Implement logic for importing datasets from files (e.g., JSONL).

-   [ ] **3.4: Test Execution Service:**
    -   [ ] Create `TestExecutionService`.
    -   [ ] This service will orchestrate a `TestRun`.
    -   [ ] It will fetch the `Model` and `Dataset`, iterate through `TestCase`s, send prompts to the model, and save `TestResult`s.
    -   [ ] This service will interact with external LLM APIs, so it needs a sub-service for that.

-   [ ] **3.5: LLM API Service:**
    -   [ ] Create a generic `LlmApiService` that can be extended for different providers.
    -   [ ] Implement an `OpenAiService` that conforms to the `LlmApiService` interface.
    -   [ ] This service handles the actual HTTP requests to the LLM APIs.

-   [ ] **3.6: Analysis Service:**
    -   [ ] Create `AnalysisService`.
    -   [ ] Implement the logic for analyzing a completed `TestRun` and generating a report.

## Phase 4: CLI (The User Interface)

This phase builds the user-facing CLI using a framework like `oclif`. Each command will be a small program that uses the core services.

-   [ ] **4.1: CLI Framework Setup:**
    -   [ ] Initialize a new `oclif` project.
    -   [ ] Set up the main `janus` command.
    -   [ ] Implement a mechanism to provide the `Effect` layers to the commands.

-   [ ] **4.2: `janus project` Commands:**
    -   [ ] `janus project init`: Creates a new Janus project.
    -   [ ] `janus project get`: Retrieves project details.
    -   [ ] `janus project list`: Lists all projects.

-   [ ] **4.3: `janus model` Commands:**
    -   [ ] `janus model create`: Creates a new model configuration.
    -   [ ] `janus model get`: Retrieves a model.
    -   [ ] `janus model list`: Lists models in a project.
    -   [ ] `janus model update`: Updates a model.
    -   [ ] `janus model delete`: Deletes a model.

-   [ ] **4.4: `janus dataset` Commands:**
    -   [ ] `janus dataset create`: Creates a new dataset.
    -   [ ] `janus dataset import`: Imports a dataset from a file.
    -   [ ] `janus dataset get`: Retrieves a dataset.
    -   [ ] `janus dataset list`: Lists datasets in a project.

-   [ ] **4.5: `janus run` Commands:**
    -   [ ] `janus run start`: Starts a new test run.
    -   [ ] `janus run get`: Retrieves the status and results of a run.
    -   [ ] `janus run list`: Lists test runs.
    -   [ ] `janus run export`: Exports a test run to JSON.

-   [ ] **4.6: `janus analysis` Commands:**
    -   [ ] `janus analysis start`: Starts an analysis of a test run.
    -   [ ] `janus analysis get`: Retrieves an analysis report.
    -   [ ] `janus analysis export`: Exports an analysis to JSON.

## Phase 5: Testing, Documentation, and CI/CD

-   [ ] **5.1: Unit & Integration Tests:**
    -   [ ] Write unit tests for all "Calculation" functions.
    -   [ ] Write integration tests for services using test layers for repositories.
    -   [ ] Write end-to-end tests for the CLI commands.

-   [ ] **5.2: Documentation:**
    -   [ ] Write user documentation for the CLI.
    -   [ ] Document the domain model and architecture.

-   [ ] **5.3: CI/CD:**
    -   [ ] Set up a CI/CD pipeline (e.g., GitHub Actions).
    -   [ ] The pipeline should run tests, lint the code, and build the project.
