import { Effect, Context, Option } from 'effect';
import { ContentNode, ContentNodeVersion, Slug, Tag } from '../../domain';
import { NotFoundError, PersistenceError } from '../../domain/types/errors';

/**
 * The PersistenceService is the single source of truth for all data persistence operations.
 * It provides a high-level, business-logic-oriented API for creating, reading,
 * updating, and deleting domain entities.
 *
 * This service is an abstraction and can be implemented by different backends,
 * such as a Neo4j database or a Git-based file system. The rest of the application
 * should only ever depend on this service, not on any specific implementation.
 */
export interface PersistenceServiceImpl {
  /**
   * Finds a ContentNode by its unique slug name.
   */
  readonly findNodeByName: (
    name: Slug,
  ) => Effect.Effect<ContentNode, NotFoundError | PersistenceError>;

  /**
   * Creates a new ContentNode.
   */
  readonly createNode: (
    nodeData: Omit<ContentNode, 'id'>,
  ) => Effect.Effect<ContentNode, PersistenceError>;

  /**
   * Adds a new version to a ContentNode.
   */
  readonly addVersion: (
    nodeId: string,
    versionData: Omit<ContentNodeVersion, 'id' | 'createdAt'>,
  ) => Effect.Effect<ContentNodeVersion, PersistenceError | NotFoundError>;

  /**
   * Retrieves the latest version of a specific ContentNode.
   */
  readonly getLatestVersion: (
    nodeId: string,
  ) => Effect.Effect<Option.Option<ContentNodeVersion>, PersistenceError>;

  /**
   * Lists all ContentNodes.
   */
  readonly listNodes: () => Effect.Effect<
    readonly ContentNode[],
    PersistenceError
  >;

  /**
   * Creates a new Tag.
   */
  readonly createTag: (
    tagData: Omit<Tag, 'id'>,
  ) => Effect.Effect<Tag, PersistenceError>;

  /**
   * Finds a Tag by its unique slug name.
   */
  readonly findTagByName: (
    name: Slug,
  ) => Effect.Effect<Tag, NotFoundError | PersistenceError>;

  /**
   * Lists all Tags.
   */
  readonly listTags: () => Effect.Effect<readonly Tag[], PersistenceError>;

  /**
   * Attaches a Tag to a ContentNode.
   */
  readonly tagNode: (
    nodeId: string,
    tagId: string,
  ) => Effect.Effect<void, PersistenceError | NotFoundError>;
}

export class PersistenceService extends Context.Tag('PersistenceService')<
  PersistenceService,
  PersistenceServiceImpl
>() {}
