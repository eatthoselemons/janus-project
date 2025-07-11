import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { Composition, CompositionVersion, CompositionSnippet, Role } from "../composition"

describe("Role", () => {
  it.effect("should accept valid roles", () =>
    Effect.gen(function* () {
      const validRoles = ["system", "user_prompt", "model_response"]
      
      for (const role of validRoles) {
        const result = yield* Schema.decode(Role)(role)
        expect(result).toBe(role)
      }
    })
  )

  it.effect("should reject invalid roles", () =>
    Effect.gen(function* () {
      const invalidRoles = ["admin", "assistant", "user", "System", "USER_PROMPT", ""]
      
      for (const role of invalidRoles) {
        const result = yield* Effect.either(Schema.decode(Role)(role))
        expect(result._tag).toBe("Left")
      }
    })
  )
})

describe("CompositionSnippet", () => {
  it.effect("should decode valid composition snippet", () =>
    Effect.gen(function* () {
      const validSnippet = {
        snippetVersionId: "def45678-e89b-42d3-a456-426614174004",
        role: "system",
        sequence: 0
      }
      
      const result = yield* Schema.decode(CompositionSnippet)(validSnippet)
      expect(result).toEqual(validSnippet)
    })
  )

  it.effect("should accept different valid sequences", () =>
    Effect.gen(function* () {
      const sequences = [0, 1, 10, 100, 9999]
      
      for (const seq of sequences) {
        const validSnippet = {
          snippetVersionId: "def45678-e89b-42d3-a456-426614174004",
          role: "user_prompt",
          sequence: seq
        }
        
        const result = yield* Schema.decode(CompositionSnippet)(validSnippet)
        expect(result.sequence).toBe(seq)
      }
    })
  )

  it.effect("should reject negative sequences", () =>
    Effect.gen(function* () {
      const invalidSnippet = {
        snippetVersionId: "def45678-e89b-42d3-a456-426614174004",
        role: "system",
        sequence: -1
      }
      
      const result = yield* Effect.either(Schema.decode(CompositionSnippet)(invalidSnippet))
      expect(result._tag).toBe("Left")
    })
  )

  it.effect("should reject decimal sequences", () =>
    Effect.gen(function* () {
      const invalidSnippet = {
        snippetVersionId: "def45678-e89b-42d3-a456-426614174004",
        role: "model_response",
        sequence: 1.5
      }
      
      const result = yield* Effect.either(Schema.decode(CompositionSnippet)(invalidSnippet))
      expect(result._tag).toBe("Left")
    })
  )
})

describe("Composition", () => {
  it.effect("should decode valid composition", () =>
    Effect.gen(function* () {
      const validComposition = {
        id: "012ab345-e89b-42d3-a456-426614174005",
        name: "customer-support-prompt",
        description: "A composition for customer support interactions"
      }
      
      const result = yield* Schema.decode(Composition)(validComposition)
      expect(result).toEqual(validComposition)
    })
  )

  it.effect("should enforce slug format for name", () =>
    Effect.gen(function* () {
      const invalidComposition = {
        id: "012ab345-e89b-42d3-a456-426614174005",
        name: "Customer Support Prompt", // spaces and uppercase not allowed
        description: "Invalid name format"
      }
      
      const result = yield* Effect.either(Schema.decode(Composition)(invalidComposition))
      expect(result._tag).toBe("Left")
    })
  )
})

