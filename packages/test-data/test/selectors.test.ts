import { expect, expectTypeOf, test } from 'vitest';
import { defineFixture, GenerationError, integer, select, shape, type Paths, type Shape } from '../src/index.js';

test('typed fields and scalar kinds generate nested values with ordinary precedence', () => {
  const model = shape.object({ age: shape.integer(), home: shape.object({ city: shape.string(), enabled: shape.boolean() }), active: shape.boolean() });
  const fields = select(model);
  const recipe = defineFixture(model, { rules: [
    fields.field('age').use(integer({ min: 18, max: 18 })),
    fields.field('home.city').use('Beirut'),
    fields.all('boolean').use(false),
    fields.all('boolean', { under: 'home' }).use(true),
  ] });
  expect(recipe.one({ seed: 42 })).toEqual({ age: 18, home: { city: 'Beirut', enabled: true }, active: false });
  expect(recipe.one({ seed: 42, fields: { home: { enabled: false } } }).home.enabled).toBe(false);
});

test('selected replacements retain type checks for values, generators and scopes', () => {
  const fields = select(shape.object({ name: shape.string(), age: shape.integer(), active: shape.boolean() }));
  expectTypeOf(fields.field('age').use).parameter(0).extract<number>().toEqualTypeOf<number>();
  // @ts-expect-error A selected number cannot receive a string.
  fields.field('age').use('wrong');
  // @ts-expect-error A selected string cannot receive a numeric generator.
  fields.field('name').use(integer());
  // @ts-expect-error Boolean kind selections accept boolean values.
  fields.all('boolean').use(1);
  function compileTimeOnly() {
    // @ts-expect-error Unknown fields are rejected at compile time.
    fields.field('missing');
    // @ts-expect-error Unknown scopes are rejected at compile time.
    fields.all('boolean', { under: 'missing' });
  }
  void compileTimeOnly;
});

test('JavaScript paths and erased casts are checked against shape metadata immediately', () => {
  const fields = select(shape.object({ home: shape.object({ city: shape.string() }) }));
  expect(() => fields.field('home.missing' as 'home.city')).toThrowError(/CONFIGURATION: Unknown selectable field home.missing/);
  expect(() => fields.field('toString' as 'home')).toThrow(GenerationError);
  expect(() => fields.all('boolean', { under: 'missing' as 'home' })).toThrow(GenerationError);
});

test('wrapper and recursive paths resolve without looping on cyclic descriptors', () => {
  interface Node { name: string; child?: Node }
  const recursive: Shape<Node> = shape.lazy(() => shape.object({ name: shape.string(), child: shape.optional(recursive) }));
  expect(select(recursive).field('child.name').use('nested').match.path).toBe('child.name');
  const wrapped = shape.transform(shape.nullable(shape.optional(shape.object({ name: shape.string() }))), value => value);
  expect(select(wrapped).field('name').use('wrapped').match.path).toBe('name');
  const cycle: Shape<{ name: string }> = shape.lazy(() => cycle);
  expect(() => select(cycle).field('name')).toThrow(GenerationError);
});

test('union common fields can be selected and subtype-specific rules remain optional', () => {
  const model = shape.union([shape.object({ name: shape.string(), active: shape.boolean() }), shape.object({ name: shape.string() })]);
  const fields = select(model);
  const recipe = defineFixture(model, { rules: [fields.field('name').use('Ada'), fields.all('boolean', { optional: true }).use(true)] });
  for (const item of recipe.many(20, { seed: 42 })) expect(item.name).toBe('Ada');
  const noBooleans = shape.object({ name: shape.string() });
  expect(() => defineFixture(noBooleans, { rules: [select(noBooleans).all('boolean').use(true)] }).one({ seed: 42 })).toThrowError(/UNUSED_RULE/);
});

test('methods are excluded and unregistered output properties are rejected', () => {
  class Person {
    readonly displayName = 'computed';
    constructor(readonly name: string) {}
    describe(): string { return this.name; }
  }
  expectTypeOf<Paths<Person>>().toEqualTypeOf<'name' | 'displayName'>();
  const model = shape.transform(shape.object({ name: shape.string() }), data => new Person(data.name));
  const fields = select(model);
  expect(() => fields.field('displayName')).toThrowError(/declare it in the runtime shape/);
  expect(defineFixture(model, { rules: [fields.field('name').use('Ada')] }).one().describe()).toBe('Ada');
  function compileTimeOnly() {
    // @ts-expect-error Methods are behavior, not generated fields.
    fields.field('describe');
  }
  void compileTimeOnly;
});
