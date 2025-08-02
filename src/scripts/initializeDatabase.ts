import { Effect, Console, Schema, HashMap } from 'effect';
import { Neo4jService } from '../services/neo4j';
import {
  createContentNode,
  createContentNodeVersion,
  tagContent,
} from '../services/content';
import {
  Slug,
  ContentNodeId,
  ContentNodeVersionId,
} from '../domain/types/branded';
import { TestCase, LLMModel } from '../domain/types/testCase';
import { InsertKey, InsertValue } from '../domain/types/contentNode';
import { cypher, queryParams } from '../domain/types/database';

/**
 * Initialize database with sample content for the unified content types
 * This script sets up initial data for a fresh Neo4j installation
 */

const createSampleContent = Effect.gen(function* () {
  yield* Console.log('Creating sample content nodes...');

  // Create greeting template
  const greetingNode = yield* createContentNode(
    Schema.decodeSync(Slug)('greeting-template'),
    'Template for greeting users with personalized messages',
  );

  const greetingVersion = yield* createContentNodeVersion(
    greetingNode.id,
    'Hello {{name}}, welcome to our {{service}}!',
    'Initial greeting template with parameters',
  );

  yield* tagContent(greetingNode.id, [
    Schema.decodeSync(Slug)('greeting'),
    Schema.decodeSync(Slug)('template'),
    Schema.decodeSync(Slug)('user-facing'),
  ]);

  // Create parameter nodes
  const userNameNode = yield* createContentNode(
    Schema.decodeSync(Slug)('default-user-name'),
    'Default user name parameter',
  );

  const userNameVersion = yield* createContentNodeVersion(
    userNameNode.id,
    'valued customer',
    'Default fallback user name',
    [
      {
        versionId: greetingVersion.id,
        operation: 'insert',
        key: 'name',
      },
    ],
  );

  yield* tagContent(userNameNode.id, [
    Schema.decodeSync(Slug)('parameter'),
    Schema.decodeSync(Slug)('user-data'),
  ]);

  const serviceNameNode = yield* createContentNode(
    Schema.decodeSync(Slug)('service-name'),
    'Service name parameter',
  );

  const serviceNameVersion = yield* createContentNodeVersion(
    serviceNameNode.id,
    'Janus AI Assistant',
    'Current service name',
    [
      {
        versionId: greetingVersion.id,
        operation: 'insert',
        key: 'service',
      },
    ],
  );

  yield* tagContent(serviceNameNode.id, [
    Schema.decodeSync(Slug)('parameter'),
    Schema.decodeSync(Slug)('branding'),
  ]);

  // Create instruction content
  const conciseInstruction = yield* createContentNode(
    Schema.decodeSync(Slug)('be-concise'),
    'Instruction for concise responses',
  );

  yield* createContentNodeVersion(
    conciseInstruction.id,
    'Be concise and direct in your responses. Avoid unnecessary elaboration.',
    'Conciseness guideline',
  );

  yield* tagContent(conciseInstruction.id, [
    Schema.decodeSync(Slug)('instruction'),
    Schema.decodeSync(Slug)('tone'),
    Schema.decodeSync(Slug)('system'),
  ]);

  const helpfulInstruction = yield* createContentNode(
    Schema.decodeSync(Slug)('be-helpful'),
    'Instruction for helpful responses',
  );

  yield* createContentNodeVersion(
    helpfulInstruction.id,
    'Be helpful and supportive. Provide clear, actionable guidance.',
    'Helpfulness guideline',
  );

  yield* tagContent(helpfulInstruction.id, [
    Schema.decodeSync(Slug)('instruction'),
    Schema.decodeSync(Slug)('behavior'),
    Schema.decodeSync(Slug)('system'),
  ]);

  // Create conversation starters
  const userGreeting = yield* createContentNode(
    Schema.decodeSync(Slug)('user-greeting'),
    'Standard user greeting',
  );

  yield* createContentNodeVersion(
    userGreeting.id,
    'Hello! I need help with {{topic}}.',
    'User greeting with topic parameter',
  );

  yield* tagContent(userGreeting.id, [
    Schema.decodeSync(Slug)('user-message'),
    Schema.decodeSync(Slug)('greeting'),
    Schema.decodeSync(Slug)('conversation-starter'),
  ]);

  const assistantResponse = yield* createContentNode(
    Schema.decodeSync(Slug)('assistant-greeting-response'),
    'Assistant response to user greeting',
  );

  yield* createContentNodeVersion(
    assistantResponse.id,
    "Hello! I'd be happy to help you with that. What specific questions do you have?",
    'Standard helpful response',
  );

  yield* tagContent(assistantResponse.id, [
    Schema.decodeSync(Slug)('assistant-message'),
    Schema.decodeSync(Slug)('greeting-response'),
    Schema.decodeSync(Slug)('supportive'),
  ]);

  yield* Console.log('Sample content created successfully!');
});

