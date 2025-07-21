## FEATURE:

create snippet types as defined in the "docs/design/domain-model.md" and then write tests for them

## EXAMPLES:

## DOCUMENTATION:

There is also the effect llm documentation, follow any links you need for more information

- **Topics/Index:** `https://effect.website/llms.txt`

You can find the entire vitest documentation in `examples/vitest/docs`

You can also find the entire neo4j documentation at `examples/neo4j-documentation`

You can find effect specific test instructions here: https://www.npmjs.com/package/@effect/vitest

follow the best practices as laid out in the effect-neo4j guides. Usage instructions are in `docs/llms/guides/effect-neo4j/README.md`. Link the specific chapters the implementing llm needs

use the `docs/llms/effect/effect-compliance-checklist.md` to ensure that you have implemented the changes according to the best practices

## OTHER CONSIDERATIONS:

include tests to ensure that the `Schema.Structs` are have been implemented correctly, there are `Model.Class` features that are commonly used for database queries but `Model.Class` is intended for sql not neo4j so we need to make many of the features ourself via `Schema.Struct` refer to the documentation in `
