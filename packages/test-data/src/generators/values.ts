import RandExp from 'randexp';
import { createHash } from 'node:crypto';
import { generator, type Generator, type GeneratorContext } from '../core/instructions.js';
import { Decimal } from '../core/shape.js';
import { Random, type Seed } from '../core/random.js';
export const integer = ({ min = 1, max = 10000 }: { min?: number; max?: number } = {}): Generator<number> => generator(c => c.random.int(min, max), max - min + 1);
export const number = ({ min = 1, max = 10000 }: { min?: number; max?: number } = {}): Generator<number> => generator(c => c.random.float(min, max));
export const bigint = ({ min = 1n, max = 10000n }: { min?: bigint; max?: bigint } = {}): Generator<bigint> => generator(c => c.random.bigint(min, max));
export const boolean = (probability = 0.5): Generator<boolean> => generator(c => c.random.boolean(probability), 2);
export const oneOf = <T>(values: readonly T[]): Generator<T> => generator(c => c.random.pick(values), values.length);
export function weighted<T>(values: readonly { value: T; weight: number }[]): Generator<T> {
  if (!values.length || values.some(v => !Number.isFinite(v.weight) || v.weight < 0) || values.reduce((s, v) => s + v.weight, 0) <= 0) throw new RangeError('Invalid weights');
  return generator(c => {
    let weight = c.random.float(0, values.reduce((s, v) => s + v.weight, 0));
    for (const entry of values) { weight -= entry.weight; if (weight < 0) return entry.value; }
    return values.at(-1)!.value;
  }, values.length);
}
export const text = ({ length, min = 3, max = 10, alphabet }: { length?: number; min?: number; max?: number; alphabet?: string } = {}): Generator<string> =>
  generator(c => c.random.text(length ?? c.random.int(min, max), alphabet));
