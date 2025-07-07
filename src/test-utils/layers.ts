import { Layer, Context } from "effect"

/**
 * Generic test layer factory that creates a layer from a partial implementation.
 * Unimplemented methods will throw errors when called, helping catch missing mocks.
 */
export const makeTestLayer = <I, S extends object>(
  tag: Context.Tag<I, S>
) => (implementation: Partial<S>): Layer.Layer<I> => {
  const proxy = new Proxy({} as S, {
    get(_, prop) {
      if (prop in implementation) {
        return implementation[prop as keyof S]
      }
      throw new Error(`Method ${String(prop)} not implemented in test`)
    }
  })
  return Layer.succeed(tag, proxy)
}