const createSampleTestCases = Effect.gen(function* () {
  yield* Console.log('Creating sample test cases...');

  const neo4j = yield* Neo4jService;

  // Create a basic conversation test case
  const basicConversationTest: TestCase = {
    id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
      'test-basic-conversation-001',
    ),
    name: 'Basic Support Conversation',
    description: 'Test basic user-assistant interaction with parameters',
    createdAt: Schema.decodeSync(Schema.DateTimeUtc)(new Date().toISOString()),
    llmModel: Schema.decodeSync(Schema.String.pipe(Schema.brand('LLMModel')))(
      'gpt-4',
    ),
    messageSlots: [
      {
        role: 'system',
        tags: [
          Schema.decodeSync(Slug)('instruction'),
          Schema.decodeSync(Slug)('behavior'),
        ],
        sequence: 0,
      },
      {
        role: 'user',
        tags: [
          Schema.decodeSync(Slug)('greeting'),
          Schema.decodeSync(Slug)('user-message'),
        ],
        sequence: 1,
      },
      {
        role: 'assistant',
        tags: [
          Schema.decodeSync(Slug)('greeting-response'),
          Schema.decodeSync(Slug)('assistant-message'),
        ],
        sequence: 2,
      },
    ],
    parameters: HashMap.set(
      HashMap.empty<InsertKey, InsertValue>(),
      Schema.decodeSync(InsertKey)('topic'),
      Schema.decodeSync(InsertValue)('TypeScript programming'),
    ),
  };

  // Store test case in database
  const createTestCaseQuery = cypher`
    CREATE (t:TestCase $props)
  `;
  const testCaseParams = yield* queryParams({ props: basicConversationTest });
  yield* neo4j.runQuery(createTestCaseQuery, testCaseParams);

  // Create an A/B testing scenario
  const abTestCaseA: TestCase = {
    id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
      'test-ab-concise-system-002',
    ),
    name: 'A/B Test - Concise System Prompt',
    description: 'Test with conciseness instruction in system role',
    createdAt: Schema.decodeSync(Schema.DateTimeUtc)(new Date().toISOString()),
    llmModel: Schema.decodeSync(Schema.String.pipe(Schema.brand('LLMModel')))(
      'gpt-4',
    ),
    messageSlots: [
      {
        role: 'system',
        tags: [Schema.decodeSync(Slug)('tone')],
        sequence: 0,
      },
      {
        role: 'user',
        tags: [Schema.decodeSync(Slug)('greeting')],
        sequence: 1,
      },
    ],
  };

  const abTestCaseB: TestCase = {
    id: Schema.decodeSync(Schema.String.pipe(Schema.brand('TestCaseId')))(
      'test-ab-concise-user-003',
    ),
    name: 'A/B Test - Concise User Prompt',
    description: 'Test with conciseness instruction in user role',
    createdAt: Schema.decodeSync(Schema.DateTimeUtc)(new Date().toISOString()),
    llmModel: Schema.decodeSync(Schema.String.pipe(Schema.brand('LLMModel')))(
      'gpt-4',
    ),
    messageSlots: [
      {
        role: 'system',
        tags: [Schema.decodeSync(Slug)('behavior')],
        sequence: 0,
      },
      {
        role: 'user',
        tags: [Schema.decodeSync(Slug)('tone')],
        sequence: 1,
      },
    ],
  };

  // Store A/B test cases
  const testCaseAParams = yield* queryParams({ props: abTestCaseA });
  yield* neo4j.runQuery(createTestCaseQuery, testCaseAParams);

  const testCaseBParams = yield* queryParams({ props: abTestCaseB });
  yield* neo4j.runQuery(createTestCaseQuery, testCaseBParams);

  yield* Console.log('Sample test cases created successfully!');
});

