# Neo4j Database Setup for Janus Project

This document describes how to set up and use the Neo4j database integration for the Janus Project.

## Quick Start

1. **Start Neo4j with Docker Compose:**
   ```bash
   docker compose up -d neo4j
   ```

2. **Build the application:**
   ```bash
   pnpm run build
   ```

3. **Run database migrations:**
   ```bash
   node dist/index.js db migrate
   ```

4. **Verify setup:**
   ```bash
   node dist/index.js db status
   ```

## Database Configuration

The Neo4j connection is configured via environment variables:

- `NEO4J_URI` - Connection URI (default: `bolt://localhost:7687`)
- `NEO4J_USERNAME` - Username (default: `neo4j`)
- `NEO4J_PASSWORD` - Password (default: `password`)
- `NEO4J_DATABASE` - Database name (default: `neo4j`)

## Database Access

### Neo4j Browser

Access the Neo4j browser at: http://localhost:7474

**Default credentials:**
- Username: `neo4j`
- Password: `password`

### Bolt Protocol

Direct connection via Bolt protocol: `bolt://localhost:7687`

## Database Schema

The schema implements the domain model with the following node types:

### Nodes
- `Snippet` - Abstract snippet containers
- `SnippetVersion` - Versioned snippet content
- `Composition` - Abstract composition containers  
- `CompositionVersion` - Versioned composition recipes
- `Parameter` - Parameter definitions
- `ParameterOption` - Parameter values
- `TestRun` - Test execution containers
- `DataPoint` - Individual test results
- `Tag` - Categorization labels

### Relationships
- `VERSION_OF` - Links versions to their parent entities
- `PREVIOUS_VERSION` - Creates version history chains
- `DEFINES_PARAMETER` - Links snippets to parameters they use
- `HAS_OPTION` - Links parameters to their possible values
- `DERIVED_FROM` - Tracks composition lineage
- `INCLUDES` - Links compositions to snippet versions (with role/sequence properties)
- `GENERATED` - Links test runs to their data points
- `USING_COMPOSITION` - Links results to the composition used
- `HAS_TAG` - Applies tags to entities

## Database Management Commands

### Initialize Database
```bash
node dist/index.js db init
```

### Run Migrations
```bash
node dist/index.js db migrate
```

### Rollback Migrations
```bash
node dist/index.js db rollback
```

### Check Database Status
```bash
node dist/index.js db status
```

## Development

### Adding New Migrations

1. Create a new migration in `src/db/migrations.ts`:
   ```typescript
   const migration_002_example: Migration = {
     id: "002",
     description: "Example migration",
     up: () => runCypher(`CREATE ...`),
     down: () => runCypher(`DROP ...`)
   }
   ```

2. Add to migrations array:
   ```typescript
   export const migrations: readonly Migration[] = [
     migration_001_constraints,
     migration_002_example
   ]
   ```

### Using the Repository Pattern

The database layer uses the repository pattern with Effect-TS:

```typescript
import { SnippetRepository } from "./db/repositories"
import { Effect } from "effect"

// Example usage
const createSnippetProgram = Effect.gen(function* () {
  const repo = yield* SnippetRepository
  const snippet = createSnippet(slug, description)
  yield* repo.create(snippet)
})
```

## Docker Compose Services

The `docker-compose.yml` includes:

- **Neo4j Community Edition 5.28**
- **APOC plugin** for advanced procedures
- **Persistent volumes** for data, logs, and imports
- **Health checks** and restart policies

## Security Notes

- Default credentials are for development only
- Change credentials in production environments
- Neo4j browser is exposed on port 7474 for development
- Bolt protocol is exposed on port 7687

## Troubleshooting

### Common Issues

1. **Connection refused**: Ensure Neo4j container is running
2. **Authentication failed**: Check username/password
3. **Migration failures**: Check database logs in `docker logs janus-neo4j`

### Useful Cypher Queries

```cypher
// Check all constraints
SHOW CONSTRAINTS

// Check all indexes  
SHOW INDEXES

// Count nodes by type
MATCH (n) RETURN labels(n) as labels, count(n) as count

// Clear all data (development only)
MATCH (n) DETACH DELETE n
```