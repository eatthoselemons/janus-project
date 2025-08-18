import { Effect, Layer, Option, Schema } from 'effect';
import {
  ContentNode,
  ContentNodeVersion,
  Slug,
  Tag,
  ContentNodeId,
  ContentNodeVersionId,
  TagId,
} from '../../domain';
import { NotFoundError, PersistenceError } from '../../domain/types/errors';
import { PersistenceService } from '../../services/persistence/Persistence.service';
import { FileSystemStorageService } from '../../services/low-level/FileSystemStorage.service';

// # Reason: Use Schema.Struct instead of interfaces following project conventions
const NodeMetadata = Schema.Struct({
  description: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
});
type NodeMetadata = Schema.Schema.Type<typeof NodeMetadata>;

const NodeIndex = Schema.Struct({
  id: Schema.String,
  path: Schema.String,
  type: Schema.Literal('content', 'concatenate', 'template'),
});
type NodeIndex = Schema.Schema.Type<typeof NodeIndex>;

const TagIndex = Schema.Struct({
  id: Schema.String,
  description: Schema.String,
  nodes: Schema.Array(Schema.String),
});
type TagIndex = Schema.Schema.Type<typeof TagIndex>;

const IndexesJson = Schema.Struct({
  nodes: Schema.Record({ key: Schema.String, value: NodeIndex }),
  tags: Schema.Record({ key: Schema.String, value: TagIndex }),
});
type IndexesJson = Schema.Schema.Type<typeof IndexesJson>;

const InsertDefinition = Schema.Struct({
  node: Schema.String,
  inserts: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      values: Schema.Array(Schema.String),
    }),
  ),
});
type InsertDefinition = Schema.Schema.Type<typeof InsertDefinition>;

const InsertsYaml = Schema.Struct({
  inserts: Schema.Array(InsertDefinition),
});
type InsertsYaml = Schema.Schema.Type<typeof InsertsYaml>;

