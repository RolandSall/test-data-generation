import { describe, expect, test } from 'vitest';
import {
  shape, defineFixture, fixtureRun, listOf, integer, sequence, generator, sample,
  shared, fresh, populate, value, omit, blank, constrain, refine, annotate,
  validateShape, Decimal, decimalShape, GenerationError, oneOf,
} from '../src/index.js';
const address = shape.object({ city: shape.string(), country: shape.string() });
const person = shape.object({ id: shape.integer(), name: shape.string(), preferred: shape.string(), age: shape.integer(), home: address, work: address, phones: shape.array(shape.string()) });
const options = { seed: 42, now: '2026-01-01T00:00:00Z' };

describe('graph construction and shapes', () => {
  test('fully populates nested objects and collections', () => {
    const p = defineFixture(person).one(options);
    expect(p.home.city).toBeTypeOf('string'); expect(p.phones.length).toBeGreaterThanOrEqual(2);
    expect(validateShape(person, p)).toEqual([]);
  });
  test('map, set, record, tuple, bigint, bytes, literal and decimal', () => {
    const node = shape.object({ map: shape.map(shape.string(), address), set: shape.set(shape.integer()), record: shape.record(shape.boolean()), tuple: shape.tuple([shape.literal('x'), shape.bigint(), shape.bytes()]), decimal: decimalShape({ precision: 20, scale: 8 }) });
    const p = defineFixture(node).one(options);
    expect(p.map).toBeInstanceOf(Map); expect(p.set).toBeInstanceOf(Set); expect(p.tuple[0]).toBe('x');
    expect(p.tuple[1]).toBeTypeOf('bigint'); expect(p.tuple[2]).toBeInstanceOf(Uint8Array); expect(p.decimal.scale).toBe(8);
    expect(validateShape(node, p)).toEqual([]);
  });
  test('union variants and fixed subtype', () => {
    const node = shape.union([shape.object({ kind: shape.literal('cat') }), shape.object({ kind: shape.literal('dog') })]);
    expect(new Set(defineFixture(node).many(50, options).map(p => p.kind))).toEqual(new Set(['cat', 'dog']));
  });
  test('recursion terminates and can wire real back references', () => {
    interface Node { name: string; child?: Node }
    const node: import('../src/index.js').Shape<Node> = shape.object({ name: shape.string(), child: shape.optional(shape.lazy(() => node)) });
    expect(defineFixture(node).one(options).child).toBeUndefined();
    const linked = defineFixture(node).one({ ...options, cycle: 'reference' }); expect(linked.child).toBe(linked);
    expect(() => defineFixture(node).one({ ...options, cycle: 'error' })).toThrow(GenerationError);
  });
  test('explicit graph references preserve identity', () => {
    const node = shape.object({ address, same: shape.reference<unknown>('address') });
    const p = defineFixture(node).one(options); expect(p.same).toBe(p.address);
    expect(() => defineFixture(shape.reference('missing')).one(options)).toThrow('Unresolved reference');
  });
  test('depth and node budgets fail or terminate deliberately', () => {
    const p = defineFixture(person).one({ ...options, maxDepth: 1 }); expect(p.home).toEqual({});
    expect(() => defineFixture(person).one({ ...options, maxNodes: 2 })).toThrow('Node budget');
  });
  test('class factory receives values and invokes registered setters', () => {
    class Account { label = 'preset'; constructor(readonly id: number) {} }
    const node = shape.class<Account>({ id: shape.integer(), label: shape.string() }, values => new Account(values.id as number), { label: (o, v) => { (o as Account).label = `setter:${String(v)}`; } });
    const p = defineFixture(node, { fields: { label: 'Ada' } }).one(options);
    expect(p).toBeInstanceOf(Account); expect(p.label).toBe('setter:Ada');
    expect(() => defineFixture(shape.class({}, () => { throw new Error('invariant'); })).one(options)).toThrow('Class factory failed');
  });
  test('schema transformation supports immutable construction', () => {
    const node = shape.transform(address, a => Object.freeze(a)); const p = defineFixture(node).one(options); expect(Object.isFrozen(p)).toBe(true);
  });
});

