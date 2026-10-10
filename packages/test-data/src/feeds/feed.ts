import type { Column } from './column.js';
import type { FeedOptions } from './feed-options.js';
export type { Column } from './column.js';
export type { FeedOptions } from './feed-options.js';
import { GenerationError } from '../core/error.js';
import { generator, type GeneratorContext, type Generator } from '../core/instructions.js';
export type Row = Readonly<Record<string, unknown>>;

export const column = (from: string, decode?: (v: unknown) => unknown): Column => Object.freeze({ from, ...(decode ? { decode } : {}) });
export const template = (text: string): Column => Object.freeze({ compute: (get: (key: string) => unknown) => text.replace(/\$\{([^}]+)\}/g, (_match, key: string) => String(get(key))) });
export const generatedColumn = (input: Generator<unknown>): Column => Object.freeze({ compute: (_get: unknown, c: GeneratorContext) => input.generate(c) });
export const combineColumns = (names: readonly string[], combine: (...values: readonly unknown[]) => unknown): Column => Object.freeze({ compute: (get: (key: string) => unknown) => combine(...names.map(get)) });
export const transformColumn = (input: Column, ...transforms: readonly ((value: unknown, context: GeneratorContext) => unknown)[]): Column => Object.freeze({ ...input, transforms: [...(input.transforms ?? []), ...transforms] });
export const nullableColumn = (input: Column, probability = 0.2): Column => Object.freeze({ ...input, nullable: probability });

export class Feed {
  readonly rows: readonly Row[];
  readonly options: Readonly<FeedOptions>;
  constructor(rows: readonly Row[], options: FeedOptions = {}) {
    this.rows = Object.freeze(rows.filter(row => !options.where || options.where(row)).map(row => Object.freeze({ ...row })));
    this.options = Object.freeze({ access: 'sequential', onEnd: 'fail', unmatched: 'fail', ...options });
    if (!this.rows.length) throw new GenerationError('FEED', 'Feed has no matching rows');
    Object.freeze(this);
  }
  configure(options: FeedOptions): Feed { return new Feed(this.rows, { ...this.options, ...options }); }
  next(context: GeneratorContext): Row {
    const cursor = context.state(this, () => ({ index: 0, order: this.options.access === 'shuffle' ? context.random.shuffle(this.rows) : this.rows }));
    if (this.options.access === 'random') return context.random.pick(this.rows);
    if (cursor.index >= cursor.order.length && this.options.onEnd === 'fail') throw new GenerationError('FEED', 'Feed exhausted', context.path, context.random.seed);
    return cursor.order[cursor.index++ % cursor.order.length]!;
  }
  spec(columns: Readonly<Record<string, string | Column>>, target: string): Generator<unknown> {
    return generator(c => projectRow(this.next(c), columns, c)[target]);
  }
}
export function projectRow(row: Row, columns: Readonly<Record<string, string | Column>>, context: GeneratorContext, used = new Set<string>()): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const active = new Set<string>();
  const get = (name: string): unknown => {
    if (Object.hasOwn(result, name)) return result[name];
    if (active.has(name)) throw new GenerationError('DEPENDENCY', 'Feed column dependency cycle', context.path, context.random.seed);
    const column = Object.hasOwn(columns, name) ? columns[name] : undefined;
    if (!column) {
      if (!Object.hasOwn(row, name)) throw new GenerationError('FEED', `Missing feed property ${name}`, context.path, context.random.seed);
      used.add(name);
      return row[name];
    }
    active.add(name);
    const spec: Column = typeof column === 'string' ? { from: column } : column;
    const raw = spec.from ?? name;
    let value = spec.compute ? spec.compute(get, context) : getRaw(row, raw, context);
    if (!spec.compute) used.add(raw);
    if (spec.decode) value = spec.decode(value);
    for (const transform of spec.transforms ?? []) value = transform(value, context);
    if (spec.nullable !== undefined && context.random.boolean(spec.nullable)) value = null;
    Object.defineProperty(result, name, { value, enumerable: true, writable: true, configurable: true });
    active.delete(name);
    return value;
  };
  for (const name of Object.keys(columns)) get(name);
  return result;
}
function getRaw(row: Row, name: string, context: GeneratorContext): unknown {
  if (!Object.hasOwn(row, name)) throw new GenerationError('FEED', `Missing feed column ${name}`, context.path, context.random.seed);
  return row[name];
}
export const rows = (data: readonly Row[], options: FeedOptions = {}): Feed => new Feed(data, options);
export function readJson(source: string, options: FeedOptions = {}): Feed {
  const data: unknown = JSON.parse(source);
  if (!Array.isArray(data) || data.some(row => typeof row !== 'object' || row === null || Array.isArray(row))) throw new GenerationError('FEED', 'JSON feed must be an array of objects');
  return rows(data as Row[], options);
}
/** RFC 4180 quoting, escaped quotes, CRLF and multiline cells; no split-on-comma shortcut. */
export function readCsv(source: string, options: FeedOptions & { delimiter?: string; commentPrefix?: string; trim?: boolean } = {}): Feed {
  const delimiter = options.delimiter ?? ',';
  if (delimiter.length !== 1 || ['"', '\r', '\n'].includes(delimiter)) throw new GenerationError('FEED', 'CSV delimiter must be one non-quote character');
  const records: string[][] = [];
  let record: string[] = [], field = '', quoted = false, closed = false;
  const pushField = () => { record.push(options.trim === false ? field : field.trim()); field = ''; closed = false; };
  const pushRecord = () => { pushField(); if (record.some(v => v.length) && !(options.commentPrefix && record[0]?.startsWith(options.commentPrefix))) records.push(record); record = []; };
  const input = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (quoted) {
      if (c === '"') { if (input[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += c;
    } else if (c === delimiter) pushField();
    else if (c === '\n' || c === '\r') { if (c === '\r' && input[i + 1] === '\n') i++; pushRecord(); }
    else if (c === '"') { if (field.trim() || closed) throw new GenerationError('FEED', 'Unexpected CSV quote'); field = ''; quoted = true; }
    else if (closed && c.trim()) throw new GenerationError('FEED', 'Unexpected characters after quoted CSV cell');
    else field += c;
  }
  if (quoted) throw new GenerationError('FEED', 'Unclosed CSV quote');
  if (field || record.length || closed) pushRecord();
  const header = records.shift();
  if (!header?.length || header.some(v => !v) || new Set(header).size !== header.length) throw new GenerationError('FEED', 'CSV needs unique nonempty headers');
  return rows(records.map((cells, index) => {
    if (cells.length !== header.length) throw new GenerationError('FEED', `CSV row ${index + 2} has ${cells.length} cells; expected ${header.length}`);
    return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
  }), options);
}
export function writeCsv(data: readonly Row[], delimiter = ','): string {
  const headers = [...new Set(data.flatMap(row => Object.keys(row)))];
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return text.includes(delimiter) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.map(escape).join(delimiter), ...data.map(row => headers.map(key => escape(row[key])).join(delimiter))].join('\n');
}