const createConstraints = Effect.gen(function* () {
  yield* Console.log('Creating database constraints...');

  const neo4j = yield* Neo4jService;

  // Create unique constraints
  const constraints = [
    'CREATE CONSTRAINT content_node_name IF NOT EXISTS FOR (n:ContentNode) REQUIRE n.name IS UNIQUE',
    'CREATE CONSTRAINT content_node_id IF NOT EXISTS FOR (n:ContentNode) REQUIRE n.id IS UNIQUE',
    'CREATE CONSTRAINT content_version_id IF NOT EXISTS FOR (v:ContentNodeVersion) REQUIRE v.id IS UNIQUE',
    'CREATE CONSTRAINT test_case_id IF NOT EXISTS FOR (t:TestCase) REQUIRE t.id IS UNIQUE',
    'CREATE CONSTRAINT tag_name IF NOT EXISTS FOR (tag:Tag) REQUIRE tag.name IS UNIQUE',
  ];

  for (const constraint of constraints) {
    try {
      yield* neo4j.runQuery(cypher`${constraint}`, {});
      yield* Console.log(`✓ Created constraint: ${constraint.split(' ')[2]}`);
    } catch (error) {
      // Constraint might already exist, that's okay
      yield* Console.log(
        `• Constraint may already exist: ${constraint.split(' ')[2]}`,
      );
    }
  }

  yield* Console.log('Database constraints setup complete!');
});

const createIndexes = Effect.gen(function* () {
  yield* Console.log('Creating database indexes...');

  const neo4j = yield* Neo4jService;

  // Create indexes for better query performance
  const indexes = [
    'CREATE INDEX content_node_description IF NOT EXISTS FOR (n:ContentNode) ON (n.description)',
    'CREATE INDEX content_version_created_at IF NOT EXISTS FOR (v:ContentNodeVersion) ON (v.createdAt)',
    'CREATE INDEX test_case_name IF NOT EXISTS FOR (t:TestCase) ON (t.name)',
    'CREATE INDEX test_case_model IF NOT EXISTS FOR (t:TestCase) ON (t.llmModel)',
  ];

  for (const index of indexes) {
    try {
      yield* neo4j.runQuery(cypher`${index}`, {});
      yield* Console.log(`✓ Created index: ${index.split(' ')[2]}`);
    } catch (error) {
      // Index might already exist, that's okay
      yield* Console.log(`• Index may already exist: ${index.split(' ')[2]}`);
    }
  }

  yield* Console.log('Database indexes setup complete!');
});

/**
 * Main initialization function
 * Run this to set up a fresh Neo4j database with sample content
 */
export const initializeDatabase = Effect.gen(function* () {
  yield* Console.log(
    '🚀 Initializing Janus Project database with unified content types...',
  );
  yield* Console.log('');

  // Create database structure
  yield* createConstraints;
  yield* createIndexes;

  // Create sample content
  yield* createSampleContent;
  yield* createSampleTestCases;

  yield* Console.log('');
  yield* Console.log('✅ Database initialization complete!');
  yield* Console.log('');
  yield* Console.log('Sample data created:');
  yield* Console.log('  • Content nodes with parameters and templates');
  yield* Console.log('  • Instruction content for system prompts');
  yield* Console.log('  • Conversation starters and responses');
  yield* Console.log('  • Test cases for A/B testing scenarios');
  yield* Console.log('');
  yield* Console.log(
    'You can now use the ContentService to create conversations and test cases!',
  );
});

// Export the main function for use in scripts
export default initializeDatabase;