describe('recipe fields, cases and scoped rules', () => {
  test('nested field trees distinguish two objects of the same type', () => {
    const p = defineFixture(person, { fields: { home: { city: 'Beirut' }, work: { city: 'Paris' } } }).one(options);
    expect(p.home.city).toBe('Beirut'); expect(p.work.city).toBe('Paris'); expect(p.home.country).toBeTruthy();
  });
  test('specific fields beat broad rules, and last equally specific rule wins', () => {
    const p = defineFixture(person, { fields: { name: 'Ada' }, rules: [
      { match: { kind: 'string' }, use: 'general' }, { match: { path: 'home.city' }, use: 'first' }, { match: { path: 'home.city' }, use: 'last' },
    ] }).one(options);
    expect(p.name).toBe('Ada'); expect(p.home.city).toBe('last'); expect(p.work.city).toBe('general');
  });
  test('scope, predicate, metadata, depth and element index matching', () => {
    const node = shape.object({ home: address, work: address, items: shape.array(annotate(shape.string(), { sensitive: true }), { minSize: 3, maxSize: 3 }) });
    const p = defineFixture(node, { rules: [
      { match: { kind: 'string', under: 'home', depth: 2 }, use: 'home' },
      { match: { metadata: { sensitive: true }, index: i => i > 0 }, use: 'masked' },
      { match: { predicate: (s, path) => s.kind === 'string' && path === '$.work.city' }, use: 'work' },
    ] }).one(options);
    expect(p.home).toEqual({ city: 'home', country: 'home' }); expect(p.work.city).toBe('work'); expect(p.items.slice(1)).toEqual(['masked', 'masked']);
  });
  test('strict unused rules and individual leniency', () => {
    expect(() => defineFixture(address, { rules: [{ match: { path: 'typo' }, use: 'x' }] }).one(options)).toThrow('matched no eligible');
    expect(defineFixture(address, { rules: [{ match: { path: 'typo' }, use: 'x', optional: true }] }).one(options).city).toBeTruthy();
    expect(() => defineFixture(address).one({ ...options, fields: { typo: 'x' } as never })).toThrow('Unknown field');
  });
  test('immutable extension and named cases merge nested fields', () => {
    const base = defineFixture(person, { fields: { home: { country: 'Lebanon' } }, cases: { minor: { fields: { age: integer({ min: 0, max: 17 }) } } } });
    const extended = base.extend({ fields: { home: { city: 'Beirut' } } });
    expect(extended.one(options).home).toEqual({ city: 'Beirut', country: 'Lebanon' }); expect(base.one(options).home.city).not.toBe('Beirut');
    expect(base.one({ ...options, case: 'minor' }).age).toBeLessThan(18); expect(() => base.one({ case: 'typo' })).toThrow('Unknown case');
  });
  test('nested recipes and list recipes reuse rules in insertion scope', () => {
    const homes = defineFixture(address, { fields: { city: 'Beirut' } });
    const p = defineFixture(person, { fields: { home: homes } }).one(options);
    expect(p.home.city).toBe('Beirut'); expect(p.work.city).not.toBe('Beirut');
    expect(listOf(address, { count: 3, fields: { country: 'Lebanon' } }).one(options)).toHaveLength(3);
    expect(listOf(address, { count: 3, fields: { country: 'Lebanon' } }).one(options).every(a => a.country === 'Lebanon')).toBe(true);
  });
  test('ignore and blank subtree behavior', () => {
    const p = defineFixture(person, { fields: { name: omit(), home: blank() } }).one(options);
    expect(p.name).toBeUndefined(); expect(p.home).toEqual({});
    expect(defineFixture(person).blank(options)).toEqual({ home: {}, work: {}, phones: [] });
  });
  test('Cartesian product enumerates every bounded combination', () => {
    const node = shape.object({ kind: shape.string(), count: shape.integer() });
    expect(defineFixture(node).cartesian({ kind: ['A', 'B'], count: [1, 2, 3] }, options)).toEqual([
      { kind: 'A', count: 1 }, { kind: 'A', count: 2 }, { kind: 'A', count: 3 }, { kind: 'B', count: 1 }, { kind: 'B', count: 2 }, { kind: 'B', count: 3 },
    ]);
    expect(() => defineFixture(node).cartesian({ count: [1, 2] }, { limit: 1 })).toThrow('Cartesian product');
  });
});

