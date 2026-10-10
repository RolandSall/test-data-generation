import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { defineFixture, fixtureRun, generator, sequence, shape } from '../src/index.js';

const now = '2026-01-01T00:00:00Z';

describe('execution boundaries', () => {
  test.each([
    [0, 'dded99afd189fd03f366d09772b9a95d1ba7237b44d23e81ab86c04dfdb26bcb'],
    [1, 'fc6727f69f2749ad5cefdf72819657e887c6fce0628bda338bbda85af0e0e493'],
    [42, '0461aa2cf2cb0a09d70d6f7b9e9b116cccfda6f45c47c8c27ab2ad339ec60bc0'],
    ['replay', 'b30878ca269e348f20758b0b09714485f5e89d776e412eaa10a2bbef07fb6cd1'],
  ] as const)('preserves pre-refactor seeded output for seed %s', (seed, expected) => {
    const child = shape.object({ id: shape.integer({ min: 1, max: 99 }), flag: shape.boolean() });
    const model = shape.object({
      name: shape.string(), values: shape.array(child, { minSize: 2, maxSize: 3 }),
      labels: shape.set(shape.enum(['a', 'b', 'c']), { minSize: 2, maxSize: 2 }),
      mapping: shape.map(shape.string({ minLength: 2, maxLength: 2 }), shape.integer({ min: 0, max: 9 }), { minSize: 2, maxSize: 2 }),
      note: shape.nullable(shape.string()), timestamp: shape.date({ past: true }), total: shape.integer(),
    });
    const fixture = defineFixture(model, {
      computed: ({ derive }) => ({
        total: derive(['values'], values => values.reduce((sum, entry) => sum + entry.id, 0)),
      }),
      rules: [{ match: { kind: 'boolean', under: 'values' }, use: generator(context => context.random.boolean(0.8)) }],
      complete: [{ match: { path: 'name' }, transform: value => String(value).toUpperCase() }],
    });
    const actual = fixture.many(3, { seed, now });
    const serialized = JSON.stringify(actual, (_key, value: unknown) =>
      value instanceof Map || value instanceof Set ? [...value] : value,
    );
    // Captured before refactoring: catches changes to RNG consumption order across modules.
    expect(createHash('sha256').update(serialized).digest('hex')).toBe(expected);
  });

  test('generator state advances across recipes but resets in independent runs', () => {
    const next = sequence();
    const first = defineFixture(shape.object({ id: shape.integer() }), { fields: { id: next } });
    const second = defineFixture(shape.object({ index: shape.integer() }), { fields: { index: next } });
    const run = fixtureRun({ seed: 42, now });
    expect(run.make(first).id).toBe(1);
    expect(run.make(second).index).toBe(2);
    expect(first.one({ seed: 42, now }).id).toBe(1);
  });

  test('rules, callbacks and providers cannot leak into the next graph', () => {
    let callbacks = 0;
    const special = defineFixture(shape.object({ value: shape.custom<number>() }), {
      rules: [{ match: { path: 'value' }, use: 777 }],
      complete: [{ match: { path: '$' }, transform: () => { callbacks++; } }],
      providers: [{ match: node => node.kind === 'custom', generate: generator(() => 999) }],
    });
    const run = fixtureRun({ seed: 42, now });
    expect(run.make(special).value).toBe(777);
    const ordinary = defineFixture(shape.object({ value: shape.integer({ min: 0, max: 1 }) }));
    expect([0, 1]).toContain(run.make(ordinary).value);
    expect(callbacks).toBe(1);
    expect(() => run.make(defineFixture(shape.custom<number>()))).toThrow('requires a provider');
  });

  test('node budgets reset for each root', () => {
    const fixture = defineFixture(shape.object({ id: shape.integer() }));
    expect(fixture.many(5, { seed: 42, now, maxNodes: 2 })).toHaveLength(5);
    expect(() => fixture.one({ seed: 42, now, maxNodes: 1 })).toThrow('Node budget exceeded');
  });

  test('failed roots keep previously accepted uniqueness reservations', () => {
    const model = shape.object({ id: shape.literal(1) });
    const fixture = defineFixture(model, { unique: ['id'] });
    const run = fixtureRun({ seed: 42, now, maxAttempts: 2 });
    expect(run.make(fixture).id).toBe(1);
    expect(() => run.make(fixture)).toThrow('RETRY_EXHAUSTED');
    expect(() => run.make(fixture)).toThrow('RETRY_EXHAUSTED');
    expect(run.make(defineFixture(model, { unique: ['id'] })).id).toBe(1);
  });

  test('generator root context starts empty for the next graph', () => {
    const run = fixtureRun({ seed: 42, now });
    run.make(defineFixture(shape.object({ name: shape.string() })));
    const probe = defineFixture(shape.custom<boolean>(), {
      rules: [{ match: { path: '$' }, use: generator(context => context.root === undefined) }],
    });
    expect(run.make(probe)).toBe(true);
  });
});
