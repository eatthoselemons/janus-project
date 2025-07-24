# Janus CLI Reference

This document provides a comprehensive reference for all Janus CLI commands.

## Installation

```bash
# Build the project
pnpm run build

# Option 1: Run directly
node dist/cli/bin.js <command>

# Option 2: Install globally
npm link
janus <command>
```

## Environment Requirements

The CLI requires a running Neo4j instance. Set these environment variables:

```bash
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=password
```

Or source the provided script:
```bash
source ~/start-coding.sh
```

## Commands

### `janus snippet`

Manage code snippets in the database.

#### Subcommands

##### `janus snippet list`

List all snippets in the database.

**Usage:**
```bash
janus snippet list
```

**Output:**
- Displays a formatted table with columns: Name, Description, ID
- Shows "No snippets found" if database is empty

**Example:**
```
Snippets:
────────────────────────────────────────────────────────────────────────────────
Name            Description                     ID
────────────────────────────────────────────────────────────────────────────────
auth-check      Authentication check snippet    550e8400-e29b-41d4-a716-446655440001
logger          Logging utility snippet         550e8400-e29b-41d4-a716-446655440002
```

##### `janus snippet search <query>`

Search for snippets by name or description.

**Usage:**
```bash
janus snippet search "auth"
```

**Arguments:**
- `query` (required): Search term to match against snippet names and descriptions (case-insensitive)

**Output:**
- Displays matching snippets in same format as `list`
- Shows count of matches found
- Shows "No snippets found matching" if no results

**Example:**
```
Found 2 snippet(s) matching "auth":
────────────────────────────────────────────────────────────────────────────────
Name            Description                     ID
────────────────────────────────────────────────────────────────────────────────
auth-check      Authentication check snippet    550e8400-e29b-41d4-a716-446655440001
auth-token      Token validation snippet        550e8400-e29b-41d4-a716-446655440002
```

##### `janus snippet pull <snippet-name>`

Download a snippet's latest version to a local file.

**Usage:**
```bash
janus snippet pull auth-check
```

**Arguments:**
- `snippet-name` (required): Name of the snippet to download

**Output:**
- Creates a file named `<snippet-name>.snippet` in current directory
- Shows success message with filename
- Shows error if snippet not found or has no versions

**Example:**
```bash
$ janus snippet pull auth-check
✓ Pulled snippet 'auth-check' to auth-check.snippet
```

##### `janus snippet push <file-path> -m <message>`

Create a new snippet or update an existing one from a local file.

**Usage:**
```bash
janus snippet push my-template.snippet -m "Initial version"
```

**Arguments:**
- `file-path` (required): Path to file containing snippet content
- `-m, --message` (required): Commit message describing the changes

**Behavior:**
- Extracts snippet name from filename (without extension)
- Creates new snippet if name doesn't exist
- Adds new version if snippet already exists
- Works with any file extension

**Examples:**
```bash
# Create new snippet
$ janus snippet push my-template.snippet -m "Initial version"
Creating new snippet 'my-template'...
✓ Created snippet 'my-template' and pushed initial version

# Update existing snippet
$ janus snippet push auth-check.snippet -m "Add role-based checks"
✓ Updated snippet 'auth-check' with new version

# Push from non-.snippet file
$ janus snippet push utils.js -m "Add utility functions"
Creating new snippet 'utils'...
✓ Created snippet 'utils' and pushed initial version
```

## Error Handling

All commands handle common errors gracefully:

- **Database connection errors**: Check Neo4j is running and environment variables are set
- **Not found errors**: Verify the snippet name exists (use `list` command)
- **File system errors**: Check file permissions and paths
- **Validation errors**: Ensure snippet names use only lowercase letters, numbers, and hyphens

## Troubleshooting

### Command not found

If `janus` command is not found after `npm link`:
```bash
# Check npm bin directory is in PATH
echo $PATH | grep -q "$(npm bin -g)" || echo "Add $(npm bin -g) to PATH"
```

### Database connection issues

```bash
# Check Neo4j is running
docker ps | grep neo4j

# Test connection
curl -u neo4j:password http://localhost:7474
```

### Missing environment variables

```bash
# Check required vars
env | grep NEO4J

# Set manually if needed
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=password
```