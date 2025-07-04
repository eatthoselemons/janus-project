import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { createSlug, InvalidSlugError } from "./model";

describe("createSlug", () => {
  it("should create a slug from a valid string", () => {
    const validSlug = "a-valid-slug-123";
    const effect = createSlug(validSlug);
    const result = Effect.runSync(effect);
    expect(result).toBe(validSlug);
  });

  it("should fail for a slug with uppercase letters", () => {
    const invalidSlug = "Invalid-Slug";
    const effect = createSlug(invalidSlug);
    const result = Effect.runSync(Effect.either(effect));
    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(InvalidSlugError);
    }
  });

  it("should fail for a slug with spaces", () => {
    const invalidSlug = "invalid slug";
    const effect = createSlug(invalidSlug);
    const result = Effect.runSync(Effect.either(effect));
    expect(result._tag).toBe("Left");
  });

  it("should fail for a slug with special characters", () => {
    const invalidSlug = "invalid_slug!";
    const effect = createSlug(invalidSlug);
    const result = Effect.runSync(Effect.either(effect));
    expect(result._tag).toBe("Left");
  });

  it("should fail for a slug starting or ending with a hyphen", () => {
    const invalidSlug1 = "-invalid-slug";
    const invalidSlug2 = "invalid-slug-";
    const effect1 = createSlug(invalidSlug1);
    const effect2 = createSlug(invalidSlug2);
    const result1 = Effect.runSync(Effect.either(effect1));
    const result2 = Effect.runSync(Effect.either(effect2));
    expect(result1._tag).toBe("Left");
    expect(result2._tag).toBe("Left");
  });
});
