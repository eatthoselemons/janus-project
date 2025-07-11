/**
 * @module domain
 * 
 * Domain layer for the Janus Project
 * 
 * This module provides the core domain types and schemas for the Janus project,
 * implementing type-safe, Neo4j-compatible data models using Effect-TS patterns.
 * 
 * All types follow functional programming principles:
 * - Immutable data structures
 * - Branded types for type safety
 * - Schema validation at boundaries
 * - No behavior in data types (pure data)
 */

export * from "./types"