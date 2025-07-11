import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { Parameter, ParameterOption } from "../parameter"

describe("Parameter", () => {
  it.effect("should decode valid parameter", () =>
    Effect.gen(function* () {
      const validParameter = {
        id: "789e0123-e89b-42d3-a456-426614174002",
        name: "obligation-level",
        description: "Defines how strongly the AI should follow an instruction"
      }
      
      const result = yield* Schema.decode(Parameter)(validParameter)
      expect(result).toEqual(validParameter)
    })
  )

  it.effect("should accept parameter with hyphenated slug name", () =>
    Effect.gen(function* () {
      const validParameter = {
        id: "789e0123-e89b-42d3-a456-426614174002",
        name: "response-style-formal-casual",
        description: "Controls the formality of responses"
      }
      
      const result = yield* Schema.decode(Parameter)(validParameter)
      expect(result.name).toBe("response-style-formal-casual")
    })
  )

  it.effect("should reject parameter with spaces in name", () =>
    Effect.gen(function* () {
      const invalidParameter = {
        id: "789e0123-e89b-42d3-a456-426614174002",
        name: "obligation level", // spaces not allowed
        description: "Invalid name format"
      }
      
      const result = yield* Effect.either(Schema.decode(Parameter)(invalidParameter))
      expect(result._tag).toBe("Left")
    })
  )

  it.effect("should reject parameter with uppercase in name", () =>
    Effect.gen(function* () {
      const invalidParameter = {
        id: "789e0123-e89b-42d3-a456-426614174002",
        name: "obligationLevel", // camelCase not allowed
        description: "Invalid name format"
      }
      
      const result = yield* Effect.either(Schema.decode(Parameter)(invalidParameter))
      expect(result._tag).toBe("Left")
    })
  )

  it.effect("should handle long descriptions", () =>
    Effect.gen(function* () {
      const longDescription = "This is a very detailed description that explains " +
        "the purpose of this parameter in great detail. It covers various use cases, " +
        "provides examples, and ensures that users understand exactly how to use it."
      
      const validParameter = {
        id: "789e0123-e89b-42d3-a456-426614174002",
        name: "detailed-param",
        description: longDescription
      }
      
      const result = yield* Schema.decode(Parameter)(validParameter)
      expect(result.description).toBe(longDescription)
    })
  )
})

describe("ParameterOption", () => {
  const validDate = "2024-01-01T12:00:00Z"

  it.effect("should decode valid parameter option", () =>
    Effect.gen(function* () {
      const validOption = {
        id: "abc12345-e89b-42d3-a456-426614174003",
        value: "must",
        createdAt: validDate,
        commit_message: "Added strong obligation option"
      }
      
      const result = yield* Schema.decode(ParameterOption)(validOption)
      expect(result.id).toBe(validOption.id)
      expect(result.value).toBe(validOption.value)
      expect(result.commit_message).toBe(validOption.commit_message)
      expect(JSON.stringify(result.createdAt)).toBe('"2024-01-01T12:00:00.000Z"')
    })
  )

  it.effect("should accept various value formats", () =>
    Effect.gen(function* () {
      const values = [
        "should",
        "may",
        "casual",
        "formal",
        "You are required to",
        "It is recommended that you",
        "123",
        "true",
        "{ \"style\": \"formal\" }", // JSON string
      ]
      
      for (const value of values) {
        const validOption = {
          id: "abc12345-e89b-42d3-a456-426614174003",
          value,
          createdAt: validDate,
          commit_message: `Added option: ${value}`
        }
        
        const result = yield* Schema.decode(ParameterOption)(validOption)
        expect(result.value).toBe(value)
        expect(JSON.stringify(result.createdAt)).toBe('"2024-01-01T12:00:00.000Z"')
      }
    })
  )

  it.effect("should accept empty value", () =>
    Effect.gen(function* () {
      const validOption = {
        id: "abc12345-e89b-42d3-a456-426614174003",
        value: "",
        createdAt: validDate,
        commit_message: "Added empty option for default behavior"
      }
      
      const result = yield* Schema.decode(ParameterOption)(validOption)
      expect(result.value).toBe("")
      expect(JSON.stringify(result.createdAt)).toBe('"2024-01-01T12:00:00.000Z"')
    })
  )

  it.effect("should reject option without commit message", () =>
    Effect.gen(function* () {
      const invalidOption = {
        id: "abc12345-e89b-42d3-a456-426614174003",
        value: "test",
        createdAt: validDate,
        // missing commit_message
      }
      
      const result = yield* Effect.either(Schema.decode(ParameterOption)(invalidOption))
      expect(result._tag).toBe("Left")
    })
  )

  it.effect("should handle multiline values", () =>
    Effect.gen(function* () {
      const multilineValue = `Line 1
Line 2
Line 3`
      
      const validOption = {
        id: "abc12345-e89b-42d3-a456-426614174003",
        value: multilineValue,
        createdAt: validDate,
        commit_message: "Added multiline option"
      }
      
      const result = yield* Schema.decode(ParameterOption)(validOption)
      expect(result.value).toBe(multilineValue)
      expect(JSON.stringify(result.createdAt)).toBe('"2024-01-01T12:00:00.000Z"')
    })
  )

  it.effect("should preserve date precision", () =>
    Effect.gen(function* () {
      const preciseDate = "2024-01-01T12:34:56.789Z"
      
      const validOption = {
        id: "abc12345-e89b-42d3-a456-426614174003",
        value: "test",
        createdAt: preciseDate,
        commit_message: "Test precise timestamp"
      }
      
      const result = yield* Schema.decode(ParameterOption)(validOption)
      expect(JSON.stringify(result.createdAt)).toBe('"2024-01-01T12:34:56.789Z"')
    })
  )
})