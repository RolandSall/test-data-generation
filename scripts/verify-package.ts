import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..'), packageRoot = join(root, 'packages/test-data');
const directory = await mkdtemp(join(tmpdir(), 'test-data-consumer-'));
const run = (cmd: string, args: string[], cwd = directory) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', directory], packageRoot)) as { filename: string; files: { path: string }[] }[];
  const tarball = packed[0]!;
  const files = new Set(tarball.files.map(file => file.path));
  assert(tarball.files.every(file => !file.path.split('/').some(part => ['playground', 'examples'].includes(part))), 'Playground and examples must not be published');
  assert(files.has('README.md') && files.has('LICENSE'));
  assert(tarball.files.every(file => ['dist/', 'README.md', 'LICENSE', 'package.json'].some(prefix => file.path.startsWith(prefix))), 'Unexpected npm payload');
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as { exports: Record<string, unknown>; version: string };
  const check = (entry: unknown): void => {
    if (typeof entry === 'string') assert(files.has(entry.replace(/^\.\//, '')), `Missing export ${entry}`);
    else if (typeof entry === 'object' && entry !== null) Object.values(entry).forEach(check);
  };
  Object.values(manifest.exports).forEach(check);
  const code = `import { defineFixture, shape, sequence } from '@integration-testing/test-data-generation';\nconst recipe = defineFixture(shape.object({ id: shape.integer() }), { fields: { id: sequence() } });\nconst ids = recipe.many(3, { seed: 42 }).map(p => p.id);\nif (JSON.stringify(ids) !== '[1,2,3]') throw new Error('Consumer generation failed');\n`;
  const core = join(directory, 'core-only'); await mkdir(core);
  await writeFile(join(core, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { '@integration-testing/test-data-generation': `file:${join(directory, tarball.filename)}` } }));
  run('npm', ['exec', '--yes', '--package=npm@11.19.1', '--', 'npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'], core);
  await writeFile(join(core, 'consumer.mjs'), code); run('node', ['consumer.mjs'], core);
  const tree = run('npm', ['ls', '--all', '--json'], core);
  const coreTree = JSON.parse(tree) as { dependencies: Record<string, { dependencies?: Record<string, { missing?: boolean; version?: string }> }> };
  const installed = Object.entries(coreTree.dependencies['@integration-testing/test-data-generation']?.dependencies ?? {}).filter(([, dependency]) => !dependency.missing && dependency.version).map(([name]) => name);
  assert(installed.every(name => !['zod', 'typescript', 'protobufjs', 'vitest', '@jest/globals'].includes(name)), `Core must not install optional adapters: ${installed.join(', ')}`);
  const coreAudit = JSON.parse(run('npm', ['audit', '--omit=dev', '--json'], core)) as { metadata: { vulnerabilities: { total: number } } };
  assert.equal(coreAudit.metadata.vulnerabilities.total, 0, 'Published core dependency audit');
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: {
    '@integration-testing/test-data-generation': `file:${join(directory, tarball.filename)}`,
    zod: '4.6.5', typescript: '5.9.3', protobufjs: '8.8.0', vitest: '4.1.11', jest: '30.5.2', '@jest/globals': '30.5.2',
  } }));
  // Use the release toolchain in isolation: npm 10's Arborist crashes while resolving Vitest's optional peers.
  run('npm', ['exec', '--yes', '--package=npm@11.19.1', '--', 'npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund']);
  await writeFile(join(directory, 'consumer.mjs'), code); run('node', ['consumer.mjs']);
  await writeFile(join(directory, 'consumer.cjs'), code.replace("import { defineFixture, shape, sequence } from '@integration-testing/test-data-generation';", "const { defineFixture, shape, sequence } = require('@integration-testing/test-data-generation');")); run('node', ['consumer.cjs']);
  const typeCode = `import { defineFixture, shape, listOf } from '@integration-testing/test-data-generation';\nimport {fromZod} from '@integration-testing/test-data-generation/zod';\nimport {describeType} from '@integration-testing/test-data-generation/typescript';\nimport {fromProtobuf} from '@integration-testing/test-data-generation/protobuf';\nimport {readSettingsFile} from '@integration-testing/test-data-generation/node';\nimport * as z from 'zod';\nvoid describeType; void fromProtobuf; void readSettingsFile;\nconst inferredAge:number=defineFixture(fromZod(z.object({age:z.number()}))).one().age;\nconst schema = shape.object({ name: shape.string(), age: shape.integer() });\nconst fixture = defineFixture(schema, { fields: { age: 18 }, computed: ({ derive }) => ({ name: derive(['age'], age => String(age)) }) });\nconst count: number = fixture.one({ seed: 42 }).age;\nlistOf(schema, { count: 2 }).one();\n// @ts-expect-error Unknown field must be rejected in installed types\ndefineFixture(schema, { fields: { typo: true } });\n`;
  await writeFile(join(directory, 'consumer.mts'), typeCode); await writeFile(join(directory, 'consumer.cts'), typeCode);
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2023', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: false, noEmit: true }, include: ['consumer.mts', 'consumer.cts'] }));
  run('node', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.json']);
  await writeFile(join(directory, 'models.ts'), 'export interface Person { name: string; age: number }');
  const adapterCode = `import {defineFixture} from '@integration-testing/test-data-generation';\nimport {fromZod} from '@integration-testing/test-data-generation/zod';\nimport {fromProtobuf} from '@integration-testing/test-data-generation/protobuf';\nimport {describeType} from '@integration-testing/test-data-generation/typescript';\nimport {readSettingsFile} from '@integration-testing/test-data-generation/node';\nimport * as z from 'zod';\nimport protobuf from 'protobufjs';\nconst schema=z.object({name:z.string().min(3)}); schema.parse(defineFixture(fromZod(schema)).one({seed:42}));\nconst type=protobuf.parse('syntax="proto3"; message Person { string name=1; }').root.lookupType('Person'); if(type.verify(defineFixture(fromProtobuf(type)).one({seed:42}))) throw new Error('Protobuf consumer');\nif(typeof defineFixture(describeType('./models.ts','Person')).one({seed:42}).name!=='string') throw new Error('Compiler consumer');\nif((await readSettingsFile('./settings.json')).seed!==42) throw new Error('Node consumer');\n`;
  await writeFile(join(directory, 'settings.json'), '{"seed":42}');
  await writeFile(join(directory, 'adapters.mjs'), adapterCode); run('node', ['adapters.mjs']);
  const cjsAdapters = adapterCode
    .replace("import {defineFixture} from '@integration-testing/test-data-generation';", "const {defineFixture}=require('@integration-testing/test-data-generation');")
    .replace("import {fromZod} from '@integration-testing/test-data-generation/zod';", "const {fromZod}=require('@integration-testing/test-data-generation/zod');")
    .replace("import {fromProtobuf} from '@integration-testing/test-data-generation/protobuf';", "const {fromProtobuf}=require('@integration-testing/test-data-generation/protobuf');")
    .replace("import {describeType} from '@integration-testing/test-data-generation/typescript';", "const {describeType}=require('@integration-testing/test-data-generation/typescript');")
    .replace("import {readSettingsFile} from '@integration-testing/test-data-generation/node';", "const {readSettingsFile}=require('@integration-testing/test-data-generation/node');")
    .replace("import * as z from 'zod';", "const z=require('zod');")
    .replace("import protobuf from 'protobufjs';", "const protobuf=require('protobufjs');");
  await writeFile(join(directory, 'adapters.cjs'), `(async()=>{\n${cjsAdapters}\n})().catch(error=>{console.error(error);process.exitCode=1;});`); run('node', ['adapters.cjs']);
  await writeFile(join(directory, 'jest.config.cjs'), "module.exports = { testEnvironment: 'node', testMatch: ['**/consumer.jest.test.cjs'] };\n");
  await writeFile(join(directory, 'consumer.jest.test.cjs'), "const {given, expect} = require('@integration-testing/test-data-generation/jest');\nconst {defineFixture, shape} = require('@integration-testing/test-data-generation');\ngiven('packed Jest recipe', { person: defineFixture(shape.object({ name: shape.string() })) }, ({person}) => expect(person.name).toEqual(expect.any(String)), { seed: 42 });\n");
  run('node', ['node_modules/jest/bin/jest.js', '--runInBand', '--config', 'jest.config.cjs']);
  await writeFile(join(directory, 'consumer.vitest.test.ts'), "import {test,expect} from '@integration-testing/test-data-generation/vitest';\nimport {defineFixture,shape} from '@integration-testing/test-data-generation';\ntest('packed Vitest session', ({data}) => { expect(data.make(defineFixture(shape.string()))).toEqual(expect.any(String)); });\n");
  run('node', ['node_modules/vitest/vitest.mjs', 'run', 'consumer.vitest.test.ts']);
  // Assert actual failure reports include replay information in both runners.
  await writeFile(join(directory, 'consumer.jest.test.cjs'), "const {given} = require('@integration-testing/test-data-generation/jest');\ngiven('failure probe', {}, () => { throw new Error('intentional'); }, {seed: 8532});\n");
  const failedJest = spawnSync('node', ['node_modules/jest/bin/jest.js', '--runInBand', '--config', 'jest.config.cjs'], { cwd: directory, encoding: 'utf8' });
  assert.equal(failedJest.status, 1); assert.match(failedJest.stdout + failedJest.stderr, /seed=8532/);
  await writeFile(join(directory, 'consumer.vitest.test.ts'), "import {test} from '@integration-testing/test-data-generation/vitest';\ntest('failure probe', ({data}) => { void data; throw new Error('intentional'); });\n");
  const failedVitest = spawnSync('node', ['node_modules/vitest/vitest.mjs', 'run', 'consumer.vitest.test.ts'], { cwd: directory, encoding: 'utf8', env: { ...process.env, TEST_DATA_SEED: '8532' } });
  assert.equal(failedVitest.status, 1); assert.match(failedVitest.stdout + failedVitest.stderr, /TEST_DATA_SEED=.*8532/);
  console.log(`Verified ${manifest.version}: ${files.size} published files; core-only installation and dependency audit; ESM/CJS runtimes and declarations; installed schema/compiler/Node adapters; Jest/Vitest consumers and replay failure reports.`);
} finally { await rm(directory, { recursive: true, force: true }); }
