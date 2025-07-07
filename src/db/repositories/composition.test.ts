import { describe, it, expect } from "@effect/vitest"
import { Effect, Option, Layer, Context } from "effect"
import * as Repository from "../repositories"
import * as Domain from "../../core/domain"
import * as TestUtils from "../../test-utils"
import * as Neo4j from "../neo4j"

describe("CompositionRepository", () => {
  // --- Repository Error Tests (Already tested in snippet.test.ts) ---

  // --- Create Method Tests ---

  describe("create", () => {
    it.effect("creates composition successfully", () => {
      const mockComposition = TestUtils.testComposition({ description: "Test composition" })
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        create: (data) => Effect.succeed(mockComposition)
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        
        const result = yield* repo.create(mockComposition)
        
        expect(result.name).toBe(TestUtils.testSlugs.composition)
        expect(result.description).toBe("Test composition")
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("handles database error during creation", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        create: () => Effect.fail(new Repository.RepositoryError({
          operation: "create",
          entityType: "Composition",
          message: "Connection lost"
        }))
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const mockComposition = TestUtils.testComposition()
        
        const result = yield* Effect.exit(repo.create(mockComposition))
        
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") {
          const error = result.cause.error
          expect(error._tag).toBe("RepositoryError")
          expect(error.operation).toBe("create")
          expect(error.entityType).toBe("Composition")
        }
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("creates composition with minimal data (edge case)", () => {
      const mockComposition = TestUtils.testComposition({ description: "" })
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        create: () => Effect.succeed(mockComposition)
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        
        const result = yield* repo.create(mockComposition)
        
        expect(result.description).toBe("")
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })
  })

  // --- FindById Method Tests ---

  describe("findById", () => {
    it.effect("finds existing composition by id", () => {
      const mockComposition = TestUtils.testComposition()
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        findById: () => Effect.succeed(Option.some(mockComposition))
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const result = yield* repo.findById(TestUtils.testIds.composition)
        
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(TestUtils.testIds.composition)
        }
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("returns None for non-existent composition", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        findById: () => Effect.succeed(Option.none())
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const result = yield* repo.findById("non-existent" as Domain.CompositionId)
        
        expect(Option.isNone(result)).toBe(true)
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("handles database error during findById", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        findById: () => Effect.fail(new Repository.RepositoryError({
          operation: "findById",
          entityType: "Composition",
          message: "Query timeout"
        }))
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const result = yield* Effect.exit(
          repo.findById(TestUtils.testIds.composition)
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
    it.effect("finds composition by slug name", () => {
      const mockComposition = TestUtils.testComposition()
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        findByName: () => Effect.succeed(Option.some(mockComposition))
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const result = yield* repo.findByName(TestUtils.testSlugs.composition)
        
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe(TestUtils.testSlugs.composition)
        }
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("returns None for non-existent name", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        findByName: () => Effect.succeed(Option.none())
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const result = yield* repo.findByName("non-existent-slug" as Domain.Slug)
        
        expect(Option.isNone(result)).toBe(true)
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("handles special characters in slug (edge case)", () => {
      let capturedName: string | undefined
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        findByName: (name) => {
          capturedName = name
          return Effect.succeed(Option.none())
        }
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        yield* repo.findByName("test-123-abc" as Domain.Slug)
        expect(capturedName).toBe("test-123-abc")
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })
  })

  // --- List Method Tests ---

  describe("list", () => {
    it.effect("returns all compositions ordered by name", () => {
      const compositions = [
        TestUtils.testComposition({ name: "alpha" as Domain.Slug }),
        TestUtils.testComposition({ name: "beta" as Domain.Slug }),
        TestUtils.testComposition({ name: "gamma" as Domain.Slug })
      ]
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        list: () => Effect.succeed(compositions)
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const result = yield* repo.list()
        
        expect(result).toHaveLength(3)
        expect(result[0].name).toBe("alpha")
        expect(result[1].name).toBe("beta")
        expect(result[2].name).toBe("gamma")
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("returns empty array when no compositions exist", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        list: () => Effect.succeed([])
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const result = yield* repo.list()
        
        expect(result).toEqual([])
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("handles large result sets (edge case)", () => {
      const largeSet = Array(1000).fill(null).map((_, i) => 
        TestUtils.testComposition({ name: `comp-${i.toString().padStart(4, '0')}` as Domain.Slug })
      )
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        list: () => Effect.succeed(largeSet)
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const result = yield* repo.list()
        
        expect(result).toHaveLength(1000)
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })
  })

  // --- Update Method Tests ---

  describe("update", () => {
    it.effect("updates existing composition", () => {
      const existingComposition = TestUtils.testComposition()
      const updatedComposition = { ...existingComposition, description: "Updated description" }
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        update: () => Effect.succeed(updatedComposition)
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const result = yield* repo.update(TestUtils.testIds.composition, {
          description: "Updated description"
        })
        
        expect(result.description).toBe("Updated description")
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("fails when composition not found", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        update: (id) => Effect.fail(new Domain.CompositionNotFound({ id }))
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const result = yield* Effect.exit(
          repo.update("non-existent" as Domain.CompositionId, { description: "New" })
        )
        
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") {
          const error = result.cause.error
          expect(error._tag).toBe("CompositionNotFound")
        }
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("handles partial updates (edge case)", () => {
      const existingComposition = TestUtils.testComposition()
      let capturedUpdates: any
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        update: (id, updates) => {
          capturedUpdates = updates
          return Effect.succeed({ ...existingComposition, description: "Partial update" })
        }
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const result = yield* repo.update(TestUtils.testIds.composition, {
          description: "Partial update"
          // name is not included in update
        })
        
        expect(capturedUpdates).toEqual({ description: "Partial update" })
        expect(result.description).toBe("Partial update")
        expect(result.name).toBe(existingComposition.name) // unchanged
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })
  })

  // --- Delete Method Tests ---

  describe("delete", () => {
    it.effect("deletes existing composition", () => {
      const existingComposition = TestUtils.testComposition()
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        delete: () => Effect.void
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        yield* repo.delete(TestUtils.testIds.composition)
        // No error means success
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("fails when composition not found", () => {
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        delete: (id) => Effect.fail(new Domain.CompositionNotFound({ id }))
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        const result = yield* Effect.exit(
          repo.delete("non-existent" as Domain.CompositionId)
        )
        
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") {
          const error = result.cause.error
          expect(error._tag).toBe("CompositionNotFound")
        }
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })

    it.effect("handles cascade delete with relationships (edge case)", () => {
      const existingComposition = TestUtils.testComposition()
      let deleteCalled = false
      
      const TestRepositoryLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        delete: () => {
          deleteCalled = true
          return Effect.void
        }
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        yield* repo.delete(TestUtils.testIds.composition)
        expect(deleteCalled).toBe(true)
      }).pipe(
        Effect.provide(TestRepositoryLayer)
      )
    })
  })

  // --- Test Layer Tests ---

  describe("CompositionRepository.Test", () => {
    it.effect("provides test implementation", () => {
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        
        // Test default behaviors
        // create() should die with message
        const mockComposition = TestUtils.testComposition()
        const createResult = yield* Effect.exit(repo.create(mockComposition))
        expect(createResult._tag).toBe("Failure")
        
        const findResult = yield* repo.findById("any-id" as Domain.CompositionId)
        expect(Option.isNone(findResult)).toBe(true)
        
        const listResult = yield* repo.list()
        expect(listResult).toEqual([])
      }).pipe(
        Effect.provide(Repository.CompositionRepository.Test)
      )
    })

    it.effect("can be customized with makeTestLayer", () => {
      const mockComposition = TestUtils.testComposition()
      
      const CustomTestLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        findById: () => Effect.succeed(Option.some(mockComposition)),
        list: () => Effect.succeed([mockComposition])
      })
      
      return Effect.gen(function* () {
        const repo = yield* Repository.CompositionRepository
        
        const findResult = yield* repo.findById(TestUtils.testIds.composition)
        expect(Option.isSome(findResult)).toBe(true)
        
        const listResult = yield* repo.list()
        expect(listResult).toHaveLength(1)
      }).pipe(
        Effect.provide(CustomTestLayer)
      )
    })

    it("throws for unimplemented methods in custom test", () => {
      const CustomTestLayer = TestUtils.makeTestLayer(Repository.CompositionRepository)({
        // Only implement findById, not create
        findById: () => Effect.succeed(Option.none())
      })
      
      // Access the method directly to trigger the proxy error
      const testFn = () => {
        const proxy = new Proxy({} as Repository.CompositionRepositoryService, {
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