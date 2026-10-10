import { cp, writeFile } from 'node:fs/promises';
await cp('dist/types/esm', 'dist/types/cjs', { recursive: true });
await writeFile('dist/types/cjs/package.json', '{"type":"commonjs"}\n');
