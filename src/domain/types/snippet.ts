import { Schema } from "effect"
import { SnippetId, SnippetVersionId, Slug } from "./branded"

/**
 * Snippet - The abstract container for a snippet and all its versions
 * Represents a reusable building block of prompts with a consistent name
 */
export const Snippet = Schema.Struct({
  id: SnippetId,
  name: Slug,
  description: Schema.String
})
export type Snippet = typeof Snippet.Type

/**
 * SnippetVersion - An immutable snapshot of a snippet's content at a specific point in time
 * Contains the actual template content with placeholders like {{variable_name}}
 */
export const SnippetVersion = Schema.Struct({
  id: SnippetVersionId,
  content: Schema.String, // Template string, e.g., "You {{obligation_level}} answer the question"
  createdAt: Schema.DateTimeUtc,
  commit_message: Schema.String // Mandatory message explaining the change
})
export type SnippetVersion = typeof SnippetVersion.Type