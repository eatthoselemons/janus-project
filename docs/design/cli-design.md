## The Janus Project: CLI Design Specification

This document outlines the design and functionality of the `janus` command-line interface. The CLI is the primary tool for interacting with the Janus Project's database and running experiments in the Minimum Viable Product (MVP).

### Design Philosophy

The CLI is designed with two core principles:

1.  **Git-like Workflow:** For creating and editing core entities like Content nodes, the CLI mimics the familiar `pull`/`push` cycle of Git. This allows users to leverage their favorite local text editors for content creation while maintaining a structured, versioned history in the database.
2.  **Ephemeral Configuration:** Test execution is initiated by a `test_config.yaml` file. This file is treated as a temporary script or recipe. The CLI uses it to create permanent, immutable entities (like `TestCase` and `TestRun`) in the database, which then become the persistent record of the experiment.

### Command Structure

The CLI follows a `noun verb` structure (e.g., `janus content pull`).

---

### 1. `janus content`

Commands for managing unified content nodes in the content tree.

#### `janus content pull <content-name>`

Downloads the latest version of a content node from the database to a local file.

- **Arguments:**
  - `<content-name>`: The `Slug` of the content node to pull.
- **Behavior:**
  - Creates a file in a local `janus_workspace/` directory named `<content-name>.txt`.
  - If the file already exists, it will be overwritten.

#### `janus content push <file-path> -m <message>`

Pushes changes from a local file to the database, creating a new `ContentNodeVersion`.

- **Arguments:**
  - `<file-path>`: The path to the local content file. The filename is used to determine the content node's `Slug`.
- **Options:**
  - `-m`, `--message <message>`: **(Required)** A commit message describing the change.
- **Behavior:**
  - Reads the file content and calculates its hash.
  - If the hash matches the latest version in the database, it does nothing.
  - If the hash is different, it creates a new `ContentNodeVersion` with the new content and the provided commit message.

#### `janus content list`

Lists all available content nodes.

#### `janus content search "<query>"`

Performs a semantic vector search across all content nodes to find conceptually similar ones.

- **Arguments:**
  - `<query>`: The text string to search for.

#### `janus content tag <content-name> <tag-name>`

Applies a tag to a content node for organization and filtering.

- **Arguments:**
  - `<content-name>`: The `Slug` of the content node to tag.
  - `<tag-name>`: The `Slug` of the tag to apply.

---

### 2. `janus test-case`

Commands for managing test cases (conversation structures for LLM prompts).

#### `janus test-case create <name> --model <llm-model>`

Creates a new test case that defines a conversation structure.

- **Arguments:**
  - `<name>`: The name of the test case.
- **Options:**
  - `--model <llm-model>`: **(Required)** The LLM model this test case is designed for (e.g., 'gpt-4', 'claude-3').
  - `--description <desc>`: Optional description of the test case purpose.

#### `janus test-case add-slot <test-case-name> --role <role> --tags <tags> --sequence <number>`

Adds a message slot to a test case.

- **Arguments:**
  - `<test-case-name>`: The name of the test case to modify.
- **Options:**
  - `--role <role>`: **(Required)** The role for this slot ('system', 'user', or 'assistant').
  - `--tags <tags>`: Comma-separated list of tags to filter content.
  - `--sequence <number>`: **(Required)** The order of this slot in the conversation.
  - `--include <nodes>`: Comma-separated list of specific content nodes to include.
  - `--exclude <nodes>`: Comma-separated list of specific content nodes to exclude.

#### `janus test-case list`

Lists all available test cases.

#### `janus test-case build <test-case-name>`

Previews the conversation that would be built from a test case.

- **Arguments:**
  - `<test-case-name>`: The name of the test case to preview.

---

### 3. `janus tag`

Commands for managing tags used to organize and filter content.

#### `janus tag create <name>`

Creates a new tag.

- **Arguments:**
  - `<name>`: The `Slug` of the tag to create.

#### `janus tag list`

Lists all available tags.

#### `janus tag search "<query>"`

Searches for tags matching the query.

- **Arguments:**
  - `<query>`: The text to search for in tag names.

---

### 4. `janus run`

Commands for executing test runs.

#### `janus run <config-file-path>`

Executes a test suite based on a YAML configuration file.

- **Arguments:**
  - `<config-file-path>`: The path to the `test_config.yaml` file.
- **Behavior:**
  - Parses the config file.
  - Creates a permanent `TestRun` entity in the database.
  - Executes the specified test cases by building conversations from the content tree.
  - Executes the test matrix, making calls to the specified LLMs.
  - Saves each result as a `DataPoint` linked to the `TestRun`.

#### `janus run list`

Lists all past test runs.

---

### 5. Global Commands

#### `janus export --run-id <id> --output <file-path>`

Exports a complete, self-contained experiment as a single JSON file.

- **Options:**
  - `--run-id <id>`: **(Required)** The ID of the `TestRun` to export.
  - `--output <file-path>`: **(Required)** The path to save the JSON export file.

#### `janus import <file-path> --conflict-namespace <prefix>`

Imports an experiment from a JSON file into the local database.

- **Arguments:**
  - `<file-path>`: The path to the JSON export file to import.
- **Options:**
  - `--conflict-namespace <prefix>`: **(Required)** A prefix to apply to the IDs of any imported entities that conflict with existing local entities (same ID, different content).
- **Behavior:**
  - Safely merges the experiment, logging any conflicts that were resolved using the provided namespace.

---

### `test_config.yaml` Specification

This file defines the matrix of tests to be executed by the `janus run` command.

```yaml
# A human-readable name for this test run. Will be stored on the TestRun entity.
test_run_name: 'Q3 Persona Comparison - Formal vs. Informal'

# User-defined metadata for tracking and reporting.
metadata:
  owner: 'research-team'
  ticket: 'JANUS-42'

# A list of LLMs to run the tests against.
# The engine will run all tests for each LLM listed here.
llms:
  - provider: 'anthropic'
    model: 'claude-3-opus-20240229'
  - provider: 'openai'
    model: 'gpt-4o-2024-05-13'

# The list of tests to execute.
tests:
  # Test Case 1: Using a pre-defined test case.
  - name: 'formal_summary_test'
    # References a TestCase that defines the conversation structure.
    test_case_name: 'formal-summary-v2'
    # Parameters to inject. The engine will create a test for each value in an array.
    parameters:
      document_source: 'file://./data/financial_report.txt'
      # This will generate two DataPoints for this test case (one for each length).
      summary_length: [3, 5]

  # Test Case 2: Using inline test case definition.
  - name: 'informal_persona_test'
    test_case:
      # Define the conversation structure inline.
      description: 'Informal persona with friendly tone'
      message_slots:
        - role: 'system'
          tags: ['informal-persona', 'friendly']
          sequence: 0
        - role: 'user'
          tags: ['greeting']
          exclude: ['formal-greeting']
          sequence: 1
        - role: 'assistant'
          tags: ['response']
          sequence: 2
    parameters:
      user_name: 'Alex'
```
