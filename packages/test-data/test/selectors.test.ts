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

test('property access selectors infer field values and scope nested scalar rules', () => {
  const model = shape.object({ name: shape.string(), age: shape.integer(), home: shape.object({ city: shape.string(), enabled: shape.boolean() }), active: shape.boolean() });
  const fields = select(model);
  const age = fields.field(person => person.age);
  expectTypeOf(age.use).parameter(0).extract<number>().toEqualTypeOf<number>();
  const recipe = defineFixture(model, { rules: [
    fields.field(person => person.name).use('Ada'),
    age.use(integer({ min: 30, max: 30 })),
    fields.field(person => person.home.city).use('Beirut'),
    fields.all('boolean').use(false),
    fields.all('boolean', { under: person => person.home }).use(true),
  ] });
  expect(recipe.one({ seed: 42 })).toEqual({ name: 'Ada', age: 30, home: { city: 'Beirut', enabled: true }, active: false });
  // @ts-expect-error A property-selected number still rejects strings.
  age.use('wrong');
  // @ts-expect-error A property-selected string rejects numeric generators.
  fields.field(person => person.name).use(integer());
  function compileTimeOnly() {
    // @ts-expect-error Property access rejects unknown nested fields.
    fields.field(person => person.home.missing);
    // @ts-expect-error Property scopes reject unknown fields too.
    fields.all('boolean', { under: person => person.missing });
  }
  void compileTimeOnly;
});

test('property selectors support inherited class fields without invoking constructors or getters', () => {
  let constructorCalls = 0;
  class Customer {
    constructor(readonly name: string) { constructorCalls++; }
    get label(): string { throw new Error('Getter must not run'); }
    describe(): string { return this.name; }
  }
  class Member extends Customer {
    constructor(name: string, readonly age: number) { super(name); }
  }
  const input = shape.object({ name: shape.string(), age: shape.integer() });
  const model = shape.transform(input, data => new Member(data.name, data.age));
  const fields = select(model);
  const rule = fields.field(member => member.name).use('Ada');
  expect(constructorCalls).toBe(0);
  expect(defineFixture(model, { rules: [rule] }).one().describe()).toBe('Ada');
  expect(constructorCalls).toBe(1);
  expect(() => fields.field(member => member.label)).toThrowError(/Unknown selectable field label/);
  expect(() => fields.field(member => member.describe)).toThrowError(/Unknown selectable field describe/);
});

test('property callbacks reject computations, constants, multiple fields and mutation', () => {
  const fields = select(shape.object({ name: shape.string(), age: shape.integer(), active: shape.boolean() }));
  const rejected = [
    () => fields.field(person => person.age + 1),
    () => fields.field(person => `${person.name}`),
    () => fields.field(person => person.name.toUpperCase()),
    () => fields.field(() => 'name'),
    () => fields.field(person => person),
    () => fields.field(person => person.active ? person.name : person.age),
    () => fields.field(person => { person.name = 'changed'; return person.name; }),
    () => fields.field(person => { delete (person as { name?: string }).name; return person.age; }),
    () => fields.field(person => { Object.defineProperty(person, 'name', { value: 'changed' }); return person.name; }),
    () => fields.field(person => { Object.keys(person); return person.name; }),
    () => fields.field(person => { Object.getOwnPropertyDescriptor(person, 'name'); return person.name; }),
    () => fields.field(person => { Object.getPrototypeOf(person); return person.name; }),
    () => fields.field(person => { void ('name' in person); return person.name; }),
  ];
  for (const attempt of rejected) expect(attempt).toThrowError(/CONFIGURATION: Property selector must return a single field access/);
});

test('optional property access and whole collection selections retain their declared types', () => {
  const model = shape.object({ customer: shape.optional(shape.object({ name: shape.string() })), items: shape.array(shape.integer()) });
  const fields = select(model);
  expect(fields.field(order => order.customer?.name).use('Ada').match.path).toBe('customer.name');
  expectTypeOf(fields.field(order => order.customer?.name).use).parameter(0).extract<string | undefined>().toEqualTypeOf<string | undefined>();
  expect(defineFixture(model, { rules: [fields.field(order => order.items).use([1, 2])] }).one().items).toEqual([1, 2]);
  expect(() => fields.field(order => order.items[0])).toThrowError(/Unknown selectable field items.0/);
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
