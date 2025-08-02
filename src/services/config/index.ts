import { Context, Redacted } from 'effect';
import {
  Neo4jUri,
  Neo4jUser,
  ProviderName,
  ApiBaseUrl,
  LlmModel,
} from '../../domain/types';

/**
 * ConfigService provides type-safe access to application configuration
 * All sensitive values (passwords, API keys) are wrapped with Redacted
 */
export class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  {
    readonly storageBackend?: 'neo4j' | 'git';
    readonly neo4j: {
      readonly uri: Neo4jUri;
      readonly user: Neo4jUser;
      readonly password: Redacted.Redacted<string>;
    };
    readonly git?: {
      readonly dataPath?: string;
      readonly mode?: 'lossless' | 'lossy';
    };
    readonly llm: {
      readonly providers: Record<
        ProviderName,
        {
          readonly apiKey: Redacted.Redacted<string>;
          readonly baseUrl: ApiBaseUrl;
          readonly model: LlmModel;
        }
      >;
    };
  }
>() {}

// Re-export utility functions
export * from './utils';
