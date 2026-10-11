import { afterEach, describe, expect, test } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import protobuf from 'protobufjs';
import { defineFixture } from '../src/index.js';
import { describeType } from '../src/adapters/typescript.js';
import { fromProtobuf } from '../src/adapters/protobuf.js';
import { filePath, readStream } from '../src/adapters/node.js';

const directories: string[] = [];
async function sourceFile(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'test-data-adapters-'));
  directories.push(directory);
  const path = join(directory, 'models.ts');
  await writeFile(path, contents);
  return path;
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

// Full compiler programs can exceed the default five seconds under CI coverage.
describe('compiler conversion boundaries', { timeout: 15_000 }, () => {
  test('literal/scalar precedence and built-in collections produce compatible values', async () => {
    const path = await sourceFile(`
      interface Buffer { readonly length: number }
      export interface Model {
        label: 'fixed'; count: 7; off: false; enabled: boolean; big: bigint;
        nothing: null; absent: undefined; voided: void; tuple: [string, 7];
        numbers: ReadonlyArray<number>; list: string[]; date: Date;
        map: ReadonlyMap<string, number>; set: ReadonlySet<string>;
        bytes: Uint8Array; buffer: Buffer; dictionary: { [key: string]: boolean };
        choice: 'x' | number;
      }
    `);
    const value = defineFixture(describeType<Record<string, unknown>>(path, 'Model')).one({ seed: 42, defaults: { array: { minSize: 2, maxSize: 2 } } });
    expect(value).toMatchObject({ label: 'fixed', count: 7, off: false, nothing: null });
    expect(value.absent).toBeUndefined(); expect(value.voided).toBeUndefined();
    expect(value.enabled).toBeTypeOf('boolean'); expect(value.big).toBeTypeOf('bigint');
    expect(value.tuple).toEqual([expect.any(String), 7]);
    expect(value.numbers).toEqual([expect.any(Number), expect.any(Number)]);
    expect(value.list).toEqual([expect.any(String), expect.any(String)]);
    expect(value.date).toBeInstanceOf(Date); expect(value.map).toBeInstanceOf(Map); expect(value.set).toBeInstanceOf(Set);
    expect(value.bytes).toBeInstanceOf(Uint8Array); expect(value.buffer).toBeInstanceOf(Uint8Array);
    expect(Object.values(value.dictionary as object).every(item => typeof item === 'boolean')).toBe(true);
    expect(value.choice === 'x' || typeof value.choice === 'number').toBe(true);
  });

  test('explicit compiler settings retain null/undefined union semantics and report missing inputs', async () => {
    const path = await sourceFile('export type Model = null | undefined');
    const config = join(path, '..', 'tsconfig.json');
    await writeFile(config, JSON.stringify({ compilerOptions: { target: 'ES2023', strictNullChecks: true } }));
    const fixture = defineFixture(describeType(path, 'Model', { tsconfig: config }));
    expect(fixture.one({ optionalProbability: 0 })).toBeNull();
    expect(fixture.one({ optionalProbability: 1 })).toBeUndefined();
    expect(() => describeType(join(path, '..', 'missing.ts'), 'Model')).toThrow('Missing type source');
    await writeFile(config, '{');
    expect(() => describeType(path, 'Model', { tsconfig: config })).toThrow();
  });

  test.each([
    ['unknown', 'export type Model = unknown', 'explicit metadata/provider'],
    ['never', 'export type Model = never', 'explicit metadata/provider'],
    ['unbound generic', 'export interface Model<T> { value: T }', 'explicit metadata/provider'],
    ['class method', 'export class Model { execute(): void {} }', 'class factory/provider'],
  ])('%s remains an explicit unsupported input', async (_label, contents, message) => {
    const path = await sourceFile(contents!);
    expect(() => describeType(path, 'Model')).toThrow(message!);
  });
});

describe('protobuf conversion boundaries', () => {
  test('scalar families, enums, integer map keys and multiple oneof groups survive encoding', () => {
    const root = protobuf.parse(`syntax = "proto3";
      message Model {
        enum State { FIRST = 0; SECOND = 1; }
        string text = 1; bytes data = 2; bool enabled = 3;
        double real = 4; float fraction = 5;
        int32 signed = 6; sint32 zigzag = 7; sfixed32 signedFixed = 8;
        uint32 unsigned = 9; fixed32 unsignedFixed = 10;
        int64 wide = 11; sint64 wideZigzag = 12; sfixed64 wideFixed = 13;
        uint64 wideUnsigned = 14; fixed64 wideUnsignedFixed = 15;
        State state = 16; map<int32, string> labels = 17;
        oneof contact { string email = 18; string phone = 19; }
        oneof location { string city = 20; string street = 21; }
      }
    `).root;
    const type = root.lookupType('Model');
    for (const message of defineFixture(fromProtobuf(type)).many(20, { seed: 42 })) {
      expect(type.verify(message)).toBeNull();
      expect(type.verify(type.decode(type.encode(message).finish()))).toBeNull();
      expect(Object.hasOwn(message, 'email') !== Object.hasOwn(message, 'phone')).toBe(true);
      expect(Object.hasOwn(message, 'city') !== Object.hasOwn(message, 'street')).toBe(true);
    }
  });

  test('recursive descriptors preserve their lazy edge and support explicit termination before encoding', () => {
    interface Tree extends protobuf.Message<Tree> { id: string; children: Tree[] }
    const type = protobuf.parse('syntax="proto3"; message Tree { string id = 1; repeated Tree children = 2; }').root.lookupType('Tree');
    const model = fromProtobuf<Tree>(type);
    expect(model.fields!.children!.element!.resolve!()).toBe(model);
    const fixture = defineFixture(model, { fields: { children: [] } });
    for (const tree of fixture.many(5, { seed: 42 })) {
      expect(type.verify(tree)).toBeNull();
      const decoded = type.decode(type.encode(tree).finish());
      expect(type.toObject(decoded)).toEqual(type.toObject(tree));
    }
  });
});

describe('explicit Node preparation', () => {
  test('JSON stream decoding preserves UTF-8 split across chunks and enforces the exact byte bound', async () => {
    const payload = Buffer.from('[{"name":"José"}]');
    const split = payload.indexOf(0xc3) + 1;
    async function* stream() { yield payload.subarray(0, split); yield payload.subarray(split); }
    const feed = await readStream(stream(), { format: 'json', maxBytes: payload.length });
    expect(feed.rows[0]!.name).toBe('José');
    await expect(readStream(stream(), { format: 'json', maxBytes: payload.length - 1 })).rejects.toThrow('byte limit');
  });

  test('filename extensions cannot introduce path components', () => {
    expect(() => filePath({ extension: '../txt' })).toThrow('Invalid extension');
  });
});
