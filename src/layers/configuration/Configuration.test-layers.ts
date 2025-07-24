import { Layer, Redacted, Schema } from 'effect';
import { ConfigService } from '../../services/config';
import { makeTestLayerFor } from '../../lib/test-utils';
import {
  Neo4jUri,
  Neo4jUser,
  ProviderName,
  ApiBaseUrl,
  LlmModel,
} from '../../domain/types';

/**
 * Test layer with mock configuration
 */
export const ConfigServiceTest = (
  config: {
    neo4j?: {
      uri?: string;
      user?: string;
      password?: string;
    };
    llm?: {
      providers?: Record<
        string,
        {
          apiKey: string;
          baseUrl: string;
          model: string;
        }
      >;
    };
  } = {},
) =>
  Layer.succeed(
    ConfigService,
    ConfigService.of({
      neo4j: {
        uri: Schema.decodeSync(Neo4jUri)(
          config.neo4j?.uri ?? 'bolt://localhost:7687',
        ),
        user: Schema.decodeSync(Neo4jUser)(config.neo4j?.user ?? 'test-user'),
        password: Redacted.make(config.neo4j?.password ?? 'test-password'),
      },
      llm: {
        providers: Object.entries(config.llm?.providers ?? {}).reduce(
          (acc, [name, provider]) => {
            acc[Schema.decodeSync(ProviderName)(name)] = {
              apiKey: Redacted.make(provider.apiKey),
              baseUrl: Schema.decodeSync(ApiBaseUrl)(provider.baseUrl),
              model: Schema.decodeSync(LlmModel)(provider.model),
            };
            return acc;
          },
          {} as Record<
            ProviderName,
            {
              apiKey: Redacted.Redacted<string>;
              baseUrl: ApiBaseUrl;
              model: LlmModel;
            }
          >,
        ),
      },
    }),
  );

/**
 * Create a partial test layer using makeTestLayer pattern
 * Useful for tests that only need specific config values
 *
 * @example
 * ```ts
 * const layer = ConfigServiceTestPartial({
 *   neo4j: { uri: 'bolt://test:7687' }
 * });
 * ```
 */
export const ConfigServiceTestPartial = (
  impl: Partial<{
    neo4j: {
      uri: Neo4jUri;
      user: Neo4jUser;
      password: Redacted.Redacted<string>;
    };
    llm: {
      providers: Record<
        ProviderName,
        {
          apiKey: Redacted.Redacted<string>;
          baseUrl: ApiBaseUrl;
          model: LlmModel;
        }
      >;
    };
  }>,
) => {
  return makeTestLayerFor(ConfigService)(impl);
};
