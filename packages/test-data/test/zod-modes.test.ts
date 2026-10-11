import { expect, expectTypeOf, test } from 'vitest';
import { z } from 'zod';
import { defineFixture, generator, select, GenerationError } from '../src/index.js';
import { fromZod } from '../src/adapters/zod.js';
const options = { seed: 42, now: '2026-01-01Z', maxAttempts: 10 };

test('nested transformations generate parsed output and valid raw input with accurate types', () => {
  const schema = z.object({ nested: z.object({ n: z.literal('42').transform(Number) }), values: z.array(z.literal('42').transform(Number)).length(2) });
  const output = defineFixture(fromZod(schema)).one({ ...options, check: 'schema' });
  const input = defineFixture(fromZod(schema, { mode: 'input' })).one({ ...options, check: 'schema' });
  expect(output).toEqual({ nested: { n: 42 }, values: [42, 42] });
  expect(input).toEqual({ nested: { n: '42' }, values: ['42', '42'] });
  expect(schema.parse(input)).toEqual(output);
  expectTypeOf(output).toEqualTypeOf<z.output<typeof schema>>();
  expectTypeOf(input).toEqualTypeOf<z.input<typeof schema>>();
});
test('root transformations consume raw nested input, and output refinements stay enforced', () => {
  const schema = z.object({ n: z.literal('42').transform(Number) }).transform(x => ({ doubled: x.n * 2 }));
  expect(defineFixture(fromZod(schema)).one({ ...options, check: 'schema' })).toEqual({ doubled: 84 });
  const refined = z.object({ n: z.literal('42').transform(Number) }).refine(x => x.n === 42);
  expect(defineFixture(fromZod(refined)).one({ ...options, check: 'schema' })).toEqual({ n: 42 });
});
test('overrides and generators at transformed fields supply output values without re-parsing', () => {
  const schema = z.object({ n: z.literal('42').transform(Number) });
  const model = fromZod(schema);
  expect(defineFixture(model, { fields: { n: 9 } }).one({ ...options, check: 'schema' })).toEqual({ n: 9 });
  expect(defineFixture(model, { rules: [select(model).field(x => x.n).use(generator(() => 8))] }).one(options)).toEqual({ n: 8 });
});
test('pipelines honor input/output constraints and retry intersecting domains', () => {
  const schema = z.object({ n: z.number().int().min(1).max(10).pipe(z.number().min(5)) });
  for (const mode of ['input', 'output'] as const) {
    defineFixture(fromZod(schema, { mode })).many(20, { ...options, maxAttempts: 100, check: 'schema' }).forEach(value => expect(value.n).toBeGreaterThanOrEqual(5));
  }
});
test('impossible pipeline and cross-property refinements retain nested issue paths and guidance', () => {
  const pipeline = z.object({ outer: z.object({ n: z.number().max(10).pipe(z.number().min(20)) }) });
  try { defineFixture(fromZod(pipeline)).one(options); throw new Error('expected failure'); }
  catch (error) { expect(error).toBeInstanceOf(GenerationError); expect((error as GenerationError).path).toBe('$.outer.n'); expect(String(error)).toContain('provider'); }
  const schema = z.object({ nested: z.object({ n: z.number() }).refine(() => false, { path: ['n'], message: 'custom business requirement' }) });
  expect(() => defineFixture(fromZod(schema)).one(options)).toThrow('$.nested.n');
  expect(() => defineFixture(fromZod(schema)).one(options)).toThrow('custom business requirement');
});
test('known formats generate independently valid data; unsupported formats explain the override', () => {
  const schema = z.object({ email: z.email(), id: z.uuid(), url: z.url(), ipv4: z.ipv4(), ipv6: z.ipv6(), date: z.iso.date(), time: z.iso.time(), datetime: z.iso.datetime() });
  defineFixture(fromZod(schema)).many(10, { ...options, check: 'schema' }).forEach(value => expect(schema.safeParse(value).success).toBe(true));
  const unsupported = z.object({ token: z.jwt() });
  expect(() => defineFixture(fromZod(unsupported)).one(options)).toThrow('$.token');
  expect(() => defineFixture(fromZod(unsupported)).one(options)).toThrow('provider');
  expect(defineFixture(fromZod(z.object({ code: z.string().refine(x => x === 'custom') })), { fields: { code: generator(() => 'custom' as const) } }).one({ ...options, check: 'schema' })).toEqual({ code: 'custom' });
});
test('output defaults and input absence respect schema input/output boundaries', () => {
  const schema = z.object({ n: z.string().transform(Number).default(7) });
  const output = defineFixture(fromZod(schema)).one({ ...options, schemaDefaults: 'preserve', check: 'schema' });
  const input = defineFixture(fromZod(schema, { mode: 'input' })).one({ ...options, schemaDefaults: 'preserve', check: 'schema' });
  expect(output).toEqual({ n: 7 }); expect(input).toEqual({}); expect(schema.parse(input)).toEqual(output);
});
test('readonly, optional and union transformations retain output behavior', () => {
  const schema = z.object({ frozen: z.object({ n: z.literal('42').transform(Number) }).readonly(), variant: z.union([z.literal('42').transform(Number), z.literal(42)]) });
  const value = defineFixture(fromZod(schema)).one({ ...options, check: 'schema' });
  expect(value.variant).toBe(42); expect(value.frozen.n).toBe(42); expect(Object.isFrozen(value.frozen)).toBe(true);
});
test('asynchronous effects and unrepresentable preprocess input require explicit preparation', () => {
  expect(() => defineFixture(fromZod(z.string().transform(async x => x))).one(options)).toThrow('Promise');
  expect(() => defineFixture(fromZod(z.preprocess(x => x, z.string()))).one(options)).toThrow('provider');
});

test('plain defaulted primitives retain kind rules/providers and nested output objects', () => {
  const model = fromZod(z.object({ enabled: z.boolean().default(false) }));
  expect(defineFixture(model, { rules: [select(model).all('boolean').use(true)] }).one({ ...options, schemaDefaults: 'preserve' })).toEqual({ enabled: true });
  expect(defineFixture(model, { providers: [{ match: node => node.kind === 'boolean', generate: generator(() => true) }] }).one({ ...options, schemaDefaults: 'preserve' })).toEqual({ enabled: true });
  const schema = z.object({ n: z.literal('42').transform(Number) }).default({ n: 7 });
  expect(defineFixture(fromZod(schema)).one({ ...options, check: 'schema' })).toEqual({ n: 42 });
  expect(defineFixture(fromZod(schema)).one({ ...options, schemaDefaults: 'preserve', check: 'schema' })).toEqual({ n: 7 });
});
