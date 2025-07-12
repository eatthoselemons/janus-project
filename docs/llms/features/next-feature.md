## FEATURE:

Implement the next unchecked subsection as laid out in "docs/design/implementation-todo.md"
ie write a prp for section 1.3 or 2.1 etc

## EXAMPLES:

You can find the entire vitest documentation in `examples/vitest/docs`

You can also find the entire neo4j documentation at `examples/neo4j-documentation`

## DOCUMENTATION:

There is also the effect llm documentation, follow any links you need for more information
-   **Topics/Index:** `https://effect.website/llms.txt`

You can find effect specific test instructions here: https://www.npmjs.com/package/@effect/vitest

follow the best practices as laid out in the effect-neo4j guides. Usage instructions are in `docs/llms/guides/effect-neo4j/README.md`. Link the specific chapters the implementing llm needs

use the `docs/llms/effect/effect-compliance-checklist.md` to ensure that you have implemented the changes according to the best practices

## OTHER CONSIDERATIONS:

all code is in the `src/` folder
When making the PRP name it after the subsection
remember that to run only the janus tests you need to run `pnpm test src`