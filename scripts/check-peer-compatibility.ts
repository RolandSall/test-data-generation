import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { prepareZodRegressions } from './compatibility/zod-regressions.js';

const root = resolve(import.meta.dirname, '..');
const minimum = { zod: '4.3.0', typescript: '5.9.2', protobufjs: '8.8.0', vitest: '4.1.0', '@jest/globals': '30.1.0' } as const;
type Peer = keyof typeof minimum;
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { devDependencies: Record<Peer | 'ajv', string> };
const peerArgument = process.argv[2];
const targetArgument = process.argv[3];
if (peerArgument && !Object.hasOwn(minimum, peerArgument) || targetArgument && !['minimum', 'current', '4.3'].includes(targetArgument) || targetArgument === '4.3' && peerArgument !== 'zod') throw new Error('Usage: check-peer-compatibility.ts [peer] [minimum|current] or zod 4.3');
const peers = peerArgument ? [peerArgument as Peer] : Object.keys(minimum) as Peer[];
const staging = await mkdtemp(join(tmpdir(), 'test-data-peer-'));
const run = (cmd: string, args: string[], cwd: string) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' });
try {
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', staging], join(root, 'packages/test-data'))) as { filename: string }[];
  for (const peer of peers) for (const target of targetArgument ? [targetArgument] : peer === 'zod' ? ['minimum', '4.3', 'current'] : ['minimum', 'current']) {
    const version = target === 'minimum' ? minimum[peer] : target === '4.3' ? '4.3.6' : manifest.devDependencies[peer].replace(/^[~^]/, '');
    const directory = await mkdtemp(join(staging, 'consumer-'));
    const dependencies: Record<string, string> = { '@integration-testing/test-data-generation': `file:${join(staging, packed[0]!.filename)}`, typescript: '5.9.3', '@types/node': '22.18.0', [peer]: version };
    if (peer === '@jest/globals') dependencies.jest = version;
    if (peer === 'zod') {
      dependencies.vitest = manifest.devDependencies.vitest;
      dependencies.protobufjs = manifest.devDependencies.protobufjs;
      dependencies.ajv = manifest.devDependencies.ajv;
    }
    await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies }));
    try {
      run('npm', ['exec', '--yes', '--package=npm@11.19.1', '--', 'npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'], directory);
      const code = consumer(peer);
      await writeFile(join(directory, 'test-peer.ts'), code);
      if (peer !== 'vitest') await writeFile(join(directory, 'test-peer.cts'), code);
      if (peer === 'typescript') await writeFile(join(directory, 'model.ts'), `declare const brand: unique symbol;
        export type Identifier = number & { readonly [brand]: 'Identifier' };
        export type Label = string & { readonly [brand]: 'Label' };
        export interface Model { id: Identifier; child: { label: Label } }`);
      if (peer === 'zod') await prepareZodRegressions(root, directory);
      await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2023', lib: ['ES2023', 'ESNext.Disposable'], module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, types: ['node'], skipLibCheck: false, esModuleInterop: true, outDir: 'out' }, include: ['*.ts', '*.cts', 'regressions/**/*.ts'] }));
      run('node', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], directory);
      if (peer === 'vitest') {
        await writeFile(join(directory, 'vitest.config.mjs'), "export default { test: { include: ['out/test-peer.js'] } };");
        run('node', ['node_modules/vitest/vitest.mjs', 'run'], directory);
      } else if (peer === '@jest/globals') {
        run('node', ['node_modules/jest/bin/jest.js', '--runInBand', '--config', JSON.stringify({ rootDir: directory, testMatch: ['**/out/test-peer.cjs'] })], directory);
      } else {
        run('node', ['out/test-peer.js'], directory);
        run('node', ['out/test-peer.cjs'], directory);
      }
      if (peer === 'zod') console.log(run('node', ['node_modules/vitest/vitest.mjs', 'run'], directory).trim());
      console.log(`Verified ${peer}@${version} (${target}): packed consumer types and runtime${peer === 'vitest' ? ' ESM' : peer === '@jest/globals' ? ' Jest CJS' : ' ESM/CJS'}`);
    } catch (error) {
      const failure = error as { stdout?: Buffer; stderr?: Buffer };
      throw new Error(`${peer}@${version} (${target}) failed\n${failure.stdout?.toString() ?? ''}\n${failure.stderr?.toString() ?? ''}`, { cause: error });
    }
  }
} finally { await rm(staging, { recursive: true, force: true }); }

