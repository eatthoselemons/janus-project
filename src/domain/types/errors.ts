import { Data, Schema } from 'effect';
import { AnyId, Slug } from './branded';

/**
 * Base error class for all Janus errors
 * Uses Data.TaggedError for simple error with just a message
 */
export class JanusError extends Data.TaggedError('JanusError')<{
  message: string;
}> {}

/**
 * Persistence error for database operations
 * Includes operation type and optional query for debugging
 */
export class PersistenceError extends Schema.TaggedError<PersistenceError>()(
  'PersistenceError',
  {
    originalMessage: Schema.String,
    query: Schema.optional(Schema.String),
    operation: Schema.Literal('create', 'read', 'update', 'delete', 'connect'),
  },
) {
  get message() {
    return `Database ${this.operation} failed: ${this.originalMessage}`;
  }
}

/**
 * LLM API error for failures from language model providers
 * Includes provider name and optional status code
 */
export class LlmApiError extends Schema.TaggedError<LlmApiError>()(
  'LlmApiError',
  {
    provider: Schema.String,
    statusCode: Schema.optional(Schema.Number),
    originalMessage: Schema.String,
  },
) {
  get message() {
    const status = this.statusCode ? ` (${this.statusCode})` : '';
    const truncatedMessage =
      this.originalMessage.length > 100
        ? this.originalMessage.substring(0, 100) + '...'
        : this.originalMessage;
    return `LLM API error from ${this.provider}${status}: ${truncatedMessage}`;
  }
}

/**
 * File system error for file IO operations
 * Includes path and operation type
 */
export class FileSystemError extends Schema.TaggedError<FileSystemError>()(
  'FileSystemError',
  {
    path: Schema.String,
    operation: Schema.Literal('read', 'write', 'delete', 'mkdir'),
    originalMessage: Schema.String,
  },
) {
  get message() {
    return `File system ${this.operation} error at ${this.path}: ${this.originalMessage}`;
  }
}

/**
 * Not found error for entity lookup failures
 * Includes entity type and either an ID or slug identifier
 */
export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  'NotFoundError',
  {
    entityType: Schema.Literal(
      'snippet',
      'parameter',
      'composition',
      'tag',
      'test-run',
      'data-point',
    ),
    id: Schema.optional(AnyId),
    slug: Schema.optional(Slug),
  },
) {
  get message() {
    const identifier = this.id ?? this.slug ?? 'unknown';
    return `${this.entityType} not found: ${identifier}`;
  }
}

/**
 * Conflict error for import/merge operations
 * Includes details about the conflicting entities
 */
export class ConflictError extends Schema.TaggedError<ConflictError>()(
  'ConflictError',
  {
    entityType: Schema.Literal(
      'snippet',
      'snippet-version',
      'parameter',
      'parameter-option',
      'composition',
      'composition-version',
      'tag',
      'test-run',
      'data-point',
    ),
    existingId: AnyId,
    importingId: AnyId,
    conflictField: Schema.String,
    originalMessage: Schema.String,
  },
) {
  get message() {
    return `Import conflict for ${this.entityType}: ${this.originalMessage} (existing: ${this.existingId}, importing: ${this.importingId}, field: ${this.conflictField})`;
  }
}

/**
 * Union type for all Janus errors
 */
export type JanusErrors =
  | JanusError
  | PersistenceError
  | LlmApiError
  | FileSystemError
  | NotFoundError
  | ConflictError;
