
import { Effect, Context, Layer, Clock } from "effect";
import { v4 as uuidv4 } from "uuid";
import * as S from "effect/Schema";

// --- Uuid Service ---

export const Uuid = S.String.pipe(
  S.pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  S.brand("Uuid")
);
export type Uuid = S.Schema.Type<typeof Uuid>;

export interface UuidService {
  readonly v4: Effect.Effect<Uuid>;
}

export class UuidServiceTag extends Context.Tag("UuidService")<UuidServiceTag, UuidService>() {}

export const UuidServiceLive = Layer.succeed(
  UuidServiceTag,
  {
    v4: Effect.sync(() => uuidv4() as Uuid)
  }
);

// --- Clock Service ---

export interface ClockService {
  readonly currentTimeMillis: Effect.Effect<number>;
  readonly sleep: (ms: number) => Effect.Effect<void>;
}

export class ClockServiceTag extends Context.Tag("ClockService")<ClockServiceTag, ClockService>() {}

export const ClockServiceLive = Layer.succeed(
  ClockServiceTag,
  {
    currentTimeMillis: Clock.currentTimeMillis,
    sleep: (ms: number) => Clock.sleep(ms)
  }
);
