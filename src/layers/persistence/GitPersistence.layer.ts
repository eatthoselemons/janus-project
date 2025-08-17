import { Effect, Layer, Option, Schema } from 'effect';
import { Brand } from 'effect/Brand';
import { ContentNode, ContentNodeVersion, Slug, Tag } from '../../domain';
import { NotFoundError, PersistenceError } from '../../domain/types/errors';
import { PersistenceService } from '../../services/persistence/Persistence.service';
import { FileSystemStorageService } from '../../services/low-level/FileSystemStorage.service';

export const GitPersistenceLive = Layer.effect(
  PersistenceService,
  Effect.gen(function* () {
    const storage = yield* FileSystemStorageService;

    // This is a simplified implementation. A real implementation would need
    // to handle relationships, indexing, and other database features.

    const findNodeByName = (name: Slug) =>
      Effect.gen(function* () {
        const content = yield* storage.readFile(`nodes/${name}.json`);
        const json = JSON.parse(content);
        return yield* Schema.decodeUnknown(ContentNode)(json);
      });

    const createNode = (nodeData: Omit<ContentNode, 'id'>) =>
      Effect.gen(function* () {
        const id = Brand.branded<ContentNode['id']>(crypto.randomUUID());
        const node = { ...nodeData, id };
        const content = JSON.stringify(node, null, 2);
        yield* storage.writeFile(`nodes/${node.name}.json`, content);
        yield* storage.commit(`Created node: ${node.name}`);
        return node;
      });

    const addVersion = (
      nodeId: string,
      versionData: Omit<ContentNodeVersion, 'id' | 'createdAt'>,
    ) =>
      Effect.gen(function* () {
        // In a real git implementation, we would find the node by its ID.
        // For this simplified version, we assume the nodeId is the name.
        const node = yield* findNodeByName(nodeId as Slug);

        const id = Brand.branded<ContentNodeVersion['id']>(crypto.randomUUID());
        const createdAt = new Date();
        const version = { ...versionData, id, createdAt };

        const content = JSON.stringify(version, null, 2);
        const path = `versions/${node.name}/${id}.json`;
        yield* storage.writeFile(path, content);
        yield* storage.commit(`Added version to node: ${node.name}`);
        return version;
      });

    const getLatestVersion = (nodeId: string) =>
      Effect.gen(function* () {
        // This is a simplified implementation. A real implementation would
        // read the directory and find the latest version by date.
        return Option.none();
      });

    const listNodes = () =>
      Effect.gen(function* () {
        const files = yield* storage.listFiles('nodes');
        return yield* Effect.forEach(files, (file) => {
          const name = file.replace('.json', '');
          return findNodeByName(name as Slug);
        });
      });

    const createTag = (tagData: Omit<Tag, 'id'>) =>
      Effect.gen(function* () {
        const id = Brand.branded<Tag['id']>(crypto.randomUUID());
        const tag = { ...tagData, id };
        const content = JSON.stringify(tag, null, 2);
        yield* storage.writeFile(`tags/${tag.name}.json`, content);
        yield* storage.commit(`Created tag: ${tag.name}`);
        return tag;
      });

    const findTagByName = (name: string) =>
      Effect.gen(function* () {
        const content = yield* storage.readFile(`tags/${name}.json`);
        const json = JSON.parse(content);
        return yield* Schema.decodeUnknown(Tag)(json);
      });

    const listTags = () =>
      Effect.gen(function* () {
        const files = yield* storage.listFiles('tags');
        return yield* Effect.forEach(files, (file) => {
          const name = file.replace('.json', '');
          return findTagByName(name);
        });
      });

    const tagNode = (nodeId: string, tagId: string) =>
      Effect.gen(function* () {
        // In a real implementation, this would create a relationship
        // For now, we'll store it as a simple mapping file
        const mapping = { nodeId, tagId, createdAt: new Date() };
        const content = JSON.stringify(mapping, null, 2);
        const filename = `${nodeId}-${tagId}.json`;
        yield* storage.writeFile(`node-tags/${filename}`, content);
        yield* storage.commit(`Tagged node ${nodeId} with tag ${tagId}`);
      });

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
