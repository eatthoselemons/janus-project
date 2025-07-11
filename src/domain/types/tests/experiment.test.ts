import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { TestRun, DataPoint } from "../experiment"

describe("TestRun", () => {
  const validDate = "2024-01-02T10:00:00Z"

  it.effect("should decode valid test run", () =>
    Effect.gen(function* () {
      const validTestRun = {
        id: "345ef012-e89b-42d3-a456-426614174010",
        name: "GPT-4 Performance Test",
        createdAt: validDate,
        llm_provider: "OpenAI",
        llm_model: "gpt-4-turbo",
        metadata: {
          temperature: 0.7,
          max_tokens: 2000,
          test_type: "performance",
          user: "john.doe@example.com"
        }
      }
      
      const result = yield* Schema.decode(TestRun)(validTestRun)
      expect(result.id).toBe(validTestRun.id)
      expect(result.name).toBe(validTestRun.name)
      expect(result.llm_provider).toBe(validTestRun.llm_provider)
      expect(result.llm_model).toBe(validTestRun.llm_model)
      expect(result.metadata).toEqual(validTestRun.metadata)
      expect(JSON.stringify(result.createdAt)).toBe('"2024-01-02T10:00:00.000Z"')
    })
  )

  it.effect("should handle empty metadata", () =>
    Effect.gen(function* () {
      const validTestRun = {
        id: "345ef012-e89b-42d3-a456-426614174010",
        name: "Basic Test",
        createdAt: validDate,
        llm_provider: "Anthropic",
        llm_model: "claude-3-opus",
        metadata: {}
      }
      
      const result = yield* Schema.decode(TestRun)(validTestRun)
      expect(result.metadata).toEqual({})
      expect(JSON.stringify(result.createdAt)).toBe('"2024-01-02T10:00:00.000Z"')
    })
  )

  it.effect("should handle complex nested metadata", () =>
    Effect.gen(function* () {
      const complexMetadata = {
        settings: {
          temperature: 0.5,
          top_p: 0.95,
          presence_penalty: 0.1,
          frequency_penalty: 0.2
        },
        environment: {
          region: "us-east-1",
          version: "2.1.0",
          features: ["streaming", "function_calling"]
        },
        tags: ["production", "benchmark", "nightly"],
        custom_data: {
          nested: {
            deeply: {
              value: 42
            }
          }
        }
      }
      
      const validTestRun = {
        id: "345ef012-e89b-42d3-a456-426614174010",
        name: "Complex Metadata Test",
        createdAt: validDate,
        llm_provider: "OpenAI",
        llm_model: "gpt-4",
        metadata: complexMetadata
      }
      
      const result = yield* Schema.decode(TestRun)(validTestRun)
      expect(result.metadata).toEqual(complexMetadata)
      expect(JSON.stringify(result.createdAt)).toBe('"2024-01-02T10:00:00.000Z"')
    })
  )

  it.effect("should accept various provider and model names", () =>
    Effect.gen(function* () {
      const providers = [
        { provider: "OpenAI", model: "gpt-3.5-turbo" },
        { provider: "Anthropic", model: "claude-3-sonnet-20240229" },
        { provider: "Google", model: "gemini-pro" },
        { provider: "Mistral", model: "mistral-large-latest" },
        { provider: "Custom Provider", model: "custom-model-v1" }
      ]
      
      for (const { provider, model } of providers) {
        const testRun = {
          id: "345ef012-e89b-42d3-a456-426614174010",
          name: `Test for ${provider}`,
          createdAt: validDate,
          llm_provider: provider,
          llm_model: model,
          metadata: {}
        }
        
        const result = yield* Schema.decode(TestRun)(testRun)
        expect(result.llm_provider).toBe(provider)
        expect(result.llm_model).toBe(model)
        expect(JSON.stringify(result.createdAt)).toBe('"2024-01-02T10:00:00.000Z"')
      }
    })
  )

  it.effect("should reject test run without required fields", () =>
    Effect.gen(function* () {
      const invalidTestRun = {
        id: "345ef012-e89b-42d3-a456-426614174010",
        name: "Invalid Test",
        createdAt: validDate,
        // missing llm_provider and llm_model
        metadata: {}
      }
      
      const result = yield* Effect.either(Schema.decode(TestRun)(invalidTestRun))
      expect(result._tag).toBe("Left")
    })
  )
})

