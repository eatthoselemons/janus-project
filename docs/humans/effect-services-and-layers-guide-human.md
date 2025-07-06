
# Using Services and Layers in Effect: A Guide to Actions, Calculations, and Data

This guide explains how to use Effect's `Services` and `Layers` to structure your application according to the principles of "actions, calculations, and data," as described in Eric Normand's "Grokking Simplicity." We'll use examples from this repository to illustrate these concepts.

## The Core Principles

*   **Data:** Immutable data structures that represent the state of your application.
*   **Calculations:** Pure functions that take data as input and produce new data as output. They have no side effects.
*   **Actions:** Operations that interact with the outside world, such as reading from a database, making an API call, or writing to the console. Actions are where side effects live.

By separating these three concerns, we can build applications that are easier to reason about, test, and maintain.

## Services as Actions

In Effect, **Services** are the natural way to represent **actions**. A service is a collection of functions that perform side effects. We can define a service using `Context.Tag`.

Let's look at an example from `examples/http-server/src/Domain/User.ts`:

```typescript
import { Context, Effect } from "effect"

// ... other imports

export class CurrentUser extends Context.Tag("Domain/User/CurrentUser")<
  CurrentUser,
  {
    readonly _: unique symbol
    readonly id: string
    readonly email: string
    readonly name: string
  }
>() {}
```

Here, `CurrentUser` is a service that provides information about the currently logged-in user. It's defined as a `Context.Tag` with a unique identifier `"Domain/User/CurrentUser"`. The second type parameter defines the shape of the service's implementation.

This service represents an **action** because it depends on the external context of an HTTP request to determine the current user. It's not a pure calculation.

## Layers: Providing Implementations for Services

A **Layer** provides a concrete implementation for a service. This is how we connect our abstract service definitions (actions) to the real world.

We can create layers that provide live implementations (e.g., fetching a user from a database) or test implementations (e.g., returning a hard-coded user).

Here's an example of a utility function from `examples/http-server/src/lib/Layer.ts` that creates a test layer for any service:

```typescript
import { Context, Layer } from "effect"

export const makeTestLayer = <I, S extends object>(tag: Context.Tag<I, S>) => (service: Partial<S>): Layer.Layer<I> =>
  Layer.succeed(tag, tag.of(service as S))
```

This function, `makeTestLayer`, takes a service `tag` and a partial implementation of that service. It then creates a `Layer` that provides the full service by merging the partial implementation with the service's interface.

We can use this to provide a test implementation of our `CurrentUser` service like this:

```typescript
import { Effect, Layer } from "effect"
import { CurrentUser } from "examples/http-server/src/Domain/User.ts"
import { makeTestLayer } from "examples/http-server/src/lib/Layer.ts"

const testUserLayer = makeTestLayer(CurrentUser)({
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
})

const program = Effect.gen(function*(_) {
  const user = yield* _(CurrentUser)
  console.log(`The current user is ${user.name}`)
})

const runnable = Effect.provide(program, testUserLayer)

Effect.runPromise(runnable)
```

In this example:

1.  `testUserLayer` is a `Layer` that provides a concrete implementation of the `CurrentUser` service.
2.  `program` is an `Effect` that depends on the `CurrentUser` service.
3.  `Effect.provide(program, testUserLayer)` injects the `testUserLayer` into the `program`, satisfying its dependency on `CurrentUser`.

## Calculations: The Glue Between Actions

**Calculations** are pure functions that operate on data. In an Effect application, calculations are often represented by functions that take data as input and return an `Effect` that describes a computation. These `Effect`s can then be composed with our services (actions).

For example, let's imagine a function that determines if a user is an administrator:

```typescript
import { Effect } from "effect"
import { CurrentUser } from "examples/http-server/src/Domain/User.ts"

const isAdministrator = (user: CurrentUser): boolean => {
  return user.email.endsWith("@example.com")
}

const program = Effect.gen(function*(_) {
  const user = yield* _(CurrentUser)
  if (isAdministrator(user)) {
    console.log("Welcome, administrator!")
  } else {
    console.log("Welcome, user!")
  }
})
```

Here, `isAdministrator` is a pure **calculation**. It takes a `CurrentUser` (data) and returns a `boolean` (data). It has no side effects. The `program` then uses this calculation to decide what to do.

## Putting It All Together

By using `Services` to define our **actions**, `Layers` to provide their implementations, and pure functions for our **calculations**, we can build Effect applications that are:

*   **Testable:** We can easily swap out live layers with test layers to test our business logic in isolation.
*   **Maintainable:** The separation of concerns makes it easier to understand and modify our code.
*   **Composable:** Effect's powerful composition operators allow us to build complex applications from small, reusable pieces.

This approach aligns perfectly with the principles of "actions, calculations, and data," and provides a solid foundation for building robust and scalable applications with Effect.