function consumer(peer: Peer): string {
  const core = "import { defineFixture, shape, select, fixtureRun, sequence } from '@integration-testing/test-data-generation';\n";
  if (peer === 'zod') return core + `import { fromZod } from '@integration-testing/test-data-generation/zod';
    import { z } from 'zod';
    const schema = z.object({ n: z.literal('42').transform(Number), status: z.string().default('pending') });
    const output = defineFixture(fromZod(schema)).one({ seed: 42, schemaDefaults: 'preserve', check: 'schema' });
    const input = defineFixture(fromZod(schema, { mode: 'input' })).one({ seed: 42, check: 'schema' });
    const n: number = output.n; const raw: '42' = input.n;
    if (n !== 42 || raw !== '42' || output.status !== 'pending' || schema.parse(input).n !== n) throw new Error('Zod mode/default mismatch');
    for (const kind of ['default', 'prefault'] as const) {
      let calls = 0;
      const omitted = defineFixture(fromZod(z.object({ count: z.number()[kind](() => ++calls).optional() })));
      const value = omitted.one({ seed: 42, optionalProbability: 1, check: 'schema' });
      if (Object.hasOwn(value, 'count') || calls !== 0) throw new Error('Output validation applied a default factory');
    }
    const refined = z.object({ n: z.number() }).refine(() => false, { path: ['n'], message: 'impossible' });
    try { defineFixture(fromZod(refined)).one({ seed: 42, maxAttempts: 2 }); throw new Error('Expected rejection'); }
    catch (error) { if (!String(error).includes('$.n')) throw error; }
    `;
  if (peer === 'typescript') return core + `import { describeType } from '@integration-testing/test-data-generation/typescript';
    declare const brand: unique symbol;
    type Identifier = number & { readonly [brand]: 'Identifier' };
    type Label = string & { readonly [brand]: 'Label' };
    interface Model { id: Identifier; child: { label: Label } }
    const model = describeType<Model>('model.ts', 'Model');
    const value = defineFixture(model, { rules: [select(model).field(x => x.child.label).use('Ada' as Label)] }).one({ seed: 42 });
    const id: Identifier = value.id;
    if (typeof id !== 'number' || value.child.label !== 'Ada') throw new Error('Compiler brand mismatch');
    `;
  if (peer === 'protobufjs') return core + `import protobuf from 'protobufjs';
    import { fromProtobuf } from '@integration-testing/test-data-generation/protobuf';
    const message = protobuf.parse('syntax="proto3"; message Model { string name = 1; uint32 count = 2; repeated string tags = 3; }').root.lookupType('Model');
    const generated = defineFixture(fromProtobuf(message)).one({ seed: 42 });
    if (message.verify(generated) !== null) throw new Error('Invalid protobuf message');
    message.decode(message.encode(generated).finish());
    `;
  if (peer === 'vitest') return core + `import { test, expect } from '@integration-testing/test-data-generation/vitest';
    const recipe = defineFixture(shape.object({ id: shape.integer() }), { fields: { id: sequence() } });
    test('isolated runner session', ({ data }) => {
      expect(data.make(recipe).id).toBe(1); expect(data.make(recipe).id).toBe(2);
      const selected = data.make(recipe, { onlyProvided: true }); expect(selected.id).toBe(3);
    });
    `;
  return core + `import { given, expect } from '@integration-testing/test-data-generation/jest';
    const recipe = defineFixture(shape.object({ id: shape.integer() }), { fields: { id: sequence() } });
    given('typed runner generation', { first: recipe, second: recipe }, values => {
      const id: number = values.first.id;
      expect(id).toBe(1); expect(values.second.id).toBe(2);
    }, { seed: 42, now: '2026-01-01Z' });
    `;
}