describe("DataPoint", () => {
  it.effect("should decode valid data point", () =>
    Effect.gen(function* () {
      const validDataPoint = {
        id: "567ab234-e89b-42d3-a456-426614174011",
        final_prompt_text: "You are an AI assistant. Please help the user with their question.",
        response_text: "I'd be happy to help you! What would you like to know?",
        metrics: {
          latency_ms: 1234,
          prompt_tokens: 15,
          completion_tokens: 12,
          total_tokens: 27,
          cost_usd: 0.00054
        }
      }
      
      const result = yield* Schema.decode(DataPoint)(validDataPoint)
      expect(result).toEqual(validDataPoint)
    })
  )

  it.effect("should handle large prompt and response texts", () =>
    Effect.gen(function* () {
      const largePrompt = "You are an AI assistant. ".repeat(100)
      const largeResponse = "This is a detailed response. ".repeat(200)
      
      const validDataPoint = {
        id: "567ab234-e89b-42d3-a456-426614174011",
        final_prompt_text: largePrompt,
        response_text: largeResponse,
        metrics: {
          size_warning: "large_content",
          truncated: false
        }
      }
      
      const result = yield* Schema.decode(DataPoint)(validDataPoint)
      expect(result.final_prompt_text).toBe(largePrompt)
      expect(result.response_text).toBe(largeResponse)
    })
  )

  it.effect("should handle empty metrics", () =>
    Effect.gen(function* () {
      const validDataPoint = {
        id: "567ab234-e89b-42d3-a456-426614174011",
        final_prompt_text: "Simple prompt",
        response_text: "Simple response",
        metrics: {}
      }
      
      const result = yield* Schema.decode(DataPoint)(validDataPoint)
      expect(result.metrics).toEqual({})
    })
  )

  it.effect("should handle various metric types", () =>
    Effect.gen(function* () {
      const complexMetrics = {
        // Numbers
        latency_ms: 500,
        accuracy_score: 0.95,
        
        // Strings
        model_version: "2024-01-02",
        region: "us-west-2",
        
        // Booleans
        cached: true,
        streaming: false,
        
        // Arrays
        token_logprobs: [-0.5, -1.2, -0.8],
        function_calls: ["search", "calculate"],
        
        // Nested objects
        performance: {
          cpu_usage: 45.2,
          memory_mb: 512,
          gpu_utilized: true
        },
        
        // Null values
        error: null,
        warning: null
      }
      
      const validDataPoint = {
        id: "567ab234-e89b-42d3-a456-426614174011",
        final_prompt_text: "Test prompt",
        response_text: "Test response",
        metrics: complexMetrics
      }
      
      const result = yield* Schema.decode(DataPoint)(validDataPoint)
      expect(result.metrics).toEqual(complexMetrics)
    })
  )

  it.effect("should handle multiline prompts and responses", () =>
    Effect.gen(function* () {
      const multilinePrompt = `System: You are a helpful assistant.

User: Can you explain quantum computing?

Please provide:
1. A simple explanation
2. Key concepts
3. Real-world applications`
      
      const multilineResponse = `I'd be happy to explain quantum computing!

1. Simple Explanation:
   Quantum computing uses quantum mechanics principles to process information.

2. Key Concepts:
   - Qubits
   - Superposition
   - Entanglement

3. Real-world Applications:
   - Cryptography
   - Drug discovery
   - Financial modeling`
      
      const validDataPoint = {
        id: "567ab234-e89b-42d3-a456-426614174011",
        final_prompt_text: multilinePrompt,
        response_text: multilineResponse,
        metrics: {
          line_count_prompt: 7,
          line_count_response: 12
        }
      }
      
      const result = yield* Schema.decode(DataPoint)(validDataPoint)
      expect(result.final_prompt_text).toBe(multilinePrompt)
      expect(result.response_text).toBe(multilineResponse)
    })
  )

  it.effect("should reject data point with missing response", () =>
    Effect.gen(function* () {
      const invalidDataPoint = {
        id: "567ab234-e89b-42d3-a456-426614174011",
        final_prompt_text: "Test prompt",
        // missing response_text
        metrics: {}
      }
      
      const result = yield* Effect.either(Schema.decode(DataPoint)(invalidDataPoint))
      expect(result._tag).toBe("Left")
    })
  )
})