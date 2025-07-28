#!/usr/bin/env node
import * as NodeRuntime from '@effect/platform-node/NodeRuntime';
import * as NodeContext from '@effect/platform-node/NodeContext';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ConfigProvider from 'effect/ConfigProvider';
import { run } from '../cli';
import { ConfigServiceLive } from '../layers/configuration/Configuration.layer';
import { Neo4jLive } from '../layers/neo4j/Neo4j.layer';

const MainLive = Layer.mergeAll(NodeContext.layer, NodeFileSystem.layer).pipe(
  Layer.provideMerge(ConfigServiceLive),
  Layer.provideMerge(Neo4jLive),
);

const program = run(process.argv).pipe(
  Effect.provide(MainLive),
  Effect.withConfigProvider(ConfigProvider.fromEnv()),
) as Effect.Effect<void, never, never>;

NodeRuntime.runMain(program, { disableErrorReporting: true });
