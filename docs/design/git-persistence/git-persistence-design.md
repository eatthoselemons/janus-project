# Git Persistence Layer Design

## Overview

The Git persistence layer provides a file-based alternative to the Neo4j persistence implementation, optimized for human readability and manual editing while leveraging Git's native versioning capabilities.

## Design Principles

1. **Human-Readable Content**: Primary content stored in Markdown for easy reading and editing
2. **Minimal System Files**: Reduce machine-managed files to essentials
3. **Git-Native Versioning**: Use Git commits as the versioning mechanism - no separate version files
4. **User-Friendly Composition**: Simple syntax for includes and concatenation
5. **Effect-TS Compliance**: Full compatibility with existing Effect-TS service interfaces

## Architecture

### File Structure

```
project-root/
├── .janus/                      # Hidden directory for system files (minimal)
│   ├── indexes.json            # ID mappings and search indexes
│   └── experiments/            # Experiment data
│       ├── test-runs.json      # Test run metadata (TestRun)
│       └── data-points.json    # Test results (DataPoint)
│
├── content/                    # Human-editable content nodes
│   ├── nodes/                  # Content nodes
│   │   ├── getting-started.md  # Simple content node
│   │   ├── advanced-topics/    # Directory = auto-concatenate all .md files
│   │   │   ├── 01-overview.md  # Numbered for ordering
│   │   │   ├── 02-concepts.md
│   │   │   └── 03-examples.md
│   │   └── templates/
│   │       ├── tutorial.md     # Template node
│   │       └── reference.md
│   └── inserts/                # Insert definitions
│       └── inserts.yaml        # All insert mappings in one file
│
└── test-cases/                 # Test case definitions (YAML format)
    ├── basic-tutorial.yaml
    └── advanced-test.yaml
```

## File Formats

### Content Files (Human-Editable)

#### Simple Content Node (`content/nodes/getting-started.md`)
```markdown
---
description: An introduction to the Janus project
tags: [tutorial, beginner]  # Tag names (slugs) - no separate tag files needed
---

# Getting Started

Your content here...

## Section 1

More content...
```

#### Composite Node - Auto-Concatenate Directory

Any directory automatically concatenates all its `.md` files in alphabetical order:

`content/nodes/advanced-topics/01-overview.md`:
```markdown
---
description: Overview section
---

# Overview

This content will be concatenated first...
```

`content/nodes/advanced-topics/02-concepts.md`:
```markdown
# Core Concepts

This content will be concatenated second...
```

The directory `advanced-topics` becomes a node that concatenates all files in order.

#### Insert Definitions (`content/inserts/inserts.yaml`)

All insert mappings in a single file for simplicity:

```yaml
# Insert definitions - maps nodes to their insert points and values
inserts:
  # Node that will receive the inserts
  - node: welcome-message
    inserts:
      - key: greeting
        values:
          - welcome
          - hello
          - hi
      - key: closing
        values:
          - goodbye
          - see-you
  
  - node: tutorial-template
    inserts:
      - key: prerequisites
        values:
          - basic-setup
          - environment-check
      - key: examples
        values:
          - example-basic
          - example-advanced
```

#### Node with Insert Points (`content/nodes/templates/tutorial.md`)
```markdown
---
description: Tutorial template with insertion points
tags: [template]
---

# Tutorial

## Prerequisites

{{insert:prerequisites}}

## Main Content

Core tutorial content here...

## Examples

{{insert:examples}}

## Summary

Conclusion here...
```

### System Files (Machine-Managed)

#### Indexes and ID Mappings (`.janus/indexes.json`)
```json
{
  "nodes": {
    "getting-started": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "path": "content/nodes/getting-started.md",
      "type": "content"
    },
    "full-guide": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "path": "content/nodes/full-guide/_index.md",
      "type": "concatenate"
    },
    "templates/base": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "path": "content/nodes/templates/_index.md",
      "type": "template"
    }
  },
  "tags": {
    "tutorial": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "description": "Tutorial content",
      "nodes": ["getting-started", "full-guide"]
    },
    "template": {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "description": "Reusable templates",
      "nodes": ["templates/base"]
    }
  }
}
```

#### Test Cases (`test-cases/basic-tutorial.yaml`)

Test cases are stored as YAML files for better readability:

```yaml
# Test case definition - no createdAt needed (use Git timestamp)
id: aa0e8400-e29b-41d4-a716-446655440005
name: Basic Tutorial Test
description: Test the tutorial flow with different models
llmModel: gpt-4  # Note: Consider updating type to support list for A/B testing
# llmModels: [gpt-4, claude-3]  # Future: support multiple models
messageSlots:
  - role: system
    tags: [tutorial]
    sequence: 0
  - role: user
    includeNodes: [getting-started]
    sequence: 1
  - role: assistant
    tags: [response, tutorial]
    sequence: 2
parameters:  # Optional test parameters
  temperature: 0.7
  max_tokens: 1000
```

