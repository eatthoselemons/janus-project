import { Command, Options } from '@effect/cli';
import { snippet } from './commands/snippet';

const mainCommand = Command.make('janus', {
  verbose: Options.boolean('verbose').pipe(
    Options.withAlias('v'),
    Options.withDescription('Enable verbose output'),
    Options.withDefault(false),
  ),
}).pipe(Command.withSubcommands([snippet]));

export const run = Command.run(mainCommand, {
  name: 'Janus CLI',
  version: '0.0.1',
});