describe('ownership, lifecycle and existing data', () => {
  test('shared values preserve identity; literal values clone per root', () => {
    const node = shape.object({ address }); const existing = { city: 'Beirut', country: 'Lebanon' };
    const same = defineFixture(node, { fields: { address: shared(existing) } }).many(2, options); expect(same[0]!.address).toBe(same[1]!.address);
    const copies = defineFixture(node, { fields: { address: value(existing) } }).many(2, options); expect(copies[0]!.address).not.toBe(copies[1]!.address);
    copies[0]!.address.city = 'changed'; expect(existing.city).toBe('Beirut');
  });
  test('fresh bypasses population; populate fills missing fields and callbacks', () => {
    const node = shape.object({ address }); let callbacks = 0;
    const completion = { match: { path: 'address' }, transform: (v: unknown) => { callbacks++; return v; }, optional: true };
    const opaque = defineFixture(node, { fields: { address: fresh(() => ({ city: 'Beirut' } as never)) }, complete: [completion] }).one(options);
    expect(opaque.address.country).toBeUndefined(); expect(callbacks).toBe(0);
    const filled = defineFixture(node, { fields: { address: populate(() => ({ city: 'Beirut' } as never)) }, complete: [completion] }).one(options);
    expect(filled.address.city).toBe('Beirut'); expect(filled.address.country).toBeTruthy(); expect(callbacks).toBe(1);
  });
  test('completion replacement runs after population and graph wiring', () => {
    const p = defineFixture(address, { complete: [{ match: { path: '$' }, transform: v => ({ ...v as object, city: 'done' }) }] }).one(options); expect(p.city).toBe('done');
  });
  test('callbacks can explicitly include supplied objects', () => {
    let calls = 0; defineFixture(shape.object({ address }), { fields: { address: shared({ city: 'A', country: 'B' }) }, complete: [{ match: { path: 'address' }, includeSupplied: true, transform: v => { calls++; return v; } }] }).one(options);
    expect(calls).toBe(1);
  });
  test('fill preserves initialized data and existing collection sizes', () => {
    const p = { name: 'Ada', home: { city: 'Beirut' }, phones: ['provided'] };
    const filled = defineFixture(person).fill(p, options); expect(filled).toBe(p); expect(filled.name).toBe('Ada'); expect(filled.home.country).toBeTruthy(); expect(filled.phones).toEqual(['provided']);
  });
  test('fill missing versus nullish and explicit rules', () => {
    const node = shape.object({ a: shape.nullable(shape.string()), b: shape.integer() });
    const missing = defineFixture(node).fill({ a: null, b: 0 }, options); expect(missing).toEqual({ a: null, b: 0 });
    const nullish = defineFixture(node).fill({ a: null, b: 0 }, { ...options, mode: 'nullish', nullProbability: 0 }); expect(nullish.a).toBeTypeOf('string'); expect(nullish.b).toBe(0);
    expect(defineFixture(node, { fields: { b: 8 } }).fill({ a: null, b: 0 }, { ...options, mode: 'rules' })).toEqual({ a: null, b: 8 });
  });
  test('frozen input and factory errors are explicit', () => {
    expect(() => defineFixture(address).fill(Object.freeze({ city: 'A' }), options)).toThrow('frozen');
  });
});