describe("CompositionVersion", () => {
  const validDate = "2024-01-01T15:30:00Z"

  it.effect("should decode valid composition version", () =>
    Effect.gen(function* () {
      const validVersion = {
        id: "678cd901-e89b-42d3-a456-426614174006",
        snippets: [
          {
            snippetVersionId: "def45678-e89b-42d3-a456-426614174004",
            role: "system",
            sequence: 0
          },
          {
            snippetVersionId: "abc12345-e89b-42d3-a456-426614174007",
            role: "user_prompt",
            sequence: 0
          }
        ],
        createdAt: validDate,
        commit_message: "Initial composition version"
      }
      
      const result = yield* Schema.decode(CompositionVersion)(validVersion)
      expect(result.id).toBe(validVersion.id)
      expect(result.snippets).toEqual(validVersion.snippets)
      expect(result.commit_message).toBe(validVersion.commit_message)
      expect(JSON.stringify(result.createdAt)).toBe('"2024-01-01T15:30:00.000Z"')
      expect(result.snippets).toHaveLength(2)
    })
  )

  it.effect("should handle empty snippets array", () =>
    Effect.gen(function* () {
      const validVersion = {
        id: "678cd901-e89b-42d3-a456-426614174006",
        snippets: [],
        createdAt: validDate,
        commit_message: "Empty composition for testing"
      }
      
      const result = yield* Schema.decode(CompositionVersion)(validVersion)
      expect(result.snippets).toEqual([])
      expect(JSON.stringify(result.createdAt)).toBe('"2024-01-01T15:30:00.000Z"')
    })
  )

  it.effect("should handle complex multi-snippet compositions", () =>
    Effect.gen(function* () {
      const complexVersion = {
        id: "678cd901-e89b-42d3-a456-426614174006",
        snippets: [
          {
            snippetVersionId: "def45678-e89b-42d3-a456-426614174004",
            role: "system",
            sequence: 0
          },
          {
            snippetVersionId: "abc12345-e89b-42d3-a456-426614174007",
            role: "system",
            sequence: 1
          },
          {
            snippetVersionId: "111aaaaa-e89b-42d3-a456-426614174008",
            role: "user_prompt",
            sequence: 0
          },
          {
            snippetVersionId: "222bbbbb-e89b-42d3-a456-426614174009",
            role: "model_response",
            sequence: 0
          }
        ],
        createdAt: validDate,
        commit_message: "Complex multi-role composition"
      }
      
      const result = yield* Schema.decode(CompositionVersion)(complexVersion)
      expect(result.snippets).toHaveLength(4)
      expect(JSON.stringify(result.createdAt)).toBe('"2024-01-01T15:30:00.000Z"')
      
      // Check that we have multiple system snippets
      const systemSnippets = result.snippets.filter(s => s.role === "system")
      expect(systemSnippets).toHaveLength(2)
      expect(systemSnippets[0].sequence).toBe(0)
      expect(systemSnippets[1].sequence).toBe(1)
    })
  )

  it.effect("should reject version with invalid snippet in array", () =>
    Effect.gen(function* () {
      const invalidVersion = {
        id: "678cd901-e89b-42d3-a456-426614174006",
        snippets: [
          {
            snippetVersionId: "def45678-e89b-42d3-a456-426614174004",
            role: "system",
            sequence: 0
          },
          {
            snippetVersionId: "not-a-uuid", // Invalid UUID
            role: "user_prompt",
            sequence: 0
          }
        ],
        createdAt: validDate,
        commit_message: "Invalid snippet ID"
      }
      
      const result = yield* Effect.either(Schema.decode(CompositionVersion)(invalidVersion))
      expect(result._tag).toBe("Left")
    })
  )

  it.effect("should accept detailed commit messages", () =>
    Effect.gen(function* () {
      const detailedMessage = `feat: Add customer support composition

- Added system prompt for friendly tone
- Included user prompt template with placeholders
- Set up model response guidance

This composition handles:
* Initial greetings
* Problem identification
* Solution suggestions
* Follow-up questions`
      
      const validVersion = {
        id: "678cd901-e89b-42d3-a456-426614174006",
        snippets: [],
        createdAt: validDate,
        commit_message: detailedMessage
      }
      
      const result = yield* Schema.decode(CompositionVersion)(validVersion)
      expect(result.commit_message).toBe(detailedMessage)
      expect(JSON.stringify(result.createdAt)).toBe('"2024-01-01T15:30:00.000Z"')
    })
  )
})