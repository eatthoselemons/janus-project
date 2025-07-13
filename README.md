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

Configure one or more LLM providers:

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
