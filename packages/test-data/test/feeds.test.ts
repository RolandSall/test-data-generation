import { describe, expect, test } from 'vitest';
import { defineFixture, shape, readCsv, readJson, rows, column, template, combineColumns, generatedColumn, transformColumn, nullableColumn, sample, uuid, writeCsv } from '../src/index.js';
const csv = 'firstName,lastName,dob,gender\nJohn,Doe,2001-11-22,MALE\nAlice,Smith,1977-07-15,FEMALE\nBob,Brown,1999-12-01,MALE\n';
const person = shape.object({ id: shape.string({ format: 'uuid' }), firstName: shape.string(), lastName: shape.string(), dob: shape.date(), gender: shape.enum(['MALE', 'FEMALE']) });
const opts = { seed: 42, now: '2026-01-01Z' };
describe('coherent feed rows and typed conversion', () => {
  test('maps rows together and generates missing fields', () => {
    const p = defineFixture(person, { source: readCsv(csv) }).many(3, opts);
    expect(p.map(p => p.firstName)).toEqual(['John', 'Alice', 'Bob']); expect(p[1]!.lastName).toBe('Smith'); expect(p[1]!.dob).toEqual(new Date('1977-07-15')); expect(p[0]!.id).toMatch(/^[a-f0-9-]{36}$/);
  });
  test('overrides beat feed columns without changing the rest of the row', () => {
    const p = defineFixture(person, { source: readCsv(csv), fields: { firstName: 'override' } }).many(3, opts);
    expect(p.map(p => p.firstName)).toEqual(['override', 'override', 'override']); expect(p.map(p => p.lastName)).toEqual(['Doe', 'Smith', 'Brown']);
  });
  test('recycle, exhaustion and fresh execution cursors', () => {
    const fixture = defineFixture(person, { source: readCsv(csv, { onEnd: 'cycle' }) });
    expect(fixture.many(5, opts).map(p => p.firstName)).toEqual(['John', 'Alice', 'Bob', 'John', 'Alice']); expect(fixture.one(opts).firstName).toBe('John');
    expect(() => defineFixture(person, { source: readCsv(csv) }).many(4, opts)).toThrow('Feed exhausted');
  });
  test('random sampling with replacement is seeded and coherent', () => {
    const fixture = defineFixture(person, { source: readCsv(csv, { access: 'random' }) }); const p = fixture.many(30, opts);
    expect(p).toEqual(fixture.many(30, opts)); p.forEach(p => expect({ John: 'Doe', Alice: 'Smith', Bob: 'Brown' }[p.firstName]).toBe(p.lastName));
  });
  test('shuffle visits each row exactly once before exhaustion', () => {
    const fixture = defineFixture(person, { source: readCsv(csv, { access: 'shuffle' }) }); const p = fixture.many(3, opts);
    expect(new Set(p.map(p => p.firstName))).toEqual(new Set(['John', 'Alice', 'Bob'])); expect(p).toEqual(fixture.many(3, opts));
  });
  test('tags translate to typed row predicates', () => {
    const fixture = defineFixture(person, { source: readCsv(csv, { where: row => row.gender === 'FEMALE', onEnd: 'cycle' }) });
    expect(fixture.many(3, opts).map(p => p.firstName)).toEqual(['Alice', 'Alice', 'Alice']);
  });
  test('unmatched columns fail by default and can be ignored', () => {
    expect(() => defineFixture(shape.object({ firstName: shape.string() }), { source: readCsv(csv) }).one(opts)).toThrow('Unmapped');
    expect(defineFixture(shape.object({ firstName: shape.string() }), { source: readCsv(csv, { unmatched: 'ignore' }) }).one(opts).firstName).toBe('John');
  });
  test('JSON retains typed values and CSV strictly decodes scalar values', () => {
    const node = shape.object({ enabled: shape.boolean(), count: shape.integer(), big: shape.bigint() });
    const p = defineFixture(node, { source: readCsv('enabled,count,big\nfalse,0,1234567890123456789012') }).one(opts); expect(p).toEqual({ enabled: false, count: 0, big: 1234567890123456789012n });
    expect(defineFixture(shape.object({ count: shape.integer() }), { source: readJson('[{"count":4}]') }).one(opts).count).toBe(4);
    expect(() => defineFixture(node, { source: readCsv('enabled,count,big\nmaybe,0,1') }).one(opts)).toThrow('Boolean column');
    expect(() => defineFixture(shape.object({ n: shape.integer() }), { source: rows([{ n: ' ' }]) }).one(opts)).toThrow('Invalid numeric');
  });
});
describe('column specs and transformation pipelines', () => {
  test('aliases, templates and combining functions resolve in the same row', () => {
    const feed = readCsv(csv); const columns = { firstName: 'firstName', surname: column('lastName'), fullName: template('${firstName} ${surname}'), description: combineColumns(['surname', 'firstName'], (last, first) => `${last}, ${first}`) };
    expect(sample(feed.spec(columns, 'fullName'), { count: 3 })).toEqual(['John Doe', 'Alice Smith', 'Bob Brown']);
    expect(sample(feed.spec(columns, 'description'), { count: 3 })).toEqual(['Doe, John', 'Smith, Alice', 'Brown, Bob']);
  });
  test('generated columns, decoders, ordered postprocessing and nullability', () => {
    const feed = readCsv(csv, { onEnd: 'cycle' }); const columns = { id: generatedColumn(uuid()), first: transformColumn(column('firstName'), v => String(v).toUpperCase(), v => `"${v}"`), bytes: column('firstName', v => Buffer.from(String(v))), nullable: nullableColumn(column('firstName'), 0.5) };
    expect(sample(feed.spec(columns, 'first'), { count: 3 })).toEqual(['"JOHN"', '"ALICE"', '"BOB"']);
    expect(sample(feed.spec(columns, 'bytes'))[0]).toEqual(Buffer.from('John'));
    expect(sample(feed.spec(columns, 'id'), { seed: 42 })).toEqual(sample(feed.spec(columns, 'id'), { seed: 42 }));
    expect(sample(feed.spec(columns, 'nullable'), { seed: 42, count: 50 })).toContain(null);
  });
  test('column cycles and missing properties fail precisely', () => {
    const feed = rows([{ name: 'Ada' }]); expect(() => sample(feed.spec({ a: template('${b}'), b: template('${a}') }, 'a'))).toThrow('dependency cycle');
    expect(() => sample(feed.spec({ a: 'missing' }, 'a'))).toThrow('Missing feed column');
  });
  test('mapping source property names into a different object shape', () => {
    const node = shape.object({ name: shape.string(), last: shape.string() });
    expect(defineFixture(node, { source: rows([{ first: 'Ada', surname: 'Lovelace' }]), columns: { name: 'first', last: 'surname' } }).one(opts)).toEqual({ name: 'Ada', last: 'Lovelace' });
  });
});
describe('CSV parsing and malformed input', () => {
  test('quotes, escaped quotes, multiline cells, BOM and CRLF', () => {
    const feed = readCsv('\uFEFFname,description\r\n"Ada, A","two\nlines ""quoted"""\r\n'); expect(feed.rows).toEqual([{ name: 'Ada, A', description: 'two\nlines "quoted"' }]);
  });
  test('custom delimiters, comments and trimming', () => {
    expect(readCsv('# comment\nname|value\n Ada | x \n', { delimiter: '|', commentPrefix: '#' }).rows).toEqual([{ name: 'Ada', value: 'x' }]);
    expect(readCsv('name\n Ada \n', { trim: false }).rows[0]!.name).toBe(' Ada ');
  });
  test.each(['name,name\na,b', 'name,value\na', 'name\n"unclosed', 'name\n"a"extra', ',value\na,b'])('rejects malformed CSV: %s', input => expect(() => readCsv(input)).toThrow());
  test('writer round-trips quoted and multiline cells', () => { const data = [{ name: 'a,b', text: '"quote"\nline' }]; expect(readCsv(writeCsv(data)).rows).toEqual(data); });
  test('invalid JSON and empty filtered feeds fail', () => { expect(() => readJson('{}')).toThrow('array'); expect(() => rows([{ a: 1 }], { where: () => false })).toThrow('no matching'); });
});
