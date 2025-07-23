import { Layer, Redacted, Schema } from 'effect';
import { ConfigService } from '../../services/config';
import {
  Neo4jUri,
  Neo4jUser,
  ProviderName,
  ApiBaseUrl,
  LlmModel,
} from '../../domain/types';

// Test layer with mock configuration for testing
export const ConfigServiceTest = Layer.succeed(
  ConfigService,
  ConfigService.of({
    neo4j: {
      uri: Schema.decodeSync(Neo4jUri)('bolt://localhost:7687'),
      user: Schema.decodeSync(Neo4jUser)('neo4j'),
      password: Redacted.make('test-password'),
    },
    llm: {
      providers: {
        [Schema.decodeSync(ProviderName)('openai')]: {
          apiKey: Redacted.make('sk-test-key'),
          baseUrl: Schema.decodeSync(ApiBaseUrl)('https://api.openai.com/v1'),
          model: Schema.decodeSync(LlmModel)('gpt-4'),
        },
      },
    },
  }),
);
