#!/usr/bin/env node

import { janus } from "./cli/index";
import { Command } from "@effect/cli";
import { Effect } from "effect";
import { NodeContext, NodeRuntime } from "@effect/platform-node";

const cli = Command.run(janus, {
  name: "Janus CLI",
  version: "0.0.1",
});

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
);