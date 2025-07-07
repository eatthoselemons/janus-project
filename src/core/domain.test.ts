import { describe, it, expect } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Domain from "./domain"

describe("Domain Schemas", () => {
  // --- Branded ID Types Tests ---
  
  describe("SnippetId", () => {
    it("accepts valid UUID format", () => {
      const valid = "123e4567-e89b-12d3-a456-426614174000"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.SnippetId)(valid)
      )
      expect(result).toBe(valid)
    })

    it("accepts any string (edge case)", () => {
      const edgeCase = "not-a-uuid-but-still-valid"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.SnippetId)(edgeCase)
      )
      expect(result).toBe(edgeCase)
    })

    it("rejects non-string types", () => {
      const invalid = 12345
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.SnippetId)(invalid)
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("SnippetVersionId", () => {
    it("accepts valid string", () => {
      const valid = "version-123"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.SnippetVersionId)(valid)
      )
      expect(result).toBe(valid)
    })

    it("accepts empty string (edge case)", () => {
      const edgeCase = ""
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.SnippetVersionId)(edgeCase)
      )
      expect(result).toBe(edgeCase)
    })

    it("rejects null", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.SnippetVersionId)(null)
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("ParameterId", () => {
    it("accepts valid string", () => {
      const valid = "param-456"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.ParameterId)(valid)
      )
      expect(result).toBe(valid)
    })

    it("accepts unicode string (edge case)", () => {
      const edgeCase = "param-🚀-unicode"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.ParameterId)(edgeCase)
      )
      expect(result).toBe(edgeCase)
    })

    it("rejects undefined", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.ParameterId)(undefined)
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("ParameterOptionId", () => {
    it("accepts valid string", () => {
      const valid = "option-789"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.ParameterOptionId)(valid)
      )
      expect(result).toBe(valid)
    })

    it("accepts very long string (edge case)", () => {
      const edgeCase = "a".repeat(1000)
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.ParameterOptionId)(edgeCase)
      )
      expect(result).toBe(edgeCase)
    })

    it("rejects boolean", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.ParameterOptionId)(true)
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("CompositionId", () => {
    it("accepts valid string", () => {
      const valid = "comp-123"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.CompositionId)(valid)
      )
      expect(result).toBe(valid)
    })

    it("accepts string with special chars (edge case)", () => {
      const edgeCase = "comp_123$%^"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.CompositionId)(edgeCase)
      )
      expect(result).toBe(edgeCase)
    })

    it("rejects array", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.CompositionId)(["not", "a", "string"])
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("CompositionVersionId", () => {
    it("accepts valid string", () => {
      const valid = "comp-version-123"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.CompositionVersionId)(valid)
      )
      expect(result).toBe(valid)
    })

    it("accepts numeric string (edge case)", () => {
      const edgeCase = "12345"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.CompositionVersionId)(edgeCase)
      )
      expect(result).toBe(edgeCase)
    })

    it("rejects object", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.CompositionVersionId)({ id: "123" })
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("TestRunId", () => {
    it("accepts valid string", () => {
      const valid = "test-run-123"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.TestRunId)(valid)
      )
      expect(result).toBe(valid)
    })

    it("accepts string with newlines (edge case)", () => {
      const edgeCase = "test\nrun\n123"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.TestRunId)(edgeCase)
      )
      expect(result).toBe(edgeCase)
    })

    it("rejects NaN", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.TestRunId)(NaN)
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("DataPointId", () => {
    it("accepts valid string", () => {
      const valid = "data-point-123"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.DataPointId)(valid)
      )
      expect(result).toBe(valid)
    })

    it("accepts string with tabs (edge case)", () => {
      const edgeCase = "data\tpoint\t123"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.DataPointId)(edgeCase)
      )
      expect(result).toBe(edgeCase)
    })

    it("rejects symbol", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.DataPointId)(Symbol("test"))
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("TagId", () => {
    it("accepts valid string", () => {
      const valid = "tag-123"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.TagId)(valid)
      )
      expect(result).toBe(valid)
    })

    it("accepts single character (edge case)", () => {
      const edgeCase = "a"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.TagId)(edgeCase)
      )
      expect(result).toBe(edgeCase)
    })

    it("rejects function", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.TagId)(() => "tag")
      )
      expect(result._tag).toBe("Failure")
    })
  })

  // --- Slug Type Tests ---

  describe("Slug", () => {
    it("accepts valid slug format", () => {
      const valid = "my-valid-slug"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.Slug)(valid)
      )
      expect(result).toBe(valid)
    })

    it("accepts single character slug (edge case)", () => {
      const edgeCase = "a"
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.Slug)(edgeCase)
      )
      expect(result).toBe(edgeCase)
    })

    it("accepts maximum length slug (edge case)", () => {
      const edgeCase = "a-".repeat(49) + "a" // 100 characters
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.Slug)(edgeCase)
      )
      expect(result).toBe(edgeCase)
    })

    it("rejects empty string", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.Slug)("")
      )
      expect(result._tag).toBe("Failure")
    })

    it("rejects slug with spaces", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.Slug)("my slug")
      )
      expect(result._tag).toBe("Failure")
    })

    it("rejects slug with uppercase", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.Slug)("My-Slug")
      )
      expect(result._tag).toBe("Failure")
    })

    it("rejects slug with special characters", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.Slug)("my_slug!")
      )
      expect(result._tag).toBe("Failure")
    })

    it("rejects slug starting with hyphen", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.Slug)("-slug")
      )
      expect(result._tag).toBe("Failure")
    })

    it("rejects slug ending with hyphen", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.Slug)("slug-")
      )
      expect(result._tag).toBe("Failure")
    })

    it("rejects slug exceeding max length", () => {
      const tooLong = "a".repeat(101)
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.Slug)(tooLong)
      )
      expect(result._tag).toBe("Failure")
    })

    it("rejects slug with consecutive hyphens", () => {
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.Slug)("my--slug")
      )
      expect(result._tag).toBe("Failure")
    })
  })

  // --- Tagged Error Tests ---

  describe("InvalidSlugError", () => {
    it("creates error with message", () => {
      const error = new Domain.InvalidSlugError({ message: "Test error" })
      expect(error._tag).toBe("InvalidSlugError")
      expect(error.message).toBe("Test error")
    })

    it("creates error with empty message (edge case)", () => {
      const error = new Domain.InvalidSlugError({ message: "" })
      expect(error.message).toBe("")
    })

    it("creates error with long message (edge case)", () => {
      const longMessage = "Error: " + "a".repeat(1000)
      const error = new Domain.InvalidSlugError({ message: longMessage })
      expect(error.message).toBe(longMessage)
    })
  })

  describe("EntityNotFoundError", () => {
    it("creates error with entity type and id", () => {
      const error = new Domain.EntityNotFoundError({ 
        entityType: "Snippet", 
        id: "123" 
      })
      expect(error._tag).toBe("EntityNotFoundError")
      expect(error.entityType).toBe("Snippet")
      expect(error.id).toBe("123")
    })

    it("creates error with empty values (edge case)", () => {
      const error = new Domain.EntityNotFoundError({ 
        entityType: "", 
        id: "" 
      })
      expect(error.entityType).toBe("")
      expect(error.id).toBe("")
    })

    it("creates error with special characters (edge case)", () => {
      const error = new Domain.EntityNotFoundError({ 
        entityType: "Entity@#$%", 
        id: "id-🚀-unicode" 
      })
      expect(error.entityType).toBe("Entity@#$%")
      expect(error.id).toBe("id-🚀-unicode")
    })
  })

  // --- Entity-specific Error Tests ---

  describe("SnippetNotFound", () => {
    it("creates error with valid id", () => {
      const id = "123" as Domain.SnippetId
      const error = new Domain.SnippetNotFound({ id })
      expect(error._tag).toBe("SnippetNotFound")
      expect(error.id).toBe(id)
    })

    it("creates error with empty id (edge case)", () => {
      const id = "" as Domain.SnippetId
      const error = new Domain.SnippetNotFound({ id })
      expect(error.id).toBe("")
    })

    it("creates error with complex id (edge case)", () => {
      const id = "123e4567-e89b-12d3-a456-426614174000" as Domain.SnippetId
      const error = new Domain.SnippetNotFound({ id })
      expect(error.id).toBe(id)
    })
  })

  // --- Entity Schema Tests ---

  describe("Snippet Schema", () => {
    it("accepts valid snippet data", () => {
      const valid = {
        id: "123",
        name: "valid-slug",
        description: "Test description",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z"
      }
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.Snippet)(valid)
      )
      expect(result.id).toBe("123")
      expect(result.name).toBe("valid-slug")
      expect(result.description).toBe("Test description")
      expect(result.createdAt).toEqual(new Date("2024-01-01T00:00:00Z"))
      expect(result.updatedAt).toEqual(new Date("2024-01-02T00:00:00Z"))
    })

    it("accepts snippet with empty description (edge case)", () => {
      const edgeCase = {
        id: "123",
        name: "valid-slug",
        description: "",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z"
      }
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.Snippet)(edgeCase)
      )
      expect(result.description).toBe("")
    })

    it("rejects snippet with missing required field", () => {
      const invalid = {
        id: "123",
        name: "valid-slug",
        // missing description
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z"
      }
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.Snippet)(invalid)
      )
      expect(result._tag).toBe("Failure")
    })

    it("rejects snippet with invalid date", () => {
      const invalid = {
        id: "123",
        name: "valid-slug",
        description: "Test",
        createdAt: "not-a-date",
        updatedAt: "2024-01-01T00:00:00Z"
      }
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.Snippet)(invalid)
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("CompositionSnippet Schema", () => {
    it("accepts valid composition snippet", () => {
      const valid = {
        snippetVersionId: "version-123",
        role: "system",
        sequence: 0
      }
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.CompositionSnippet)(valid)
      )
      expect(result.snippetVersionId).toBe("version-123")
      expect(result.role).toBe("system")
      expect(result.sequence).toBe(0)
    })

    it("accepts all valid roles", () => {
      const roles = ["system", "user_prompt", "model_response"]
      roles.forEach(role => {
        const valid = {
          snippetVersionId: "version-123",
          role,
          sequence: 1
        }
        const result = Effect.runSync(
          Schema.decodeUnknown(Domain.CompositionSnippet)(valid)
        )
        expect(result.role).toBe(role)
      })
    })

    it("accepts large sequence number (edge case)", () => {
      const edgeCase = {
        snippetVersionId: "version-123",
        role: "user_prompt",
        sequence: 999999
      }
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.CompositionSnippet)(edgeCase)
      )
      expect(result.sequence).toBe(999999)
    })

    it("rejects negative sequence", () => {
      const invalid = {
        snippetVersionId: "version-123",
        role: "system",
        sequence: -1
      }
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.CompositionSnippet)(invalid)
      )
      expect(result._tag).toBe("Failure")
    })

    it("rejects non-integer sequence", () => {
      const invalid = {
        snippetVersionId: "version-123",
        role: "system",
        sequence: 1.5
      }
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.CompositionSnippet)(invalid)
      )
      expect(result._tag).toBe("Failure")
    })

    it("rejects invalid role", () => {
      const invalid = {
        snippetVersionId: "version-123",
        role: "invalid_role",
        sequence: 0
      }
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.CompositionSnippet)(invalid)
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("TestRun Schema", () => {
    it("accepts valid test run data", () => {
      const valid = {
        id: "test-123",
        name: "Test Run 1",
        llm_provider: "OpenAI",
        llm_model: "gpt-4",
        metadata: { key1: "value1", key2: 123 },
        createdAt: "2024-01-01T00:00:00Z"
      }
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.TestRun)(valid)
      )
      expect(result.id).toBe("test-123")
      expect(result.name).toBe("Test Run 1")
      expect(result.llm_provider).toBe("OpenAI")
      expect(result.llm_model).toBe("gpt-4")
      expect(result.metadata).toEqual({ key1: "value1", key2: 123 })
      expect(result.createdAt).toEqual(new Date("2024-01-01T00:00:00Z"))
    })

    it("accepts empty metadata (edge case)", () => {
      const edgeCase = {
        id: "test-123",
        name: "Test Run",
        llm_provider: "Provider",
        llm_model: "Model",
        metadata: {},
        createdAt: "2024-01-01T00:00:00Z"
      }
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.TestRun)(edgeCase)
      )
      expect(result.metadata).toEqual({})
    })

    it("rejects non-record metadata", () => {
      const invalid = {
        id: "test-123",
        name: "Test Run",
        llm_provider: "Provider",
        llm_model: "Model",
        metadata: "not-a-record",
        createdAt: "2024-01-01T00:00:00Z"
      }
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.TestRun)(invalid)
      )
      expect(result._tag).toBe("Failure")
    })
  })

  // --- Slug Creation Function Tests ---

  describe("createSlug", () => {
    it("creates slug from valid input", () => {
      const result = Effect.runSync(
        Domain.createSlug("valid-slug")
      )
      expect(result).toBe("valid-slug")
    })

    it("trims whitespace from input", () => {
      const result = Effect.runSync(
        Domain.createSlug("  valid-slug  ")
      )
      expect(result).toBe("valid-slug")
    })

    it("returns InvalidSlugError for invalid format", () => {
      const result = Effect.runSyncExit(
        Domain.createSlug("Invalid Slug!")
      )
      expect(result._tag).toBe("Failure")
      if (result._tag === "Failure") {
        const error = result.cause as any
        expect(error.error._tag).toBe("InvalidSlugError")
      }
    })
  })

  // --- Creation Schema Tests ---

  describe("CreateSnippetData", () => {
    it("accepts valid creation data", () => {
      const valid = {
        name: "valid-slug",
        description: "Test description"
      }
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.CreateSnippetData)(valid)
      )
      expect(result.name).toBe("valid-slug")
      expect(result.description).toBe("Test description")
    })

    it("accepts empty description (edge case)", () => {
      const edgeCase = {
        name: "valid-slug",
        description: ""
      }
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.CreateSnippetData)(edgeCase)
      )
      expect(result.description).toBe("")
    })

    it("rejects missing required field", () => {
      const invalid = {
        name: "valid-slug"
        // missing description
      }
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.CreateSnippetData)(invalid)
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("CreateTestRunData", () => {
    it("accepts data with optional metadata", () => {
      const valid = {
        name: "Test Run",
        llm_provider: "OpenAI",
        llm_model: "gpt-4",
        metadata: { key: "value" }
      }
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.CreateTestRunData)(valid)
      )
      expect(result).toEqual(valid)
    })

    it("accepts data without optional metadata", () => {
      const valid = {
        name: "Test Run",
        llm_provider: "OpenAI",
        llm_model: "gpt-4"
      }
      const result = Effect.runSync(
        Schema.decodeUnknown(Domain.CreateTestRunData)(valid)
      )
      expect(result.metadata).toBeUndefined()
    })

    it("rejects invalid metadata type", () => {
      const invalid = {
        name: "Test Run",
        llm_provider: "OpenAI",
        llm_model: "gpt-4",
        metadata: ["not", "a", "record"]
      }
      const result = Effect.runSyncExit(
        Schema.decodeUnknown(Domain.CreateTestRunData)(invalid)
      )
      expect(result._tag).toBe("Failure")
    })
  })

  // --- Validation Helper Tests ---

  describe("validateSnippetData", () => {
    it("validates correct data", () => {
      const valid = {
        name: "valid-slug",
        description: "Test"
      }
      const result = Effect.runSync(
        Domain.validateSnippetData(valid)
      )
      expect(result.name).toBe("valid-slug")
      expect(result.description).toBe("Test")
    })

    it("validates minimal data (edge case)", () => {
      const edgeCase = {
        name: "a",
        description: ""
      }
      const result = Effect.runSync(
        Domain.validateSnippetData(edgeCase)
      )
      expect(result.name).toBe("a")
      expect(result.description).toBe("")
    })

    it("rejects invalid data", () => {
      const invalid = {
        name: 123, // not a string
        description: "Test"
      }
      const result = Effect.runSyncExit(
        Domain.validateSnippetData(invalid)
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("validateCompositionSnippets", () => {
    it("validates array of snippets", () => {
      const valid = [
        {
          snippetVersionId: "v1",
          role: "system",
          sequence: 0
        },
        {
          snippetVersionId: "v2",
          role: "user_prompt",
          sequence: 1
        }
      ]
      const result = Effect.runSync(
        Domain.validateCompositionSnippets(valid)
      )
      expect(result).toHaveLength(2)
    })

    it("validates empty array (edge case)", () => {
      const result = Effect.runSync(
        Domain.validateCompositionSnippets([])
      )
      expect(result).toEqual([])
    })

    it("rejects invalid snippet in array", () => {
      const invalid = [
        {
          snippetVersionId: "v1",
          role: "invalid_role", // invalid
          sequence: 0
        }
      ]
      const result = Effect.runSyncExit(
        Domain.validateCompositionSnippets(invalid)
      )
      expect(result._tag).toBe("Failure")
    })
  })
})