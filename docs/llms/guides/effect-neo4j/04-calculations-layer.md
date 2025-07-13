> **Audience:** LLM / AI Agent (Focused Guide)

# 4. Calculations Layer - Pure Functions

This section covers how to implement the Calculations layer using pure functions.

### Domain Calculations

Pure functions that operate on your domain types:

```typescript
// Simple calculations
export const isAdult = (age: Age): boolean => age >= 18;

export const yearsUntilRetirement = (age: Age): number => Math.max(0, 65 - age);

// Composite calculations
export const canRetire = (person: Person): boolean =>
  person.age >= 65 || (person.age >= 60 && person.yearsOfService >= 30);

// Calculations with branded return types
export const calculateInfluence = (
  followers: FollowerCount,
): Effect.Effect<InfluenceScore, Schema.ParseError> =>
  Schema.decode(InfluenceScore)(Math.log10(followers + 1) * 100);

// Compose calculations
export const isInfluencer = (score: InfluenceScore): boolean => score > 300;

export const checkInfluencer = (
  followers: FollowerCount,
): Effect.Effect<boolean, Schema.ParseError> =>
  Effect.map(calculateInfluence(followers), isInfluencer);
```

### Business Rule Calculations

Encode business rules as pure functions:

```typescript
// Relationship rules
export const canFollow = (follower: Person, target: Person): boolean =>
  follower.id !== target.id && !follower.blockedUsers.includes(target.id);

// Validation rules
export const isValidCompanyName = (name: CompanyName): boolean =>
  name.length >= 2 && !RESERVED_NAMES.includes(name);

// Complex business logic
export const calculateDiscount = (
  customer: Customer,
  order: Order,
): Effect.Effect<DiscountPercentage, Schema.ParseError> => {
  const baseDiscount = customer.loyaltyTier === 'Gold' ? 10 : 0;
  const volumeDiscount = order.items.length > 10 ? 5 : 0;
  const seasonalDiscount = isBlackFriday(order.date) ? 15 : 0;

  return Schema.decode(DiscountPercentage)(
    Math.min(baseDiscount + volumeDiscount + seasonalDiscount, 30),
  );
};
```
