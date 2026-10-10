import { expect, expectTypeOf, test } from 'vitest';
import { defineFixture, shape, integer, type Infer, type Fields, type Paths, type AtPath, type DeepPartial } from '../src/index.js';
test('schema inference, field overrides and computed paths are statically checked', () => {
  const schema = shape.object({ name: shape.string(), age: shape.integer(), home: shape.object({ city: shape.string() }), optional: shape.optional(shape.string()) });
  const fixture = defineFixture(schema, { fields: { age: integer({ min: 18, max: 65 }) } });
  expectTypeOf(fixture.one()).toEqualTypeOf<Infer<typeof schema>>();
  // @ts-expect-error Unknown field must not compile.
  defineFixture(schema, { fields: { typo: 'x' } });
  // @ts-expect-error A numeric field cannot receive a string generator.
  defineFixture(schema, { fields: { age: 'wrong' } });
  defineFixture(schema, { computed: ({ derive }) => ({ name: derive(['home.city'], city => { expectTypeOf(city).toEqualTypeOf<string>(); return city; }) }) });
  defineFixture(schema, { computed: ({ derive }) => ({ name:
    // @ts-expect-error Unknown dependency path must not compile.
    derive(['home.typo'], city => String(city)),
  }) });
});

test('field/path utilities stop at nullable and optional leaf values', () => {
  interface Model {
    name: string;
    count: number;
    customer?: { name: string } | null;
    created?: Date;
    items?: { id: string }[] | null;
    labels?: Map<string, number>;
    flags?: Set<boolean>;
  }
  type ExpectedPaths = 'name' | 'count' | 'customer' | 'customer.name' | 'created' | 'items' | 'labels' | 'flags';
  expectTypeOf<Paths<Model>>().toEqualTypeOf<ExpectedPaths>();
  expectTypeOf<Paths<Model, 1>>().toEqualTypeOf<keyof Model>();
  expectTypeOf<AtPath<Model, 'customer.name'>>().toEqualTypeOf<string>();
  expectTypeOf<AtPath<Model, 'created'>>().toEqualTypeOf<Date | undefined>();
  expectTypeOf<AtPath<Model, 'customer.missing'>>().toEqualTypeOf<never>();

  const fields: Fields<Model> = { count: integer(), customer: { name: 'Ada' }, items: [{ id: 'A' }], created: new Date(0) };
  expect(fields.customer).toEqual({ name: 'Ada' });
  // @ts-expect-error A collection accepts a replacement, not a partial field tree.
  const partialArray: Fields<Model> = { items: { length: 2 } };
  expect(partialArray).toBeDefined();
  // @ts-expect-error A nested override must use the declared property names.
  const unknownField: Fields<Model> = { customer: { typo: 'Ada' } };
  expect(unknownField).toBeDefined();
  // @ts-expect-error An optional array's methods are not object-field dependency paths.
  const collectionMethod: Paths<Model> = 'items.length';
  expect(collectionMethod).toBeDefined();

  expectTypeOf<DeepPartial<{ items: readonly number[] }>['items']>().toEqualTypeOf<readonly number[] | undefined>();
  expectTypeOf<DeepPartial<{ created: Date }>['created']>().toEqualTypeOf<Date | undefined>();
});

test('recursive path enumeration has an explicit compiler depth bound', () => {
  interface Node { value: string; child?: Node }
  expectTypeOf<Paths<Node, 0>>().toEqualTypeOf<never>();
  expectTypeOf<Paths<Node, 1>>().toEqualTypeOf<'value' | 'child'>();
  expectTypeOf<Extract<Paths<Node>, 'child.child.child.child.value'>>().toEqualTypeOf<'child.child.child.child.value'>();
  expectTypeOf<Extract<Paths<Node>, 'child.child.child.child.child.value'>>().toEqualTypeOf<never>();
  expectTypeOf<Extract<Paths<Node, 7>, 'child.child.child.child.child.child.value'>>().toEqualTypeOf<'child.child.child.child.child.child.value'>();
});

test('multiple computed dependencies retain callback order, argument types and return checks', () => {
  const model = shape.object({ label: shape.string(), price: shape.number(), details: shape.object({ code: shape.string() }) });
  const fixture = defineFixture(model, {
    fields: { price: 12, details: { code: 'ORD' } },
    computed: ({ derive }) => ({
      label: derive(['details.code', 'price'], (code, price) => {
        expectTypeOf(code).toEqualTypeOf<string>();
        expectTypeOf(price).toEqualTypeOf<number>();
        return `${code}-${price}`;
      }),
    }),
  });
  expect(fixture.one().label).toBe('ORD-12');
  // @ts-expect-error A computed string field cannot return a number.
  defineFixture(model, { computed: ({ derive }) => ({ label: derive(['price'], price => price) }) });
});
