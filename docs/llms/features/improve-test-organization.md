## FEATURE:

There are 2 things to do:
1. expand tests, need test cases on an expected case, a failure case, and an edge case
2. Re-organize the files. Many of the files, especially the models, need to be broken up into smaller files

I expect that there will need to be a set of test directories with sub-files for each model type
Also there should be many tests for neo4j, testing that the database operations work, testing that the various queries to the database do create/update/delete the data they are supposed to


## EXAMPLES:

there are a few tests in the `src/core/model.tests.ts`

## DOCUMENTATION:

There is an "effect-compliance-checklist.md" in `docs/llms/effect/` made from the effect documentation that has a lot of tasks we need for implementing effect correctly

There is also the effect llm documentation
-   **Condensed:** `https://effect.website/llms-small.txt`
-   **Full:** `https://effect.website/llms-full.txt`
-   **Topics/Index:** `https://effect.website/llms.txt`

You can find the entire vitest documentation in `examples/vitest/docs`

You can also find the entire neo4j documentation at `examples/neo4j-documentation`

## OTHER CONSIDERATIONS:

include tests to ensure that the `Schema.Structs` are have been implemented correctly