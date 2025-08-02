import { Layer, Effect } from 'effect';
import { StorageService } from '../../services/storage';
import { Neo4jService } from '../../services/neo4j';
import { createNeo4jStorage } from '../../services/storage/neo4j/Neo4jStorage';

/**
 * Neo4j implementation of the StorageService
 * This layer depends on Neo4jService and provides StorageService
 */
export const Neo4jStorageLive = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;
    return StorageService.of(createNeo4jStorage(neo4j));
  }),
);
