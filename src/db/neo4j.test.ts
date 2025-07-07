import { describe, it, expect, vi, beforeEach, afterEach } from "@effect/vitest"
import { Effect, Layer, Scope } from "effect"
import * as Neo4j from "./neo4j"
import { makeTestLayer, mockSession, mockQueryResult, QueryResultSequence } from "../test-utils"
import { Session } from "neo4j-driver"

describe("Neo4j Service", () => {
  // --- Tagged Error Tests ---
  
  describe("Neo4jConnectionError", () => {
    it("creates error with message", () => {
      const error = new Neo4j.Neo4jConnectionError({
        message: "Connection failed"
      })
      expect(error._tag).toBe("Neo4jConnectionError")
      expect(error.message).toBe("Connection failed")
    })

    it("creates error with cause (edge case)", () => {
      const cause = new Error("Network error")
      const error = new Neo4j.Neo4jConnectionError({
        message: "Connection failed",
        cause
      })
      expect(error.cause).toBe(cause)
    })

    it("creates error without cause (edge case)", () => {
      const error = new Neo4j.Neo4jConnectionError({
        message: "Connection failed"
      })
      expect(error.cause).toBeUndefined()
    })
  })

  describe("Neo4jQueryError", () => {
    it("creates error with query and message", () => {
      const error = new Neo4j.Neo4jQueryError({
        query: "MATCH (n) RETURN n",
        message: "Query failed"
      })
      expect(error._tag).toBe("Neo4jQueryError")
      expect(error.query).toBe("MATCH (n) RETURN n")
      expect(error.message).toBe("Query failed")
    })

    it("creates error with long query (edge case)", () => {
      const longQuery = "MATCH " + "n".repeat(1000)
      const error = new Neo4j.Neo4jQueryError({
        query: longQuery,
        message: "Query failed"
      })
      expect(error.query.length).toBe(1006)
    })

    it("creates error with complex cause (edge case)", () => {
      const cause = { code: "Neo.DatabaseError.General.UnknownError", message: "Unknown" }
      const error = new Neo4j.Neo4jQueryError({
        query: "RETURN 1",
        message: "Failed",
        cause
      })
      expect(error.cause).toEqual(cause)
    })
  })

  describe("Neo4jSessionError", () => {
    it("creates error with message", () => {
      const error = new Neo4j.Neo4jSessionError({
        message: "Session creation failed"
      })
      expect(error._tag).toBe("Neo4jSessionError")
      expect(error.message).toBe("Session creation failed")
    })

    it("creates error with empty message (edge case)", () => {
      const error = new Neo4j.Neo4jSessionError({
        message: ""
      })
      expect(error.message).toBe("")
    })

    it("creates error with nested cause (edge case)", () => {
      const cause = new Error("Inner error")
      const error = new Neo4j.Neo4jSessionError({
        message: "Session failed",
        cause: { originalError: cause, timestamp: Date.now() }
      })
      expect(error.cause).toHaveProperty("originalError", cause)
    })
  })

  // --- Service Method Tests ---

  describe("createSession", () => {
    it.effect("creates and releases session properly", () =>
      Effect.gen(function* () {
        let sessionClosed = false
        const mockSessionInstance = mockSession()
        mockSessionInstance.close = vi.fn(() => {
          sessionClosed = true
          return Promise.resolve()
        })

        const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
          createSession: () => Effect.acquireRelease(
            Effect.succeed(mockSessionInstance),
            (session) => Effect.promise(() => session.close())
          )
        })

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const neo4j = yield* Neo4j.Neo4jService
            const session = yield* neo4j.createSession()
            expect(session).toBe(mockSessionInstance)
            return "success"
          })
        ).pipe(Effect.provide(TestLayer))

        expect(result).toBe("success")
        expect(sessionClosed).toBe(true)
      })
    )

    it.effect("handles session creation error", () =>
      Effect.gen(function* () {
        const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
          createSession: () => Effect.fail(new Neo4j.Neo4jSessionError({
            message: "Cannot create session"
          }))
        })

        const result = yield* Effect.exit(
          Effect.scoped(
            Effect.gen(function* () {
              const neo4j = yield* Neo4j.Neo4jService
              yield* neo4j.createSession()
            })
          )
        ).pipe(Effect.provide(TestLayer))

        expect(result._tag).toBe("Failure")
      })
    )

    it.effect("releases session even on error (edge case)", () =>
      Effect.gen(function* () {
        let sessionClosed = false
        const mockSessionInstance = mockSession()
        mockSessionInstance.close = vi.fn(() => {
          sessionClosed = true
          return Promise.resolve()
        })

        const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
          createSession: () => Effect.acquireRelease(
            Effect.succeed(mockSessionInstance),
            (session) => Effect.promise(() => session.close())
          )
        })

        yield* Effect.exit(
          Effect.scoped(
            Effect.gen(function* () {
              const neo4j = yield* Neo4j.Neo4jService
              yield* neo4j.createSession()
              // Force an error after session creation
              yield* Effect.fail("test error")
            })
          )
        ).pipe(Effect.provide(TestLayer))

        expect(sessionClosed).toBe(true)
      })
    )
  })

  describe("runQuery", () => {
    it.effect("executes query and returns results", () => {
      const mockResults = [
        { id: 1, name: "Node 1" },
        { id: 2, name: "Node 2" }
      ]

      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => Effect.succeed(mockResults)
      })

      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        const results = yield* neo4j.runQuery("MATCH (n) RETURN n")
        
        expect(results).toEqual(mockResults)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("passes parameters correctly", () => {
      let capturedQuery: string | undefined
      let capturedParams: Record<string, any> | undefined

      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runQuery: (query, params) => {
          capturedQuery = query
          capturedParams = params
          return Effect.succeed([])
        }
      })

      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        yield* neo4j.runQuery("MATCH (n {id: $id}) RETURN n", { id: 123 })
        
        expect(capturedQuery).toBe("MATCH (n {id: $id}) RETURN n")
        expect(capturedParams).toEqual({ id: 123 })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("handles empty results (edge case)", () => {
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => Effect.succeed([])
      })

      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        const results = yield* neo4j.runQuery("MATCH (n) WHERE n.id = 'nonexistent' RETURN n")
        
        expect(results).toEqual([])
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("handles query error", () => {
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runQuery: (query) => Effect.fail(new Neo4j.Neo4jQueryError({
          query,
          message: "Syntax error"
        }))
      })

      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        const result = yield* Effect.exit(
          neo4j.runQuery("INVALID QUERY")
        )
        
        expect(result._tag).toBe("Failure")
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe("runTransaction", () => {
    it.effect("commits transaction on success", () => {
      let committed = false
      let rolledBack = false

      const mockSessionInstance = {
        beginTransaction: () => ({
          commit: vi.fn(async () => { committed = true }),
          rollback: vi.fn(async () => { rolledBack = true })
        })
      } as any

      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runTransaction: (fn) => 
          Effect.gen(function* () {
            const tx = mockSessionInstance.beginTransaction()
            return yield* fn(mockSessionInstance).pipe(
              Effect.tap(() => Effect.promise(() => tx.commit())),
              Effect.catchAll((error) => 
                Effect.promise(() => tx.rollback()).pipe(
                  Effect.flatMap(() => Effect.fail(error))
                )
              )
            )
          })
      })

      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        const result = yield* neo4j.runTransaction(() => Effect.succeed("success"))
        
        expect(result).toBe("success")
        expect(committed).toBe(true)
        expect(rolledBack).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("rolls back transaction on error", () => {
      let committed = false
      let rolledBack = false

      const mockSessionInstance = {
        beginTransaction: () => ({
          commit: vi.fn(async () => { committed = true }),
          rollback: vi.fn(async () => { rolledBack = true })
        })
      } as any

      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runTransaction: (fn) => 
          Effect.gen(function* () {
            const tx = mockSessionInstance.beginTransaction()
            return yield* fn(mockSessionInstance).pipe(
              Effect.tap(() => Effect.promise(() => tx.commit())),
              Effect.catchAll((error) => 
                Effect.promise(() => tx.rollback()).pipe(
                  Effect.flatMap(() => Effect.fail(error))
                )
              )
            )
          })
      })

      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        const result = yield* Effect.exit(
          neo4j.runTransaction(() => Effect.fail("transaction error"))
        )
        
        expect(result._tag).toBe("Failure")
        expect(committed).toBe(false)
        expect(rolledBack).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("handles complex transaction (edge case)", () => {
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runTransaction: (fn) => fn({} as Session)
      })

      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        const result = yield* neo4j.runTransaction(() => 
          Effect.gen(function* () {
            // Simulate multiple operations
            yield* Effect.succeed("op1")
            yield* Effect.succeed("op2")
            return { result: "complex" }
          })
        )
        
        expect(result).toEqual({ result: "complex" })
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe("close", () => {
    it.effect("closes driver successfully", () => {
      let closed = false
      
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        close: () => {
          closed = true
          return Effect.void
        }
      })

      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        yield* neo4j.close()
        
        expect(closed).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("ignores close errors (edge case)", () => {
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        close: () => Effect.die("close error")
      })

      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        // Should not throw even if close fails
        const result = yield* Effect.exit(neo4j.close())
        
        expect(result._tag).toBe("Failure")
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("can be called multiple times (edge case)", () => {
      let closeCount = 0
      
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        close: () => {
          closeCount++
          return Effect.void
        }
      })

      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        yield* neo4j.close()
        yield* neo4j.close()
        yield* neo4j.close()
        
        expect(closeCount).toBe(3)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // --- Convenience Function Tests ---

  describe("executeQuery", () => {
    it.effect("delegates to service", () => {
      const mockResults = [{ value: 42 }]
      
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => Effect.succeed(mockResults)
      })

      return Effect.gen(function* () {
        const results = yield* Neo4j.executeQuery("RETURN 42 as value")
        
        expect(results).toEqual(mockResults)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("forwards parameters", () => {
      let capturedParams: Record<string, any> | undefined
      
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runQuery: (_, params) => {
          capturedParams = params
          return Effect.succeed([])
        }
      })

      return Effect.gen(function* () {
        yield* Neo4j.executeQuery("MATCH (n {id: $id})", { id: "test-123" })
        
        expect(capturedParams).toEqual({ id: "test-123" })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("handles service errors", () => {
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => Effect.fail(new Neo4j.Neo4jQueryError({
          query: "test",
          message: "Query failed"
        }))
      })

      return Effect.gen(function* () {
        const result = yield* Effect.exit(
          Neo4j.executeQuery("MATCH (n) RETURN n")
        )
        
        expect(result._tag).toBe("Failure")
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe("executeTransaction", () => {
    it.effect("delegates to service", () => {
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runTransaction: (fn) => fn({} as Session)
      })

      return Effect.gen(function* () {
        const result = yield* Neo4j.executeTransaction(() => 
          Effect.succeed({ transactionResult: true })
        )
        
        expect(result).toEqual({ transactionResult: true })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("passes session correctly", () => {
      const mockSessionInstance = mockSession()
      let receivedSession: Session | undefined
      
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runTransaction: (fn) => {
          return fn(mockSessionInstance).pipe(
            Effect.tap(() => Effect.sync(() => {
              receivedSession = mockSessionInstance
            }))
          )
        }
      })

      return Effect.gen(function* () {
        yield* Neo4j.executeTransaction((session) => {
          expect(session).toBe(mockSessionInstance)
          return Effect.succeed("done")
        })
        
        expect(receivedSession).toBe(mockSessionInstance)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("propagates transaction errors", () => {
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runTransaction: () => Effect.fail(new Neo4j.Neo4jQueryError({
          query: "transaction",
          message: "Transaction failed"
        }))
      })

      return Effect.gen(function* () {
        const result = yield* Effect.exit(
          Neo4j.executeTransaction(() => Effect.succeed("should not reach"))
        )
        
        expect(result._tag).toBe("Failure")
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe("healthCheck", () => {
    it.effect("returns true when database is healthy", () => {
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => Effect.succeed([{ health: 1 }])
      })

      return Effect.gen(function* () {
        const isHealthy = yield* Neo4j.healthCheck()
        
        expect(isHealthy).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("returns false when query fails", () => {
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => Effect.fail(new Neo4j.Neo4jQueryError({
          query: "RETURN 1 as health",
          message: "Connection lost"
        }))
      })

      return Effect.gen(function* () {
        const isHealthy = yield* Neo4j.healthCheck()
        
        expect(isHealthy).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("returns false for empty results (edge case)", () => {
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => Effect.succeed([])
      })

      return Effect.gen(function* () {
        const isHealthy = yield* Neo4j.healthCheck()
        
        expect(isHealthy).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect("returns false for wrong result format (edge case)", () => {
      const TestLayer = makeTestLayer(Neo4j.Neo4jService)({
        runQuery: () => Effect.succeed([{ health: "not-a-number" }])
      })

      return Effect.gen(function* () {
        const isHealthy = yield* Neo4j.healthCheck()
        
        expect(isHealthy).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // --- Test Layer Tests ---
  
  describe("Neo4jService.Test", () => {
    it.effect("provides default test implementation", () => {
      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        
        // runQuery should return empty array by default
        const results = yield* neo4j.runQuery("TEST QUERY")
        expect(results).toEqual([])
        
        // close should succeed
        yield* neo4j.close()
      }).pipe(Effect.provide(Neo4j.Neo4jService.Test))
    })

    it.effect("dies on createSession", () => {
      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        
        const result = yield* Effect.exit(
          Effect.scoped(neo4j.createSession())
        )
        
        expect(result._tag).toBe("Failure")
      }).pipe(Effect.provide(Neo4j.Neo4jService.Test))
    })

    it.effect("dies on runTransaction", () => {
      return Effect.gen(function* () {
        const neo4j = yield* Neo4j.Neo4jService
        
        const result = yield* Effect.exit(
          neo4j.runTransaction(() => Effect.succeed("test"))
        )
        
        expect(result._tag).toBe("Failure")
      }).pipe(Effect.provide(Neo4j.Neo4jService.Test))
    })
  })
})