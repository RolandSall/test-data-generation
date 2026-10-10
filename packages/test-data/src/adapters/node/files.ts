import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { generator, type Generator } from '../../core/instructions.js';

const RANDOM_FILENAME_LENGTH = 12;

export function filePath({ directory = '.', extension = 'txt' }: {
  directory?: string;
  extension?: string;
} = {}): Generator<string> {
  if (!/^[a-zA-Z0-9]+$/.test(extension)) throw new RangeError('Invalid extension');
  return generator(context => resolve(directory, `${context.random.text(RANDOM_FILENAME_LENGTH)}.${extension}`));
}

/** Filesystem writes are explicit and async, never an implicit generator side effect. */
export async function materializeFile(path: string, contents: string | Uint8Array): Promise<string> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, { flag: 'wx' });
  return path;
}
