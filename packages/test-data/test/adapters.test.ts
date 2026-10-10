import { afterEach, describe, expect, test } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as z from 'zod';
import { Ajv } from 'ajv';
import protobuf from 'protobufjs';
import { defineFixture, fromJsonSchema, fromColumns, type JsonSchema, validateShape } from '../src/index.js';
import { fromZod } from '../src/adapters/zod.js';
import { describeType } from '../src/adapters/typescript.js';
import { fromProtobuf } from '../src/adapters/protobuf.js';
import { readCsvFile, readJsonFile, readStream, filePath, materializeFile } from '../src/adapters/node.js';
import { sample } from '../src/generators/values.js';
const options = { seed: 42, now: '2026-01-01Z' };
const directories: string[] = [];
async function directory(): Promise<string> { const path = await mkdtemp(join(tmpdir(), 'test-data-')); directories.push(path); return path; }
afterEach(async () => { await Promise.all(directories.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
describe('Zod independent constraint validation', () => {
  test('nested objects, arrays, integers, dates and formats', () => {
    const schema = z.object({ name: z.string().min(5).max(12), age: z.number().int().min(18).max(65), email: z.email(), id: z.uuid(), dob: z.date(), tags: z.array(z.string()).min(2).max(4) });
    const fixture = defineFixture(fromZod(schema)); fixture.many(30, options).forEach(p => expect(schema.safeParse(p).success).toBe(true));
  });
  test('maps, sets, tuples, enums, finite records and union variants', () => {
    const schema = z.object({ map: z.map(z.string(), z.number()), set: z.set(z.string()).min(2).max(3), tuple: z.tuple([z.literal('x'), z.boolean()]), record: z.record(z.enum(['A', 'B']), z.number()), variant: z.discriminatedUnion('kind', [z.object({ kind: z.literal('cat'), paws: z.literal(4) }), z.object({ kind: z.literal('bird'), wings: z.literal(2) })]) });
    defineFixture(fromZod(schema)).many(20, options).forEach(p => expect(schema.safeParse(p).success).toBe(true));
  });
  test('nullable, optional, lazy and readonly shapes', () => {
    const schema = z.object({ name: z.string(), extra: z.string().nullable().optional(), frozen: z.object({ name: z.string() }).readonly() });
    const p = defineFixture(fromZod(schema)).one(options); expect(schema.safeParse(p).success).toBe(true); expect(Object.isFrozen(p.frozen)).toBe(true);
    const lazy = z.lazy(() => z.object({ name: z.string() })); expect(defineFixture(fromZod(lazy)).one(options).name).toBeTruthy();
  });
  test('regex and refinement checks are honored with bounded retries', () => {
    const schema = z.object({ code: z.string().regex(/^CODE-\d{4}$/), even: z.number().int().min(0).max(100).refine(v => v % 2 === 0) });
    defineFixture(fromZod(schema)).many(20, options).forEach(p => expect(schema.safeParse(p).success).toBe(true));
  });
  test('object intersections and transformation pipelines', () => {
    const schema = z.intersection(z.object({ first: z.string() }), z.object({ second: z.number() })); expect(schema.safeParse(defineFixture(fromZod(schema)).one(options)).success).toBe(true);
    expect(defineFixture(fromZod(z.number().int().min(1).max(1).transform(n => `value:${n}`))).one(options)).toBe('value:1');
  });
  test('unsupported custom shapes require providers and invalid overrides fail opt-in validation', () => {
    expect(() => defineFixture(fromZod(z.custom())).one(options)).toThrow('provider');
    const fixture = defineFixture(fromZod(z.object({ name: z.string().max(3) })), { fields: { name: 'too-long' } }); expect(() => fixture.one({ ...options, check: 'schema' })).toThrow('VALIDATION');
  });
  test('large bigint lower bounds and numeric enum set domains stay valid', () => {
    const large = z.bigint().min(10n ** 30n); expect(defineFixture(fromZod(large)).one(options)).toBeGreaterThanOrEqual(10n ** 30n);
    enum Status { Active, Disabled }
    const schema = z.set(z.enum(Status));
    defineFixture(fromZod(schema)).many(40, options).forEach(value => { expect(schema.safeParse(value).success).toBe(true); expect(value.size).toBe(2); });
  });
});
describe('JSON Schema and column metadata', () => {
  test('generated values pass independent Ajv validation', () => {
    const schema: JsonSchema = { type: 'object', properties: { name: { type: 'string', minLength: 4, maxLength: 8 }, age: { type: 'integer', minimum: 18, maximum: 65 }, code: { type: 'string', pattern: '^AB[0-9]{3}$' }, tags: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 50 }, minItems: 2, maxItems: 4, uniqueItems: true } }, required: ['name', 'age', 'code', 'tags'] };
    const validator = new Ajv().compile(schema); defineFixture(fromJsonSchema(schema)).many(30, options).forEach(p => expect(validator(p), JSON.stringify(validator.errors)).toBe(true));
  });
  test('local references, null unions, constants and nested generics', () => {
    const schema: JsonSchema = { type: 'object', properties: { item: { $ref: '#/$defs/Address' }, optional: { type: ['string', 'null'] } }, required: ['item', 'optional'], $defs: { Address: { type: 'object', properties: { kind: { const: 'home' } }, required: ['kind'] } } };
    const p = defineFixture(fromJsonSchema<{ item: { kind: string } }>(schema)).one(options); expect(p.item.kind).toBe('home');
    expect(() => fromJsonSchema({ $ref: 'https://example.test/schema' })).toThrow('local');
    expect(() => fromJsonSchema({ $ref: '#/$defs/missing' })).toThrow('Missing');
  });
  test('column length, precision, scale and validation bounds compose', () => {
    const node = fromColumns({ code: { type: 'string', length: 4 }, amount: { type: 'decimal', precision: 20, scale: 3, minimum: 1, maximum: 7 }, count: { type: 'integer', minimum: 18, maximum: 65 }, enabled: { type: 'boolean', nullable: true } });
    const p = defineFixture(node).one(options); expect(String(p.code).length).toBeLessThanOrEqual(4); expect(String(p.amount)).toMatch(/^[1-7]\.\d{3}$/); expect(validateShape(node, p)).toEqual([]);
  });
});
describe('TypeScript compiler metadata', () => {
  test('interfaces, nested generics, inheritance, unions and recursive optional fields', async () => {
    const path = join(await directory(), 'models.ts');
    await writeFile(path, 'interface Base { id: string }\ninterface Box<T> { value: T }\nexport interface Person extends Base { age: number; kind: "A" | "B"; box: Box<string[]>; labels: Map<string, number>; flags: Set<boolean>; date: Date; next?: Person }');
    const node = describeType<{ id: string; box: { value: string[] }; labels: Map<string, number>; date: Date }>(path, 'Person'); const p = defineFixture(node).one(options);
    expect(p.id).toBeTypeOf('string'); expect(p.box.value[0]).toBeTypeOf('string'); expect(p.labels).toBeInstanceOf(Map); expect(p.date).toBeInstanceOf(Date);
  });
  test('unknown declarations and unbound any types fail clearly', async () => {
    const path = join(await directory(), 'models.ts'); await writeFile(path, 'export interface Model { value: any }');
    expect(() => describeType(path, 'Missing')).toThrow('Unknown declaration'); expect(() => describeType(path, 'Model')).toThrow('explicit metadata');
  });
  test('scoped boolean rules reach nested compiler types while preserving boolean literals', async () => {
    interface Order { paid: boolean; literal: true; customer: { active: boolean; settings: { email: boolean; sms?: boolean; consent: boolean | null; devices: { enabled: boolean }[] } } }
    const path = join(await directory(), 'orders.ts');
    await writeFile(path, 'export interface Order { paid: boolean; literal: true; customer: { active: boolean; settings: { email: boolean; sms?: boolean; consent: boolean | null; devices: { enabled: boolean }[] } } }');
    const fixture = defineFixture(describeType<Order>(path, 'Order'), {
      fields: { paid: true, customer: { active: true } },
      rules: [{ match: { kind: 'boolean', under: 'customer.settings' }, use: false }],
    });
    for (const order of fixture.many(20, { ...options, nullProbability: 0 })) {
      expect(order.paid).toBe(true); expect(order.customer.active).toBe(true); expect(order.literal).toBe(true);
      expect(order.customer.settings.email).toBe(false); expect(order.customer.settings.sms).toBe(false); expect(order.customer.settings.consent).toBe(false);
      expect(order.customer.settings.devices.every(device => device.enabled === false)).toBe(true);
    }
    const absent = fixture.one({ ...options, optionalProbability: 1, nullProbability: 1 });
    expect(absent.customer.settings.sms).toBeUndefined(); expect(absent.customer.settings.consent).toBeNull();
  });
});
describe('protobuf descriptor construction', () => {
  test('scalars, unsigned numbers, bytes, repeated values, maps and oneofs encode/decode', () => {
    const root = protobuf.parse('syntax="proto3"; message Address { string city = 1; } message Person { string name = 1; uint32 age = 2; bytes payload = 3; repeated Address addresses = 4; map<string,string> tags = 5; oneof contact { string email = 6; string phone = 7; } }').root;
    const type = root.lookupType('Person'), fixture = defineFixture(fromProtobuf(type));
    fixture.many(20, options).forEach(message => { expect(type.verify(message)).toBeNull(); const wire = type.encode(message).finish(); expect(type.toObject(type.decode(wire), { bytes: Array })).toEqual(type.toObject(message, { bytes: Array })); expect(Object.hasOwn(message, 'email') !== Object.hasOwn(message, 'phone')).toBe(true); });
  });
});
describe('node source and file adapters', () => {
  test('CSV, JSON and async streams', async () => {
    const dir = await directory(); await writeFile(join(dir, 'data.csv'), 'name\nAda'); await writeFile(join(dir, 'data.json'), '[{"name":"Ada"}]');
    expect((await readCsvFile(join(dir, 'data.csv'))).rows[0]!.name).toBe('Ada'); expect((await readJsonFile(join(dir, 'data.json'))).rows[0]!.name).toBe('Ada');
    async function* stream() { yield Buffer.from('name\n'); yield Buffer.from('Ada'); }
    expect((await readStream(stream())).rows[0]!.name).toBe('Ada'); await expect(readStream(stream(), { maxBytes: 2 })).rejects.toThrow('byte limit');
  });
  test('file generation is explicit and refuses overwrites', async () => {
    const dir = await directory(), path = sample(filePath({ directory: dir }))[0]!;
    expect(await materializeFile(path, 'contents')).toBe(path); await expect(materializeFile(path, 'other')).rejects.toThrow();
  });
});
