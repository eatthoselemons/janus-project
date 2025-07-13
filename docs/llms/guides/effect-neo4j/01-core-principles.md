> **Audience:** LLM / AI Agent (Focused Guide)

# 1. Core Principles

This guide covers the core principles for building applications with Effect-TS and Neo4j, following principles from three essential books:
- **"Grokking Simplicity"** by Eric Normand - Separate Data, Calculations, and Actions
- **"Type-Driven Development with Idris"** by Edwin Brady - Let types guide implementation
- **"Programming with Types"** by Vlad Riscutia - Avoid primitive obsession, use composition

## From "Grokking Simplicity" (Eric Normand)
1. **Stratified Design** - Build layers of abstraction where each layer only knows about layers below
2. **Separate Actions, Calculations, and Data**:
   - **Data**: What things ARE (immutable values)
   - **Calculations**: Compute new data from existing data (pure functions)
   - **Actions**: Interact with the world (side effects wrapped in Effect)
3. **Minimize Actions** - Push as much logic as possible into pure calculations
4. **Make Actions Atomic** - Group related side effects together

## From "Type-Driven Development with Idris" (Edwin Brady)
1. **Type, Define, Refine** workflow:
   - **Type**: Define types that make illegal states impossible
   - **Define**: Write function signatures using those types
   - **Refine**: Implement functions guided by types, then refine types if needed
2. **Make illegal states unrepresentable** - Use the type system to prevent errors at compile time
3. **Total functions** - Handle all possible inputs explicitly
4. **Types as specifications** - Types document intent and constraints

## From "Programming with Types" (Vlad Riscutia)
1. **Avoid primitive obsession** - Wrap primitives in semantic domain types
2. **Use composition over inheritance** - Build behavior from small, composable functions
3. **Parse, don't validate** - Transform and validate data once at system boundaries
4. **Phantom types for compile-time guarantees** - Use branded types for type safety
5. **Functions as values** - Pass and return functions to build complex behavior