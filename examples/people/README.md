# People examples

This package creates real [Person](models/person.ts) instances. The class implements the separate [PersonDetails](models/person-details.ts) interface and exposes `fullName` and `isAdult()`. Its constructor enforces the age range.

Each nested interface is in its own file: [Address](models/address.ts), [Contact](models/contact.ts), [NotificationPreferences](models/notification-preferences.ts), and [SecurityPreferences](models/security-preferences.ts).

The [Person shape](shapes/person-shape.ts) generates [typed input details](shapes/person-details-shape.ts), then calls `new Person(details)`. The [fixture](fixtures/people.ts) supplies seeded names, UUIDs, nested field overrides, a rule for every boolean beneath `preferences`, and a child scenario. The class constructor alone does not describe the fields to the generator; the shapes provide that information.

Run from the repository root:

```sh
bun run examples person
bun run examples family
bun run examples fill
```

| Scenario | Source | Behavior |
| --- | --- | --- |
| `person` | [create-person.ts](scenarios/create-person.ts) | Builds one class instance, including nested address, contact union variants and security preferences |
| `family` | [create-family.ts](scenarios/create-family.ts) | Uses one session to build an adult and two children sharing the parent's surname; overrides one boolean |
| `fill` | [fill-person-details.ts](scenarios/fill-person-details.ts) | Completes an existing partial object in place, preserving age zero and a false preference |

The [tests](people.test.ts) verify constructor methods, nested values, rule precedence, family cases, identity and replay. Run all example tests with `bun run examples:test`. See the [example index](../README.md).
