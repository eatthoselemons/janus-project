import * as Domain from "../core/domain"

// Fixed test IDs for deterministic testing
export const testIds = {
  snippet: "00000000-0000-0000-0000-000000000001" as Domain.SnippetId,
  snippet2: "00000000-0000-0000-0000-000000000002" as Domain.SnippetId,
  snippetVersion: "00000000-0000-0000-0000-000000000101" as Domain.SnippetVersionId,
  snippetVersion2: "00000000-0000-0000-0000-000000000102" as Domain.SnippetVersionId,
  parameter: "00000000-0000-0000-0000-000000000201" as Domain.ParameterId,
  parameter2: "00000000-0000-0000-0000-000000000202" as Domain.ParameterId,
  parameterOption: "00000000-0000-0000-0000-000000000301" as Domain.ParameterOptionId,
  composition: "00000000-0000-0000-0000-000000000401" as Domain.CompositionId,
  compositionVersion: "00000000-0000-0000-0000-000000000501" as Domain.CompositionVersionId,
  testRun: "00000000-0000-0000-0000-000000000601" as Domain.TestRunId,
  dataPoint: "00000000-0000-0000-0000-000000000701" as Domain.DataPointId,
  tag: "00000000-0000-0000-0000-000000000801" as Domain.TagId
}

// Fixed timestamps for deterministic testing
export const testDates = {
  past: new Date("2023-12-31T00:00:00Z"),
  recent: new Date("2024-01-01T00:00:00Z"),
  future: new Date("2024-01-02T00:00:00Z")
}

// Fixed slugs for testing
export const testSlugs = {
  snippet: "test-snippet" as Domain.Slug,
  snippet2: "test-snippet-2" as Domain.Slug,
  parameter: "test-parameter" as Domain.Slug,
  composition: "test-composition" as Domain.Slug,
  tag: "test-tag" as Domain.Slug,
  invalid: "invalid slug!" // Note: not cast to Slug, for testing validation
}

// Test entity factories with fixed data
export const testSnippet = (overrides: Partial<Domain.Snippet> = {}): Domain.Snippet => ({
  id: testIds.snippet,
  name: testSlugs.snippet,
  description: "Test snippet description",
  createdAt: testDates.past,
  updatedAt: testDates.recent,
  ...overrides
})

export const testSnippetVersion = (overrides: Partial<Domain.SnippetVersion> = {}): Domain.SnippetVersion => ({
  id: testIds.snippetVersion,
  content: "console.log('Hello, world!');",
  commit_message: "Initial version",
  createdAt: testDates.past,
  ...overrides
})

export const testParameter = (overrides: Partial<Domain.Parameter> = {}): Domain.Parameter => ({
  id: testIds.parameter,
  name: testSlugs.parameter,
  description: "Test parameter description",
  createdAt: testDates.past,
  updatedAt: testDates.recent,
  ...overrides
})

export const testParameterOption = (overrides: Partial<Domain.ParameterOption> = {}): Domain.ParameterOption => ({
  id: testIds.parameterOption,
  value: "test-value",
  commit_message: "Added option",
  createdAt: testDates.past,
  ...overrides
})

export const testComposition = (overrides: Partial<Domain.Composition> = {}): Domain.Composition => ({
  id: testIds.composition,
  name: testSlugs.composition,
  description: "Test composition description",
  createdAt: testDates.past,
  updatedAt: testDates.recent,
  ...overrides
})

export const testCompositionVersion = (overrides: Partial<Domain.CompositionVersion> = {}): Domain.CompositionVersion => ({
  id: testIds.compositionVersion,
  snippets: [testCompositionSnippet()],
  commit_message: "Initial composition",
  createdAt: testDates.past,
  ...overrides
})

export const testCompositionSnippet = (overrides: Partial<Domain.CompositionSnippet> = {}): Domain.CompositionSnippet => ({
  snippetVersionId: testIds.snippetVersion,
  role: "system" as Domain.CompositionRole,
  sequence: 0,
  ...overrides
})

export const testTestRun = (overrides: Partial<Domain.TestRun> = {}): Domain.TestRun => ({
  id: testIds.testRun,
  name: "Test run 1",
  llm_provider: "openai",
  llm_model: "gpt-4",
  metadata: {},
  createdAt: testDates.past,
  ...overrides
})

export const testDataPoint = (overrides: Partial<Domain.DataPoint> = {}): Domain.DataPoint => ({
  id: testIds.dataPoint,
  final_prompt_text: "Test prompt",
  response_text: "Test response",
  metrics: { duration_ms: 100, tokens_used: 50 },
  createdAt: testDates.past,
  ...overrides
})

export const testTag = (overrides: Partial<Domain.Tag> = {}): Domain.Tag => ({
  id: testIds.tag,
  name: testSlugs.tag,
  createdAt: testDates.past,
  ...overrides
})