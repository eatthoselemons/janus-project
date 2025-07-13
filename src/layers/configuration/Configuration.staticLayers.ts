import { Layer, Redacted } from 'effect';
import { ConfigService } from '../../services/config';

// Test layer with mock configuration for testing
export const ConfigServiceTest = Layer.succeed(
  ConfigService,
  ConfigService.of({
    neo4j: {
      uri: 'bolt://localhost:7687',
      user: 'neo4j',
      password: Redacted.make('test-password'),
    },
    llm: {
      providers: {
        openai: {
          apiKey: Redacted.make('sk-test-key'),
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4',
        },
      },
    },
  }),
);
