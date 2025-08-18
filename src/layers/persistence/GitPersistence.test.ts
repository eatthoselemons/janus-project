import { describe, it, expect } from '@effect/vitest';
import { Effect, Option } from 'effect';
import { PersistenceService } from '../../services/persistence/Persistence.service';
import { GitPersistenceLive } from './GitPersistence.layer';
import { FileSystemStorageService } from '../../services/low-level/FileSystemStorage.service';
import { Slug } from '../../domain/types/branded';
import { NotFoundError } from '../../domain/types/errors';
import { createMockFileSystemStorageLayer } from './test/MockFileSystemStorage.layer';

// # Reason: Helper to create mock layer with initial files
const createMockLayer = (initialFiles?: Map<string, string>) =>
  createMockFileSystemStorageLayer(initialFiles);

describe('GitPersistence Layer', () => {
  describe('Node Operations', () => {
    it.effect('should create a new content node with markdown format', () =>
      Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;

        const name = 'test-node' as Slug;
        const description = 'Test node description';

        const node = yield* persistence.createNode({ name, description });

        expect(node.name).toBe(name);
        expect(node.description).toBe(description);
        expect(node.id).toBeDefined();

        // # Reason: Check that markdown file was created with frontmatter
        const fileContent = yield* storage.readFile(
          'content/nodes/test-node.md',
        );
        expect(fileContent).toBeDefined();
        expect(fileContent).toContain('---');
        expect(fileContent).toContain('description: Test node description');

        // # Reason: Check that indexes were updated
        const indexContent = yield* storage.readFile('.janus/indexes.json');
        expect(indexContent).toBeDefined();
        const indexes = JSON.parse(indexContent);
        expect(indexes.nodes['test-node']).toBeDefined();
        expect(indexes.nodes['test-node'].path).toBe(
          'content/nodes/test-node.md',
        );
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer()),
      ),
    );

    it.effect('should find an existing node by name', () => {
      // # Reason: Set up existing node file
      const initialFiles = new Map<string, string>();
      initialFiles.set(
        'content/nodes/existing-node.md',
        `---
description: Existing node
tags: [test, sample]
---

# Existing Node Content

This is the content of the existing node.`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'existing-node': {
              id: '123e4567-e89b-42d3-a456-426614174000',
              path: 'content/nodes/existing-node.md',
              type: 'content',
            },
          },
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const node = yield* persistence.findNodeByName('existing-node' as Slug);

        expect(node.name).toBe('existing-node');
        expect(node.description).toBe('Existing node');
        expect(node.id).toBe('123e4567-e89b-42d3-a456-426614174000');
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should return NotFoundError for non-existent node', () => {
      const initialFiles = new Map<string, string>();
      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {},
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const result = yield* Effect.either(
          persistence.findNodeByName('non-existent' as Slug),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(NotFoundError);
          expect(result.left.entityType).toBe('content node');
        }
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should list all nodes', () => {
      // # Reason: Set up multiple nodes
      const initialFiles = new Map<string, string>();
      initialFiles.set(
        'content/nodes/node1.md',
        `---
description: Node 1
---

Content 1`,
      );

      initialFiles.set(
        'content/nodes/node2.md',
        `---
description: Node 2
---

Content 2`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            node1: {
              id: 'id1',
              path: 'content/nodes/node1.md',
              type: 'content',
            },
            node2: {
              id: 'id2',
              path: 'content/nodes/node2.md',
              type: 'content',
            },
          },
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const nodes = yield* persistence.listNodes();

        expect(nodes).toHaveLength(2);
        expect(nodes.map((n) => n.name)).toContain('node1');
        expect(nodes.map((n) => n.name)).toContain('node2');
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });
  });

  describe('Version Operations', () => {
    it.effect('should add a version to an existing node', () => {
      // # Reason: Set up existing node
      const initialFiles = new Map<string, string>();
      initialFiles.set(
        'content/nodes/versioned-node.md',
        `---
description: Versioned node
---

Initial content`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'versioned-node': {
              id: 'node-id-123',
              path: 'content/nodes/versioned-node.md',
              type: 'content',
            },
          },
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;
        const version = yield* persistence.addVersion('node-id-123', {
          content: 'Updated content for version 2',
          commitMessage: 'Update node content',
        });

        expect(version.content).toBe('Updated content for version 2');
        expect(version.commitMessage).toBe('Update node content');
        expect(version.id).toBeDefined();
        expect(version.createdAt).toBeDefined();

        // # Reason: Check that file was updated
        const fileContent = yield* storage.readFile(
          'content/nodes/versioned-node.md',
        );
        expect(fileContent).toContain('Updated content for version 2');
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should get the latest version of a node', () => {
      // # Reason: Set up node with content
      const initialFiles = new Map<string, string>();
      initialFiles.set(
        'content/nodes/test-node.md',
        `---
description: Test node
---

Current version content`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'test-node': {
              id: 'node-id-456',
              path: 'content/nodes/test-node.md',
              type: 'content',
            },
          },
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const versionOption =
          yield* persistence.getLatestVersion('node-id-456');

        expect(Option.isSome(versionOption)).toBe(true);
        if (Option.isSome(versionOption)) {
          const version = versionOption.value;
          expect(version.content).toBe('Current version content');
          expect(version.commitMessage).toBe('Current version');
        }
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });
  });

  describe('Tag Operations', () => {
    it.effect('should create a new tag', () => {
      const initialFiles = new Map<string, string>();
      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {},
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;
        const tag = yield* persistence.createTag({
          name: 'new-tag' as Slug,
          description: 'A new tag for testing',
        });

        expect(tag.name).toBe('new-tag');
        expect(tag.description).toBe('A new tag for testing');
        expect(tag.id).toBeDefined();

        // # Reason: Check indexes were updated
        const indexContent = yield* storage.readFile('.janus/indexes.json');
        const indexes = JSON.parse(indexContent);
        expect(indexes.tags['new-tag']).toBeDefined();
        expect(indexes.tags['new-tag'].description).toBe(
          'A new tag for testing',
        );
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should find a tag by name from indexes', () => {
      const initialFiles = new Map<string, string>();
      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {},
          tags: {
            'existing-tag': {
              id: 'tag-id-123',
              description: 'An existing tag',
              nodes: ['node1', 'node2'],
            },
          },
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const tag = yield* persistence.findTagByName('existing-tag');

        expect(tag.name).toBe('existing-tag');
        expect(tag.description).toBe('An existing tag');
        expect(tag.id).toBe('tag-id-123');
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should find a tag by name from node metadata', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: Set up node with tags in frontmatter
      initialFiles.set(
        'content/nodes/tagged-node.md',
        `---
description: Tagged node
tags: [implicit-tag, another-tag]
---

Content`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'tagged-node': {
              id: 'node-id-123',
              path: 'content/nodes/tagged-node.md',
              type: 'content',
            },
          },
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const tag = yield* persistence.findTagByName('implicit-tag');

        expect(tag.name).toBe('implicit-tag');
        expect(tag.description).toBe('Tag: implicit-tag');
        expect(tag.id).toBeDefined();
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should list all tags from both indexes and nodes', () => {
      const initialFiles = new Map<string, string>();

      initialFiles.set(
        'content/nodes/node-with-tags.md',
        `---
description: Node with tags
tags: [from-node, shared-tag]
---

Content`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'node-with-tags': {
              id: 'node-id',
              path: 'content/nodes/node-with-tags.md',
              type: 'content',
            },
          },
          tags: {
            'from-index': {
              id: 'index-tag-id',
              description: 'Tag from index',
              nodes: [],
            },
            'shared-tag': {
              id: 'shared-tag-id',
              description: 'Shared tag',
              nodes: ['node-with-tags'],
            },
          },
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const tags = yield* persistence.listTags();

        const tagNames = tags.map((t) => t.name);
        expect(tagNames).toContain('from-index');
        expect(tagNames).toContain('from-node');
        expect(tagNames).toContain('shared-tag');

        // # Reason: Shared tag should use index description
        const sharedTag = tags.find((t) => t.name === 'shared-tag');
        expect(sharedTag?.description).toBe('Shared tag');
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should tag a node', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: Set up node and tag
      initialFiles.set(
        'content/nodes/node-to-tag.md',
        `---
description: Node to tag
---

Content`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'node-to-tag': {
              id: 'node-id',
              path: 'content/nodes/node-to-tag.md',
              type: 'content',
            },
          },
          tags: {
            'tag-to-apply': {
              id: 'tag-id',
              description: 'Tag to apply',
              nodes: [],
            },
          },
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;
        yield* persistence.tagNode('node-id', 'tag-id');

        // # Reason: Check node file was updated with tag
        const nodeContent = yield* storage.readFile(
          'content/nodes/node-to-tag.md',
        );
        expect(nodeContent).toContain('tags: [tag-to-apply]');

        // # Reason: Check indexes were updated
        const indexContent = yield* storage.readFile('.janus/indexes.json');
        const indexes = JSON.parse(indexContent);
        expect(indexes.tags['tag-to-apply'].nodes).toContain('node-to-tag');
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });
  });

  describe('Directory Concatenation', () => {
    it.effect(
      'should concatenate all markdown files in a directory node',
      () => {
        const initialFiles = new Map<string, string>();

        // # Reason: Set up directory with multiple markdown files
        initialFiles.set(
          'content/nodes/composite-node/01-intro.md',
          `---
description: Introduction
---

# Introduction

First section content`,
        );

        initialFiles.set(
          'content/nodes/composite-node/02-main.md',
          `# Main Content

Second section content`,
        );

        initialFiles.set(
          'content/nodes/composite-node/03-conclusion.md',
          `# Conclusion

Final section content`,
        );

        initialFiles.set(
          '.janus/indexes.json',
          JSON.stringify({
            nodes: {
              'composite-node': {
                id: 'composite-id',
                path: 'content/nodes/composite-node',
                type: 'concatenate',
              },
            },
            tags: {},
          }),
        );

        return Effect.gen(function* () {
          const persistence = yield* PersistenceService;
          const node = yield* persistence.findNodeByName(
            'composite-node' as Slug,
          );

          expect(node.name).toBe('composite-node');
          expect(node.description).toBe(
            'Concatenated content from content/nodes/composite-node',
          );

          // # Reason: Content should be concatenated in order
          // Note: The implementation extracts body content only (no frontmatter)
          const expectedContent = `# Introduction

First section content

# Main Content

Second section content

# Conclusion

Final section content`;

          // # Reason: Get the actual content through version
          const version = yield* persistence.getLatestVersion('composite-id');
          if (Option.isSome(version)) {
            expect(version.value.content).toBe(expectedContent);
          }
        }).pipe(
          Effect.provide(GitPersistenceLive),
          Effect.provide(createMockLayer(initialFiles)),
        );
      },
    );

    it.effect('should handle empty directories gracefully', () => {
      const initialFiles = new Map<string, string>();

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'empty-dir': {
              id: 'empty-id',
              path: 'content/nodes/empty-dir',
              type: 'concatenate',
            },
          },
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const node = yield* persistence.findNodeByName('empty-dir' as Slug);

        expect(node.name).toBe('empty-dir');

        // # Reason: Should return empty content for empty directory
        const version = yield* persistence.getLatestVersion('empty-id');
        if (Option.isSome(version)) {
          expect(version.value.content).toBe('');
        }
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });
  });

  describe('Insert Processing', () => {
    it.effect('should process insert placeholders in content', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: Set up node with insert placeholders
      initialFiles.set(
        'content/nodes/template-node.md',
        `---
description: Template with inserts
---

# Template

## Prerequisites

{{insert:prerequisites}}

## Examples

{{insert:examples}}

## End`,
      );

      // # Reason: Set up inserts.yaml
      initialFiles.set(
        'content/inserts/inserts.yaml',
        `inserts:
  - node: template-node
    inserts:
      - key: prerequisites
        values:
          - "Prerequisite 1"
          - "Prerequisite 2"
      - key: examples
        values:
          - "Example A"
          - "Example B"
          - "Example C"`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'template-node': {
              id: 'template-id',
              path: 'content/nodes/template-node.md',
              type: 'content',
            },
          },
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        yield* persistence.findNodeByName('template-node' as Slug);

        // # Reason: Get processed content through version
        const version = yield* persistence.getLatestVersion('template-id');
        if (Option.isSome(version)) {
          const content = version.value.content!;

          // # Reason: Check inserts were processed
          expect(content).toContain('Prerequisite 1');
          expect(content).toContain('Prerequisite 2');
          expect(content).toContain('Example A');
          expect(content).toContain('Example B');
          expect(content).toContain('Example C');

          // # Reason: Check placeholders were replaced
          expect(content).not.toContain('{{insert:prerequisites}}');
          expect(content).not.toContain('{{insert:examples}}');
        }
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should handle missing inserts file gracefully', () => {
      const initialFiles = new Map<string, string>();

      initialFiles.set(
        'content/nodes/node-without-inserts.md',
        `---
description: Node without inserts
---

# Content

{{insert:missing}}

More content`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'node-without-inserts': {
              id: 'no-inserts-id',
              path: 'content/nodes/node-without-inserts.md',
              type: 'content',
            },
          },
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        yield* persistence.findNodeByName('node-without-inserts' as Slug);

        // # Reason: Should return content with placeholders unchanged
        const version = yield* persistence.getLatestVersion('no-inserts-id');
        if (Option.isSome(version)) {
          expect(version.value.content).toContain('{{insert:missing}}');
        }
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });
  });

  describe('Frontmatter Parsing', () => {
    it.effect('should parse frontmatter correctly', () => {
      const initialFiles = new Map<string, string>();

      initialFiles.set(
        'content/nodes/frontmatter-test.md',
        `---
description: Complex frontmatter test
tags: [tag1, tag2, tag3]
---

# Content Section

The actual content goes here.`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'frontmatter-test': {
              id: 'fm-test-id',
              path: 'content/nodes/frontmatter-test.md',
              type: 'content',
            },
          },
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const node = yield* persistence.findNodeByName(
          'frontmatter-test' as Slug,
        );

        expect(node.description).toBe('Complex frontmatter test');

        // # Reason: Content should not include frontmatter
        const version = yield* persistence.getLatestVersion('fm-test-id');
        if (Option.isSome(version)) {
          const content = version.value.content!;
          expect(content).not.toContain('---');
          expect(content).not.toContain('description:');
          expect(content).not.toContain('tags:');
          expect(content).toContain('# Content Section');
          expect(content).toContain('The actual content goes here.');
        }
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should handle missing frontmatter gracefully', () => {
      const initialFiles = new Map<string, string>();

      initialFiles.set(
        'content/nodes/no-frontmatter.md',
        `# Direct Content

This file has no frontmatter.`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'no-frontmatter': {
              id: 'no-fm-id',
              path: 'content/nodes/no-frontmatter.md',
              type: 'content',
            },
          },
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const node = yield* persistence.findNodeByName(
          'no-frontmatter' as Slug,
        );

        expect(node.description).toBe('');

        // # Reason: Should return full content when no frontmatter
        const version = yield* persistence.getLatestVersion('no-fm-id');
        if (Option.isSome(version)) {
          const content = version.value.content!;
          expect(content).toContain('# Direct Content');
          expect(content).toContain('This file has no frontmatter.');
        }
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });
  });

  describe('Edge Cases', () => {
    it.effect('should handle node not in index but file exists', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: File exists but not in index
      initialFiles.set(
        'content/nodes/unindexed-node.md',
        `---
description: Unindexed node
---

Content of unindexed node`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {},
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const node = yield* persistence.findNodeByName(
          'unindexed-node' as Slug,
        );

        expect(node.name).toBe('unindexed-node');
        expect(node.description).toBe('Unindexed node');
        expect(node.id).toBeDefined();
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should handle special characters in content', () => {
      const initialFiles = new Map<string, string>();

      const specialContent = `---
description: Special "characters" & symbols
tags: [special-chars, "quoted-tag"]
---

# Special Content

This has "quotes" and & ampersands
Also: colons, {{braces}}, and other symbols!`;

      initialFiles.set('content/nodes/special-chars.md', specialContent);
      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {},
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const node = yield* persistence.findNodeByName('special-chars' as Slug);

        expect(node.description).toBe('Special "characters" & symbols');

        const version = yield* persistence.getLatestVersion(node.id);
        if (Option.isSome(version)) {
          expect(version.value.content).toContain(
            'This has "quotes" and & ampersands',
          );
        }
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });
  });

  describe('Pre-existing Files', () => {
    it.effect('should handle pre-existing files with walk function', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: Simulate pre-existing files created by user
      initialFiles.set(
        'content/nodes/manual-node1.md',
        `---
description: Manually created node 1
tags: [manual, user-created]
---

This node was created manually by the user.`,
      );

      initialFiles.set(
        'content/nodes/manual-node2.md',
        `---
description: Manually created node 2
---

Another manually created node.`,
      );

      // # Reason: No indexes yet - they should be created by walk function

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;

        // # Reason: Should be able to find manually created nodes
        const node1 = yield* persistence.findNodeByName('manual-node1' as Slug);
        expect(node1.name).toBe('manual-node1');
        expect(node1.description).toBe('Manually created node 1');

        const node2 = yield* persistence.findNodeByName('manual-node2' as Slug);
        expect(node2.name).toBe('manual-node2');
        expect(node2.description).toBe('Manually created node 2');

        // # Reason: List should include manually created nodes
        const nodes = yield* persistence.listNodes();
        const nodeNames = nodes.map((n) => n.name);
        expect(nodeNames).toContain('manual-node1');
        expect(nodeNames).toContain('manual-node2');
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });
  });
});
