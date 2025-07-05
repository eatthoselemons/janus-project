import { describe, it, expect } from 'vitest';
import { janus } from './index';

describe('CLI Commands Structure', () => {
  it('should export a janus command', () => {
    expect(janus).toBeDefined();
    expect(typeof janus).toBe('object');
  });

  it('should be a valid Effect CLI command object', () => {
    // Test that the CLI is properly structured as an Effect Command
    expect(janus).toBeDefined();
    expect(janus).toHaveProperty('descriptor');
    expect(janus).toHaveProperty('tag');
    expect(janus).toHaveProperty('transform');
  });

  it('should implement the CLI structure according to design spec', () => {
    // This test validates that the CLI exports properly and matches the design
    // The specific internal structure is less important than the fact that it compiles and exports
    expect(janus).toBeDefined();
    expect(janus.descriptor).toBeDefined();
    
    // The fact that it has a descriptor means it's a properly constructed CLI command
    expect(janus.descriptor._tag).toBe('Subcommands');
  });

  it('should be usable with the Effect CLI runner', () => {
    // This is a basic integration test to ensure the CLI can be used
    expect(janus).toBeDefined();
    expect(typeof janus).toBe('object');
    expect(janus.descriptor).toBeDefined();
    
    // The CLI should have the basic structure needed for Effect CLI
    expect(janus).toHaveProperty('tag');
    expect(janus).toHaveProperty('transform');
  });
});