import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Reuse every Zod regression file against the installed package and selected peer. */
export async function prepareZodRegressions(root: string, consumer: string): Promise<void> {
  const tests = join(root, 'packages/test-data/test');
  const directory = join(consumer, 'regressions');
  await mkdir(directory);
  let count = 0;
  for (const file of (await readdir(tests)).sort()) {
    if (!file.endsWith('.test.ts')) continue;
    const source = await readFile(join(tests, file), 'utf8');
    if (!source.includes('fromZod') && !/from ['"]zod(?:\/[^'"]*)?['"]/.test(source)) continue;
    const rewritten = source.replace(/(['"])\.\.\/src\/([^'"]+)\.js\1/g, (_match, quote: string, path: string) => {
      const entry = publicEntry(path);
      return `${quote}@integration-testing/test-data-generation${entry}${quote}`;
    });
    await writeFile(join(directory, file), rewritten);
    count++;
  }
  if (!count) throw new Error('No Zod regression files found');
  await writeFile(join(consumer, 'vitest.config.mjs'), "export default { test: { include: ['out/regressions/**/*.test.js'], testTimeout: 15000 } };\n");
}

function publicEntry(path: string): string {
  if (path === 'index' || path === 'generators/values') return '';
  const adapter = /^adapters\/(zod|typescript|protobuf|node)$/.exec(path);
  if (adapter) return '/' + adapter[1];
  throw new Error(`Zod compatibility regression requires a public entry point for ${path}`);
}
