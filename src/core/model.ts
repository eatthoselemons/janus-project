import { Effect, Data } from "effect";
import { Slug } from "./domain";

// --- Errors ---

export class InvalidSlugError extends Data.TaggedError("InvalidSlugError")<{
  readonly reason: string;
}> {}

// --- Smart Constructors ---

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Creates a `Slug` from a raw string.
 * It returns an `Effect` that can fail with an `InvalidSlugError`.
 */
export const createSlug = (
  raw: string
): Effect.Effect<Slug, InvalidSlugError> => {
  if (!slugRegex.test(raw)) {
    return Effect.fail(
      new InvalidSlugError({ reason: "Slug must be lowercase and contain only letters, numbers, and hyphens." })
    );
  }
  return Effect.succeed(raw as Slug);
};