**Note on llmModel**: Currently the TestCase type defines `llmModel` as a single LLMModel. For A/B testing scenarios, this should be updated to `llmModels: Schema.Array(LLMModel)` to support testing with multiple models.

**Note on createdAt**: The TestCase type includes `createdAt: Schema.DateTimeUtc`, but in the Git persistence layer this should come from the Git commit timestamp when the file was created, not be manually specified.

## Versioning Strategy

### Git-Native Versioning

Since Git already provides complete version history, we don't need separate version files:

1. **Each commit is a version**: Git commits naturally represent ContentNodeVersions
2. **Commit message as version description**: Maps to `ContentNodeVersion.commitMessage`
3. **Git timestamp as createdAt**: Use Git commit timestamp
4. **Content retrieval from history**: `git show <commit>:path/to/file.md`

### Version Operations

#### Creating a Version (Implicit)
```typescript
// When content changes, it's automatically versioned by Git
const updateNode = (nodeSlug: Slug, content: string) =>
  Effect.gen(function* () {
    // 1. Update content file
    yield* writeContentFile(nodeSlug, content);
    
    // 2. Update indexes if needed
    yield* updateIndexes(nodeSlug);
    
    // 3. Git commit creates the version
    yield* gitCommit(`Update node: ${nodeSlug}`);
  });
```

#### Retrieving Version History
```typescript
// Get versions from Git history
const getNodeVersions = (nodeSlug: Slug) =>
  Effect.gen(function* () {
    const nodePath = yield* getNodePath(nodeSlug);
    
    // Use git log to get all versions
    const gitHistory = yield* gitLog(nodePath);
    
    return gitHistory.map(commit => ({
      id: commit.hash as ContentNodeVersionId,
      createdAt: commit.date,
      commitMessage: commit.message,
      content: undefined  // Load on demand
    }));
  });

// Get specific version content
const getVersionContent = (nodeSlug: Slug, versionId: string) =>
  Effect.gen(function* () {
    const nodePath = yield* getNodePath(nodeSlug);
    return yield* gitShow(versionId, nodePath);
  });
```

## Processing Relationships

### Simplified Processing Model

The Git persistence layer uses two simple rules:

1. **Directories = Concatenation**: Any directory automatically concatenates all `.md` files
2. **Inserts = Explicit Mapping**: Insert operations defined in `content/inserts/inserts.yaml`

```typescript
// Process directory nodes (auto-concatenate)
const processDirectoryNode = (nodePath: string) =>
  Effect.gen(function* () {
    const files = yield* listMarkdownFiles(nodePath);
    
    // Sort files alphabetically (respects numbering like 01-, 02-)
    const sortedFiles = files.sort();
    
    // Read and concatenate all files
    const contents = yield* Effect.forEach(
      sortedFiles,
      (file) => readFile(file)
    );
    
    return contents.join('\n\n');
  });

// Process insert operations from central inserts.yaml
const processInserts = (nodeName: string, content: string) =>
  Effect.gen(function* () {
    const insertsConfig = yield* readInsertsConfig();
    const nodeInserts = insertsConfig.inserts.find(i => i.node === nodeName);
    
    if (!nodeInserts) return content;
    
    let processedContent = content;
    for (const insert of nodeInserts.inserts) {
      const placeholder = `{{insert:${insert.key}}}`;
      const values = insert.values.join('\n\n');
      processedContent = processedContent.replace(placeholder, values);
    }
    
    return processedContent;
  });
```

## Tag Management

Tags are now fully integrated into node metadata:

1. **No separate tag files**: Tags defined inline in node frontmatter
2. **Automatic tag registry**: System builds tag index from node metadata
3. **Tag descriptions**: Inferred from first use or maintained in indexes.json

```typescript
// Build tag index from all nodes
const buildTagIndex = () =>
  Effect.gen(function* () {
    const nodes = yield* getAllNodes();
    const tagMap = new Map<string, Set<string>>();
    
    for (const node of nodes) {
      const metadata = yield* parseNodeMetadata(node);
      for (const tag of metadata.tags || []) {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, new Set());
        }
        tagMap.get(tag)!.add(node.slug);
      }
    }
    
    return tagMap;
  });
```

## Implementation Mapping

### Service Interface Compatibility

The Git persistence layer implements the actual `PersistenceServiceImpl` interface:

```typescript
interface PersistenceServiceImpl {
  // ContentNode operations
  readonly findNodeByName: (name: Slug) => 
    Effect<ContentNode, NotFoundError | PersistenceError>
  
  readonly createNode: (nodeData: Omit<ContentNode, 'id'>) => 
    Effect<ContentNode, PersistenceError>
  
  readonly listNodes: () => 
    Effect<readonly ContentNode[], PersistenceError>
  
  // Version operations (Git-based)
  readonly addVersion: (nodeId: string, versionData: Omit<ContentNodeVersion, 'id' | 'createdAt'>) => 
    Effect<ContentNodeVersion, PersistenceError | NotFoundError>
  
  readonly getLatestVersion: (nodeId: string) => 
    Effect<Option<ContentNodeVersion>, PersistenceError>
  
  // Tag operations (extracted from node metadata)
  readonly createTag: (tagData: Omit<Tag, 'id'>) => 
    Effect<Tag, PersistenceError>
  
  readonly findTagByName: (name: Slug) => 
    Effect<Tag, NotFoundError | PersistenceError>
  
  readonly listTags: () => 
    Effect<readonly Tag[], PersistenceError>
  
  readonly tagNode: (nodeId: string, tagId: string) => 
    Effect<void, PersistenceError | NotFoundError>
}
```

