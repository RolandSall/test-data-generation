import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readme = await readFile(resolve(root, 'README.md'), 'utf8');
const metadata = JSON.parse(await readFile(resolve(root, 'packages/test-data/package.json'), 'utf8')) as { repository: { url: string } };
const repository = metadata.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
const generated = '<!-- Generated from root README. Run bun run docs:sync. -->\n\n' +
  readme.replace(/\]\(((?:docs|examples|playground)\/[^)]+)\)/g, (_, path: string) => '](' + repository + '/blob/main/' + path + ')');
const destination = resolve(root, 'packages/test-data/README.md');
if (process.argv.includes('--check')) {
  if (await readFile(destination, 'utf8') !== generated) throw new Error('npm README is stale. Run bun run docs:sync.');
  console.log('npm README matches the canonical root README.');
} else {
  await writeFile(destination, generated);
  console.log('Synchronized npm README.');
}
