import { Command } from '@effect/cli';
import { pull } from './pull';
import { push } from './push';
import { list } from './list';
import { search } from './search';

export const snippet = Command.make('snippet').pipe(
  Command.withDescription('Manage snippets in the Janus system'),
  Command.withSubcommands([pull, push, list, search]),
);