**Note**: The Git implementation derives much of its data from the file system and Git history rather than storing it explicitly. For example:
- `addVersion`: Creates a Git commit rather than a database record
- `getLatestVersion`: Reads from Git HEAD for the file
- Tags are extracted from node metadata rather than stored separately

## Key Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Tags | Inline in node metadata | No separate files to maintain |
| Versions | Git history only | Git already provides this |
| Timestamps | From Git commits | No manual createdAt fields |
| Concatenation | Automatic for directories | Simple convention, no config needed |
| Inserts | Single inserts.yaml file | Explicit but centralized |
| Test Cases | YAML in test-cases/ root | Separate from content, human-editable |
| File naming | Alphabetical ordering | Use 01-, 02- prefixes for control |
| Complexity | Minimal for Git, full for Neo4j | Trade simplicity for power |

## Example Workflows

### Creating a Simple Node
```bash
# Create content file
cat > content/nodes/my-tutorial.md << 'EOF'
---
description: My awesome tutorial
tags: [tutorial, beginner]
---

# My Tutorial

Content goes here...
EOF

# Commit to create version
git add content/nodes/my-tutorial.md
git commit -m "Add my-tutorial node"
```

### Creating a Composite Node (Auto-Concatenate)
```bash
# Create directory with numbered files for ordering
mkdir content/nodes/complete-guide

# Add component files (numbered for order)
cat > content/nodes/complete-guide/01-intro.md << 'EOF'
---
description: Introduction section
---

# Introduction

This is the first section...
EOF

cat > content/nodes/complete-guide/02-overview.md << 'EOF'
# Overview

This is the second section...
EOF

cat > content/nodes/complete-guide/03-examples.md << 'EOF'
# Examples

This is the third section...
EOF

# Commit - directory automatically becomes concatenated node
git add content/nodes/complete-guide/
git commit -m "Create complete guide composite"
```

### Adding Insert Operations
```bash
# Edit the inserts.yaml file
cat >> content/inserts/inserts.yaml << 'EOF'
  - node: complete-guide/02-overview
    inserts:
      - key: warning
        values:
          - "⚠️ Important: Read prerequisites first"
      - key: tips
        values:
          - "💡 Tip: Use keyboard shortcuts"
          - "💡 Tip: Check the documentation"
EOF

# Update the file to include insert placeholders
# In content/nodes/complete-guide/02-overview.md:
# Add {{insert:warning}} and {{insert:tips}} where needed

git add content/inserts/inserts.yaml
git commit -m "Add insert points to complete guide"
```

### Viewing Version History
```bash
# See all versions of a node
git log --oneline content/nodes/getting-started.md

# View specific version
git show abc123:content/nodes/getting-started.md

# Diff between versions
git diff abc123..def456 content/nodes/getting-started.md
```

## Migration Considerations

### From Current Design to Simplified Design

1. **Merge metadata files**: Combine separate meta.yaml into markdown frontmatter
2. **Remove version files**: Delete versions.json, rely on Git
3. **Consolidate tags**: Extract from all nodes, build tag index
4. **Update paths**: Adjust for single-file nodes vs directories

### Backward Compatibility

Support both formats during transition:
- Check for `_index.md` first (new format)
- Fall back to `content.md` + `meta.yaml` (old format)
- Gradually migrate on write operations

## Trade-offs: Git vs Neo4j

### Git Persistence Layer
**Best for:**
- Small to medium projects (< 1000 nodes)
- Human editing and review
- Simple deployment (no database)
- Version control integration

**Limitations:**
- Basic insert operations only
- No complex graph queries
- Manual file organization
- Limited performance at scale

### Neo4j Persistence Layer
**Best for:**
- Large projects (> 1000 nodes)
- Complex relationship graphs
- Full insert/concatenate flexibility
- High-performance queries

**Trade-off:**
- Requires database setup
- Not human-editable
- More complex deployment

## Summary

This simplified Git persistence design follows the principle: **"Convention over configuration"**

- **Directories automatically concatenate** - no configuration needed
- **Inserts are explicit** - all in one file for clarity
- **Git handles versioning** - no duplicate version tracking
- **Tags are inline** - no separate tag files
- **Simple beats complex** - if you need full power, use Neo4j

The design makes the common case (concatenation) automatic while keeping the complex case (inserts) possible but explicit. This provides a smooth upgrade path: start with Git for simplicity, migrate to Neo4j when you need more power.