import { expect, test } from 'vitest';
import { z } from 'zod';
import { defineFixture, fromJsonSchema, shape, parseSettings, generator } from '../src/index.js';
import { fromZod } from '../src/adapters/zod.js';
const options = { seed: 42, now: '2026-01-01Z' };

test('generation remains the default; preserving schema defaults is opt-in and nested', () => {
  const fixture = defineFixture(fromZod(z.object({ status: z.string().default('pending'), nested: z.object({ count: z.number().default(0) }) })));
  expect(fixture.one(options).status).not.toBe('pending');
  expect(fixture.one({ ...options, schemaDefaults: 'preserve', check: 'schema' })).toEqual({ status: 'pending', nested: { count: 0 } });
  expect(fixture.one({ ...options, schemaDefaults: 'preserve', fields: { status: '' } }).status).toBe('');
});
test('declared null, falsy and empty defaults are preserved and mutable defaults copied', () => {
  const fixture = defineFixture(fromZod(z.object({ flag: z.boolean().default(false), text: z.string().default(''),
    nil: z.string().nullable().default(null), items: z.array(z.number()).default([]),
    map: z.map(z.string(), z.number()).default(new Map()), set: z.set(z.string()).default(new Set()) })));
  const [a, b] = fixture.many(2, { ...options, schemaDefaults: 'preserve', check: 'schema' });
  expect(a).toEqual({ flag: false, text: '', nil: null, items: [], map: new Map(), set: new Set() });
  expect(a!.items).not.toBe(b!.items); expect(a!.map).not.toBe(b!.map); expect(a!.set).not.toBe(b!.set);
});
test('default factories are deferred until preservation and prefaults are parsed', () => {
  let calls = 0;
  const fixture = defineFixture(fromZod(z.number().default(() => ++calls)));
  fixture.one(options); expect(calls).toBe(0);
  expect(fixture.many(2, { ...options, schemaDefaults: 'preserve' })).toEqual([1, 2]);
  const prefault = defineFixture(fromZod(z.string().trim().toUpperCase().prefault(' ada ')));
  expect(prefault.one({ ...options, schemaDefaults: 'preserve' })).toBe('ADA');
});
test.each(['default', 'prefault'] as const)('output validation never executes an omitted %s factory', kind => {
  let calls = 0;
  const count = z.number()[kind](() => ++calls).optional();
  const fixture = defineFixture(fromZod(z.object({ count })));
  expect(calls).toBe(0);
  expect(fixture.one({ ...options, optionalProbability: 1 })).toEqual({});
  expect(fixture.one({ ...options, optionalProbability: 1, check: 'schema' })).toEqual({});
  expect(calls).toBe(0);
});
test.each(['default', 'prefault'] as const)('nested %s factories run only for preserved missing values', kind => {
  let calls = 0;
  const fixture = defineFixture(fromZod(z.object({ nested: z.object({ count: z.number()[kind](() => ++calls) }) })));
  fixture.one({ ...options, check: 'schema' });
  expect(calls).toBe(0);
  expect(fixture.one({ ...options, schemaDefaults: 'preserve', check: 'schema' })).toEqual({ nested: { count: 1 } });
  expect(calls).toBe(1);
  expect(fixture.one({ ...options, schemaDefaults: 'preserve', check: 'schema', fields: { nested: { count: 0 } } })).toEqual({ nested: { count: 0 } });
  expect(calls).toBe(1);
});
test.each(['default', 'prefault'] as const)('required %s output validation rejects missing values without applying a fallback', kind => {
  let calls = 0;
  const model = fromZod(z.number()[kind](() => ++calls));
  expect(model.validate!(undefined)).not.toHaveLength(0);
  expect(model.validate!('invalid')).not.toHaveLength(0);
  expect(model.validate!(0)).toEqual([]);
  expect(calls).toBe(0);
});
test('JSON Schema defaults support nested fields, false and null without replacing supplied values', () => {
  const fixture = defineFixture(fromJsonSchema<{ enabled: boolean; detail: { text: string }; nil: null }>({
    type: 'object', required: ['enabled', 'detail', 'nil'], properties: {
      enabled: { type: 'boolean', default: false }, detail: { type: 'object', required: ['text'], properties: { text: { type: 'string', default: '' } } }, nil: { type: 'null', default: null },
    },
  }));
  expect(fixture.one({ ...options, schemaDefaults: 'preserve', check: 'schema' })).toEqual({ enabled: false, detail: { text: '' }, nil: null });
});
test('optional properties populate by default and omit explicitly, without ignoring supplied values', () => {
  const fixture = defineFixture(fromZod(z.object({ nickname: z.string().optional() })));
  expect(Object.hasOwn(fixture.one(options), 'nickname')).toBe(true);
  expect(Object.hasOwn(fixture.one({ ...options, optionalProbability: 1 }), 'nickname')).toBe(false);
  expect(fixture.one({ ...options, optionalProbability: 1, fields: { nickname: '' } })).toEqual({ nickname: '' });
});
test('supplied values survive both overrides and filling, and explicit generators beat defaults', () => {
  const model = shape.object({ nil: shape.nullable(shape.string()), flag: shape.boolean(), zero: shape.integer(), text: shape.string(), items: shape.array(shape.integer()), map: shape.map(shape.string(), shape.integer()), set: shape.set(shape.string()) });
  const supplied = { nil: null, flag: false, zero: 0, text: '', items: [], map: new Map<string, number>(), set: new Set<string>() };
  expect(defineFixture(model, { fields: supplied }).one({ ...options, schemaDefaults: 'preserve' })).toEqual(supplied);
  expect(defineFixture(model).fill(supplied, { ...options, schemaDefaults: 'preserve' })).toEqual(supplied);
  expect(defineFixture(fromZod(z.object({ n: z.number().default(0) })), { fields: { n: generator(() => 7) } }).one({ ...options, schemaDefaults: 'preserve' })).toEqual({ n: 7 });
});
test('settings accept the policy and reject invalid modes', () => {
  expect(parseSettings('{"schemaDefaults":"preserve"}').schemaDefaults).toBe('preserve');
  expect(() => parseSettings('{"schemaDefaults":"bad"}')).toThrow('Invalid schemaDefaults');
  // @ts-expect-error Invalid policy is also checked at runtime.
  expect(() => defineFixture(shape.string()).one({ schemaDefaults: 'bad' })).toThrow('Invalid schemaDefaults');
});
