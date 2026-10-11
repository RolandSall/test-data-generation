# Inheritance, polymorphism and selectors

Run from the repository root:

```sh
bun run playground inheritance
bun run playground polymorphism
bun run playground unknown-fields
bun run playground:test
```

[`Animal`](models/animal.ts) implements the [`NamedAnimal`](models/named-animal.ts) contract. [`Dog`](models/dog.ts) and [`Cat`](models/cat.ts) extend it, initialize inherited fields through `super()`, and override `speak()`. Calling the inherited `describe()` method invokes the concrete subclass's implementation.

[`shapes.ts`](shapes.ts) shares inherited field descriptors, then constructs real instances through typed input transformations. `AnimalShape` explicitly registers both subtypes. `HouseholdShape` generates them in a nested collection. No automatic subclass discovery occurs.

[`fixtures.ts`](fixtures.ts) shows property-access selectors for inherited class fields (`animal => animal.name`), all generated booleans, and a nested owner field. `dogHouseholds` replaces the union collection with a fixture whose element shape is exclusively `DogShape`. Its declared result type remains `Dog | Cat` to match the parent field; the runtime constructor is always `Dog`.

[`scenarios.ts`](scenarios.ts) prints prototype checks and polymorphic behavior. The unknown-fields demo intentionally simulates untyped configuration: existing inherited fields can be overridden; unknown override keys produce `CONFIGURATION`, unknown selector paths produce `CONFIGURATION` immediately, and unmatched raw rules produce `UNUSED_RULE`.

[`inheritance.test.ts`](inheritance.test.ts) verifies prototypes, inherited data, overridden methods, both concrete variants, deterministic replay, deep boolean rules, forced subtypes, constructor guards and field errors. This directory is excluded from npm packaging.
