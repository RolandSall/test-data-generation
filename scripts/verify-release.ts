import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const manifest = JSON.parse(await readFile('packages/test-data/package.json', 'utf8')) as { name: string; version: string; repository?: { url: string } };
if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(manifest.version)) throw new Error('Invalid release version');
if (process.env.GITHUB_REPOSITORY && manifest.repository?.url !== `git+https://github.com/${process.env.GITHUB_REPOSITORY}.git`) throw new Error('Set package repository metadata to the actual release repository');
if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('Release requires a clean checkout');
const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(manifest.name)}/${manifest.version}`);
if (response.status !== 404) throw new Error(response.ok ? `${manifest.version} is already published` : `npm preflight returned ${response.status}`);
console.log(`${manifest.name}@${manifest.version} is available for publication`);
