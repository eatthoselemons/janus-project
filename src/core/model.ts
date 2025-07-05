/**
 * Pure calculation functions for domain model operations.
 * Following Eric Normand's paradigm, these functions are pure calculations
 * that transform data without side effects.
 */

import { Effect, Schema } from "effect"
import {
  Slug,
  Snippet,
  SnippetVersion, 
  Parameter,
  ParameterOption,
  Composition,
  CompositionVersion,
  CompositionSnippet,
  TestRun,
  DataPoint,
  Tag,
  InvalidSlugError,
  createSlug,
  CreateSnippetData,
  CreateSnippetVersionData,
  CreateParameterData,
  CreateParameterOptionData,
  CreateCompositionData,
  CreateCompositionVersionData,
  CreateTestRunData,
  CreateDataPointData,
  CreateTagData
} from "./domain"

// --- Slug Utilities ---

/**
 * Converts a raw string to a URL-friendly slug format.
 * Pure calculation function that normalizes strings for slug creation.
 */
export const normalizeSlugInput = (input: string): string => {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Creates a slug from raw input with normalization.
 */
export const createSlugFromInput = (input: string): Effect.Effect<Slug, InvalidSlugError> => {
  const normalized = normalizeSlugInput(input)
  return createSlug(normalized)
}

// --- Entity Creation Helpers ---
// These are pure calculation functions that create data for entity insertion

/**
 * Creates validated data for Snippet creation.
 */
export const createSnippetData = (name: Slug, description: string): CreateSnippetData => ({
  name,
  description
})

/**
 * Creates validated data for SnippetVersion creation.
 */
export const createSnippetVersionData = (content: string, commit_message: string): CreateSnippetVersionData => ({
  content,
  commit_message
})

/**
 * Creates validated data for Parameter creation.
 */
export const createParameterData = (name: Slug, description: string): CreateParameterData => ({
  name,
  description
})

/**
 * Creates validated data for ParameterOption creation.
 */
export const createParameterOptionData = (value: string, commit_message: string): CreateParameterOptionData => ({
  value,
  commit_message
})

/**
 * Creates validated data for Composition creation.
 */
export const createCompositionData = (name: Slug, description: string): CreateCompositionData => ({
  name,
  description
})

/**
 * Creates validated data for CompositionVersion creation.
 */
export const createCompositionVersionData = (
  snippets: readonly CompositionSnippet[],
  commit_message: string
): CreateCompositionVersionData => ({
  snippets,
  commit_message
})

/**
 * Creates validated data for TestRun creation.
 */
export const createTestRunData = (
  name: string,
  llm_provider: string,
  llm_model: string,
  metadata: Record<string, unknown> = {}
): CreateTestRunData => ({
  name,
  llm_provider,
  llm_model,
  metadata
})

/**
 * Creates validated data for DataPoint creation.
 */
export const createDataPointData = (
  final_prompt_text: string,
  response_text: string,
  metrics: Record<string, unknown> = {}
): CreateDataPointData => ({
  final_prompt_text,
  response_text,
  metrics
})

/**
 * Creates validated data for Tag creation.
 */
export const createTagData = (name: Slug): CreateTagData => ({
  name
})

// --- Validation Helpers ---
// Pure functions for validating composition structures

/**
 * Validates that composition snippets have proper sequence ordering.
 */
export const validateSnippetSequencing = (snippets: readonly CompositionSnippet[]): boolean => {
  const roleGroups = snippets.reduce((acc, snippet) => {
    const role = snippet.role
    if (!acc[role]) acc[role] = []
    acc[role].push(snippet.sequence)
    return acc
  }, {} as Record<string, number[]>)

  return Object.values(roleGroups).every(sequences => {
    const sorted = [...sequences].sort((a, b) => a - b)
    return sequences.length === 0 || (
      sorted[0] === 0 && 
      sorted.every((seq, idx) => idx === 0 || seq === sorted[idx - 1] + 1)
    )
  })
}

/**
 * Validates that all snippet version IDs in a composition are unique.
 */
export const validateUniqueSnippetVersions = (snippets: readonly CompositionSnippet[]): boolean => {
  const ids = snippets.map(s => s.snippetVersionId)
  return new Set(ids).size === ids.length
}

/**
 * Validates a complete composition structure.
 */
export const validateCompositionStructure = (snippets: readonly CompositionSnippet[]): boolean => {
  return validateSnippetSequencing(snippets) && validateUniqueSnippetVersions(snippets)
}

// --- Transformation Helpers ---

/**
 * Extracts snippet version IDs from a composition version.
 */
export const extractSnippetVersionIds = (composition: CompositionVersion): readonly string[] => {
  return composition.snippets.map(s => s.snippetVersionId)
}

/**
 * Groups composition snippets by role.
 */
export const groupSnippetsByRole = (snippets: readonly CompositionSnippet[]) => {
  return snippets.reduce((acc, snippet) => {
    const role = snippet.role
    if (!acc[role]) acc[role] = []
    acc[role].push(snippet)
    return acc
  }, {} as Record<string, CompositionSnippet[]>)
}

/**
 * Sorts snippets within each role by sequence.
 */
export const sortSnippetsBySequence = (snippets: readonly CompositionSnippet[]): CompositionSnippet[] => {
  return [...snippets].sort((a, b) => {
    if (a.role !== b.role) {
      const roleOrder = { system: 0, user_prompt: 1, model_response: 2 }
      return roleOrder[a.role as keyof typeof roleOrder] - roleOrder[b.role as keyof typeof roleOrder]
    }
    return a.sequence - b.sequence
  })
}

// --- Entity Construction Helpers ---

/**
 * Creates a complete Snippet entity with generated ID and timestamps.
 */
export const buildSnippet = (data: CreateSnippetData): Snippet => ({
  id: crypto.randomUUID() as any, // Will be validated by Schema
  name: data.name,
  description: data.description,
  createdAt: new Date(),
  updatedAt: new Date()
})

/**
 * Creates a complete SnippetVersion entity with generated ID and timestamp.
 */
export const buildSnippetVersion = (data: CreateSnippetVersionData): SnippetVersion => ({
  id: crypto.randomUUID() as any, // Will be validated by Schema
  content: data.content,
  commit_message: data.commit_message,
  createdAt: new Date()
})

/**
 * Creates a complete Parameter entity with generated ID and timestamps.
 */
export const buildParameter = (data: CreateParameterData): Parameter => ({
  id: crypto.randomUUID() as any, // Will be validated by Schema
  name: data.name,
  description: data.description,
  createdAt: new Date(),
  updatedAt: new Date()
})

/**
 * Creates a complete ParameterOption entity with generated ID and timestamp.
 */
export const buildParameterOption = (data: CreateParameterOptionData): ParameterOption => ({
  id: crypto.randomUUID() as any, // Will be validated by Schema
  value: data.value,
  commit_message: data.commit_message,
  createdAt: new Date()
})

/**
 * Creates a complete Composition entity with generated ID and timestamps.
 */
export const buildComposition = (data: CreateCompositionData): Composition => ({
  id: crypto.randomUUID() as any, // Will be validated by Schema
  name: data.name,
  description: data.description,
  createdAt: new Date(),
  updatedAt: new Date()
})

/**
 * Creates a complete CompositionVersion entity with generated ID and timestamp.
 */
export const buildCompositionVersion = (data: CreateCompositionVersionData): CompositionVersion => ({
  id: crypto.randomUUID() as any, // Will be validated by Schema
  snippets: data.snippets,
  commit_message: data.commit_message,
  createdAt: new Date()
})

/**
 * Creates a complete TestRun entity with generated ID and timestamp.
 */
export const buildTestRun = (data: CreateTestRunData): TestRun => ({
  id: crypto.randomUUID() as any, // Will be validated by Schema
  name: data.name,
  llm_provider: data.llm_provider,
  llm_model: data.llm_model,
  metadata: data.metadata || {},
  createdAt: new Date()
})

/**
 * Creates a complete DataPoint entity with generated ID and timestamp.
 */
export const buildDataPoint = (data: CreateDataPointData): DataPoint => ({
  id: crypto.randomUUID() as any, // Will be validated by Schema
  final_prompt_text: data.final_prompt_text,
  response_text: data.response_text,
  metrics: data.metrics || {},
  createdAt: new Date()
})

/**
 * Creates a complete Tag entity with generated ID and timestamp.
 */
export const buildTag = (data: CreateTagData): Tag => ({
  id: crypto.randomUUID() as any, // Will be validated by Schema
  name: data.name,
  createdAt: new Date()
})