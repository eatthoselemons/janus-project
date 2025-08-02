import { Effect, HashMap, Chunk } from 'effect';
import { Neo4jService } from '../neo4j';
import { PersistenceError } from '../../domain/types/errors';
import { cypher, queryParams } from '../../domain/types/database';
import {
  ContentNodeVersionId,
  ParameterContext,
  ParameterKey,
  ParameterValue,
} from '../../domain/types/contentNode';
import {
  TestCase,
  MessageSlot,
  Message,
  Conversation,
} from '../../domain/types/testCase';
import { processContentFromId } from './ContentProcessing';

/**
 * Find content matching message slot criteria
 */
export const findContentForSlot = (
  slot: MessageSlot,
  _parameters: ParameterContext,
): Effect.Effect<ContentNodeVersionId[], PersistenceError, Neo4jService> =>
  Effect.gen(function* () {
    const neo4j = yield* Neo4jService;

    // Build query based on slot configuration
    const queryParts: string[] = [
      'MATCH (n:ContentNode)-[:VERSION_OF]-(v:ContentNodeVersion)',
    ];
    const whereConditions: string[] = [];

    // Add tag filtering if specified
    if (slot.tags && slot.tags.length > 0) {
      whereConditions.push(
        'ALL(tag IN $tags WHERE (n)-[:HAS_TAG]->(:Tag {name: tag}))',
      );
    }

    // Add exclusions
    if (slot.excludeNodes && slot.excludeNodes.length > 0) {
      whereConditions.push(
        'NOT n.id IN $excludeIds AND NOT n.name IN $excludeNames',
      );
    }

    // Add inclusions
    if (slot.includeNodes && slot.includeNodes.length > 0) {
      whereConditions.push('(n.id IN $includeIds OR n.name IN $includeNames)');
    }

    if (whereConditions.length > 0) {
      queryParts.push('WHERE ' + whereConditions.join(' AND '));
    }

    queryParts.push('RETURN v.id as versionId');
    queryParts.push('ORDER BY v.createdAt DESC');

    const query = cypher`${queryParts.join(' ')}`;

    const params = yield* queryParams({
      tags: slot.tags || [],
      excludeIds: slot.excludeNodes?.filter((n) => n.includes('-')) || [],
      excludeNames: slot.excludeNodes?.filter((n) => !n.includes('-')) || [],
      includeIds: slot.includeNodes?.filter((n) => n.includes('-')) || [],
      includeNames: slot.includeNodes?.filter((n) => !n.includes('-')) || [],
    });

    const results = yield* neo4j.runQuery<{ versionId: ContentNodeVersionId }>(
      query,
      params,
    );
    return results.map((r) => r.versionId);
  })
    .pipe(
      Effect.mapError((error) => {
        if (error instanceof PersistenceError) {
          return error;
        }
        return new PersistenceError({
          originalMessage: String(error),
          operation: 'read',
        });
      }),
    )
    .pipe(Effect.withSpan('ContentService.findContentForSlot'));

/**
 * Build conversation from TestCase
 */
export const buildConversationFromTestCase = (
  testCase: TestCase,
): Effect.Effect<Conversation, Error | PersistenceError, Neo4jService> =>
  Effect.gen(function* () {
    // Annotate span with test case info
    yield* Effect.annotateCurrentSpan({
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      slotCount: testCase.messageSlots.length,
      llmModel: testCase.llmModel,
    });

    // Sort slots by sequence
    const sortedSlots = [...testCase.messageSlots].sort(
      (a, b) => a.sequence - b.sequence,
    );

    // Process each slot
    const messages = yield* Effect.forEach(sortedSlots, (slot) =>
      Effect.gen(function* () {
        // Find content matching slot criteria
        const versionIds = yield* findContentForSlot(
          slot,
          testCase.parameters || HashMap.empty(),
        );

        if (versionIds.length === 0) {
          return yield* Effect.fail(
            new Error(`No content found for slot with role ${slot.role}`),
          );
        }

        // Process all matching content and concatenate
        const contents = yield* Effect.forEach(versionIds, (versionId) =>
          processContentFromId(
            versionId,
            testCase.parameters || HashMap.empty(),
            { includeTags: slot.tags },
          ),
        );

        const combinedContent = contents.filter(Boolean).join('\n');
        return { role: slot.role, content: combinedContent } satisfies Message;
      }),
    );

    // Convert array to Chunk for Conversation type
    return Chunk.fromIterable(messages);
  }).pipe(Effect.withSpan('ContentService.buildConversationFromTestCase'));