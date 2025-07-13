import { Schema } from 'effect';
import { TestRunId, DataPointId } from './branded';

/**
 * TestRun - The parent container for a single execution of prompt experiments
 * Represents an experimental run where prompts are tested with specific LLM configurations
 */
export const TestRun = Schema.Struct({
  id: TestRunId,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc,
  llm_provider: Schema.String,
  llm_model: Schema.String,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});
export type TestRun = typeof TestRun.Type;

/**
 * DataPoint - The result of a single LLM call within a TestRun
 * Contains the prompt that was sent and the response received
 */
export const DataPoint = Schema.Struct({
  id: DataPointId,
  final_prompt_text: Schema.String,
  response_text: Schema.String,
  metrics: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});
export type DataPoint = typeof DataPoint.Type;
