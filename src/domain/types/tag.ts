import { Schema } from 'effect';
import { TagId, Slug } from './branded';

/**
 * Tag - A label with description for organizing and querying entities
 * Used for categorizing snippets and compositions with meaningful context
 */
export const Tag = Schema.Struct({
  id: TagId,
  name: Slug,
  description: Schema.String,
});
export type Tag = typeof Tag.Type;
