import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function markdownFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = directory + '/' + entry.name;
    if (entry.isDirectory()) files.push(...await markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(path);
  }
  return files.sort();
}
const documents = [
  'README.md',
  'CONTRIBUTING.md',
  'playground/README.md',
  ...await markdownFiles('examples'),
  ...await markdownFiles('docs'),
];
const contents = new Map(await Promise.all(documents.map(async name => [name, await readFile(join(root, name), 'utf8')] as const)));
const fenced = /^```(\w+)([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm;
const withoutCode = (text: string) => text.replace(fenced, '');
const anchors = (text: string): Set<string> => {
  const counts = new Map<string, number>();
  return new Set([...withoutCode(text).matchAll(/^#{1,6}\s+(.+)$/gm)].map(match => {
    const slug = match[1]!.toLowerCase().replace(/`/g, '').replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/\s/g, '-');
    const count = counts.get(slug) ?? 0;
    counts.set(slug, count + 1);
    return count ? slug + '-' + count : slug;
  }));
};
let links = 0;
for (const [name, content] of contents) {
  for (const match of withoutCode(content).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1]!;
    if (/^[a-z]+:/i.test(target)) continue;
    const [path, fragment] = target.split('#');
    const full = path ? resolve(root, dirname(name), decodeURIComponent(path)) : join(root, name);
    if (!existsSync(full)) throw new Error(name + ': missing link ' + target);
    if (fragment && !anchors(await readFile(full, 'utf8')).has(decodeURIComponent(fragment))) throw new Error(name + ': missing anchor ' + target);
    links++;
  }
}

const temporary = await mkdtemp(join(root, '.docs-check-'));
const guides: string[] = [];
const runners: { kind: 'jest' | 'vitest'; name: string; body: string }[] = [];
let snippets = 0;
const command = (file: string, args: string[], cwd = temporary): void => {
  try {
    execFileSync('node', [isAbsolute(file) ? file : join(root, file), ...args], { cwd, stdio: 'pipe', timeout: 120000 });
  } catch (error) {
    const failure = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error([file, failure.stdout?.toString(), failure.stderr?.toString()].filter(Boolean).join('\n'), { cause: error });
  }
};
try {
  const scopedModules = join(temporary, 'node_modules', '@integration-testing');
  await mkdir(scopedModules, { recursive: true });
  await symlink(join(root, 'packages/test-data'), join(scopedModules, 'test-data-generation'), 'dir');
  for (const [name, content] of contents) {
    const code: string[] = [];
    for (const match of content.matchAll(fenced)) {
      const language = match[1]!;
      const attributes = match[2]!;
      const body = match[3]!;
      const namedFile = /\bfile=([\w.-]+)/.exec(attributes)?.[1];
      if (namedFile) await writeFile(join(temporary, namedFile), body);
      if (language !== 'ts') continue;
      snippets++;
      const runner = /\brunner=(jest|vitest)/.exec(attributes)?.[1] as 'jest' | 'vitest' | undefined;
      if (runner) {
        const runnerName = 'testing-' + runner + '-' + runners.length + '.test.ts';
        runners.push({ kind: runner, name: runnerName, body });
        await writeFile(join(temporary, runnerName), body);
      } else code.push(body);
    }
    if (code.length) {
      const guide = 'guide-' + name.replace(/\.md$/, '').replaceAll('/', '-').toLowerCase() + '.ts';
      guides.push(guide);
      await writeFile(join(temporary, guide), code.join('\n') + '\nexport {};\n');
    }
  }
  await writeFile(join(temporary, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2023', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
      exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, esModuleInterop: true,
      types: ['node'], skipLibCheck: false, noEmitOnError: true, outDir: './out',
    },
    include: ['*.ts'],
  }));
  command('node_modules/typescript/bin/tsc', ['--project', join(temporary, 'tsconfig.json')]);
  for (const guide of guides) {
    command(join(temporary, 'out', guide.replace(/\.ts$/, '.js')), []);
  }
  for (const runner of runners) {
    if (runner.kind === 'jest') {
      const filename = runner.name.replace(/\.ts$/, '.cjs');
      await writeFile(join(temporary, 'out', filename), ts.transpileModule(runner.body, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, esModuleInterop: true },
      }).outputText);
      command('node_modules/jest/bin/jest.js', ['--runInBand', '--config', JSON.stringify({
        rootDir: temporary, testEnvironment: 'node', testMatch: ['**/' + filename],
      })]);
    } else {
      const config = join(temporary, 'vitest.config.mjs');
      await writeFile(config, 'export default ' + JSON.stringify({
        root: temporary, test: { include: ['out/' + runner.name.replace(/\.ts$/, '.js')] },
      }));
      command('node_modules/vitest/vitest.mjs', ['run', '--config', config]);
    }
  }
  console.log(snippets + ' TypeScript snippets checked; ' + guides.length + ' guide programs and ' +
    runners.length + ' real runner examples executed; ' + links + ' local links verified.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
