> **Audience:** LLM / AI Agent (Focused Guide)

# 3. Data Layer - Schema Design

This section covers the rules for designing Neo4j schemas using `Effect-TS`.

### Neo4j-Specific Schema Rules

**Critical**: NEVER use `Model.Class` with Neo4j - it's SQL-only!

```typescript
// ❌ WRONG - Model.Class is for SQL databases
export class Person extends Model.Class<Person>("Person")({...})

// ✅ CORRECT - Use Schema.Struct for Neo4j nodes
export const PersonNode = Schema.Struct({
  id: PersonId,
  name: PersonName,
  email: Email,
  age: Age,
  labels: Schema.Array(Label),
  createdAt: Schema.DateTimeUtc
})
export type PersonNode = typeof PersonNode.Type

// ✅ CORRECT - Use Schema.Class only when you need methods
export class PersonNode extends Schema.Class<PersonNode>("PersonNode")({
  id: PersonId,
  name: PersonName,
  labels: Schema.Array(Label)
}) {
  hasLabel(label: Label): boolean {
    return this.labels.includes(label)
  }

  get displayName(): string {
    return `${this.name} (${this.id})`
  }
}
```

### Relationship Schemas

Define relationships as first-class entities:

```typescript
export const FollowsRelationship = Schema.Struct({
  since: Schema.DateTimeUtc,
  strength: RelationshipStrength,
  mutual: Schema.Boolean,
});
export type FollowsRelationship = typeof FollowsRelationship.Type;

export const WorksAtRelationship = Schema.Struct({
  role: JobTitle,
  startDate: Schema.DateTimeUtc,
  endDate: Schema.Option(Schema.DateTimeUtc),
  department: Department,
});
```

### Complex Node Types

For nodes with rich properties:

```typescript
export const CompanyNode = Schema.Struct({
  id: CompanyId,
  name: CompanyName,
  founded: Schema.DateTimeUtc,
  employees: EmployeeCount,
  revenue: Schema.Option(Revenue),
  industries: Schema.Array(Industry),
  headquarters: Address,
  metadata: Schema.Record(Schema.String, Schema.Unknown),
});
```
