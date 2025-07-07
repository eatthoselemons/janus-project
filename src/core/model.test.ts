import { describe, it, expect } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as Model from "./model"
import * as Domain from "./domain"
import * as Services from "./services"

describe("Model", () => {
  // --- Slug Utilities Tests ---
  
  describe("normalizeSlugInput", () => {
    it("converts to lowercase and replaces spaces", () => {
      expect(Model.normalizeSlugInput("Hello World")).toBe("hello-world")
    })

    it("handles special characters", () => {
      expect(Model.normalizeSlugInput("Test@#$%Name")).toBe("test-name")
    })

    it("collapses multiple dashes", () => {
      expect(Model.normalizeSlugInput("test   name")).toBe("test-name")
    })

    it("removes leading and trailing dashes", () => {
      expect(Model.normalizeSlugInput("--test-name--")).toBe("test-name")
    })

    it("handles empty string (edge case)", () => {
      expect(Model.normalizeSlugInput("")).toBe("")
    })

    it("handles only special characters (edge case)", () => {
      expect(Model.normalizeSlugInput("@#$%^&*()")).toBe("")
    })
  })

  describe("createSlugFromInput", () => {
    it("creates slug from valid input", () => {
      const result = Effect.runSync(
        Model.createSlugFromInput("Test Name")
      )
      expect(result).toBe("test-name")
    })

    it("creates slug from input with special chars", () => {
      const result = Effect.runSync(
        Model.createSlugFromInput("Test@#$ Name!!! 123")
      )
      expect(result).toBe("test-name-123")
    })

    it("fails for input that normalizes to empty string", () => {
      const result = Effect.runSyncExit(
        Model.createSlugFromInput("@#$%")
      )
      expect(result._tag).toBe("Failure")
    })
  })

  // --- Pure Creation Function Tests ---

  describe("createSnippet", () => {
    it("creates snippet from complete data", () => {
      const data = {
        id: "00000000-0000-0000-0000-000000000001" as Domain.SnippetId,
        name: "test-snippet" as Domain.Slug,
        description: "Test description",
        createdAt: new Date(),
        updatedAt: new Date()
      }
      const result = Model.createSnippet(data)
      expect(result.id).toBe(data.id)
      expect(result.name).toBe(data.name)
      expect(result.description).toBe(data.description)
      expect(result.createdAt).toBe(data.createdAt)
      expect(result.updatedAt).toBe(data.updatedAt)
    })
  })

  describe("createParameter", () => {
    it("creates parameter from complete data", () => {
      const data = {
        id: "00000000-0000-0000-0000-000000000002" as Domain.ParameterId,
        name: "test-param" as Domain.Slug,
        description: "Parameter description",
        createdAt: new Date(),
        updatedAt: new Date()
      }
      const result = Model.createParameter(data)
      expect(result.id).toBe(data.id)
      expect(result.name).toBe(data.name)
      expect(result.description).toBe(data.description)
      expect(result.createdAt).toBe(data.createdAt)
      expect(result.updatedAt).toBe(data.updatedAt)
    })
  })

  describe("createComposition", () => {
    it("creates composition from complete data", () => {
      const data = {
        id: "00000000-0000-0000-0000-000000000003" as Domain.CompositionId,
        name: "test-comp" as Domain.Slug,
        description: "Composition description",
        createdAt: new Date(),
        updatedAt: new Date()
      }
      const result = Model.createComposition(data)
      expect(result.id).toBe(data.id)
      expect(result.name).toBe(data.name)
      expect(result.description).toBe(data.description)
      expect(result.createdAt).toBe(data.createdAt)
      expect(result.updatedAt).toBe(data.updatedAt)
    })
  })

  describe("createTag", () => {
    it("creates tag from complete data", () => {
      const data = {
        id: "00000000-0000-0000-0000-000000000004" as Domain.TagId,
        name: "test-tag" as Domain.Slug,
        createdAt: new Date()
      }
      const result = Model.createTag(data)
      expect(result.id).toBe(data.id)
      expect(result.name).toBe(data.name)
      expect(result.createdAt).toBe(data.createdAt)
    })
  })

  // --- Build Function Tests ---

  describe("Build Functions", () => {
    const testUuid = "00000000-0000-0000-0000-000000000001" as Services.Uuid
    
    const testLayer = Layer.succeed(Services.UuidServiceTag, {
      v4: Effect.succeed(testUuid)
    })

    describe("buildSnippet", () => {
      it("creates snippet with generated ID and timestamps", () => {
        const data: Domain.CreateSnippetData = {
          name: "test-snippet" as Domain.Slug,
          description: "Test description"
        }
        
        const result = Effect.runSync(
          Model.buildSnippet(data).pipe(
            Effect.provide(testLayer)
          )
        )
        
        expect(result.id).toBe(testUuid)
        expect(result.name).toBe("test-snippet")
        expect(result.description).toBe("Test description")
        expect(result.createdAt).toBeInstanceOf(Date)
        expect(result.updatedAt).toBeInstanceOf(Date)
      })

      it("handles empty description", () => {
        const data: Domain.CreateSnippetData = {
          name: "test" as Domain.Slug,
          description: ""
        }
        
        const result = Effect.runSync(
          Model.buildSnippet(data).pipe(
            Effect.provide(testLayer)
          )
        )
        
        expect(result.description).toBe("")
      })

      it("fails without required services", () => {
        const data: Domain.CreateSnippetData = {
          name: "test" as Domain.Slug,
          description: "Test"
        }
        
        const result = Effect.runSyncExit(Model.buildSnippet(data))
        expect(result._tag).toBe("Failure")
      })
    })

    describe("buildParameter", () => {
      it("creates parameter with generated ID and timestamps", () => {
        const data: Domain.CreateParameterData = {
          name: "test-param" as Domain.Slug,
          description: "Parameter description"
        }
        
        const result = Effect.runSync(
          Model.buildParameter(data).pipe(
            Effect.provide(testLayer)
          )
        )
        
        expect(result.id).toBe(testUuid)
        expect(result.name).toBe("test-param")
        expect(result.description).toBe("Parameter description")
        expect(result.createdAt).toBeInstanceOf(Date)
        expect(result.updatedAt).toBeInstanceOf(Date)
      })
    })

    describe("buildComposition", () => {
      it("creates composition with generated ID and timestamps", () => {
        const data: Domain.CreateCompositionData = {
          name: "test-comp" as Domain.Slug,
          description: "Composition description"
        }
        
        const result = Effect.runSync(
          Model.buildComposition(data).pipe(
            Effect.provide(testLayer)
          )
        )
        
        expect(result.id).toBe(testUuid)
        expect(result.name).toBe("test-comp")
        expect(result.description).toBe("Composition description")
        expect(result.createdAt).toBeInstanceOf(Date)
        expect(result.updatedAt).toBeInstanceOf(Date)
      })
    })

    describe("buildTestRun", () => {
      it("creates test run with generated ID and timestamp", () => {
        const data: Domain.CreateTestRunData = {
          name: "Test Run",
          llm_provider: "OpenAI",
          llm_model: "gpt-4",
          metadata: { key: "value" }
        }
        
        const result = Effect.runSync(
          Model.buildTestRun(data).pipe(
            Effect.provide(testLayer)
          )
        )
        
        expect(result.id).toBe(testUuid)
        expect(result.name).toBe("Test Run")
        expect(result.llm_provider).toBe("OpenAI")
        expect(result.llm_model).toBe("gpt-4")
        expect(result.metadata).toEqual({ key: "value" })
        expect(result.createdAt).toBeInstanceOf(Date)
      })

      it("handles empty metadata", () => {
        const data: Domain.CreateTestRunData = {
          name: "Test",
          llm_provider: "Provider",
          llm_model: "Model"
        }
        
        const result = Effect.runSync(
          Model.buildTestRun(data).pipe(
            Effect.provide(testLayer)
          )
        )
        
        expect(result.metadata).toEqual({})
      })
    })

    describe("buildTag", () => {
      it("creates tag with generated ID and timestamp", () => {
        const data: Domain.CreateTagData = {
          name: "test-tag" as Domain.Slug
        }
        
        const result = Effect.runSync(
          Model.buildTag(data).pipe(
            Effect.provide(testLayer)
          )
        )
        
        expect(result.id).toBe(testUuid)
        expect(result.name).toBe("test-tag")
        expect(result.createdAt).toBeInstanceOf(Date)
      })
    })

    describe("build functions with multiple UUIDs", () => {
      it("generates different UUIDs for multiple entities", () => {
        let uuidCounter = 0
        const multiUuidLayer = Layer.succeed(Services.UuidServiceTag, {
          v4: Effect.sync(() => {
            uuidCounter++
            return `00000000-0000-0000-0000-00000000000${uuidCounter}` as Services.Uuid
          })
        })

        const snippet1 = Effect.runSync(
          Model.buildSnippet({
            name: "snippet1" as Domain.Slug,
            description: "First"
          }).pipe(Effect.provide(multiUuidLayer))
        )
        
        const snippet2 = Effect.runSync(
          Model.buildSnippet({
            name: "snippet2" as Domain.Slug,
            description: "Second"
          }).pipe(Effect.provide(multiUuidLayer))
        )
        
        expect(snippet1.id).toBe("00000000-0000-0000-0000-000000000001")
        expect(snippet2.id).toBe("00000000-0000-0000-0000-000000000002")
        expect(snippet1.id).not.toBe(snippet2.id)
      })
    })
  })
})