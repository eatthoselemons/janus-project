import { Console } from 'effect';

// Generic type for entities with name and description
type NamedEntity = {
  readonly name: string;
  readonly description: string;
};

// Generic formatting functions
export const formatNamedEntity = <T extends NamedEntity>(entity: T): string =>
  `${entity.name} - ${entity.description}`;

export const formatNamedEntityList = <T extends NamedEntity>(
  entities: readonly T[],
  emptyMessage: string = 'No items found.',
): string => {
  if (entities.length === 0) {
    return emptyMessage;
  }

  const maxNameLength = Math.max(
    ...entities.map((e) => e.name.length),
    'NAME'.length,
  );

  const header = `${'NAME'.padEnd(maxNameLength)} | DESCRIPTION`;
  const separator = `${'-'.repeat(maxNameLength)} | ${'-'.repeat(50)}`;

  const rows = entities.map(
    (entity) => `${entity.name.padEnd(maxNameLength)} | ${entity.description}`,
  );

  return [header, separator, ...rows].join('\n');
};

// Generic logging functions
export const logSuccess = (message: string) => Console.log(`✓ ${message}`);

export const logError = (message: string) => Console.error(`✗ ${message}`);
