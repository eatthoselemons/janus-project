import { describe, it, expect } from '@effect/vitest';
import { Effect, Option } from 'effect';
import { PersistenceService } from '../../services/persistence/Persistence.service';
import { GitPersistenceLive } from './GitPersistence.layer';
import { FileSystemStorageService } from '../../services/low-level/FileSystemStorage.service';
import { Slug } from '../../domain/types/branded';
import { createMockFileSystemStorageLayer } from './test/MockFileSystemStorage.layer';

// # Reason: Helper to create mock layer with initial files
const createMockLayer = (initialFiles?: Map<string, string>) =>
  createMockFileSystemStorageLayer(initialFiles);

describe('GitPersistence walkFileSystem', () => {
  describe('Pre-existing Files Indexing', () => {
    it.effect('should create indexes for pre-existing markdown files', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: Simulate pre-existing files without indexes
      initialFiles.set(
        'content/nodes/existing-node1.md',
        `---
description: First existing node
tags: [auto-indexed, test]
---

Content of first node`,
      );

      initialFiles.set(
        'content/nodes/existing-node2.md',
        `---
description: Second existing node
---

Content of second node`,
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;

        // # Reason: Nodes should be findable after walkFileSystem runs on init
        const node1 = yield* persistence.findNodeByName(
          'existing-node1' as Slug,
        );
        expect(node1.name).toBe('existing-node1');
        expect(node1.description).toBe('First existing node');

        const node2 = yield* persistence.findNodeByName(
          'existing-node2' as Slug,
        );
        expect(node2.name).toBe('existing-node2');
        expect(node2.description).toBe('Second existing node');

        // # Reason: Check that indexes were created
        const indexContent = yield* storage.readFile('.janus/indexes.json');
        const indexes = JSON.parse(indexContent);

        expect(indexes.nodes['existing-node1']).toBeDefined();
        expect(indexes.nodes['existing-node1'].path).toBe(
          'content/nodes/existing-node1.md',
        );
        expect(indexes.nodes['existing-node1'].type).toBe('content');

        expect(indexes.nodes['existing-node2']).toBeDefined();
        expect(indexes.nodes['existing-node2'].path).toBe(
          'content/nodes/existing-node2.md',
        );
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should extract and index tags from pre-existing files', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: Files with tags but no tag index
      initialFiles.set(
        'content/nodes/tagged-file1.md',
        `---
description: File with tags
tags: [extracted-tag, another-tag]
---

Content`,
      );

      initialFiles.set(
        'content/nodes/tagged-file2.md',
        `---
description: Another file with tags
tags: [extracted-tag, unique-tag]
---

Content`,
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;

        // # Reason: Tags should be findable
        const tag1 = yield* persistence.findTagByName('extracted-tag');
        expect(tag1.name).toBe('extracted-tag');
        expect(tag1.description).toBe('Tag: extracted-tag');

        const tag2 = yield* persistence.findTagByName('unique-tag');
        expect(tag2.name).toBe('unique-tag');

        // # Reason: Check indexes were updated with tags
        const indexContent = yield* storage.readFile('.janus/indexes.json');
        const indexes = JSON.parse(indexContent);

        expect(indexes.tags['extracted-tag']).toBeDefined();
        expect(indexes.tags['extracted-tag'].nodes).toContain('tagged-file1');
        expect(indexes.tags['extracted-tag'].nodes).toContain('tagged-file2');

        expect(indexes.tags['another-tag']).toBeDefined();
        expect(indexes.tags['another-tag'].nodes).toContain('tagged-file1');

        expect(indexes.tags['unique-tag']).toBeDefined();
        expect(indexes.tags['unique-tag'].nodes).toContain('tagged-file2');
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should index pre-existing directory nodes', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: Simulate a directory with markdown files
      initialFiles.set(
        'content/nodes/dir-node/01-intro.md',
        `---
description: Introduction
---

# Introduction

First part`,
      );

      initialFiles.set(
        'content/nodes/dir-node/02-main.md',
        `# Main Content

Second part`,
      );

      initialFiles.set(
        'content/nodes/dir-node/03-outro.md',
        `# Conclusion

Third part`,
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;

        // # Reason: Directory node should be findable
        const node = yield* persistence.findNodeByName('dir-node' as Slug);
        expect(node.name).toBe('dir-node');
        expect(node.description).toBe(
          'Concatenated content from content/nodes/dir-node',
        );

        // # Reason: Check that it was indexed as concatenate type
        const indexContent = yield* storage.readFile('.janus/indexes.json');
        const indexes = JSON.parse(indexContent);

        expect(indexes.nodes['dir-node']).toBeDefined();
        expect(indexes.nodes['dir-node'].path).toBe('content/nodes/dir-node');
        expect(indexes.nodes['dir-node'].type).toBe('concatenate');

        // # Reason: Verify content is concatenated correctly
        const version = yield* persistence.getLatestVersion(
          indexes.nodes['dir-node'].id,
        );
        if (Option.isSome(version)) {
          expect(version.value.content).toContain('First part');
          expect(version.value.content).toContain('Second part');
          expect(version.value.content).toContain('Third part');
        }
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect(
      'should not overwrite existing node IDs but should update tag indexes',
      () => {
        const initialFiles = new Map<string, string>();

        // # Reason: Pre-existing file with tags
        initialFiles.set(
          'content/nodes/already-indexed.md',
          `---
description: Already indexed node
tags: [existing, newly-added]
---

Content`,
        );

        // # Reason: Pre-existing index with specific ID but missing the newly-added tag
        const existingNodeId = '11111111-1111-1111-1111-111111111111';
        initialFiles.set(
          '.janus/indexes.json',
          JSON.stringify({
            nodes: {
              'already-indexed': {
                id: existingNodeId,
                path: 'content/nodes/already-indexed.md',
                type: 'content',
              },
            },
            tags: {
              existing: {
                id: 'existing-tag-id',
                description: 'Existing tag',
                nodes: ['already-indexed'],
              },
              'pre-existing-tag': {
                id: 'tag-11111111',
                description: 'Pre-existing tag',
                nodes: ['some-other-node'],
              },
            },
          }),
        );

        return Effect.gen(function* () {
          const persistence = yield* PersistenceService;
          const storage = yield* FileSystemStorageService;

          // # Reason: Should preserve existing node ID
          const node = yield* persistence.findNodeByName(
            'already-indexed' as Slug,
          );
          expect(node.id).toBe(existingNodeId);

          // # Reason: Should preserve existing tags
          const indexContent = yield* storage.readFile('.janus/indexes.json');
          const indexes = JSON.parse(indexContent);

          // # Reason: Existing node ID should be preserved
          expect(indexes.nodes['already-indexed'].id).toBe(existingNodeId);

          // # Reason: Pre-existing tag should be preserved
          expect(indexes.tags['pre-existing-tag']).toBeDefined();
          expect(indexes.tags['pre-existing-tag'].id).toBe('tag-11111111');
          expect(indexes.tags['pre-existing-tag'].description).toBe(
            'Pre-existing tag',
          );

          // # Reason: Existing tag should be preserved
          expect(indexes.tags['existing']).toBeDefined();
          expect(indexes.tags['existing'].id).toBe('existing-tag-id');

          // # Reason: Newly added tag should be indexed
          // Users should be able to edit files manually and have tags indexed
          expect(indexes.tags['newly-added']).toBeDefined();
          expect(indexes.tags['newly-added'].nodes).toContain(
            'already-indexed',
          );
        }).pipe(
          Effect.provide(GitPersistenceLive),
          Effect.provide(createMockLayer(initialFiles)),
        );
      },
    );

    it.effect('should remove tags from index when removed from file', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: File with fewer tags than in index (tag was removed)
      initialFiles.set(
        'content/nodes/tag-removed.md',
        `---
description: Node with removed tag
tags: [kept-tag]
---

Content`,
      );

      // # Reason: Index shows the file previously had 'removed-tag'
      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'tag-removed': {
              id: 'node-with-removed-tag',
              path: 'content/nodes/tag-removed.md',
              type: 'content',
            },
          },
          tags: {
            'kept-tag': {
              id: 'kept-tag-id',
              description: 'Tag that stays',
              nodes: ['tag-removed'],
            },
            'removed-tag': {
              id: 'removed-tag-id',
              description: 'Tag that was removed',
              nodes: ['tag-removed', 'other-node'],
            },
          },
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;

        // # Reason: Access node to trigger walkFileSystem
        yield* persistence.findNodeByName('tag-removed' as Slug);

        const indexContent = yield* storage.readFile('.janus/indexes.json');
        const indexes = JSON.parse(indexContent);

        // # Reason: kept-tag should still have the node
        expect(indexes.tags['kept-tag'].nodes).toContain('tag-removed');

        // # Reason: removed-tag should no longer reference this node
        expect(indexes.tags['removed-tag'].nodes).not.toContain('tag-removed');
        expect(indexes.tags['removed-tag'].nodes).toContain('other-node');
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect(
      'should handle mixed scenario with indexed and non-indexed content',
      () => {
        const initialFiles = new Map<string, string>();

        // # Reason: Mix of indexed and non-indexed files
        initialFiles.set(
          'content/nodes/indexed-node.md',
          `---
description: Already indexed
tags: [shared-tag]
---

Indexed content`,
        );

        initialFiles.set(
          'content/nodes/new-node.md',
          `---
description: Not yet indexed
tags: [shared-tag, new-tag]
---

New content`,
        );

        initialFiles.set(
          'content/nodes/another-new.md',
          `---
description: Another new node
---

Another content`,
        );

        // # Reason: Directory node not indexed
        initialFiles.set('content/nodes/new-dir/file1.md', `Part 1`);
        initialFiles.set('content/nodes/new-dir/file2.md', `Part 2`);

        // # Reason: Partial index - only has indexed-node
        initialFiles.set(
          '.janus/indexes.json',
          JSON.stringify({
            nodes: {
              'indexed-node': {
                id: 'existing-id-123',
                path: 'content/nodes/indexed-node.md',
                type: 'content',
              },
            },
            tags: {
              'shared-tag': {
                id: 'shared-tag-id',
                description: 'Existing shared tag',
                nodes: ['indexed-node'],
              },
            },
          }),
        );

        return Effect.gen(function* () {
          const persistence = yield* PersistenceService;
          const storage = yield* FileSystemStorageService;

          // # Reason: All nodes should be findable
          const indexedNode = yield* persistence.findNodeByName(
            'indexed-node' as Slug,
          );
          expect(indexedNode.id).toBe('existing-id-123');

          const newNode = yield* persistence.findNodeByName('new-node' as Slug);
          expect(newNode.description).toBe('Not yet indexed');

          const anotherNew = yield* persistence.findNodeByName(
            'another-new' as Slug,
          );
          expect(anotherNew.description).toBe('Another new node');

          const dirNode = yield* persistence.findNodeByName('new-dir' as Slug);
          expect(dirNode.description).toBe(
            'Concatenated content from content/nodes/new-dir',
          );

          // # Reason: Check final index state
          const indexContent = yield* storage.readFile('.janus/indexes.json');
          const indexes = JSON.parse(indexContent);

          // # Reason: Should have all nodes indexed
          expect(Object.keys(indexes.nodes)).toHaveLength(4);
          expect(indexes.nodes['indexed-node'].id).toBe('existing-id-123');
          expect(indexes.nodes['new-node']).toBeDefined();
          expect(indexes.nodes['another-new']).toBeDefined();
          expect(indexes.nodes['new-dir']).toBeDefined();
          expect(indexes.nodes['new-dir'].type).toBe('concatenate');

          // # Reason: Shared tag should include both nodes
          expect(indexes.tags['shared-tag'].nodes).toContain('indexed-node');
          expect(indexes.tags['shared-tag'].nodes).toContain('new-node');
          expect(indexes.tags['shared-tag'].description).toBe(
            'Existing shared tag',
          );

          // # Reason: New tag should be created
          expect(indexes.tags['new-tag']).toBeDefined();
          expect(indexes.tags['new-tag'].nodes).toContain('new-node');
        }).pipe(
          Effect.provide(GitPersistenceLive),
          Effect.provide(createMockLayer(initialFiles)),
        );
      },
    );

    it.effect('should detect and clean up removed tags from files', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: Multiple files with various tag changes
      initialFiles.set(
        'content/nodes/file1.md',
        `---
description: File 1
tags: [tag-a, tag-b]
---

Content`,
      );

      initialFiles.set(
        'content/nodes/file2.md',
        `---
description: File 2
tags: [tag-b]
---

Content`,
      );

      // # Reason: Index shows file1 previously had tag-c (now removed)
      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            file1: {
              id: 'file1-id',
              path: 'content/nodes/file1.md',
              type: 'content',
            },
            file2: {
              id: 'file2-id',
              path: 'content/nodes/file2.md',
              type: 'content',
            },
          },
          tags: {
            'tag-a': {
              id: 'tag-a-id',
              description: 'Tag A',
              nodes: ['file1'],
            },
            'tag-b': {
              id: 'tag-b-id',
              description: 'Tag B',
              nodes: ['file1', 'file2'],
            },
            'tag-c': {
              id: 'tag-c-id',
              description: 'Tag C (removed from file1)',
              nodes: ['file1'],
            },
          },
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;

        // # Reason: Trigger walkFileSystem
        yield* persistence.listNodes();

        const indexContent = yield* storage.readFile('.janus/indexes.json');
        const indexes = JSON.parse(indexContent);

        // # Reason: tag-a should remain with file1
        expect(indexes.tags['tag-a'].nodes).toEqual(['file1']);

        // # Reason: tag-b should have both files
        expect(indexes.tags['tag-b'].nodes).toEqual(['file1', 'file2']);

        // # Reason: tag-c should be empty (removed from file1)
        expect(indexes.tags['tag-c'].nodes).toEqual([]);
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should not save indexes if no modifications were made', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: Fully indexed setup
      initialFiles.set(
        'content/nodes/fully-indexed.md',
        `---
description: Fully indexed node
---

Content`,
      );

      initialFiles.set(
        '.janus/indexes.json',
        JSON.stringify({
          nodes: {
            'fully-indexed': {
              id: 'node-id-123',
              path: 'content/nodes/fully-indexed.md',
              type: 'content',
            },
          },
          tags: {},
        }),
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;

        // # Reason: Record initial index content
        const initialIndexContent = yield* storage.readFile(
          '.janus/indexes.json',
        );

        // # Reason: Access a node to trigger any potential re-indexing
        const node = yield* persistence.findNodeByName('fully-indexed' as Slug);
        expect(node.id).toBe('node-id-123');

        // # Reason: Index should remain exactly the same (no formatting changes)
        const finalIndexContent = yield* storage.readFile(
          '.janus/indexes.json',
        );
        expect(finalIndexContent).toBe(initialIndexContent);
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should handle files with no frontmatter', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: File without frontmatter
      initialFiles.set(
        'content/nodes/no-frontmatter.md',
        `# Direct Content

This file has no frontmatter at all.`,
      );

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;

        // # Reason: Should still index the file
        const node = yield* persistence.findNodeByName(
          'no-frontmatter' as Slug,
        );
        expect(node.name).toBe('no-frontmatter');
        expect(node.description).toBe('');

        // # Reason: Check it was indexed
        const indexContent = yield* storage.readFile('.janus/indexes.json');
        const indexes = JSON.parse(indexContent);

        expect(indexes.nodes['no-frontmatter']).toBeDefined();
        expect(indexes.nodes['no-frontmatter'].type).toBe('content');
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should ignore non-markdown files', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: Mix of file types
      initialFiles.set(
        'content/nodes/valid-node.md',
        `---
description: Valid markdown
---

Content`,
      );

      initialFiles.set('content/nodes/README.txt', `This is a text file`);
      initialFiles.set('content/nodes/data.json', `{"key": "value"}`);
      initialFiles.set('content/nodes/.hidden', `Hidden file`);

      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;

        // # Reason: Only markdown should be indexed
        const nodes = yield* persistence.listNodes();
        expect(nodes).toHaveLength(1);
        expect(nodes[0].name).toBe('valid-node');

        // # Reason: Check index only has markdown file
        const indexContent = yield* storage.readFile('.janus/indexes.json');
        const indexes = JSON.parse(indexContent);

        expect(Object.keys(indexes.nodes)).toHaveLength(1);
        expect(indexes.nodes['valid-node']).toBeDefined();
        expect(indexes.nodes['README']).toBeUndefined();
        expect(indexes.nodes['data']).toBeUndefined();
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });

    it.effect('should only index files in content/ directory, not docs/ or other directories', () => {
      const initialFiles = new Map<string, string>();
      
      // # Reason: Files in various directories
      initialFiles.set('content/nodes/content-node.md', `---
description: Node in content directory
---

Content`);
      
      initialFiles.set('docs/nodes/docs-node.md', `---
description: Node in docs directory
---

Documentation`);
      
      initialFiles.set('docs/architecture.md', `---
description: Architecture doc
---

Architecture details`);
      
      initialFiles.set('README.md', `# README`);
      
      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;
        
        // # Reason: Only content/nodes files should be indexed
        const nodes = yield* persistence.listNodes();
        expect(nodes).toHaveLength(1);
        expect(nodes[0].name).toBe('content-node');
        
        // # Reason: Verify index only has content/ files
        const indexContent = yield* storage.readFile('.janus/indexes.json');
        const indexes = JSON.parse(indexContent);
        
        expect(Object.keys(indexes.nodes)).toHaveLength(1);
        expect(indexes.nodes['content-node']).toBeDefined();
        expect(indexes.nodes['docs-node']).toBeUndefined();
        expect(indexes.nodes['architecture']).toBeUndefined();
        expect(indexes.nodes['README']).toBeUndefined();
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles))
      );
    });

    it.effect('should handle directory with both subdirectories and .md files', () => {
      const initialFiles = new Map<string, string>();
      
      // # Reason: Directory with both .md files and subdirectories (only top-level indexed)
      initialFiles.set('content/nodes/hybrid-dir/overview.md', `---
description: Overview file
---

# Overview

This is the overview.`);
      
      initialFiles.set('content/nodes/hybrid-dir/section1/part1.md', `# Section 1 Part 1

Content for section 1 part 1`);
      
      initialFiles.set('content/nodes/hybrid-dir/section1/part2.md', `# Section 1 Part 2

Content for section 1 part 2`);
      
      initialFiles.set('content/nodes/hybrid-dir/section2/intro.md', `# Section 2 Intro

Introduction to section 2`);
      
      initialFiles.set('content/nodes/hybrid-dir/conclusion.md', `# Conclusion

Final thoughts`);
      
      // # Reason: Also add some top-level nodes to test
      initialFiles.set('content/nodes/section1/direct.md', `# Direct Section 1

Direct content in section1 at top level`);
      
      initialFiles.set('content/nodes/section2/direct.md', `# Direct Section 2

Direct content in section2 at top level`);
      
      return Effect.gen(function* () {
        const persistence = yield* PersistenceService;
        const storage = yield* FileSystemStorageService;
        
        // # Reason: Only top-level directories are indexed as nodes
        const nodes = yield* persistence.listNodes();
        const nodeNames = nodes.map(n => n.name).sort();
        
        // # Reason: Should have hybrid-dir and the separate top-level section1/section2
        expect(nodeNames).toContain('hybrid-dir');
        expect(nodeNames).toContain('section1');  
        expect(nodeNames).toContain('section2');
        
        // # Reason: Verify index structure
        const indexContent = yield* storage.readFile('.janus/indexes.json');
        const indexes = JSON.parse(indexContent);
        
        // # Reason: Parent directory should be concatenate type
        expect(indexes.nodes['hybrid-dir']).toBeDefined();
        expect(indexes.nodes['hybrid-dir'].type).toBe('concatenate');
        expect(indexes.nodes['hybrid-dir'].path).toBe('content/nodes/hybrid-dir');
        
        // # Reason: Top-level section directories should be indexed
        expect(indexes.nodes['section1']).toBeDefined();
        expect(indexes.nodes['section1'].type).toBe('concatenate');
        expect(indexes.nodes['section1'].path).toBe('content/nodes/section1');
        
        expect(indexes.nodes['section2']).toBeDefined();
        expect(indexes.nodes['section2'].type).toBe('concatenate');
        expect(indexes.nodes['section2'].path).toBe('content/nodes/section2');
        
        // # Reason: Verify hybrid-dir concatenates only its direct .md files
        const hybridNode = yield* persistence.findNodeByName('hybrid-dir' as Slug);
        const version = yield* persistence.getLatestVersion(indexes.nodes['hybrid-dir'].id);
        if (Option.isSome(version)) {
          // # Reason: Should include overview and conclusion from parent dir
          expect(version.value.content).toContain('This is the overview');
          expect(version.value.content).toContain('Final thoughts');
          // # Reason: Should NOT include subdirectory contents (they're in subdirs)
          expect(version.value.content).not.toContain('Section 1 Part 1');
        }
        
        // # Reason: Check top-level section1 has its own content
        const section1Version = yield* persistence.getLatestVersion(indexes.nodes['section1'].id);
        if (Option.isSome(section1Version)) {
          expect(section1Version.value.content).toContain('Direct Section 1');
          expect(section1Version.value.content).toContain('Direct content in section1 at top level');
        }
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles))
      );
    });

    it.effect('should handle empty directories (no markdown files)', () => {
      const initialFiles = new Map<string, string>();

      // # Reason: Directory with non-markdown files only
      initialFiles.set('content/nodes/non-md-dir/readme.txt', `Text file`);
      initialFiles.set('content/nodes/non-md-dir/data.json', `{}`);

      // # Reason: Initialize with empty indexes so we can read them
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

        // # Reason: Directory without .md files should not be indexed
        const nodes = yield* persistence.listNodes();
        expect(nodes).toHaveLength(0);

        // # Reason: Check no directory node was created
        const indexContent = yield* storage.readFile('.janus/indexes.json');
        const indexes = JSON.parse(indexContent);

        expect(indexes.nodes['non-md-dir']).toBeUndefined();
      }).pipe(
        Effect.provide(GitPersistenceLive),
        Effect.provide(createMockLayer(initialFiles)),
      );
    });
  });
});
