import { expect, expectTypeOf, test } from 'vitest';
import { defineFixture, fixtureRun, shape, select, omit, value, integer, type Infer, type DeepPartial, type RunOptions } from '../src/index.js';
const model = shape.object({ name: shape.string(), age: shape.integer(), address: shape.object({ city: shape.string(), zip: shape.string() }), other: shape.object({ label: shape.string() }), tags: shape.array(shape.string()), flag: shape.boolean(), nil: shape.nullable(shape.string()) });
type Person = Infer<typeof model>;
const people = defineFixture(model);
const options = { seed: 42, now: '2026-01-01Z' };
test('full objects remain the default; onlyProvided excludes every unselected property', () => {
  const full = people.one({ ...options, fields: { name: 'Ada' } });
  expect(Object.keys(full)).toHaveLength(7); expect(full.address.zip).toBeTypeOf('string');
  const partial = people.one({ ...options, onlyProvided: true, fields: { name: 'Ada', address: { city: 'Beirut' } } });
  expect(partial).toEqual({ name: 'Ada', address: { city: 'Beirut' } });
  expect(Object.hasOwn(partial, 'age')).toBe(false); expect(Object.hasOwn(partial.address!, 'zip')).toBe(false);
  expectTypeOf(full).toEqualTypeOf<Person>(); expectTypeOf(partial).toEqualTypeOf<DeepPartial<Person>>();
  const oldOptions: RunOptions<Person> = options;
  expectTypeOf(people.one(oldOptions)).toEqualTypeOf<Person>();
  // @ts-expect-error Partial results cannot be assigned to a complete Person.
  const complete: Person = partial; void complete;
});
test('selection comes from merged recipe/case/call fields and supports generators, null and empty values', () => {
  const fixture = defineFixture(model, { fields: { name: 'Ada' }, cases: { adult: { fields: { age: integer({ min: 18, max: 18 }) } } } });
  expect(fixture.one({ ...options, onlyProvided: true, case: 'adult', fields: { address: { city: '' }, flag: false, nil: null, tags: [] } })).toEqual({ name: 'Ada', age: 18, address: { city: '' }, flag: false, nil: null, tags: [] });
  expect(people.one({ ...options, onlyProvided: true })).toEqual({});
});
test('batches, streams, results and session calls return partial types with the same selection', () => {
  const selected = { ...options, onlyProvided: true as const, fields: { name: 'Ada' } };
  expect(people.many(2, selected)).toEqual([{ name: 'Ada' }, { name: 'Ada' }]);
  expect(people.stream(selected).next().value).toEqual({ name: 'Ada' });
  const result = people.result(selected); expect(result.value).toEqual({ name: 'Ada' }); expect(result.seed).toBe(42);
  const run = fixtureRun(options);
  const partial = run.make(people, { onlyProvided: true, fields: { name: 'Ada' } });
  expect(partial).toEqual({ name: 'Ada' });
  expect(run.makeMany(people, 2, { onlyProvided: true, fields: { name: 'Ada' } })).toEqual([{ name: 'Ada' }, { name: 'Ada' }]);
  expectTypeOf(partial).toEqualTypeOf<DeepPartial<Person>>();
  expectTypeOf(result.value).toEqualTypeOf<DeepPartial<Person>>();
});
test('explicit omission removes own keys through both fields and rules, including fill', () => {
  const selectors = select(model);
  const fields = people.one({ ...options, fields: { name: omit(), address: { city: omit() } } });
  const rules = defineFixture(model, { rules: [selectors.field(x => x.name).use(omit())] }).one(options);
  expect(Object.hasOwn(fields, 'name')).toBe(false); expect(Object.hasOwn(fields.address, 'city')).toBe(false);
  expect(Object.hasOwn(rules, 'name')).toBe(false);
  const existing = { name: 'Ada', address: { city: 'Beirut' } };
  people.fill(existing, { ...options, fields: { name: omit() } }); expect(Object.hasOwn(existing, 'name')).toBe(false);
  const explicitUndefined = people.one({ ...options, fields: { name: value(undefined as never) } });
  expect(Object.hasOwn(explicitUndefined, 'name')).toBe(true); expect(explicitUndefined.name).toBeUndefined();
  expect(defineFixture(shape.string(), { rules: [{ match: { path: '$' }, use: omit() }] }).one(options)).toBeUndefined();
});
test('blank still retains blank objects/collections; schema checking rejects incomplete required fields', () => {
  expect(people.blank(options)).toEqual({ address: {}, other: {}, tags: [] });
  expect(() => people.one({ ...options, onlyProvided: true, fields: { name: 'Ada' }, check: 'schema' })).toThrow('VALIDATION');
});
test('selected optional/nullable trees stay present and preserve supplied descendants', () => {
  const fixture = defineFixture(shape.object({ optional: shape.optional(shape.object({ name: shape.string(), age: shape.integer() })), nullable: shape.nullable(shape.object({ city: shape.string(), zip: shape.string() })) }));
  expect(fixture.one({ ...options, onlyProvided: true, optionalProbability: 1, nullProbability: 1, fields: { optional: { name: 'Ada' }, nullable: { city: 'Beirut' } } })).toEqual({ optional: { name: 'Ada' }, nullable: { city: 'Beirut' } });
  expect(fixture.one({ ...options, optionalProbability: 1, nullProbability: 1, fields: { optional: { name: 'Ada' } } }).optional!.name).toBe('Ada');
});
test('selection does not implicitly add computed/feed properties, and rules only apply to visited fields', () => {
  const fixture = defineFixture(model, { computed: d => ({ age: d.derive(['name'], name => name.length) }), rules: [{ ...select(model).field(x => x.flag).use(true), optional: true }] });
  expect(fixture.one({ ...options, onlyProvided: true, fields: { name: 'Ada' } })).toEqual({ name: 'Ada' });
});
test('unsafe partial class construction and unknown fields fail clearly', () => {
  class PersonClass { constructor(readonly name: string, readonly age: number) {} }
  const classes = defineFixture(shape.class({ name: shape.string(), age: shape.integer() }, data => new PersonClass(data.name as string, data.age as number)));
  expect(() => classes.one({ ...options, onlyProvided: true, fields: { name: 'Ada' } })).toThrow('class factories');
  const transforms = defineFixture(shape.transform(shape.object({ name: shape.string() }), data => ({ name: data.name, added: true })));
  expect(() => transforms.one({ ...options, onlyProvided: true, fields: { name: 'Ada' } })).toThrow('partial transformation output');
  // @ts-expect-error Unknown properties are rejected at compile time and runtime.
  expect(() => people.one({ ...options, onlyProvided: true, fields: { unknown: 'x' } })).toThrow('Unknown field');
  // @ts-expect-error onlyProvided must be boolean.
  expect(() => people.one({ onlyProvided: 'yes' })).toThrow('onlyProvided must be a boolean');
});

test('dynamic selection flags return a conservative partial-capable type', () => {
  const enabled = Boolean(true);
  const result = people.one({ ...options, onlyProvided: enabled, fields: { name: 'Ada' } });
  expect(result).toEqual({ name: 'Ada' });
  expectTypeOf(result).toEqualTypeOf<Person | DeepPartial<Person>>();
  const sessionResult = fixtureRun(options).make(people, { onlyProvided: enabled, fields: { name: 'Ada' } });
  expect(sessionResult).toEqual({ name: 'Ada' });
});
