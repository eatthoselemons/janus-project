import { Context, Redacted } from 'effect';

/**
 * ConfigService provides type-safe access to application configuration
 * All sensitive values (passwords, API keys) are wrapped with Redacted
 */
export class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  {
    readonly neo4j: {
      readonly uri: string;
      readonly user: string;
      readonly password: Redacted.Redacted<string>;
    };
    readonly llm: {
      readonly providers: Record<
        string,
        {
          readonly apiKey: Redacted.Redacted<string>;
          readonly baseUrl: string;
          readonly model: string;
        }
      >;
    };
  }
>() {}

// Re-export utility functions
export * from './utils';
