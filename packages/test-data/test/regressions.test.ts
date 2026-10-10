import { describe, expect, test } from 'vitest';
import protobuf from 'protobufjs';
import { defineFixture, fixtureRun, shape, generator, shared, value, template, rows, sample, date } from '../src/index.js';
import { fromProtobuf } from '../src/adapters/protobuf.js';
const options = { seed: 42, now: '2026-01-01Z' };

describe('collection completion and rejected attempts', () => {
  test('map keys and values, set values, and record values can be replaced', () => {
    const model = shape.object({
      map: shape.map(shape.enum(['A', 'B']), shape.integer(), { minSize: 2, maxSize: 2 }),
      set: shape.set(shape.integer({ min: 1, max: 20 }), { minSize: 2, maxSize: 2 }),
      record: shape.record(shape.string(), { minSize: 2, maxSize: 2 }, shape.enum(['left', 'right'])),
    });
    const data = defineFixture(model, { complete: [
      { match: { path: 'map.*.key' }, transform: v => String(v).toLowerCase() },
      { match: { path: 'map.*.value' }, transform: () => 999 },
      { match: { path: 'set.*' }, transform: v => Number(v) + 100 },
      { match: { path: 'record.*' }, transform: () => 'replaced' },
    ] }).one(options);
    expect([...data.map.keys()].sort()).toEqual(['a', 'b']); expect([...data.map.values()]).toEqual([999, 999]);
    expect([...data.set].every(v => v >= 101)).toBe(true); expect(data.record).toEqual({ left: 'replaced', right: 'replaced' });
  });
  test('completion transformations compose in order', () => {
    const data = defineFixture(shape.object({ name: shape.string() }), { fields: { name: 'Ada' }, complete: [
      { match: { path: 'name' }, includeSupplied: true, transform: v => `${String(v)}!` },
      { match: { path: 'name' }, includeSupplied: true, transform: v => `${String(v)}?` },
    ] }).one(options);
    expect(data.name).toBe('Ada!?');
  });
  test('duplicate collection attempts do not invoke completion callbacks', () => {
    for (let seed = 0; seed < 30; seed++) {
      const completed: unknown[] = [];
      const data = defineFixture(shape.set(shape.enum(['A', 'B']), { minSize: 2, maxSize: 2 }), { complete: [
        { match: { path: '*' }, transform: v => { completed.push(v); } },
      ] }).one({ seed });
      expect(completed.length).toBe(2); expect(new Set(completed)).toEqual(data);
    }
  });
  test('a failed root does not reserve its uniqueness keys', () => {
    let fail = true;
    const fixture = defineFixture(shape.object({ id: shape.literal(1) }), { unique: ['id'], complete: [
      { match: { path: '$' }, transform: () => { if (fail) { fail = false; throw new Error('first failure'); } } },
    ] });
    const run = fixtureRun(options);
    expect(() => run.make(fixture)).toThrow('first failure'); expect(run.make(fixture).id).toBe(1);
  });
  test('aliasing is distinct from a real cycle during structural uniqueness', () => {
    const fixture = defineFixture(shape.custom<{ a: object; b: object; id: number }>(), { rules: [
      { match: { path: '$' }, unique: true, use: generator(c => { const alias = { name: 'same' }; return { a: alias, b: alias, id: c.index }; }) },
    ] });
    const data = fixture.many(3, options); expect(data.map(v => v.id)).toEqual([0, 1, 2]); expect(data[0]!.a).toBe(data[0]!.b);
  });
});

describe('explicit ownership, feed dependencies, and run settings', () => {
  test('opaque instances retain private state through explicit ownership', () => {
    class Secret { #code = 12; read() { return this.#code; } }
    const instance = new Secret(), model = shape.object({ secret: shape.custom<Secret>() });
    expect(defineFixture(model, { fields: { secret: shared(instance) } }).one(options).secret.read()).toBe(12);
    expect(() => defineFixture(model, { fields: { secret: value(instance) } }).one(options)).toThrow('Opaque instances');
  });
  test('templates account for their consumed raw columns in strict feeds', () => {
    const fixture = defineFixture(shape.object({ displayName: shape.string() }), {
      source: rows([{ first: 'Ada', last: 'Lovelace' }]), columns: { displayName: template('${first} ${last}') },
    });
    expect(fixture.one(options).displayName).toBe('Ada Lovelace');
  });
  test('nullable rules honor overrides and final schema checks', () => {
    const fixture = defineFixture(shape.object({ name: shape.string() }), { rules: [{ match: { path: 'name' }, nullable: 1 }] });
    expect(fixture.one(options).name).toBeNull(); expect(fixture.one({ ...options, fields: { name: 'Ada' } }).name).toBe('Ada');
    expect(() => fixture.one({ ...options, check: 'schema' })).toThrow('VALIDATION');
    expect(() => defineFixture(shape.string(), { rules: [{ match: { path: '$' }, nullable: 2 }] }).one(options)).toThrow('probability');
  });
  test('session execution settings cannot be silently overridden', () => {
    const run = fixtureRun(options);
    expect(() => run.make(defineFixture(shape.string()), { seed: 9 } as never)).toThrow('belongs on fixtureRun');
  });
  test('relative dates honor explicit bounds and clocks outside the default range', () => {
    const now = '1800-01-01Z'; expect(sample(date({ past: true }), { now })[0]!.getTime()).toBeLessThan(new Date(now).getTime());
    expect(sample(date({ future: true }), { now: '2300-01-01Z' })[0]!.getTime()).toBeGreaterThan(new Date('2300-01-01Z').getTime());
    expect(() => sample(date({ past: true, min: new Date('2030-01-01Z') }), options)).toThrow();
    expect(() => sample(date(), { count: -1 })).toThrow('Count'); expect(() => sample(date(), { now: 'invalid' })).toThrow('clock');
  });
});

test('protobuf uses the full signed and unsigned 64-bit ranges without precision loss', () => {
  const type = protobuf.parse('syntax="proto3"; message Data { int64 signed = 1; uint64 unsigned = 2; map<bool,string> flags = 3; }').root.lookupType('Data');
  const data = defineFixture(fromProtobuf(type)).many(40, options);
  const signed: bigint[] = [];
  for (const message of data) {
    expect(type.verify(message)).toBeNull();
    const object = type.toObject(message, { longs: String });
    signed.push(BigInt(object.signed)); expect(BigInt(object.unsigned)).toBeGreaterThanOrEqual(0n);
    expect(type.toObject(type.decode(type.encode(message).finish()), { longs: String })).toEqual(object);
    expect(Object.keys(object.flags as object).sort()).toEqual(['false', 'true']);
  }
  expect(signed.some(n => n < -BigInt(Number.MAX_SAFE_INTEGER))).toBe(true); expect(signed.some(n => n > BigInt(Number.MAX_SAFE_INTEGER))).toBe(true);
});
