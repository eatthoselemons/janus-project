import { Context, Effect, Layer } from 'effect';

/**
 * Creates an unimplemented method that dies with a descriptive error
 * This helps identify when tests are calling methods they shouldn't
 */
const makeUnimplemented = (serviceName: string, methodName: PropertyKey) => {
  const errorMessage = `${serviceName}: Unimplemented method "${methodName.toString()}"`;
  const dead = Effect.die(errorMessage);
  
  // Create a function that returns the dead effect
  function unimplemented(...args: any[]) {
    Effect.logError(`Called unimplemented method with args: ${JSON.stringify(args)}`).pipe(
      Effect.runSync
    );
    return dead;
  }
  
  // Make the function behave like an Effect
  Object.assign(unimplemented, dead);
  Object.setPrototypeOf(unimplemented, Object.getPrototypeOf(dead));
  
  return unimplemented;
};

/**
 * Creates a proxy that provides default implementations for unimplemented methods
 * This allows partial service implementations in tests
 */
const makeUnimplementedProxy = <A extends object>(
  serviceName: string,
  partialImpl: Partial<A>,
): A =>
  new Proxy({ ...partialImpl } as A, {
    get(target, prop, _receiver) {
      if (prop in target) {
        return target[prop as keyof A];
      }
      // Create and cache the unimplemented method
      return ((target as any)[prop] = makeUnimplemented(serviceName, prop));
    },
    has: () => true, // Pretend all properties exist
  });

/**
 * Creates a test layer factory for a service
 * This allows you to create test implementations with only the methods you need.
 * Unimplemented methods will throw descriptive errors when called.
 * 
 * This is the recommended approach for creating test layers in Effect applications,
 * especially when using class-based service tags.
 * 
 * @example
 * ```ts
 * // With a class-based service tag
 * class UserService extends Context.Tag('UserService')<UserService, {
 *   findById: (id: string) => Effect.Effect<User>
 *   create: (data: UserData) => Effect.Effect<User>
 * }>() {}
 * 
 * // Create a test layer with only the methods you need
 * const testLayer = makeTestLayerFor(UserService)({
 *   findById: (id) => Effect.succeed({ id, name: 'Test User' })
 *   // create is not implemented - will throw if called
 * });
 * 
 * // Use in tests
 * const program = Effect.gen(function* () {
 *   const users = yield* UserService
 *   return yield* users.findById('123')
 * })
 * 
 * const result = await Effect.runPromise(
 *   program.pipe(Effect.provide(testLayer))
 * )
 * ```
 */
export const makeTestLayerFor = <S extends object>(
  tag: Context.Tag<any, S> & { key?: string; _tag?: string },
) => {
  const serviceName = tag.key || (tag as any)._tag || 'UnknownService';
  
  return (partialService: Partial<S>): Layer.Layer<any> =>
    Layer.succeed(tag as any, makeUnimplementedProxy(serviceName, partialService));
};

/**
 * Type helper to extract the service type from a Context.Tag
 * Useful when you need to work with the service interface directly
 */
export type ServiceOf<T> = T extends Context.Tag<any, infer S> ? S : never;

/**
 * Creates a simple stub layer that returns fixed values
 * Useful for services where you want all methods to return the same value
 * 
 * @example
 * ```ts
 * const StubLogger = makeStubLayer(LoggerService)({
 *   defaultReturn: Effect.succeed(undefined)
 * });
 * ```
 */
export const makeStubLayer = <I, S extends object>(
  tag: Context.Tag<I, S>,
) => (options: { defaultReturn?: any } = {}): Layer.Layer<I> => {
  const handler = {
    get(_target: any, prop: PropertyKey) {
      if (typeof prop === 'string' && !prop.startsWith('_')) {
        return () => options.defaultReturn ?? Effect.succeed(undefined);
      }
      return undefined;
    },
  };
  
  return Layer.succeed(tag, new Proxy({} as S, handler));
};