export const character = (alphabet?: string): Generator<string> => text({ length: 1, ...(alphabet === undefined ? {} : { alphabet }) });
export const bytes = ({ length, min = 3, max = 10 }: { length?: number; min?: number; max?: number } = {}): Generator<Uint8Array> =>
  generator(c => { const count = length ?? c.random.int(min, max); if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Invalid byte length'); return Uint8Array.from({ length: count }, () => c.random.int(0, 255)); });
export const uuid = (): Generator<string> => generator(c => {
  const bytes = Array.from({ length: 16 }, () => c.random.int(0, 255));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = bytes.map(v => v.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
});
export const email = (): Generator<string> => generator(c => `${c.random.text(8, 'abcdefghijklmnopqrstuvwxyz')}@${c.random.text(6, 'abcdefghijklmnopqrstuvwxyz')}.test`);
export const url = ({ protocol = 'https', host = 'example.test', port }: { protocol?: string; host?: string; port?: number } = {}): Generator<string> =>
  generator(c => `${protocol}://${host}${port === undefined ? '' : `:${port}`}/${c.random.text(8, 'abcdefghijklmnopqrstuvwxyz')}`);
export const ipv4 = (): Generator<string> => generator(c => Array.from({ length: 4 }, () => c.random.int(0, 255)).join('.'));
export const date = ({ min, max, past, future }: { min?: Date; max?: Date; past?: boolean; future?: boolean } = {}): Generator<Date> => generator(c => {
  if (past && future) throw new RangeError('A date cannot be both past and future');
  const window = 100 * 366 * 86400000;
  const low = Math.max(min?.getTime() ?? (past ? c.now.getTime() - window : Date.UTC(2000, 0, 1)), future ? c.now.getTime() + 1 : -Infinity);
  const high = Math.min(max?.getTime() ?? (future ? c.now.getTime() + window : Date.UTC(2100, 0, 1)), past ? c.now.getTime() - 1 : Infinity);
  return new Date(c.random.int(low, high));
});
export const duration = (options: { min?: number; max?: number } = {}): Generator<number> => integer(options);
export const decimal = ({ precision = 8, scale = 2, min, max }: { precision?: number; scale?: number; min?: Decimal; max?: Decimal } = {}): Generator<Decimal> => {
  if (!Number.isInteger(precision) || precision < 1 || precision > 100 || scale > precision || scale < 0 || !Number.isInteger(scale)) throw new RangeError('Invalid decimal precision/scale');
  const convert = (v: Decimal): bigint => {
    if (v.scale > scale) throw new RangeError('Decimal bound exceeds requested scale');
    return v.units * 10n ** BigInt(scale - v.scale);
  };
  return generator(c => new Decimal(c.random.bigint(min ? convert(min) : 0n, max ? convert(max) : 10n ** BigInt(precision) - 1n), scale));
};
export const regex = (expression: RegExp, maxRepeat = 20): Generator<string> => generator(c => {
  const rand = new RandExp(expression);
  rand.max = maxRepeat;
  rand.randInt = (min: number, max: number) => c.random.int(min, max);
  const value = rand.gen();
  if (!new RegExp(expression.source, expression.flags.replace(/[gy]/g, '')).test(value)) throw new RangeError('Regex could not be generated; provide a custom generator for lookarounds/backreferences');
  return value;
});
export const pattern = (template: string): Generator<string> => generator(c => template.replace(/#(.)/g, (_match: string, token: string) => {
  const alphabets: Record<string, string> = { a: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', c: 'abcdefghijklmnopqrstuvwxyz', C: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', d: '0123456789', h: '0123456789abcdef', H: '0123456789ABCDEF', '#': '#' };
  const alphabet = alphabets[token]; if (!alphabet) throw new RangeError(`Unknown pattern token #${token}`);
  return c.random.text(1, alphabet);
}));
export function sequence({ start = 1, step = 1 }: { start?: number; step?: number } = {}): Generator<number> {
  const key = {};
  return generator(c => { const counter = c.state(key, () => ({ value: start })); const value = counter.value; counter.value += step; return value; });
}
export function emit<T>(items: readonly T[], { onEnd = 'fail' }: { onEnd?: 'fail' | 'cycle' } = {}): Generator<T> {
  if (!items.length) throw new RangeError('Emit needs values');
  const key = {};
  return generator(c => {
    const counter = c.state(key, () => ({ index: 0 }));
    if (counter.index >= items.length && onEnd === 'fail') throw new RangeError('Emit source exhausted');
    return items[counter.index++ % items.length]!;
  });
}
export const mapValue = <T, R>(input: Generator<T>, map: (value: T, context: GeneratorContext) => R): Generator<R> => generator(c => map(input.generate(c), c));
export const nullable = <T>(input: Generator<T>, probability = 0.2): Generator<T | null> => generator(c => c.random.boolean(probability) ? null : input.generate(c));
export const optional = <T>(input: Generator<T>, probability = 0.2): Generator<T | undefined> => generator(c => c.random.boolean(probability) ? undefined : input.generate(c));
export const interval = (start: Date, { min = 1, max = 86400000 }: { min?: number; max?: number } = {}): Generator<{ start: Date; end: Date }> => generator(c => {
  if (!Number.isFinite(start.getTime()) || min < 0) throw new RangeError('Invalid interval bounds');
  return { start: new Date(start), end: new Date(start.getTime() + c.random.int(min, max)) };
});
export const shuffled = <T>(items: readonly T[]): Generator<T[]> => generator(c => c.random.shuffle(items));
export const hash = (algorithm: 'sha256' | 'sha512' | 'md5' = 'sha256'): Generator<string> => generator(c => createHash(algorithm).update(c.random.text(40)).digest('hex'));
export const coordinate = (): Generator<{ latitude: number; longitude: number }> => generator(c => ({ latitude: c.random.float(-90, 90), longitude: c.random.float(-180, 180) }));
const words = ['river', 'garden', 'window', 'bright', 'quiet', 'morning', 'story', 'cloud'];
export const word = (): Generator<string> => oneOf(words);
export const lorem = (count = 10): Generator<string> => generator(c => Array.from({ length: count }, () => c.random.pick(words)).join(' '));
export const wordTemplate = (template: string): Generator<string> => generator(c => template.replace(/\{word\}/g, () => c.random.pick(words)));
export function sample<T>(input: Generator<T>, options: { seed?: Seed; now?: Date | string; count?: number } = {}): T[] {
  if (!Number.isSafeInteger(options.count ?? 1) || (options.count ?? 1) < 0) throw new RangeError('Count must be a nonnegative safe integer');
  const state = new Map<object, unknown>();
  const c: GeneratorContext = { random: new Random(options.seed ?? 1), now: new Date(options.now ?? '2020-01-01T00:00:00Z'), path: '$', index: 0, root: undefined,
    state: <V>(key: object, init: () => V): V => { if (!state.has(key)) state.set(key, init()); return state.get(key) as V; } };
  if (!Number.isFinite(c.now.getTime())) throw new RangeError('Invalid clock');
  return Array.from({ length: options.count ?? 1 }, (_, index) => input.generate({ ...c, index }));
}
