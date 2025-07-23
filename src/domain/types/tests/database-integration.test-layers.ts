import { Layer, ConfigProvider, Redacted, Schema } from 'effect';
import { ConfigService } from '../../../services/config';
import { Neo4jTest } from '../../../layers/neo4j/Neo4j.layer';
import { ConfigServiceLive } from '../../../layers/configuration/Configuration.layer';
import {
  Neo4jUri,
  Neo4jUser,
  ProviderName,
  ApiBaseUrl,
  LlmModel,
} from '../database';

// ===========================
// NEO4J TEST LAYERS
// ===========================

/**
 * Test layer with person query data
 */
export const Neo4jTestWithPersonData = Neo4jTest(
  new Map([
    [
      'MATCH (n:Person {name: $name}) RETURN n',
      [{ n: { name: 'Alice', age: 30 } }],
    ],
  ]),
);

/**
 * Test layer with complex person creation data
 */
export const Neo4jTestWithComplexPersonData = Neo4jTest(
  new Map([
    [
      'CREATE (n:Person $props) RETURN n',
      [{ n: { name: 'Bob', age: 25, tags: ['developer', 'typescript'] } }],
    ],
  ]),
);

/**
 * Test layer with transaction data for user and profile creation
 */
export const Neo4jTestWithTransactionData = Neo4jTest(
  new Map([
    ['CREATE (n:User {id: $id}) RETURN n', [{ n: { id: 1 } }]],
    ['CREATE (p:Profile {userId: $userId}) RETURN p', [{ p: { userId: 1 } }]],
  ]),
);

/**
 * Test layer with batch query data
 */
export const Neo4jTestWithBatchData = Neo4jTest(
  new Map([
    [
      'MATCH (n:Person) RETURN n',
      [{ n: { name: 'Alice' } }, { n: { name: 'Bob' } }],
    ],
    ['MATCH (n:Company) RETURN n', [{ n: { name: 'Acme Corp' } }]],
  ]),
);

// ===========================
// CONFIG TEST LAYERS
// ===========================

/**
 * Base valid Neo4j configuration
 */
const validNeo4jConfig = {
  NEO4J_URI: 'bolt://localhost:7687',
  NEO4J_USER: 'neo4j',
  NEO4J_PASSWORD: 'password',
};

/**
 * Base valid LLM provider configuration
 */
const validOpenAIConfig = {
  LLM_PROVIDERS: 'openai',
  LLM_OPENAI_API_KEY: 'sk-test',
  LLM_OPENAI_BASE_URL: 'https://api.openai.com/v1',
  LLM_OPENAI_MODEL: 'gpt-4',
};

/**
 * Test layer with valid Neo4j and OpenAI configuration
 */
export const ConfigTestValid = Layer.provide(
  ConfigServiceLive,
  Layer.setConfigProvider(
    ConfigProvider.fromMap(
      new Map(Object.entries({ ...validNeo4jConfig, ...validOpenAIConfig })),
    ),
  ),
);

/**
 * Test layer with only Neo4j configuration
 */
export const ConfigTestNeo4jOnly = Layer.provide(
  ConfigServiceLive,
  Layer.setConfigProvider(
    ConfigProvider.fromMap(new Map(Object.entries(validNeo4jConfig))),
  ),
);

/**
 * Test layer with invalid Neo4j URI
 */
export const ConfigTestInvalidUri = Layer.provide(
  ConfigServiceLive,
  Layer.setConfigProvider(
    ConfigProvider.fromMap(
      new Map(
        Object.entries({
          ...validNeo4jConfig,
          NEO4J_URI: 'invalid://localhost:7687',
        }),
      ),
    ),
  ),
);

/**
 * Test layer with invalid URL in LLM provider
 */
export const ConfigTestInvalidUrl = Layer.provide(
  ConfigServiceLive,
  Layer.setConfigProvider(
    ConfigProvider.fromMap(
      new Map(
        Object.entries({
          ...validNeo4jConfig,
          LLM_PROVIDERS: 'custom',
          LLM_CUSTOM_API_KEY: 'key',
          LLM_CUSTOM_BASE_URL: 'not-a-url',
          LLM_CUSTOM_MODEL: 'model',
        }),
      ),
    ),
  ),
);

/**
 * Test layer with mixed case provider name (should be normalized)
 */
export const ConfigTestMixedCaseProvider = Layer.provide(
  ConfigServiceLive,
  Layer.setConfigProvider(
    ConfigProvider.fromMap(
      new Map(
        Object.entries({
          ...validNeo4jConfig,
          LLM_PROVIDERS: 'OpenAI', // Mixed case
          LLM_OPENAI_API_KEY: 'sk-test',
          LLM_OPENAI_BASE_URL: 'https://api.openai.com/v1',
          LLM_OPENAI_MODEL: 'gpt-4',
        }),
      ),
    ),
  ),
);

/**
 * Test layer with invalid provider names
 */
export const ConfigTestInvalidProviderNames = Layer.provide(
  ConfigServiceLive,
  Layer.setConfigProvider(
    ConfigProvider.fromMap(
      new Map(
        Object.entries({
          ...validNeo4jConfig,
          LLM_PROVIDERS: 'open@ai,validprovider',
          LLM_OPEN_AI_API_KEY: 'sk-test',
          LLM_OPEN_AI_BASE_URL: 'https://api.openai.com/v1',
          LLM_OPEN_AI_MODEL: 'gpt-4',
          LLM_VALIDPROVIDER_API_KEY: 'key',
          LLM_VALIDPROVIDER_BASE_URL: 'https://api.example.com',
          LLM_VALIDPROVIDER_MODEL: 'model',
        }),
      ),
    ),
  ),
);

/**
 * Test layer with HTTP URI (wrong protocol for Neo4j)
 */
export const ConfigTestHttpUri = Layer.provide(
  ConfigServiceLive,
  Layer.setConfigProvider(
    ConfigProvider.fromMap(
      new Map(
        Object.entries({
          ...validNeo4jConfig,
          NEO4J_URI: 'http://localhost:7687',
        }),
      ),
    ),
  ),
);