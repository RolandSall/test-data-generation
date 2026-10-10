import { readFile } from 'node:fs/promises';
import { readCsv, readJson, type Feed, type FeedOptions } from '../../feeds/feed.js';

const DEFAULT_STREAM_MAX_BYTES = 10_000_000;

export async function readCsvFile(path: string, options: Parameters<typeof readCsv>[1] = {}): Promise<Feed> {
  return readCsv(await readFile(path, 'utf8'), options);
}

export async function readJsonFile(path: string, options: FeedOptions = {}): Promise<Feed> {
  return readJson(await readFile(path, 'utf8'), options);
}

async function collectStream(stream: AsyncIterable<string | Uint8Array>, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBytes) throw new RangeError('Feed stream exceeds byte limit');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readStream(stream: AsyncIterable<string | Uint8Array>, options: FeedOptions & {
  format?: 'csv' | 'json';
  maxBytes?: number;
} = {}): Promise<Feed> {
  const input = await collectStream(stream, options.maxBytes ?? DEFAULT_STREAM_MAX_BYTES);
  return options.format === 'json' ? readJson(input, options) : readCsv(input, options);
}
