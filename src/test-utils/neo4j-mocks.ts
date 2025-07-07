import { Effect } from "effect"
import neo4j from "neo4j-driver"

// Simplified mock types that provide the minimal interface needed for testing
type MockRecord = {
  toObject(): Record<string, any>
  get(key: string | number): any
  has(key: string): boolean
  keys: string[]
  values: any[]
  length: number
}

type MockQueryResult = {
  records: MockRecord[]
  summary: {
    query: {
      text: string
      parameters: Record<string, any>
    }
    queryType: string
    counters: any
    updateStatistics: any
    plan: any
    profile: any
    notifications: any[]
    server: {
      address: string
      agent: string
      protocolVersion: any
    }
    resultConsumedAfter: any
    resultAvailableAfter: any
    database: { name: string }
    hasPlan: () => boolean
    hasProfile: () => boolean
    gqlStatusObjects?: () => any[]
  }
}

type MockTransaction = {
  run: (query: string, params?: Record<string, any>) => Promise<MockQueryResult>
  commit: () => Promise<void>
  rollback: () => Promise<void>
  close: () => Promise<void>
  isOpen: () => boolean
}

type MockSession = {
  run: (query: string, params?: Record<string, any>) => Promise<MockQueryResult>
  readTransaction: <T>(fn: (tx: MockTransaction) => T | Promise<T>) => Promise<T>
  writeTransaction: <T>(fn: (tx: MockTransaction) => T | Promise<T>) => Promise<T>
  executeRead: <T>(fn: (tx: MockTransaction) => T | Promise<T>) => Promise<T>
  executeWrite: <T>(fn: (tx: MockTransaction) => T | Promise<T>) => Promise<T>
  beginTransaction: () => MockTransaction
  lastBookmarks: () => string[]
  lastBookmark: () => string[]
  close: () => Promise<void>
}

/**
 * Mock Neo4j record that provides the essential interface for testing
 */
export const mockNeo4jRecord = (data: Record<string, any>): MockRecord => {
  const keys = Object.keys(data)
  const values = Object.values(data)
  
  return {
    keys,
    length: keys.length,
    values,
    get(key: string | number) {
      if (typeof key === 'string') {
        return data[key]
      }
      return values[key]
    },
    has(key: string) {
      return key in data
    },
    toObject() {
      return { ...data }
    }
  }
}

/**
 * Creates mock integer for Neo4j
 */
export const mockInteger = (value: number) => neo4j.int(value)

/**
 * Mock Neo4j query result stats
 */
export const mockStats = () => ({
  nodesCreated: 0,
  nodesDeleted: 0,
  relationshipsCreated: 0,
  relationshipsDeleted: 0,
  propertiesSet: 0,
  labelsAdded: 0,
  labelsRemoved: 0,
  indexesAdded: 0,
  indexesRemoved: 0,
  constraintsAdded: 0,
  constraintsRemoved: 0,
  containsSystemUpdates: () => false,
  systemUpdates: () => 0,
  containsUpdates: () => false,
  updates: () => ({
    nodesCreated: 0,
    nodesDeleted: 0,
    relationshipsCreated: 0,
    relationshipsDeleted: 0,
    propertiesSet: 0,
    labelsAdded: 0,
    labelsRemoved: 0,
    indexesAdded: 0,
    indexesRemoved: 0,
    constraintsAdded: 0,
    constraintsRemoved: 0
  })
})

/**
 * Mock Neo4j query result
 */
export const mockQueryResult = (records: Array<Record<string, any>> = []): MockQueryResult => ({
  records: records.map(mockNeo4jRecord),
  summary: {
    query: {
      text: "MOCK QUERY",
      parameters: {}
    },
    queryType: "r",
    counters: mockStats(),
    updateStatistics: mockStats(),
    plan: false as any,
    profile: false as any,
    notifications: [],
    server: {
      address: "localhost:7687",
      agent: "neo4j/test",
      protocolVersion: mockInteger(4.4)
    },
    resultConsumedAfter: mockInteger(0),
    resultAvailableAfter: mockInteger(0),
    database: { name: "neo4j" },
    hasPlan: () => false,
    hasProfile: () => false,
    gqlStatusObjects: () => []
  }
})

/**
 * Mock Neo4j transaction
 */
export const mockTransaction = (): MockTransaction => {
  return {
    run: () => Promise.resolve(mockQueryResult()),
    commit: () => Promise.resolve(),
    rollback: () => Promise.resolve(),
    close: () => Promise.resolve(),
    isOpen: () => true
  }
}

/**
 * Mock Neo4j session - simplified version
 */
export const mockSession = (): MockSession => {
  return {
    run: () => Promise.resolve(mockQueryResult()),
    readTransaction: async (fn) => fn(mockTransaction()),
    writeTransaction: async (fn) => fn(mockTransaction()),
    executeRead: async (fn) => fn(mockTransaction()),
    executeWrite: async (fn) => fn(mockTransaction()),
    beginTransaction: () => mockTransaction(),
    lastBookmarks: () => [],
    lastBookmark: () => [],
    close: () => Promise.resolve()
  }
}

/**
 * Helper to create a sequence of query results for testing
 */
export class QueryResultSequence {
  private results: Array<MockQueryResult | Error>
  private index = 0

  constructor(results: Array<MockQueryResult | Error> = []) {
    this.results = results
  }

  next(): Effect.Effect<MockQueryResult, Error> {
    if (this.index >= this.results.length) {
      return Effect.fail(new Error("No more results in sequence"))
    }
    
    const result = this.results[this.index++]
    if (result instanceof Error) {
      return Effect.fail(result)
    }
    return Effect.succeed(result)
  }

  reset() {
    this.index = 0
  }
}