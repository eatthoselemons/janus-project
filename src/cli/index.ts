import { Command, Args, Options } from "@effect/cli";
import { Effect } from "effect";

// --- Reusable Options & Args ---

const message = Options.text("message").pipe(Options.withAlias("m"));

// --- Snippet Commands ---

const snippetPull = Command.make(
  "pull",
  { args: Args.text({ name: "snippet-name" }) },
  ({ args }) => Effect.sync(() => console.log(`Pulling snippet: ${args}`))
);

const snippetPush = Command.make(
  "push",
  { args: Args.text({ name: "file-path" }), options: message },
  ({ args, options }) =>
    Effect.sync(() => console.log(`Pushing snippet from: ${args} with message: ${options}`))
);

const snippetList = Command.make("list", {}, () =>
  Effect.sync(() => console.log("Listing all snippets"))
);

const snippetSearch = Command.make(
  "search",
  { args: Args.text({ name: "query" }) },
  ({ args }) => Effect.sync(() => console.log(`Searching for snippets with query: ${args}`))
);

const snippet = Command.make("snippet").pipe(
  Command.withSubcommands([snippetPull, snippetPush, snippetList, snippetSearch])
);

// --- Composition Commands ---

const compositionCreateVersion = Command.make(
  "create-version",
  { options: message },
  ({ options }) => Effect.sync(() => console.log(`Creating version with message: ${options}`))
);

const compositionList = Command.make("list", {}, () =>
  Effect.sync(() => console.log("Listing all compositions"))
);

const composition = Command.make("composition").pipe(
  Command.withSubcommands([compositionCreateVersion, compositionList])
);

// --- Parameter Commands ---

const parameterCreate = Command.make(
  "create",
  { args: Args.text({ name: "name" }) },
  ({ args }) => Effect.sync(() => console.log(`Creating parameter: ${args}`))
);

const parameterAddOption = Command.make(
    "add-option",
    { args: Args.text({ name: "parameter-name" }), options: message },
    ({ args, options }) => Effect.sync(() => console.log(`Adding option to ${args} with message: ${options}`))
);

const parameterList = Command.make("list", {}, () =>
    Effect.sync(() => console.log("Listing all parameters"))
);

const parameterListOptions = Command.make(
    "list-options",
    { args: Args.text({ name: "parameter-name" }) },
    ({ args }) => Effect.sync(() => console.log(`Listing options for ${args}`))
);

const parameter = Command.make("parameter").pipe(
    Command.withSubcommands([parameterCreate, parameterAddOption, parameterList, parameterListOptions])
);

// --- Run Commands ---

const run = Command.make(
    "run",
    { args: Args.text({ name: "config-file-path" }) },
    ({ args }) => Effect.sync(() => console.log(`Running test with config: ${args}`))
);

// --- Janus Command ---

export const janus = Command.make("janus").pipe(
  Command.withSubcommands([snippet, composition, parameter, run])
);