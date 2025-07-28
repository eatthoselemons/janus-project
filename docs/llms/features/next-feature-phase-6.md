## FEATURE:

Write the prp for section 6.1 of the `docs/design/implementation-todo.md`

## EXAMPLES:

You can find example projects at 
- `examples/effect-official-examples/examples/http-server/src/`
- `examples/notion-discord-notifications/src/`

## DOCUMENTATION:

You can also find the entire neo4j documentation at `examples/neo4j-documentation/`

You can find the entire vitest documentation in `examples/vitest/docs/`

All effect documentation is available at `docs/llms/guides/effect-docs/`

You can find effect specific vitest instructions here: https://www.npmjs.com/package/@effect/vitest

follow the best practices as laid out in the effect-neo4j guides. Usage instructions are in `docs/llms/guides/effect-neo4j/README.md`. Link the specific chapters the implementing llm needs

use the `docs/llms/effect/effect-compliance-checklist.md` to ensure that you have implemented the changes according to the best practices

best practices for our repo about making generic persistance layer functions is: `docs/llms/best-practices/generic-persistence-patterns.md`

the code and docs for the effect packages can be found in `docs/llms/guides/effect-packages/`

effect platform node examples can be found in the packages repo `docs/llms/guides/effect-packages/platform-node/examples/`

## OTHER CONSIDERATIONS:

all code is in the `src/` folder
When making the PRP name it after the subsection
Only implement a single subsection, don't combine sections which makes prs too big that they are difficult to review
Note that there is `@effect/platform-node` that should have the methods we need to make the api calls