describe('dependencies, constraints, uniqueness and replay', () => {
  test('computed dependencies are ordered regardless of declaration order', () => {
    const p = defineFixture(person, { fields: { name: 'Ada' }, computed: ({ derive }) => ({ preferred: derive(['name'], name => name.toUpperCase()) }) }).one(options);
    expect(p.preferred).toBe('ADA');
    const node = shape.object({ a: shape.integer(), b: shape.integer(), c: shape.integer() });
    const p2 = defineFixture(node, { fields: { a: 1 }, computed: ({ derive }) => ({ c: derive(['b'], b => b + 1), b: derive(['a'], a => a + 1) }) }).one(options); expect(p2).toEqual({ a: 1, b: 2, c: 3 });
  });
  test('conditional dependencies stay local to every collection element', () => {
    const order = shape.object({ status: shape.enum(['cancelled', 'shipped']), refunded: shape.boolean() });
    const orders = listOf(order, { count: 30, computed: ({ derive }) => ({ refunded: derive(['status'], status => status === 'cancelled') }) }).one(options);
    orders.forEach(order => expect(order.refunded).toBe(order.status === 'cancelled'));
  });
  test('conflicting and cyclic computation errors carry paths and seeds', () => {
    const node = shape.object({ a: shape.integer(), b: shape.integer() });
    expect(() => defineFixture(node, { computed: ({ derive }) => ({ a: derive(['b'], b => b), b: derive(['a'], a => a) }) }).one(options)).toThrow('dependency cycle');
    expect(() => defineFixture(node, { fields: { a: 2 }, computed: ({ derive }) => ({ a: derive(['b'], b => b) }) }).one(options)).toThrow('both computed and overridden');
  });
  test('recognized constraints and custom refinements are generated', () => {
    const node = shape.object({ age: shape.integer({ min: 18, max: 65 }), code: shape.string({ pattern: /^AB\d{4}$/ }), even: refine(shape.integer({ min: 0, max: 20 }), n => n % 2 === 0, 'Must be even') });
    defineFixture(node).many(50, { ...options, check: 'schema' }).forEach(p => { expect(p.code).toMatch(/^AB\d{4}$/); expect(p.even % 2).toBe(0); });
  });
  test('explicit invalid values are allowed and final validation is opt-in', () => {
    const fixture = defineFixture(shape.string({ maxLength: 2 })); expect(fixture.one({ ...options, check: 'none' })).toHaveLength(2);
    const node = shape.object({ code: shape.string({ maxLength: 2 }) }); const recipe = defineFixture(node, { fields: { code: 'too-long' } });
    expect(recipe.one(options).code).toBe('too-long'); expect(() => recipe.one({ ...options, check: 'schema' })).toThrow('VALIDATION');
  });
  test('field and composite uniqueness span an entire batch', () => {
    const node = shape.object({ id: shape.integer({ min: 1, max: 100 }), flag: shape.boolean() });
    const values = defineFixture(node, { unique: ['id'] }).many(50, options); expect(new Set(values.map(v => v.id)).size).toBe(50);
    const composite = defineFixture(node, { unique: [{ paths: ['id', 'flag'] }] }).many(50, options); expect(new Set(composite.map(v => `${v.id}:${v.flag}`)).size).toBe(50);
  });
  test('global uniqueness rules can share a domain across fields', () => {
    const node = shape.object({ first: shape.integer(), second: shape.integer() });
    const values = defineFixture(node, { rules: [{ match: { kind: 'integer' }, use: undefined, unique: 'numbers' }] }).many(20, options);
    expect(new Set(values.flatMap(v => [v.first, v.second])).size).toBe(40);
  });
  test('impossible set sizes and retry exhaustion fail explicitly', () => {
    expect(() => defineFixture(shape.set(shape.boolean(), { minSize: 10, maxSize: 10 })).one(options)).toThrow('domain of 2');
    expect(() => defineFixture(shape.boolean(), { filter: () => false }).one({ ...options, maxAttempts: 3 })).toThrow('3 attempts');
  });
  test('custom providers use metadata and can validate domain values', () => {
    const node = annotate(shape.custom<string>(v => typeof v === 'string' && v.startsWith('ACC-') ? [] : ['Invalid account']), { brand: 'account' });
    expect(defineFixture(node, { providers: [{ match: s => s.metadata?.brand === 'account', generate: generator(c => `ACC-${c.random.int(1, 99)}`) }] }).one({ ...options, check: 'schema' })).toMatch(/^ACC-/);
  });
  test('whole graph replay and result seed extraction', () => {
    const fixture = defineFixture(person); const result = fixture.result(options); expect(fixture.one(result)).toEqual(result.value); expect(fixture.one({ ...options, seed: 900 })).not.toEqual(result.value);
  });
  test('standalone roots reset state; batches and sessions advance', () => {
    const fixture = defineFixture(shape.object({ id: shape.integer() }), { fields: { id: sequence() } });
    expect(fixture.one(options).id).toBe(1); expect(fixture.one(options).id).toBe(1); expect(fixture.many(3, options).map(p => p.id)).toEqual([1, 2, 3]);
    const run = fixtureRun(options); expect(run.make(fixture).id).toBe(1); expect(run.make(fixture).id).toBe(2);
    const stream = fixture.stream(options); expect([stream.next().value!.id, stream.next().value!.id]).toEqual([1, 2]);
  });
  test('nullable generation, exact bounds, trace and decimal arithmetic', () => {
    const node = shape.nullable(shape.string()); const values = defineFixture(node).many(50, options); expect(values).toContain(null); expect(values.some(v => typeof v === 'string')).toBe(true);
    const events: unknown[] = []; defineFixture(address).one({ ...options, trace: e => events.push(e) }); expect(events).toHaveLength(3);
    expect(Decimal.parse('999999999999999999.12').toString()).toBe('999999999999999999.12'); expect(Decimal.parse('1.20').compare(Decimal.parse('1.2'))).toBe(0);
    expect(sample(oneOf(['a', 'b']), { count: 3, seed: 3 })).toHaveLength(3);
    expect(defineFixture(constrain(shape.array(shape.string()), { minSize: 0, maxSize: 0 })).one(options)).toEqual([]);
  });
});
