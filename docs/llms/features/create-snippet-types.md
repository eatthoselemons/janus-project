## FEATURE:

create snippet types as defined in the "docs/design/domain-model.md" and then write tests for them

## EXAMPLES:

## DOCUMENTATION:

There is an "effect-compliance-checklist.md" in `docs/llms/effect/` made from the effect documentation that has a lot of tasks we need for implementing effect correctly

There is also the effect llm documentation, follow any links you need for more information
-   **Topics/Index:** `https://effect.website/llms.txt`

You can find the entire vitest documentation in `examples/vitest/docs`

You can also find the entire neo4j documentation at `examples/neo4j-documentation`

You can find effect specific test instructions here: https://www.npmjs.com/package/@effect/vitest

follow the best practices as laid out in the `docs/llms/examples/effect-neo4j-essential-guide.md`

use the `docs/llms/effect/effect-compliance-checklist.md` to ensure that you have implemented the changes according to the best practices

## OTHER CONSIDERATIONS:

include tests to ensure that the `Schema.Structs` are have been implemented correctly, there are `Model.Class` features that are commonly used for database queries but `Model.Class` is intended for sql not neo4j so we need to make many of the features ourself via `Schema.Struct` refer to the documentation in `