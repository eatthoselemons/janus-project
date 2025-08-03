import { Layer, Effect } from 'effect';
import { StorageService } from '../../services/storage';
import { ConfigService } from '../../services/config';
import { Neo4jService } from '../../services/neo4j';
import { createNeo4jStorage } from '../../services/storage/neo4j/Neo4jStorage';
import { Neo4jError } from '../../domain/types/errors';

/**
 * Neo4j implementation of the StorageService
 * This layer depends on ConfigService and Neo4jService, and provides StorageService
 */
export const Neo4jStorageLive = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const config = yield* ConfigService;

    // Validate Neo4j configuration exists
    if (!config.neo4j) {
      return yield* Effect.fail(
        new Neo4jError({
          query: '',
          originalMessage: 'Neo4j configuration is missing',
        }),
      );
    }

    const neo4j = yield* Neo4jService;
    return StorageService.of(createNeo4jStorage(neo4j));
  }),
);
