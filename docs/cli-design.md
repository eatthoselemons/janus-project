## The Janus Project: CLI Design Specification

This document outlines the design and functionality of the `janus` command-line interface. The CLI is the primary tool for interacting with the Janus Project's database and running experiments in the Minimum Viable Product (MVP).

### Design Philosophy

The CLI is designed with two core principles:

1.  **Git-like Workflow:** For creating and editing core entities like Snippets, the CLI mimics the familiar `pull`/`push` cycle of Git. This allows users to leverage their favorite local text editors for content creation while maintaining a structured, versioned history in the database.
2.  **Ephemeral Configuration:** Test execution is initiated by a `test_config.yaml` file. This file is treated as a temporary script or recipe. The CLI uses it to create permanent, immutable entities (like `CompositionVersion` and `TestRun`) in the database, which then become the persistent record of the experiment.

### Command Structure

The CLI follows a `noun verb` structure (e.g., `janus snippet pull`).

---

### 1. `janus snippet`

Commands for managing reusable prompt snippets.

#### `janus snippet pull <snippet-name>`

Downloads the latest version of a snippet from the database to a local file.

*   **Arguments:**
    *   `<snippet-name>`: The `Slug` of the snippet to pull.
*   **Behavior:**
    *   Creates a file in a local `janus_workspace/` directory named `<snippet-name>.txt`.
    *   If the file already exists, it will be overwritten.

#### `janus snippet push <file-path> -m <message>`

Pushes changes from a local file to the database, creating a new `SnippetVersion`.

*   **Arguments:**
    *   `<file-path>`: The path to the local snippet file. The filename is used to determine the snippet's `Slug`.
*   **Options:**
    *   `-m`, `--message <message>`: **(Required)** A commit message describing the change.
*   **Behavior:**
    *   Reads the file content and calculates its hash.
    *   If the hash matches the latest version in the database, it does nothing.
    *   If the hash is different, it creates a new `SnippetVersion` with the new content and the provided commit message.

#### `janus snippet list`

Lists all available snippets.

#### `janus snippet search "<query>"`

Performs a semantic vector search across all snippets to find conceptually similar ones.

*   **Arguments:**
    *   `<query>`: The text string to search for.

---

### 2. `janus composition`

Commands for managing compositions (recipes for assembling prompts).

#### `janus composition create-version --from-composition <id> | --from-group <name> -m <message>`

Creates a new, immutable `CompositionVersion` by locking in the current state of a composition or group.

*   **Options:**
    *   `--from-composition <id>`: The ID of an existing `CompositionVersion` to use as a base.
    *   `--from-group <name>`: The `Slug` of a `Tag` to use for assembling the composition (includes latest versions of all snippets with that tag).
    *   `-m`, `--message <message>`: **(Required)** A commit message describing the new version.
*   **Behavior:**
    *   Creates a new `CompositionVersion` node in the database with an immutable list of `SnippetVersion` IDs.

#### `janus composition list`

Lists all available abstract `Composition` entities.

---

### 3. `janus parameter`

Commands for managing injectable parameters.

#### `janus parameter create <name> --description "<desc>"`

Defines a new parameter.

#### `janus parameter add-option --parameter-name <name> <value> -m <message>`

Adds a new value option for an existing parameter.

#### `janus parameter list`

Lists all defined parameters.

#### `janus parameter list-options <parameter-name>`

Lists all available `ParameterOption` values for a given parameter.

---

### 4. `janus run`

Commands for executing test runs.

#### `janus run <config-file-path>`

Executes a test suite based on a YAML configuration file.

*   **Arguments:**
    *   `<config-file-path>`: The path to the `test_config.yaml` file.
*   **Behavior:**
    *   Parses the config file.
    *   Creates a permanent `TestRun` entity in the database.
    *   If the config uses declarative composition, it first creates a new, immutable `CompositionVersion`.
    *   Executes the test matrix, making calls to the specified LLMs.
    *   Saves each result as a `DataPoint` linked to the `TestRun`.

#### `janus run list`

Lists all past test runs.

---

### 5. Global Commands

#### `janus export --run-id <id> --output <file-path>`

Exports a complete, self-contained experiment as a single JSON file.

*   **Options:**
    *   `--run-id <id>`: **(Required)** The ID of the `TestRun` to export.
    *   `--output <file-path>`: **(Required)** The path to save the JSON export file.

#### `janus import <file-path> --conflict-namespace <prefix>`

Imports an experiment from a JSON file into the local database.

*   **Arguments:**
    *   `<file-path>`: The path to the JSON export file to import.
*   **Options:**
    *   `--conflict-namespace <prefix>`: **(Required)** A prefix to apply to the IDs of any imported entities that conflict with existing local entities (same ID, different content).
*   **Behavior:**
    *   Safely merges the experiment, logging any conflicts that were resolved using the provided namespace.

---

### `test_config.yaml` Specification

This file defines the matrix of tests to be executed by the `janus run` command.

```yaml
# A human-readable name for this test run. Will be stored on the TestRun entity.
test_run_name: "Q3 Persona Comparison - Formal vs. Informal"

# User-defined metadata for tracking and reporting.
metadata:
  owner: "research-team"
  ticket: "JANUS-42"

# A list of LLMs to run the tests against.
# The engine will run all tests for each LLM listed here.
llms:
  - provider: "anthropic"
    model: "claude-3-opus-20240229"
  - provider: "openai"
    model: "gpt-4o-2024-05-13"

# The list of tests to execute.
tests:
  # Test Case 1: Using a pre-defined, immutable composition.
  - name: "formal_summary_test"
    # Points to a specific CompositionVersion ID. This is the most reproducible method.
    composition_id: "formal-summary-composition-v2"
    # Parameters to inject. The engine will create a test for each value in an array.
    parameters:
      document_source: "file://./data/financial_report.txt"
      # This will generate two DataPoints for this test case (one for each length).
      summary_length: [3, 5]

  # Test Case 2: Using declarative composition to build a prompt on the fly.
  # The CLI will create a new, immutable CompositionVersion from this recipe.
  - name: "informal_persona_test"
    composition:
      # A commit message for the auto-generated CompositionVersion.
      commit_message: "Ad-hoc composition for informal persona test."
      # A list of rules to assemble the prompt.
      rules:
        # Include the latest versions of all snippets tagged with 'informal-persona'.
        - include_group: "informal-persona"
        # But explicitly exclude one of them.
        - exclude_snippet: "formal-greeting"
        # And explicitly include a specific version of another snippet.
        - include_snippet_version: "informal-closing-v3"
    parameters:
      user_name: "Alex"
```