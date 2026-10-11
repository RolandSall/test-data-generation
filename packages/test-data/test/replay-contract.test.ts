import { expect, test } from 'vitest';
import { defineFixture, fixtureRun, shape, generator, sequence, rows } from '../src/index.js';
const options = { seed: 42, now: '2026-01-01T00:00:00Z', maxAttempts: 2 };

test('result seed/clock replay the same recipe, while changed seed or clock changes generation', () => {
  const fixture = defineFixture(shape.object({ id: shape.integer(), clock: shape.string() }), { fields: { clock: generator(c => c.now.toISOString()) } });
  const result = fixture.result(options);
  expect(fixture.one({ seed: result.seed, now: result.now })).toEqual(result.value);
  expect(fixture.one({ ...options, seed: 43 })).not.toEqual(result.value);
  expect(fixture.one({ ...options, now: '2026-02-01Z' }).clock).not.toBe(result.value.clock);
});
test('generation order and source contents/order affect replay', () => {
  const first = defineFixture(shape.object({ a: shape.integer(), b: shape.integer() })).one(options);
  const reordered = defineFixture(shape.object({ b: shape.integer(), a: shape.integer() })).one(options);
  expect(first.a).toBe(reordered.b); expect(first.b).toBe(reordered.a); expect(first).not.toEqual(reordered);
  const model = shape.object({ name: shape.string() });
  const source = defineFixture(model, { source: rows([{ name: 'Ada' }, { name: 'Grace' }]) });
  expect(source.many(2, options)).toEqual(source.many(2, options));
  const reverse = defineFixture(model, { source: rows([{ name: 'Grace' }, { name: 'Ada' }]) });
  expect(reverse.many(2, options)).not.toEqual(source.many(2, options));
  const changed = defineFixture(model, { source: rows([{ name: 'Different' }, { name: 'Grace' }]) });
  expect(changed.one(options)).not.toEqual(source.one(options));
});
test('independent executions reset counters, while batches/streams/sessions advance shared state', () => {
  const ids = sequence();
  const fixture = defineFixture(shape.object({ id: shape.integer() }), { fields: { id: ids } });
  expect(fixture.one(options).id).toBe(1); expect(fixture.one(options).id).toBe(1);
  expect(fixture.many(3, options).map(value => value.id)).toEqual([1, 2, 3]);
  const stream = fixture.stream(options); expect(stream.next().value!.id).toBe(1); expect(stream.next().value!.id).toBe(2);
  const other = defineFixture(fixture.shape, { fields: { id: ids } });
  const run = fixtureRun(options);
  expect(run.make(fixture).id).toBe(1); expect(run.make(other).id).toBe(2);
  expect(fixtureRun(options).make(fixture).id).toBe(1);
});
test('recipe uniqueness spans a session/batch but is never shared between independent executions', () => {
  const fixture = defineFixture(shape.object({ id: shape.literal(7) }), { unique: ['id'] });
  expect(fixture.one(options).id).toBe(7); expect(fixture.one(options).id).toBe(7);
  expect(() => fixture.many(2, options)).toThrow('RETRY_EXHAUSTED');
  const run = fixtureRun(options); expect(run.make(fixture).id).toBe(7);
  expect(() => run.make(fixture)).toThrow('RETRY_EXHAUSTED');
  expect(fixtureRun(options).make(fixture).id).toBe(7);
  expect(run.make(defineFixture(fixture.shape, { unique: ['id'] })).id).toBe(7);
});
test('named uniqueness domains can span different recipes in a shared session', () => {
  const model = shape.object({ id: shape.integer({ min: 7, max: 7 }) });
  const rules = [{ match: { path: 'id' }, unique: 'identifiers' }];
  const first = defineFixture(model, { rules }); const second = defineFixture(model, { rules });
  const run = fixtureRun(options); expect(run.make(first).id).toBe(7);
  expect(() => run.make(second)).toThrow('RETRY_EXHAUSTED');
  expect(second.one(options).id).toBe(7);
});
