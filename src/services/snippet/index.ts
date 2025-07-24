/**
 * Snippet persistence service exports
 * Re-exports all public functions for managing snippets in Neo4j
 */

export {
  createSnippet,
  createSnippetVersion,
  mustGetSnippetByName,
  maybeGetSnippetByName,
  mustGetLatestSnippetVersion,
  maybeGetLatestSnippetVersion,
  listSnippets,
  searchSnippets,
} from './SnippetPersistence';
