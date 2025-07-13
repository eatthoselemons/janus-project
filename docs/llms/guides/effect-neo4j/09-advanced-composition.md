> **Audience:** LLM / AI Agent (Focused Guide)

# 9. Advanced Composition Patterns

While the patterns above cover the core of a database application, `Effect-TS` provides powerful composition patterns for all aspects of an application. The following are examples of how to compose other critical pieces of your system.

### Tagged Error Composition
Errors compose through tagged unions rather than inheritance. This allows services to return a clear, explicit set of possible errors that can be handled by the caller.

```typescript
// Domain-specific errors
export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: UserId },
  HttpApiSchema.annotations({ status: 404 })
) {}

export class GroupNotFound extends Schema.TaggedError<GroupNotFound>()(
  "GroupNotFound",
  { id: GroupId },
  HttpApiSchema.annotations({ status: 404 })
) {}

// Policy errors that compose with domain errors
export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {
    actorId: UserId,
    entity: Schema.String,
    action: Schema.String
  },
  HttpApiSchema.annotations({ status: 403 })
) {
  get message() {
    return `Actor (${this.actorId}) is not authorized to perform action "${this.action}" on entity "${this.entity}"`
  }
}

// A service can return a union of these errors
type MyServiceErrors = UserNotFound | GroupNotFound | Unauthorized
```

### API and Middleware Composition
For applications that expose an HTTP API, the `@effect/platform` library provides composition for endpoints and middleware.

```typescript
// Individual API groups
export class AccountsApi extends HttpApiGroup.make("accounts")
  .add(HttpApiEndpoint.patch("updateUser", "/users/:id"))
  .add(HttpApiEndpoint.get("getUserMe", "/users/me"))
  .middlewareEndpoints(Authentication) // Apply middleware to a group
  .annotate(OpenApi.Title, "Accounts")
{}

// Compose groups into a final API
export class Api extends HttpApi.empty
  .add(AccountsApi)
  .add(GroupsApi)
  .add(PeopleApi)
  .annotate(OpenApi.Title, "Groups API")
{}

// Compose middleware layers for the server
export const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(HttpApiBuilder.middlewareOpenApi()),
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(ApiLive), // Provide the composed API
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)
```

### Policy Composition
Business rules, especially authorization policies, can be composed as pure functions or higher-order Effects.

```typescript
// Functional composition of policies
export const policyCompose = <Actor extends AuthorizedActor<any, any>, E, R>(
  that: Effect.Effect<Actor, E, R>
) =>
<Actor2 extends AuthorizedActor<any, any>, E2, R2>(
  self: Effect.Effect<Actor2, E2, R2>
): Effect.Effect<Actor | Actor2, E | Unauthorized, R | CurrentUser> => 
  Effect.zipRight(self, that) as any

// Usage
const authorizedEffect = policyRequire("User", "read")(
  getUserById(id)
).pipe(
  policyCompose(policyRequire("Account", "access")(getAccountById(accountId)))
)
```