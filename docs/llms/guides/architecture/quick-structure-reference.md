# Quick Structure Reference

## Where to Put Code

### Adding a New Feature
1. **Domain types** → `src/domain/types/[feature].ts`
2. **Service interface** → `src/services/[feature]/[Feature].service.ts`
3. **Layer implementation** → `src/layers/[feature]/[Feature].layer.ts`
4. **Wire it up** → Add to `AppLive` in `src/index.ts`

### File Placement Rules
- **Pure types/interfaces** → `/domain/types/`
- **Service definitions (with Tag)** → `/services/[feature]/`
- **Implementations (with dependencies)** → `/layers/[feature]/`
- **Shared test utilities** → `/lib/`
- **Business logic** → `/main.ts` or create new effects

### Service Pattern
```typescript
// In services/myfeature/MyFeature.service.ts
export interface MyFeature {
  readonly doThing: (x: string) => Effect.Effect<Result, Error>
}
export const MyFeature = Tag<MyFeature>()

// Helper functions that use the service go in the same file
export const helperFunction = (param: string) =>
  Effect.gen(function* () {
    const service = yield* MyFeature
    return yield* service.doThing(param)
  })
```

### Layer Pattern
```typescript
// In layers/myfeature/MyFeature.layer.ts
export const MyFeatureLive = Layer.effect(
  MyFeature,
  Effect.gen(function* () {
    const config = yield* Configuration
    return { doThing: (x) => Effect.succeed(...) }
  })
)
```

### Key Rules
- Domain has NO imports from services/layers
- Service files contain both the interface AND helper functions
- Helper functions use the service via dependency injection
- Layers handle all resources and dependencies
- Tests go next to the code they test (`.test.ts`)
- Use `/index.ts` files for clean exports

### Current Services
- `Configuration` - App configuration
- `Neo4jClient` - Database access
