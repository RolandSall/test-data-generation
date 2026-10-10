import { afterEach, expect, expectTypeOf, test } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineFixture } from '../src/index.js';
import { describeType } from '../src/adapters/typescript.js';

declare const brand: unique symbol;
type Identifier = number & { readonly [brand]: 'Identifier' };
type Label = string & { readonly [brand]: 'Label' };
interface Model { id: Identifier; nested: { label: Label; ids: Identifier[] } }
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function file(source: string) {
  const directory = await mkdtemp(join(tmpdir(), 'test-data-brands-'));
  directories.push(directory);
  const path = join(directory, 'model.ts'); await writeFile(path, source); return path;
}
const declarations = `declare const brand: unique symbol;
  export type Identifier = number & { readonly [brand]: 'Identifier' };
  export type Label = string & { readonly [brand]: 'Label' };
  export interface Model { id: Identifier; nested: { label: Label; ids: Identifier[] } }
`;
test('root and nested primitive brands generate primitive values and retain declared types', { timeout: 15000 }, async () => {
  const path = await file(declarations);
  const id = defineFixture(describeType<Identifier>(path, 'Identifier')).one({ seed: 42 });
  const label = defineFixture(describeType<Label>(path, 'Label')).one({ seed: 42 });
  const model = defineFixture(describeType<Model>(path, 'Model')).one({ seed: 42 });
  expect(id).toBeTypeOf('number'); expect(label).toBeTypeOf('string');
  expect(model.id).toBeTypeOf('number'); expect(model.nested.label).toBeTypeOf('string');
  expect(model.nested.ids.length).toBeGreaterThan(0);
  expect(model.nested.ids.every(value => typeof value === 'number')).toBe(true);
  expectTypeOf(id).toEqualTypeOf<Identifier>(); expectTypeOf(model.nested.label).toEqualTypeOf<Label>();
});
test('multiple symbol markers and literal primitive constraints survive extraction', { timeout: 15000 }, async () => {
  const path = await file(`declare const a: unique symbol; declare const b: unique symbol;
    export type Model = 7 & { readonly [a]: 'A' } & { readonly [b]: 'B' };`);
  expect(defineFixture(describeType(path, 'Model')).one({ seed: 42 })).toBe(7);
});
test.each([
  "number & { unit: 'kg' }",
  "number & { readonly __brand: 'Id' }",
  "number & { [brand]: 'Id' }",
  "number & { readonly [brand]?: 'Id' }",
  'number & { readonly [brand]: { min: 1 } }',
  "string & { readonly [brand]: 'Label'; length: 5 }",
])('arbitrary intersection %s is rejected rather than weakened', { timeout: 15000 }, async type => {
  const path = await file(`declare const brand: unique symbol; export type Model = ${type};`);
  expect(() => describeType(path, 'Model')).toThrow('instead of discarding its constraints');
});
