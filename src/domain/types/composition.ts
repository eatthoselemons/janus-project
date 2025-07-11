import { Schema } from "effect"
import { CompositionId, CompositionVersionId, SnippetVersionId, Slug } from "./branded"

/**
 * Role - The type of message in a composition
 * Defines how a snippet is used within a prompt composition
 */
export const Role = Schema.Literal("system", "user_prompt", "model_response")
export type Role = typeof Role.Type

/**
 * CompositionSnippet - Represents a snippet's role and position in a composition
 * This is the junction type that links snippets to compositions with additional metadata
 */
export const CompositionSnippet = Schema.Struct({
  snippetVersionId: SnippetVersionId,
  role: Role,
  sequence: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({
      description: "The order of the snippet within its role"
    })
  )
})
export type CompositionSnippet = typeof CompositionSnippet.Type

/**
 * Composition - The abstract container for a composition and all its versions
 * Represents a recipe that defines how to assemble multiple snippets into a complete prompt
 */
export const Composition = Schema.Struct({
  id: CompositionId,
  name: Slug,
  description: Schema.String
})
export type Composition = typeof Composition.Type

/**
 * CompositionVersion - An immutable snapshot of a composition
 * Locks in specific snippet versions in a defined order and role
 */
export const CompositionVersion = Schema.Struct({
  id: CompositionVersionId,
  snippets: Schema.Array(CompositionSnippet),
  createdAt: Schema.DateTimeUtc,
  commit_message: Schema.String // Mandatory message explaining the change
})
export type CompositionVersion = typeof CompositionVersion.Type