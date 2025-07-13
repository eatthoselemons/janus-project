import { Schema } from 'effect';
import { TagId, Slug } from './branded';

/**
 * Tag - A simple label for organizing and querying entities
 * Used for categorizing snippets and compositions
 */
export const Tag = Schema.Struct({
  id: TagId,
  name: Slug,
});
export type Tag = typeof Tag.Type;
