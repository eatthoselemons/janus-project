import { Schema } from 'effect';
import { ParameterId, ParameterOptionId, Slug } from './branded';

/**
 * Parameter - The abstract definition of a parameter
 * Represents a named variable that can be injected into snippet templates
 */
export const Parameter = Schema.Struct({
  id: ParameterId,
  name: Slug,
  description: Schema.String,
});
export type Parameter = typeof Parameter.Type;

/**
 * ParameterOption - A specific, versioned value for a Parameter
 * Represents one possible value that can be used for a parameter
 */
export const ParameterOption = Schema.Struct({
  id: ParameterOptionId,
  value: Schema.String, // The actual value, e.g., "must", "should", "may"
  createdAt: Schema.DateTimeUtc,
  commit_message: Schema.String, // Mandatory message explaining the change
});
export type ParameterOption = typeof ParameterOption.Type;
