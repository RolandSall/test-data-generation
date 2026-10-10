import { expect, test } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { defineFixture, shape, resolveSettings, parseSettings, character, bytes, optional, integer, interval, atomicBigint, temporal, sample, fromJsonSchema } from '../src/index.js';
import { readSettingsFile } from '../src/adapters/node.js';
test('explicit setting layers preserve defaults and honor caller precedence', () => {
  const options = resolveSettings({ defaults: { seed: 1, maxDepth: 5, defaults: { string: { minLength: 4, maxLength: 4 } } }, environment: { TEST_DATA_SEED: 'environment', TEST_DATA_MAX_NODES: '100', TEST_DATA_STRICT: 'false' }, overrides: { seed: 42, defaults: { array: { minSize: 1, maxSize: 1 } } } });
  expect(options.seed).toBe(42); expect(options.maxDepth).toBe(5); expect(options.maxNodes).toBe(100); expect(options.strict).toBe(false);
  const data = defineFixture(shape.object({ name: shape.string(), items: shape.array(shape.string()), special: shape.string({ minLength: 8, maxLength: 8 }) })).one(options);
  expect(data.name).toHaveLength(4); expect(data.items).toHaveLength(1); expect(data.special).toHaveLength(8);
  expect(() => resolveSettings({ environment: { TEST_DATA_STRICT: 'maybe' } })).toThrow('true or false');
  expect(() => resolveSettings({ environment: { TEST_DATA_MAX_DEPTH: ' ' } })).toThrow('Invalid');
});
test('global defaults preserve recursive descriptor identity', () => {
  interface Node { name: string; next?: Node }
  const node: import('../src/index.js').Shape<Node> = shape.object({ name: shape.string(), next: shape.optional(shape.lazy(() => node)) });
  const data = defineFixture(node).one({ seed: 42, defaults: { string: { minLength: 2, maxLength: 2 } }, cycle: 'reference' });
  expect(data.name).toHaveLength(2); expect(data.next).toBe(data);
});
test('selected cases can override execution settings and calls take precedence', () => {
  const fixture = defineFixture(shape.string(), { options: { defaults: { string: { minLength: 3, maxLength: 3 } } }, cases: { short: { options: { defaults: { string: { minLength: 1, maxLength: 1 } } } } } });
  expect(fixture.one({ seed: 42 })).toHaveLength(3); expect(fixture.one({ seed: 42, case: 'short' })).toHaveLength(1);
  expect(fixture.one({ seed: 42, case: 'short', defaults: { string: { minLength: 2, maxLength: 2 } } })).toHaveLength(2);
});
test('JSON settings normalize regular expressions and bigint bounds', () => {
  const options = parseSettings('{"seed":42,"now":"2026-01-01Z","maxDepth":0,"maxAttempts":2,"maxNodes":100,"nullProbability":0.1,"optionalProbability":0.2,"strict":true,"check":"schema","cycle":"error","defaults":{"string":{"pattern":"^AB[0-9]{2}$"},"bigint":{"bigMin":"99999999999999999","bigMax":"99999999999999999"}}}');
  expect(defineFixture(shape.string()).one(options)).toMatch(/^AB\d{2}$/);
  expect(defineFixture(shape.bigint()).one(options)).toBe(99999999999999999n);
});
test.each(['[]', '{"unknown":1}', '{"maxAttempts":0}', '{"seed":false}', '{"now":"bad"}', '{"strict":"true"}', '{"cycle":"bad"}', '{"defaults":[]}', '{"defaults":{"missing":{}}}', '{"defaults":{"string":{"unknown":1}}}'])('invalid JSON settings fail clearly: %s', source => {
  expect(() => parseSettings(source)).toThrow('CONFIGURATION');
});
test('Node reads settings files without changing global environment', async () => {
  const path = await mkdtemp(join(tmpdir(), 'test-data-settings-'));
  try {
    const file = join(path, 'test-data.json'); await writeFile(file, '{"seed":42,"maxDepth":5}');
    const options = await readSettingsFile(file, { environment: { TEST_DATA_MAX_DEPTH: '2' }, overrides: { maxDepth: 3 } }); expect(options).toMatchObject({ seed: 42, maxDepth: 3 });
  } finally { await rm(path, { recursive: true, force: true }); }
});
test('remaining scalar generator families provide native JavaScript equivalents', () => {
  expect(sample(character('x'))).toEqual(['x']); expect(sample(bytes({ length: 0 }))[0]).toEqual(new Uint8Array());
  expect(sample(optional(integer(), 1))).toEqual([undefined]);
  const start = new Date('2026-01-01Z'), range = sample(interval(start, { min: 50, max: 50 }))[0]!;
  expect(range.start).toEqual(start); expect(range.start).not.toBe(start); expect(range.end.getTime() - start.getTime()).toBe(50);
  expect(() => sample(interval(start, { min: -1 }))).toThrow('interval');
  const atomic = sample(atomicBigint())[0]!, before = Atomics.load(atomic, 0); expect(Atomics.add(atomic, 0, 1n)).toBe(before);
  expect(sample(temporal('zonedDateTime'))[0]).toMatch(/Z\[UTC\]$/);
});
test('JSON Schema oneOf rejects overlapping alternatives and allOf checks every member', () => {
  expect(() => defineFixture(fromJsonSchema({ oneOf: [{ type: 'string' }, { type: 'string' }] })).one({ seed: 42, maxAttempts: 2 })).toThrow('RETRY_EXHAUSTED');
  const schema = fromJsonSchema<{ value: number }>({ allOf: [{ type: 'object', required: ['value'], properties: { value: { type: 'integer', minimum: 1, maximum: 5 } } }, { type: 'object', required: ['value'], properties: { value: { type: 'integer', minimum: 3, maximum: 7 } } }] });
  defineFixture(schema).many(10, { seed: 42 }).forEach(data => { expect(data.value).toBeGreaterThanOrEqual(3); expect(data.value).toBeLessThanOrEqual(5); });
  expect(() => fromJsonSchema({ type: 'string', not: {} } as never)).toThrow('preprocessing');
});
