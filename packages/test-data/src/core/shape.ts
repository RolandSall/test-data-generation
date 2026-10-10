import type { Constraints } from './constraints.js';
export type { Constraints } from './constraints.js';
export type Kind = 'string' | 'number' | 'integer' | 'bigint' | 'boolean' | 'date' | 'decimal' | 'bytes' | 'literal' | 'enum' | 'object' | 'array' | 'tuple' | 'set' | 'map' | 'record' | 'union' | 'lazy' | 'optional' | 'nullable' | 'reference' | 'custom' | 'transform';

export interface Shape<T = unknown> {
  readonly kind: Kind;
  readonly constraints: Readonly<Constraints>;
  readonly fields?: Readonly<Record<string, Shape>>;
  readonly element?: Shape;
  readonly key?: Shape;
  readonly members?: readonly Shape[];
  readonly values?: readonly unknown[];
  readonly resolve?: () => Shape;
  readonly target?: string;
  readonly factory?: (values: Record<string, unknown>) => unknown;
  readonly setters?: Readonly<Record<string, (object: unknown, value: unknown) => void>>;
  readonly validate?: (value: unknown) => readonly string[];
  readonly decode?: (value: unknown) => unknown;
  readonly transform?: (value: unknown) => unknown;
  readonly defaultValue?: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly __type?: T;
}
export type Infer<S extends Shape> = S extends Shape<infer T> ? T : never;
type ObjectType<P extends Record<string, Shape>> =
  { [K in keyof P as undefined extends Infer<P[K]> ? never : K]: Infer<P[K]> } &
  { [K in keyof P as undefined extends Infer<P[K]> ? K : never]?: Exclude<Infer<P[K]>, undefined> };
function node<T>(kind: Kind, constraints: Constraints = {}, extra: Partial<Shape<T>> = {}): Shape<T> {
  return Object.freeze({ kind, constraints: Object.freeze({ ...constraints }), ...extra });
}
export const shape = {
  string: (c: Constraints = {}): Shape<string> => node('string', c),
  number: (c: Constraints = {}): Shape<number> => node('number', c),
  integer: (c: Constraints = {}): Shape<number> => node('integer', c),
  bigint: (c: Constraints = {}): Shape<bigint> => node('bigint', c),
  boolean: (): Shape<boolean> => node('boolean'),
  date: (c: Constraints = {}): Shape<Date> => node('date', c),
  bytes: (c: Constraints = {}): Shape<Uint8Array> => node('bytes', c),
  literal: <const T>(value: T): Shape<T> => node('literal', {}, { values: [value] }),
  enum: <const T>(values: readonly T[]): Shape<T> => {
    if (!values.length) throw new RangeError('An enum needs at least one value');
    return node('enum', {}, { values: Object.freeze([...values]) });
  },
  object: <P extends Record<string, Shape>>(fields: P): Shape<ObjectType<P>> => node('object', {}, { fields: Object.freeze({ ...fields }) }),
  array: <T>(element: Shape<T>, c: Constraints = {}): Shape<T[]> => node('array', c, { element }),
  set: <T>(element: Shape<T>, c: Constraints = {}): Shape<Set<T>> => node('set', c, { element }),
  map: <K, V>(key: Shape<K>, element: Shape<V>, c: Constraints = {}): Shape<Map<K, V>> => node('map', c, { key, element }),
  record: <T>(element: Shape<T>, c: Constraints = {}, key?: Shape): Shape<Record<string, T>> => node('record', c, { element, ...(key ? { key } : {}) }),
  tuple: <const S extends readonly Shape[]>(members: S): Shape<{ -readonly [K in keyof S]: Infer<S[K]> }> => node('tuple', {}, { members: Object.freeze([...members]) }),
  union: <const S extends readonly Shape[]>(members: S): Shape<Infer<S[number]>> => {
    if (!members.length) throw new RangeError('A union needs at least one member');
    return node('union', {}, { members: Object.freeze([...members]) });
  },
  lazy: <T>(resolve: () => Shape<T>): Shape<T> => node('lazy', {}, { resolve }),
  optional: <T>(element: Shape<T>): Shape<T | undefined> => node('optional', {}, { element }),
  nullable: <T>(element: Shape<T>): Shape<T | null> => node('nullable', {}, { element }),
  reference: <T>(path: string): Shape<T> => node('reference', {}, { target: path }),
  transform: <I, O>(element: Shape<I>, transform: (value: I) => O): Shape<O> => node('transform', {}, { element, transform: transform as (value: unknown) => unknown }),
  custom: <T>(validate: (value: unknown) => readonly string[] = () => []): Shape<T> => node('custom', {}, { validate }),
  class: <T>(fields: Record<string, Shape>, factory: (values: Record<string, unknown>) => T,
    setters: Record<string, (object: unknown, value: unknown) => void> = {}): Shape<T> =>
    node('object', {}, { fields: Object.freeze({ ...fields }), factory, setters: Object.freeze({ ...setters }) }),
};
export function constrain<T>(input: Shape<T>, constraints: Constraints): Shape<T> {
  return Object.freeze({ ...input, constraints: Object.freeze({ ...input.constraints, ...constraints }) });
}
export function annotate<T>(input: Shape<T>, metadata: Record<string, unknown>): Shape<T> {
  return Object.freeze({ ...input, metadata: Object.freeze({ ...input.metadata, ...metadata }) });
}
export function refine<T>(input: Shape<T>, predicate: (value: T) => boolean, message: string): Shape<T> {
  return Object.freeze({ ...input, validate: (value: unknown) => [
    ...(input.validate?.(value) ?? []), ...(predicate(value as T) ? [] : [message]),
  ] });
}
/** BigInt-backed fixed-scale decimal. Avoids losing precision through Number. */
export class Decimal {
  constructor(readonly units: bigint, readonly scale: number) {
    if (!Number.isSafeInteger(scale) || scale < 0 || scale > 100) throw new RangeError('Invalid decimal scale');
  }
  static parse(value: string): Decimal {
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
    if (!match) throw new RangeError('Invalid decimal');
    const fraction = match[3] ?? '';
    return new Decimal(BigInt(`${match[1]}${match[2]}${fraction}`), fraction.length);
  }
  toString(): string {
    const sign = this.units < 0n ? '-' : '';
    const digits = (this.units < 0n ? -this.units : this.units).toString().padStart(this.scale + 1, '0');
    return sign + (this.scale ? `${digits.slice(0, -this.scale)}.${digits.slice(-this.scale)}` : digits);
  }
  toJSON(): string { return this.toString(); }
  compare(other: Decimal): number {
    const scale = Math.max(this.scale, other.scale);
    const diff = this.units * 10n ** BigInt(scale - this.scale) - other.units * 10n ** BigInt(scale - other.scale);
    return diff < 0n ? -1 : diff > 0n ? 1 : 0;
  }
}
export function decimalShape(c: Constraints = {}): Shape<Decimal> { return node('decimal', c); }