export const GitPersistenceLive = Layer.effect(
  PersistenceService,
  Effect.gen(function* () {
    const storage = yield* FileSystemStorageService;

    // # Reason: Walk filesystem to build indexes for pre-existing files
    const walkFileSystem = (): Effect.Effect<void, PersistenceError> =>
      Effect.gen(function* () {
        const indexes = yield* loadIndexes();

        // # Reason: Check for nodes not in index
        const filesResult = yield* storage.listFiles('content/nodes').pipe(
          Effect.mapError(
            () =>
              new PersistenceError({
                originalMessage: 'Failed to list nodes directory',
                operation: 'read',
              }),
          ),
          Effect.orElseSucceed(() => []),
        );

        const fileUpdates = yield* Effect.all(
          filesResult
            .filter((file) => file.endsWith('.md'))
            .map((file) => {
              const name = file.replace('.md', '');
              const path = `content/nodes/${file}`;

              return storage.readFile(path).pipe(
                Effect.map((fileContent) => {
                  const { metadata } =
                    parseMarkdownWithFrontmatter(fileContent);
                  let modified = false;

                  // # Reason: Add new node if not indexed
                  if (!indexes.nodes[name]) {
                    const nodeId = crypto.randomUUID();
                    indexes.nodes[name] = {
                      id: nodeId,
                      path,
                      type: 'content',
                    };
                    modified = true;
                  }

                  // # Reason: Always update tag indexes from metadata to catch manual edits
                  (metadata.tags || []).forEach((tag) => {
                    if (!indexes.tags[tag]) {
                      indexes.tags[tag] = {
                        id: crypto.randomUUID(),
                        description: `Tag: ${tag}`,
                        nodes: [],
                      };
                      modified = true;
                    }
                    if (!indexes.tags[tag].nodes.includes(name)) {
                      indexes.tags[tag].nodes.push(name);
                      modified = true;
                    }
                  });

                  // # Reason: Remove node from tags that are no longer in the file
                  Object.entries(indexes.tags).forEach(
                    ([tagName, tagIndex]) => {
                      const fileHasTag = (metadata.tags || []).includes(
                        tagName,
                      );
                      const indexHasNode = tagIndex.nodes.includes(name);

                      if (!fileHasTag && indexHasNode) {
                        tagIndex.nodes = tagIndex.nodes.filter(
                          (n) => n !== name,
                        );
                        modified = true;
                      }
                    },
                  );

                  return modified;
                }),
                Effect.orElseSucceed(() => null),
              );
            }),
        );

        // # Reason: Check for directories (concatenate nodes)
        const dirs = yield* storage.listFiles('content/nodes').pipe(
          Effect.map((files) => files.filter((f) => !f.includes('.'))),
          Effect.orElseSucceed(() => []),
        );

        const dirUpdates = yield* Effect.all(
          dirs.map((dir) => {
            if (indexes.nodes[dir]) {
              return Effect.succeed(null);
            }

            return storage.listFiles(`content/nodes/${dir}`).pipe(
              Effect.map((dirFiles) => {
                const hasMdFiles = dirFiles.some((f) => f.endsWith('.md'));
                if (hasMdFiles) {
                  indexes.nodes[dir] = {
                    id: crypto.randomUUID(),
                    path: `content/nodes/${dir}`,
                    type: 'concatenate',
                  };
                  return true;
                }
                return null;
              }),
              Effect.orElseSucceed(() => null),
            );
          }),
        );

        // # Reason: Save if any modifications were made
        const modified = [...fileUpdates, ...dirUpdates].some(
          (update) => update !== null,
        );
        if (modified) {
          yield* saveIndexes(indexes);
        }
      });

    // # Reason: Parse markdown with frontmatter
    const parseMarkdownWithFrontmatter = (
      content: string,
    ): { metadata: NodeMetadata; body: string } => {
      const lines = content.split('\n');
      if (lines[0] !== '---') {
        return { metadata: {}, body: content };
      }

      const endIndex = lines.indexOf('---', 1);
      if (endIndex === -1) {
        return { metadata: {}, body: content };
      }

      const frontmatterLines = lines.slice(1, endIndex);
      const metadata: NodeMetadata = {};

      // # Reason: Use functional approach to parse frontmatter
      frontmatterLines.forEach((line) => {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) return;

        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        if (key === 'description') {
          metadata.description = value;
        } else if (key === 'tags') {
          const cleanValue = value.replace(/^\[|\]$/g, '');
          metadata.tags = cleanValue
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);
        }
      });

      const body = lines
        .slice(endIndex + 1)
        .join('\n')
        .trim();
      return { metadata, body };
    };

    // # Reason: Parse YAML for inserts file
    const parseInsertsYaml = (content: string): InsertsYaml => {
      const lines = content.split('\n');
      const result: InsertsYaml = { inserts: [] };
      let currentInsert: InsertDefinition | null = null;
      let currentInsertItem: { key: string; values: string[] } | null = null;

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        if (trimmed.startsWith('- node:')) {
          if (currentInsert) {
            result.inserts.push(currentInsert);
          }
          const nodeName = trimmed.substring('- node:'.length).trim();
          currentInsert = { node: nodeName, inserts: [] };
          currentInsertItem = null;
        } else if (trimmed.startsWith('- key:') && currentInsert) {
          if (currentInsertItem) {
            currentInsert.inserts.push(currentInsertItem);
          }
          const key = trimmed.substring('- key:'.length).trim();
          currentInsertItem = { key, values: [] };
        } else if (trimmed.startsWith('- ') && currentInsertItem) {
          const value = trimmed
            .substring(2)
            .trim()
            .replace(/^["']|["']$/g, '');
          currentInsertItem.values.push(value);
        }
      });

      if (currentInsert) {
        if (currentInsertItem) {
          currentInsert.inserts.push(currentInsertItem);
        }
        result.inserts.push(currentInsert);
      }

      return result;
    };

    // # Reason: Process directory node by concatenating markdown files
    const processDirectoryNode = (
      path: string,
    ): Effect.Effect<
      { description: string; content: string; tags: string[] },
      PersistenceError
    > =>
      Effect.gen(function* () {
        const files = yield* storage.listFiles(path).pipe(
          Effect.mapError(
            () =>
              new PersistenceError({
                originalMessage: `Failed to list directory: ${path}`,
                operation: 'read',
              }),
          ),
        );

        const mdFiles = files.filter((f) => f.endsWith('.md')).sort();

        const contents = yield* Effect.all(
          mdFiles.map((file) =>
            storage.readFile(`${path}/${file}`).pipe(
              Effect.map((content) => {
                const { body } = parseMarkdownWithFrontmatter(content);
                return body;
              }),
              Effect.mapError(
                () =>
                  new PersistenceError({
                    originalMessage: `Failed to read file: ${path}/${file}`,
                    operation: 'read',
                  }),
              ),
            ),
          ),
        );

        const combinedContent = contents.join('\n\n');
        return {
          description: `Concatenated content from ${path}`,
          content: combinedContent,
          tags: [],
        };
      });

    // # Reason: Load indexes.json file
    const loadIndexes = (): Effect.Effect<IndexesJson, PersistenceError> =>
      storage.readFile('.janus/indexes.json').pipe(
        Effect.map((content) => JSON.parse(content) as IndexesJson),
        Effect.catchAll(() =>
          // # Reason: Initialize with empty indexes if file doesn't exist
          Effect.succeed({ nodes: {}, tags: {} }),
        ),
        Effect.mapError(
          () =>
            new PersistenceError({
              originalMessage: 'Failed to read indexes.json',
              operation: 'read',
            }),
        ),
      );

    // # Reason: Save indexes.json file
    const saveIndexes = (
      indexes: IndexesJson,
    ): Effect.Effect<void, PersistenceError> =>
      storage
        .writeFile('.janus/indexes.json', JSON.stringify(indexes, null, 2))
        .pipe(
          Effect.mapError(
            () =>
              new PersistenceError({
                originalMessage: 'Failed to write indexes.json',
                operation: 'write',
              }),
          ),
        );

    // # Reason: Process insert placeholders in content
    const processInserts = (
      content: string,
      nodeName: string,
    ): Effect.Effect<string, PersistenceError> =>
      storage.readFile('content/inserts/inserts.yaml').pipe(
        Effect.map((yamlContent) => {
          const insertsData = parseInsertsYaml(yamlContent);
          const nodeInserts = insertsData.inserts.find(
            (i) => i.node === nodeName,
          );

          if (!nodeInserts) return content;

          let processedContent = content;
          nodeInserts.inserts.forEach((insert) => {
            const placeholder = `{{insert:${insert.key}}}`;
            const replacement = insert.values.join('\n');
            processedContent = processedContent.replace(
              placeholder,
              replacement,
            );
          });

          return processedContent;
        }),
        Effect.orElseSucceed(() => content),
      );

    // # Reason: Find node by name and check multiple possible locations
    const findNodeByName = (
      name: Slug,
    ): Effect.Effect<ContentNode, NotFoundError | PersistenceError> =>
      Effect.gen(function* () {
        const indexes = yield* loadIndexes();
        const nodeIndex = indexes.nodes[name];

        if (nodeIndex) {
          // # Reason: Node found in index
          const isDirectory = nodeIndex.type === 'concatenate';

          if (isDirectory) {
            const { description, tags } = yield* processDirectoryNode(
              nodeIndex.path,
            );
            return {
              id: nodeIndex.id as ContentNodeId,
              name,
              description,
            };
          } else {
            const content = yield* storage.readFile(nodeIndex.path).pipe(
              Effect.mapError(
                () =>
                  new PersistenceError({
                    originalMessage: `Failed to read node file: ${nodeIndex.path}`,
                    operation: 'read',
                  }),
              ),
            );
            const { metadata } = parseMarkdownWithFrontmatter(content);
            return {
              id: nodeIndex.id as ContentNodeId,
              name,
              description: metadata.description || '',
            };
          }
        }

        // # Reason: Try to find file directly if not in index
        const possiblePaths = [
          `content/nodes/${name}.md`,
          `content/nodes/${name}/index.md`,
          `content/nodes/${name}`,
        ];

        const pathResults = yield* Effect.all(
          possiblePaths.map((path) =>
            storage.readFile(path).pipe(
              Effect.map(() => path),
              Effect.orElseSucceed(() => null),
            ),
          ),
        );

        const foundPath = pathResults.find((p) => p !== null);
        if (!foundPath) {
          return yield* Effect.fail(
            new NotFoundError({
              entityType: 'content node',
              entityId: name,
            }),
          );
        }

        // # Reason: Check if it's a directory
        const isDirectory = !foundPath.endsWith('.md');

        if (isDirectory) {
          const { description } = yield* processDirectoryNode(foundPath);
          const nodeId = crypto.randomUUID() as ContentNodeId;

          // # Reason: Update indexes with newly found node
          indexes.nodes[name] = {
            id: nodeId,
            path: foundPath,
            type: 'concatenate',
          };
          yield* saveIndexes(indexes);

          return { id: nodeId, name, description };
        } else {
          const content = yield* storage.readFile(foundPath).pipe(
            Effect.mapError(
              () =>
                new PersistenceError({
                  originalMessage: `Failed to read node file: ${foundPath}`,
                  operation: 'read',
                }),
            ),
          );
          const { metadata } = parseMarkdownWithFrontmatter(content);
          const nodeId = crypto.randomUUID() as ContentNodeId;

          // # Reason: Update indexes with newly found node
          indexes.nodes[name] = {
            id: nodeId,
            path: foundPath,
            type: 'content',
          };
          yield* saveIndexes(indexes);

          return {
            id: nodeId,
            name,
            description: metadata.description || '',
          };
        }
      });

    // # Reason: Create a new content node
    const createNode = (
      nodeData: Omit<ContentNode, 'id'>,
    ): Effect.Effect<ContentNode, PersistenceError> =>
      Effect.gen(function* () {
        const nodeId = crypto.randomUUID() as ContentNodeId;
        const node: ContentNode = { ...nodeData, id: nodeId };

        // # Reason: Create markdown content with frontmatter
        const frontmatter = `---\ndescription: ${node.description}\n---\n\n`;
        const content = frontmatter + '# ' + node.name + '\n\n';

        // # Reason: Write node file
        const nodePath = `content/nodes/${node.name}.md`;
        yield* storage.writeFile(nodePath, content).pipe(
          Effect.mapError(
            () =>
              new PersistenceError({
                originalMessage: `Failed to write node file: ${nodePath}`,
                operation: 'write',
              }),
          ),
        );

        // # Reason: Update indexes
        const indexes = yield* loadIndexes();
        indexes.nodes[node.name] = {
          id: nodeId,
          path: nodePath,
          type: 'content',
        };
        yield* saveIndexes(indexes);

        // # Reason: Commit changes
        yield* storage.commit(`Created node: ${node.name}`).pipe(
          Effect.mapError(
            () =>
              new PersistenceError({
                originalMessage: 'Failed to commit changes',
                operation: 'write',
              }),
          ),
        );

        return node;
      });

    // # Reason: Add a version to an existing node
    const addVersion = (
      nodeId: string,
      versionData: Omit<ContentNodeVersion, 'id' | 'createdAt'>,
    ): Effect.Effect<ContentNodeVersion, NotFoundError | PersistenceError> =>
      Effect.gen(function* () {
        const indexes = yield* loadIndexes();

        const nodeEntry = Object.entries(indexes.nodes).find(
          ([_, index]) => index.id === nodeId,
        );

        if (!nodeEntry) {
          return yield* Effect.fail(
            new NotFoundError({
              entityType: 'content node',
              entityId: nodeId,
            }),
          );
        }

        const [nodeName, nodeIndex] = nodeEntry;
        const versionId = crypto.randomUUID() as ContentNodeVersionId;
        const version: ContentNodeVersion = {
          ...versionData,
          id: versionId,
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
            new Date().toISOString(),
          ),
        };

        // # Reason: Read existing file and update content
        const existingContent = yield* storage.readFile(nodeIndex.path).pipe(
          Effect.mapError(
            () =>
              new PersistenceError({
                originalMessage: `Failed to read node file: ${nodeIndex.path}`,
                operation: 'read',
              }),
          ),
        );

        const { metadata } = parseMarkdownWithFrontmatter(existingContent);
        const frontmatter = `---\ndescription: ${metadata.description || ''}\n${
          metadata.tags ? `tags: [${metadata.tags.join(', ')}]\n` : ''
        }---\n\n`;
        const updatedContent = frontmatter + (version.content || '');

        yield* storage.writeFile(nodeIndex.path, updatedContent).pipe(
          Effect.mapError(
            () =>
              new PersistenceError({
                originalMessage: `Failed to write node file: ${nodeIndex.path}`,
                operation: 'write',
              }),
          ),
        );

        // # Reason: Commit changes
        yield* storage.commit(version.commitMessage).pipe(
          Effect.mapError(
            () =>
              new PersistenceError({
                originalMessage: 'Failed to commit changes',
                operation: 'write',
              }),
          ),
        );

        return version;
      });

    // # Reason: Get the latest version of a node
    const getLatestVersion = (
      nodeId: string,
    ): Effect.Effect<Option.Option<ContentNodeVersion>, PersistenceError> =>
      Effect.gen(function* () {
        const indexes = yield* loadIndexes();

        // # Reason: Find node by ID using functional approach
        const nodeEntry = Object.entries(indexes.nodes).find(
          ([_, index]) => index.id === nodeId,
        );

        if (!nodeEntry) {
          return Option.none();
        }

        const [nodeName, nodeIndex] = nodeEntry;
        const isDirectory = nodeIndex.type === 'concatenate';

        let content: string;
        if (isDirectory) {
          const result = yield* processDirectoryNode(nodeIndex.path);
          content = result.content;
        } else {
          const fileContent = yield* storage.readFile(nodeIndex.path).pipe(
            Effect.mapError(
              () =>
                new PersistenceError({
                  originalMessage: `Failed to read node file: ${nodeIndex.path}`,
                  operation: 'read',
                }),
            ),
          );
          const { body } = parseMarkdownWithFrontmatter(fileContent);
          content = body;
        }

        // # Reason: Process inserts if present
        const processedContent = yield* processInserts(content, nodeName);

        const version: ContentNodeVersion = {
          id: crypto.randomUUID() as ContentNodeVersionId,
          content: processedContent,
          createdAt: Schema.decodeSync(Schema.DateTimeUtc)(
            new Date().toISOString(),
          ),
          commitMessage: 'Current version',
        };

        return Option.some(version);
      });

    // # Reason: List all nodes
    const listNodes = (): Effect.Effect<
      readonly ContentNode[],
      PersistenceError
    > =>
      Effect.gen(function* () {
        const indexes = yield* loadIndexes();

        // # Reason: Use functional approach to map nodes
        const nodes = yield* Effect.all(
          Object.entries(indexes.nodes).map(([name, index]) =>
            Effect.gen(function* () {
              const isDirectory = index.type === 'concatenate';

              if (isDirectory) {
                const { description } = yield* processDirectoryNode(index.path);
                return {
                  id: index.id as ContentNodeId,
                  name: name as Slug,
                  description,
                };
              } else {
                const content = yield* storage.readFile(index.path).pipe(
                  Effect.mapError(
                    () =>
                      new PersistenceError({
                        originalMessage: `Failed to read node file: ${index.path}`,
                        operation: 'read',
                      }),
                  ),
                );
                const { metadata } = parseMarkdownWithFrontmatter(content);
                return {
                  id: index.id as ContentNodeId,
                  name: name as Slug,
                  description: metadata.description || '',
                };
              }
            }),
          ),
        );

        return nodes;
      });

    // # Reason: Create a new tag
    const createTag = (
      tagData: Omit<Tag, 'id'>,
    ): Effect.Effect<Tag, PersistenceError> =>
      Effect.gen(function* () {
        const tagId = crypto.randomUUID() as TagId;
        const tag: Tag = { ...tagData, id: tagId };

        // # Reason: Update indexes
        const indexes = yield* loadIndexes();
        indexes.tags[tag.name] = {
          id: tagId,
          description: tag.description,
          nodes: [],
        };
        yield* saveIndexes(indexes);

        // # Reason: Commit changes
        yield* storage.commit(`Created tag: ${tag.name}`).pipe(
          Effect.mapError(
            () =>
              new PersistenceError({
                originalMessage: 'Failed to commit changes',
                operation: 'write',
              }),
          ),
        );

        return tag;
      });

    // # Reason: Find tag by name
    const findTagByName = (
      name: string,
    ): Effect.Effect<Tag, NotFoundError | PersistenceError> =>
      Effect.gen(function* () {
        const indexes = yield* loadIndexes();

        // # Reason: Check if tag exists in indexes
        if (indexes.tags[name]) {
          const tagIndex = indexes.tags[name];
          return {
            id: tagIndex.id as TagId,
            name: name as Slug,
            description: tagIndex.description,
          };
        }

        // # Reason: Check for implicit tags from node metadata using functional approach
        const nodesWithTag = yield* Effect.all(
          Object.entries(indexes.nodes)
            .filter(([_, index]) => index.type !== 'concatenate')
            .map(([nodeName, index]) =>
              storage.readFile(index.path).pipe(
                Effect.map((content) => {
                  const { metadata } = parseMarkdownWithFrontmatter(content);
                  return (metadata.tags || []).includes(name) ? nodeName : null;
                }),
                Effect.orElseSucceed(() => null),
              ),
            ),
        );

        const hasTag = nodesWithTag.some((n) => n !== null);
        if (hasTag) {
          return {
            id: crypto.randomUUID() as TagId,
            name: name as Slug,
            description: `Tag: ${name}`,
          };
        }

        return yield* Effect.fail(
          new NotFoundError({
            entityType: 'tag',
            entityId: name,
          }),
        );
      });

    // # Reason: List all tags
    const listTags = (): Effect.Effect<readonly Tag[], PersistenceError> =>
      Effect.gen(function* () {
        const indexes = yield* loadIndexes();
        const tags = new Map<string, Tag>();

        // # Reason: Add tags from indexes
        Object.entries(indexes.tags).forEach(([name, tagIndex]) => {
          tags.set(name, {
            id: tagIndex.id as TagId,
            name: name as Slug,
            description: tagIndex.description,
          });
        });

        // # Reason: Add implicit tags from node metadata using functional approach
        yield* Effect.all(
          Object.entries(indexes.nodes)
            .filter(([_, index]) => index.type !== 'concatenate')
            .map(([_, index]) =>
              storage.readFile(index.path).pipe(
                Effect.map((content) => {
                  const { metadata } = parseMarkdownWithFrontmatter(content);
                  (metadata.tags || []).forEach((tag) => {
                    if (!tags.has(tag)) {
                      tags.set(tag, {
                        id: crypto.randomUUID() as TagId,
                        name: tag as Slug,
                        description: `Tag: ${tag}`,
                      });
                    }
                  });
                }),
                Effect.orElseSucceed(() => undefined),
              ),
            ),
        );

        return Array.from(tags.values());
      });

    // # Reason: Tag a node
    const tagNode = (
      nodeId: string,
      tagId: string,
    ): Effect.Effect<void, NotFoundError | PersistenceError> =>
      Effect.gen(function* () {
        const indexes = yield* loadIndexes();

        // # Reason: Find node and tag using functional approach
        const nodeEntry = Object.entries(indexes.nodes).find(
          ([_, index]) => index.id === nodeId,
        );
        const tagEntry = Object.entries(indexes.tags).find(
          ([_, index]) => index.id === tagId,
        );

        if (!nodeEntry) {
          return yield* Effect.fail(
            new NotFoundError({
              entityType: 'content node',
              entityId: nodeId,
            }),
          );
        }

        if (!tagEntry) {
          return yield* Effect.fail(
            new NotFoundError({
              entityType: 'tag',
              entityId: tagId,
            }),
          );
        }

        const [nodeName, nodeIndex] = nodeEntry;
        const [tagName, tagIndex] = tagEntry;

        // # Reason: Update node file with tag
        const content = yield* storage.readFile(nodeIndex.path).pipe(
          Effect.mapError(
            () =>
              new PersistenceError({
                originalMessage: `Failed to read node file: ${nodeIndex.path}`,
                operation: 'read',
              }),
          ),
        );

        const { metadata, body } = parseMarkdownWithFrontmatter(content);
        const currentTags = metadata.tags || [];
        if (!currentTags.includes(tagName)) {
          currentTags.push(tagName);
        }

        const frontmatter = `---\ndescription: ${metadata.description || ''}\ntags: [${currentTags.join(
          ', ',
        )}]\n---\n\n`;
        const updatedContent = frontmatter + body;

        yield* storage.writeFile(nodeIndex.path, updatedContent).pipe(
          Effect.mapError(
            () =>
              new PersistenceError({
                originalMessage: `Failed to write node file: ${nodeIndex.path}`,
                operation: 'write',
              }),
          ),
        );

        // # Reason: Update tag index
        if (!tagIndex.nodes.includes(nodeName)) {
          tagIndex.nodes.push(nodeName);
        }
        yield* saveIndexes(indexes);

        // # Reason: Commit changes
        yield* storage.commit(`Tagged node ${nodeName} with ${tagName}`).pipe(
          Effect.mapError(
            () =>
              new PersistenceError({
                originalMessage: 'Failed to commit changes',
                operation: 'write',
              }),
          ),
        );
      });

    // # Reason: Initialize by walking filesystem on startup to ensure indexes exist
    yield* walkFileSystem().pipe(Effect.orElseSucceed(() => undefined));

    return PersistenceService.of({
      findNodeByName,
      createNode,
      addVersion,
      getLatestVersion,
      listNodes,
      createTag,
      findTagByName,
      listTags,
      tagNode,
    });
  }),
);
