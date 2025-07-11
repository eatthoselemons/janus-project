import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import {
  SnippetId,
  SnippetVersionId,
  ParameterId,
  ParameterOptionId,
  CompositionId,
  CompositionVersionId,
  TestRunId,
  DataPointId,
  TagId,
  Slug,
  RelationshipStrength
} from "../branded"

describe("Branded UUID Types", () => {
  const validUUID = "123e4567-e89b-42d3-a456-426614174000"
  const invalidUUIDs = [
    "not-a-uuid",
    "123e4567-e89b-12d3-a456-426614174000", // wrong version (not 4)
    "123e4567-e89b-42d3-z456-426614174000", // invalid character 'z'
    "123e4567e89b42d3a456426614174000", // missing hyphens
    "123e4567-e89b-42d3-a456-42661417400", // too short
    "123e4567-e89b-42d3-a456-4266141740000", // too long
    "",
    "   ",
  ]

  // Test factory for all ID types
  const testIdType = <T>(
    name: string,
    schema: Schema.Schema<T, string>
  ) => {
    describe(name, () => {
      it.effect("should validate correct UUID", () =>
        Effect.gen(function* () {
          const result = yield* Schema.decode(schema)(validUUID)
          expect(result).toBe(validUUID)
        })
      )

      invalidUUIDs.forEach((invalidId) => {
        it.effect(`should reject invalid UUID: "${invalidId}"`, () =>
          Effect.gen(function* () {
            const result = yield* Effect.either(Schema.decode(schema)(invalidId))
            expect(result._tag).toBe("Left")
          })
        )
      })
    })
  }

  // Test all ID types
  testIdType("SnippetId", SnippetId)
  testIdType("SnippetVersionId", SnippetVersionId)
  testIdType("ParameterId", ParameterId)
  testIdType("ParameterOptionId", ParameterOptionId)
  testIdType("CompositionId", CompositionId)
  testIdType("CompositionVersionId", CompositionVersionId)
  testIdType("TestRunId", TestRunId)
  testIdType("DataPointId", DataPointId)
  testIdType("TagId", TagId)
})

describe("Slug", () => {
  const validSlugs = [
    "my-snippet",
    "test-123",
    "a",
    "123",
    "hello-world-123",
    "parameter-option-value",
  ]

  const invalidSlugs = [
    "My-Snippet", // uppercase
    "my_snippet", // underscore
    "my snippet", // space
    "my-snippet-", // trailing hyphen
    "-my-snippet", // leading hyphen
    "my--snippet", // double hyphen
    "", // empty
    "   ", // whitespace
    "a".repeat(101), // too long
    "my.snippet", // dot
    "my@snippet", // special character
  ]

  validSlugs.forEach((slug) => {
    it.effect(`should accept valid slug: "${slug}"`, () =>
      Effect.gen(function* () {
        const result = yield* Schema.decode(Slug)(slug)
        expect(result).toBe(slug)
      })
    )
  })

  invalidSlugs.forEach((slug) => {
    it.effect(`should reject invalid slug: "${slug}"`, () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(Schema.decode(Slug)(slug))
        expect(result._tag).toBe("Left")
      })
    )
  })

  it.effect("should enforce minimum length", () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(Schema.decode(Slug)(""))
      expect(result._tag).toBe("Left")
    })
  )

  it.effect("should enforce maximum length", () =>
    Effect.gen(function* () {
      const longSlug = "a-".repeat(50) + "a" // 101 characters
      const result = yield* Effect.either(Schema.decode(Slug)(longSlug))
      expect(result._tag).toBe("Left")
    })
  )
})

describe("RelationshipStrength", () => {
  const validStrengths = [0, 0.5, 1, 0.123456789]
  const invalidStrengths = [-0.1, 1.1, -1, 2, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NaN]

  validStrengths.forEach((strength) => {
    it.effect(`should accept valid strength: ${strength}`, () =>
      Effect.gen(function* () {
        const result = yield* Schema.decode(RelationshipStrength)(strength)
        expect(result).toBe(strength)
      })
    )
  })

  invalidStrengths.forEach((strength) => {
    it.effect(`should reject invalid strength: ${strength}`, () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(Schema.decode(RelationshipStrength)(strength))
        expect(result._tag).toBe("Left")
      })
    )
  })

  it.effect("should accept edge case: exactly 0", () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(RelationshipStrength)(0)
      expect(result).toBe(0)
    })
  )

  it.effect("should accept edge case: exactly 1", () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(RelationshipStrength)(1)
      expect(result).toBe(1)
    })
  )
})