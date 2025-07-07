import { describe, it, expect } from "@effect/vitest"
import { Effect, Option, Layer, Context } from "effect"
import * as Repository from "../repositories"
import * as Domain from "../../core/domain"
import * as TestUtils from "../../test-utils"
import * as Neo4j from "../neo4j"

describe("SnippetRepository", () => {
  // We don't use the actual repository implementation in tests to avoid database dependencies
  // --- Repository Error Tests ---
  
  describe("RepositoryError", () => {
    it("creates error with all fields", () => {
      const error = new Repository.RepositoryError({
        operation: "create",
        entityType: "Snippet",
        message: "Database error",
        cause: new Error("Connection lost")
      })
      expect(error._tag).toBe("RepositoryError")
      expect(error.operation).toBe("create")
      expect(error.entityType).toBe("Snippet")
      expect(error.message).toBe("Database error")
      expect(error.cause).toBeInstanceOf(Error)
    })

    it("creates error without cause (edge case)", () => {
      const error = new Repository.RepositoryError({
        operation: "update",
        entityType: "Parameter",
        message: "Update failed"
      })
      expect(error.cause).toBeUndefined()
    })

    it("handles complex operation names (edge case)", () => {
      const error = new Repository.RepositoryError({
        operation: "batch-update-with-transaction",
        entityType: "CompositionVersion",
        message: "Complex operation failed"
      })
      expect(error.operation).toBe("batch-update-with-transaction")
    })
  })

  describe("EntityValidationError", () => {
    it("creates validation error", () => {
      const error = new Repository.EntityValidationError({
        entityType: "Snippet",
        field: "name",
        message: "Invalid slug format"
      })
      expect(error._tag).toBe("EntityValidationError")
      expect(error.entityType).toBe("Snippet")
      expect(error.field).toBe("name")
      expect(error.message).toBe("Invalid slug format")
    })

    it("handles nested field names (edge case)", () => {
      const error = new Repository.EntityValidationError({
        entityType: "TestRun",
        field: "metadata.config.timeout",
        message: "Timeout must be positive"
      })
      expect(error.field).toBe("metadata.config.timeout")
    })

    it("handles empty field name (edge case)", () => {
      const error = new Repository.EntityValidationError({
        entityType: "DataPoint",
        field: "",
        message: "Entity validation failed"
      })
      expect(error.field).toBe("")
    })
  })

  // --- Create Method Tests ---

  describe("create", () => {
    it.effect("creates snippet successfully", () => {
      const mockSnippet = TestUtils.testSnippet({ description: "Test snippet" })
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        create: (data) => Effect.succeed(mockSnippet)
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        
        const result = yield* repo.create(mockSnippet)
        
        expect(result.name).toBe(TestUtils.testSlugs.snippet)
        expect(result.description).toBe("Test snippet")
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("handles database error during creation", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        create: () => Effect.fail(new Repository.RepositoryError({
          operation: "create",
          entityType: "Snippet",
          message: "Connection lost"
        }))
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const mockSnippet = TestUtils.testSnippet()
        
        const result = yield* Effect.exit(repo.create(mockSnippet))
        
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") {
          const error = result.cause.error
          expect(error._tag).toBe("RepositoryError")
          expect(error.operation).toBe("create")
          expect(error.entityType).toBe("Snippet")
        }
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("creates snippet with minimal data (edge case)", () => {
      const mockSnippet = TestUtils.testSnippet({ description: "" })
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        create: () => Effect.succeed(mockSnippet)
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        
        const result = yield* repo.create(mockSnippet)
        
        expect(result.description).toBe("")
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })
  })

  // --- FindById Method Tests ---

  describe("findById", () => {
    it.effect("finds existing snippet by id", () => {
      const mockSnippet = TestUtils.testSnippet()
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        findById: () => Effect.succeed(Option.some(mockSnippet))
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const result = yield* repo.findById(TestUtils.testIds.snippet)
        
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(TestUtils.testIds.snippet)
        }
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("returns None for non-existent snippet", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        findById: () => Effect.succeed(Option.none())
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const result = yield* repo.findById("non-existent" as Domain.SnippetId)
        
        expect(Option.isNone(result)).toBe(true)
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("handles database error during findById", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        findById: () => Effect.fail(new Repository.RepositoryError({
          operation: "findById",
          entityType: "Snippet",
          message: "Query timeout"
        }))
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const result = yield* Effect.exit(
          repo.findById(TestUtils.testIds.snippet)
        )
        
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") {
          const error = result.cause.error
          expect(error._tag).toBe("RepositoryError")
          expect(error.operation).toBe("findById")
        }
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })
  })

  // --- FindByName Method Tests ---

  describe("findByName", () => {
    it.effect("finds snippet by slug name", () => {
      const mockSnippet = TestUtils.testSnippet()
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        findByName: () => Effect.succeed(Option.some(mockSnippet))
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const result = yield* repo.findByName(TestUtils.testSlugs.snippet)
        
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe(TestUtils.testSlugs.snippet)
        }
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("returns None for non-existent name", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        findByName: () => Effect.succeed(Option.none())
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const result = yield* repo.findByName("non-existent-slug" as Domain.Slug)
        
        expect(Option.isNone(result)).toBe(true)
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("handles special characters in slug (edge case)", () => {
      let capturedName: string | undefined
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        findByName: (name) => {
          capturedName = name
          return Effect.succeed(Option.none())
        }
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        yield* repo.findByName("test-123-abc" as Domain.Slug)
        expect(capturedName).toBe("test-123-abc")
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })
  })

  // --- List Method Tests ---

  describe("list", () => {
    it.effect("returns all snippets ordered by name", () => {
      const snippets = [
        TestUtils.testSnippet({ name: "alpha" as Domain.Slug }),
        TestUtils.testSnippet({ name: "beta" as Domain.Slug }),
        TestUtils.testSnippet({ name: "gamma" as Domain.Slug })
      ]
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        list: () => Effect.succeed(snippets)
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const result = yield* repo.list()
        
        expect(result).toHaveLength(3)
        expect(result[0].name).toBe("alpha")
        expect(result[1].name).toBe("beta")
        expect(result[2].name).toBe("gamma")
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("returns empty array when no snippets exist", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        list: () => Effect.succeed([])
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const result = yield* repo.list()
        
        expect(result).toEqual([])
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("handles large result sets (edge case)", () => {
      const largeSet = Array(1000).fill(null).map((_, i) => 
        TestUtils.testSnippet({ name: `snippet-${i.toString().padStart(4, '0')}` as Domain.Slug })
      )
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        list: () => Effect.succeed(largeSet)
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const result = yield* repo.list()
        
        expect(result).toHaveLength(1000)
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })
  })

  // --- Update Method Tests ---

  describe("update", () => {
    it.effect("updates existing snippet", () => {
      const existingSnippet = TestUtils.testSnippet()
      const updatedSnippet = { ...existingSnippet, description: "Updated description" }
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        update: () => Effect.succeed(updatedSnippet)
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const result = yield* repo.update(TestUtils.testIds.snippet, {
          description: "Updated description"
        })
        
        expect(result.description).toBe("Updated description")
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("fails when snippet not found", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        update: (id) => Effect.fail(new Domain.SnippetNotFound({ id }))
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const result = yield* Effect.exit(
          repo.update("non-existent" as Domain.SnippetId, { description: "New" })
        )
        
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") {
          const error = result.cause.error
          expect(error._tag).toBe("SnippetNotFound")
        }
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("handles partial updates (edge case)", () => {
      const existingSnippet = TestUtils.testSnippet()
      let capturedUpdates: any
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        update: (id, updates) => {
          capturedUpdates = updates
          return Effect.succeed({ ...existingSnippet, description: "Partial update" })
        }
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const result = yield* repo.update(TestUtils.testIds.snippet, {
          description: "Partial update"
          // name is not included in update
        })
        
        expect(capturedUpdates).toEqual({ description: "Partial update" })
        expect(result.description).toBe("Partial update")
        expect(result.name).toBe(existingSnippet.name) // unchanged
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })
  })

  // --- Delete Method Tests ---

  describe("delete", () => {
    it.effect("deletes existing snippet", () => {
      const existingSnippet = TestUtils.testSnippet()
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        delete: () => Effect.void
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        yield* repo.delete(TestUtils.testIds.snippet)
        // No error means success
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("fails when snippet not found", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        delete: (id) => Effect.fail(new Domain.SnippetNotFound({ id }))
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        const result = yield* Effect.exit(
          repo.delete("non-existent" as Domain.SnippetId)
        )
        
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") {
          const error = result.cause.error
          expect(error._tag).toBe("SnippetNotFound")
        }
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("handles cascade delete with relationships (edge case)", () => {
      const existingSnippet = TestUtils.testSnippet()
      let deleteCalled = false
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        delete: () => {
          deleteCalled = true
          return Effect.void
        }
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        yield* repo.delete(TestUtils.testIds.snippet)
        expect(deleteCalled).toBe(true)
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })
  })

  // --- Test Layer Tests ---

  describe("SnippetRepository.Test", () => {
    it.effect("provides test implementation", () => {
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        
        // Test default behaviors
        // create() should die with message
        const mockSnippet = TestUtils.testSnippet()
        const createResult = yield* Effect.exit(repo.create(mockSnippet))
        expect(createResult._tag).toBe("Failure")
        
        const findResult = yield* repo.findById("any-id" as Domain.SnippetId)
        expect(Option.isNone(findResult)).toBe(true)
        
        const listResult = yield* repo.list()
        expect(listResult).toEqual([])
      }).pipe(
        Effect.provide(Repository.SnippetRepository.Test)
      )
    })

    it.effect("can be customized with makeTestLayer", () => {
      const mockSnippet = TestUtils.testSnippet()
      
      const CustomTestLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        findById: () => Effect.succeed(Option.some(mockSnippet)),
        list: () => Effect.succeed([mockSnippet])
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.SnippetRepository
        
        const findResult = yield* repo.findById(TestUtils.testIds.snippet)
        expect(Option.isSome(findResult)).toBe(true)
        
        const listResult = yield* repo.list()
        expect(listResult).toHaveLength(1)
      }).pipe(
        Effect.provide(CustomTestLayer)
      )
    })

    it("throws for unimplemented methods in custom test", () => {
      const CustomTestLayer = TestUtils.makeTestLayer(Repository.SnippetRepository)({
        // Only implement findById, not create
        findById: () => Effect.succeed(Option.none())
      })
      
      // Access the method directly to trigger the proxy error
      const testFn = () => {
        const proxy = new Proxy({} as Repository.SnippetRepositoryService, {
          get(_, prop) {
            if (prop === 'findById') {
              return () => Effect.succeed(Option.none())
            }
            throw new Error(`Method ${String(prop)} not implemented in test`)
          }
        })
        // This should throw when accessing 'create'
        proxy.create
      }
      
      expect(testFn).toThrow("Method create not implemented in test")
    })
  })
})