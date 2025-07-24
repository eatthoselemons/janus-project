# janus-project

About The Janus Project

The Janus Project is named for the two-faced Roman god of doorways, transitions, and duality. Janus looks to the past and the future simultaneously.
In the same spirit, this framework is designed to look in two directions: at the human-crafted prompt (the past) and the emergent, generated response (the future). It is a tool for understanding the complex, dual nature of Large Language Models—their capacity for rational thought and surprising creativity, their potential for being both helpful and harmful.
Our mission is to provide an open-source loom for researchers, red-teamers, and philosophers to weave and test these new threads of cognition. We aim to foster a deeper, more empathetic understanding of the minds we are building, and to empower them to be their most beneficial and resilient selves.

## Configuration

The application requires the following environment variables:

### Neo4j Database

- `NEO4J_URI` - Neo4j connection URI (e.g., `bolt://localhost:7687`)
- `NEO4J_USER` - Neo4j username
- `NEO4J_PASSWORD` - Neo4j password (stored securely as redacted value)

### LLM Providers

Configure LLM providers by editing `config/llm-providers.txt` and adding one provider name per line:

```txt
# config/llm-providers.txt
openai
anthropic
custom
```

Then set the environment variables for each provider you listed:

**Note**: You can override the config file by setting the `LLM_PROVIDERS` environment variable:

```bash
export LLM_PROVIDERS="openai,anthropic,custom"
```

#### OpenAI

- `LLM_OPENAI_API_KEY` - OpenAI API key (stored securely as redacted value)
- `LLM_OPENAI_BASE_URL` - Base URL for OpenAI API (e.g., `https://api.openai.com/v1`)
- `LLM_OPENAI_MODEL` - Model to use (e.g., `gpt-4`, `gpt-3.5-turbo`)

#### Anthropic

- `LLM_ANTHROPIC_API_KEY` - Anthropic API key (stored securely as redacted value)
- `LLM_ANTHROPIC_BASE_URL` - Base URL for Anthropic API (e.g., `https://api.anthropic.com`)
- `LLM_ANTHROPIC_MODEL` - Model to use (e.g., `claude-3-opus`, `claude-3-sonnet`)

#### Azure OpenAI

- `LLM_AZURE_API_KEY` - Azure OpenAI API key (stored securely as redacted value)
- `LLM_AZURE_BASE_URL` - Base URL for Azure OpenAI (e.g., `https://myresource.openai.azure.com`)
- `LLM_AZURE_MODEL` - Model to use (e.g., `gpt-4-turbo`, `gpt-35-turbo`)

#### Google Vertex AI

- `LLM_GOOGLE_API_KEY` - Google Vertex AI API key (stored securely as redacted value)
- `LLM_GOOGLE_BASE_URL` - Base URL for Google Vertex AI (e.g., `https://vertex-ai.googleapis.com`)
- `LLM_GOOGLE_MODEL` - Model to use (e.g., `gemini-pro`, `gemini-1.5-turbo`)

#### Custom Providers

You can add any custom provider by following the naming convention:

- `LLM_<PROVIDER>_API_KEY` - API key (required)
- `LLM_<PROVIDER>_BASE_URL` - Base URL (required)
- `LLM_<PROVIDER>_MODEL` - Model to use (required)

Example for a custom provider called "mycorp":

```bash
LLM_MYCORP_API_KEY=my-api-key
LLM_MYCORP_BASE_URL=https://api.mycorp.com/v1
LLM_MYCORP_MODEL=mycorp-large
```

## CLI Usage

The Janus CLI provides commands for managing snippets from the command line.

### Installation

After building the project, you can use the CLI via npm scripts or install it globally:

```bash
# Using npm scripts
pnpm run build
node dist/cli/bin.js snippet --help

# Or install globally (from project root)
npm link
janus snippet --help
```

### Snippet Commands

#### List all snippets

```bash
janus snippet list
```

Displays all snippets in a formatted table with name, description, and ID.

#### Search snippets

```bash
janus snippet search "query"
```

Search for snippets by name or description (case-insensitive).

#### Pull a snippet

```bash
janus snippet pull <snippet-name>
```

Downloads a snippet's latest version to a local file named `<snippet-name>.snippet`.

Example:

```bash
janus snippet pull auth-check
# Creates: auth-check.snippet
```

#### Push a snippet

```bash
janus snippet push <file-path> -m "commit message"
```

Creates a new snippet or updates an existing one from a local file.

Examples:

```bash
# Create new snippet from file
janus snippet push my-template.snippet -m "Initial version"

# Update existing snippet
janus snippet pull auth-check
# ... edit auth-check.snippet ...
janus snippet push auth-check.snippet -m "Add role-based checks"

# Works with any file extension
janus snippet push script.js -m "Add utility script"
```

The snippet name is derived from the filename (without extension).

### Generating CLI Documentation

The CLI documentation can be auto-generated from the command definitions:

```bash
# Generate CLI documentation
pnpm run docs:cli
```

This creates/updates `docs/cli-commands.md` with the current command structure. Run this whenever you add or modify CLI commands to keep the documentation in sync.

For more detailed CLI documentation, see:
- `docs/cli-reference.md` - Comprehensive manual with examples
- `docs/cli-commands.md` - Auto-generated command reference

## Development

### Building the Project

```bash
pnpm install
pnpm run build
```

### Running Tests

```bash
pnpm test
```

### Code Quality

Run the full preflight check before committing:

```bash
pnpm run preflight
```

This runs:
1. Code formatting (Prettier)
2. Linting (ESLint)
3. TypeScript compilation
4. All tests

### Adding New CLI Commands

1. Create your command in `src/cli/`
2. Add it to the appropriate command group
3. Write tests in `src/cli/*/tests/`
4. Update documentation:
   ```bash
   pnpm run docs:cli
   ```
5. Update the manual documentation if needed in `docs/cli-reference.md`

### Available Scripts

- `pnpm run build` - Compile TypeScript
- `pnpm run test` - Run all tests
- `pnpm run lint` - Run ESLint
- `pnpm run format` - Format code with Prettier
- `pnpm run preflight` - Run all checks
- `pnpm run docs:cli` - Generate CLI documentation
