import { GenerationError } from './error.js';
import { isInstruction, type Match } from './instructions.js';
import { Decimal, type Shape } from './shape.js';
export function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isInstruction(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
export function getPath(root: unknown, path: string): unknown {
  if (path === '$' || path === '') return root;
  return path.replace(/^\$\./, '').split('.').reduce<unknown>((value, key) => {
    if (value instanceof Map) { const entry = [...value][Number(key)]; return entry ? { key: entry[0], value: entry[1] } : undefined; }
    if (value instanceof Set) return [...value][Number(key)];
    return typeof value === 'object' && value !== null && Object.hasOwn(value, key) ? (value as Record<string, unknown>)[key] : undefined;
  }, root);
}
export function setPath(root: unknown, path: string, value: unknown): void {
  const keys = path.replace(/^\$\./, '').split('.');
  const key = keys.pop()!;
  const map = keys.length > 0 ? getPath(root, keys.slice(0, -1).join('.')) : undefined;
  if (map instanceof Map && (key === 'key' || key === 'value')) {
    const entries = [...map], index = Number(keys.at(-1)), entry = entries[index];
    if (!entry) throw new GenerationError('DEPENDENCY', 'Missing map entry', path);
    if (key === 'key' && value !== entry[0] && map.has(value)) throw new GenerationError('CONSTRAINT', 'Completion produced duplicate map key', path);
    entries[index] = key === 'key' ? [value, entry[1]] : [entry[0], value];
    map.clear(); for (const [k, v] of entries) map.set(k, v);
    return;
  }
  const object = keys.length ? getPath(root, keys.join('.')) : root;
  if (typeof object !== 'object' || object === null || Object.isFrozen(object)) throw new GenerationError('DEPENDENCY', 'Cannot write derived field', path);
  if (object instanceof Set) {
    const entries = [...object], index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= entries.length) throw new GenerationError('DEPENDENCY', 'Missing set element', path);
    if (value !== entries[index] && object.has(value)) throw new GenerationError('CONSTRAINT', 'Completion produced duplicate set element', path);
    entries[index] = value; object.clear(); for (const v of entries) object.add(v);
    return;
  }
  write(object, key, value);
}
export function write(object: object, key: string, value: unknown): void {
  Object.defineProperty(object, key, { value, writable: true, enumerable: true, configurable: true });
}
export function clone<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value) as T;
  if (value instanceof Date) return new Date(value) as T;
  if (value instanceof Decimal) return new Decimal(value.units, value.scale) as T;
  if (value instanceof Uint8Array) return (Buffer.isBuffer(value) ? Buffer.from(value) : value.slice()) as T;
  if (value instanceof Map) {
    const output = new Map<unknown, unknown>(); seen.set(value, output);
    for (const [k, v] of value as Map<unknown, unknown>) output.set(clone(k, seen), clone(v, seen));
    return output as T;
  }
  if (value instanceof Set) { const output = new Set<unknown>(); seen.set(value, output); for (const v of value as Set<unknown>) output.add(clone(v, seen)); return output as T; }
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (!Array.isArray(value) && prototype !== null && prototype !== Object.prototype) throw new GenerationError('CONSTRUCTION', 'Opaque instances require shared() or fresh(); copying cannot preserve private state');
  const output: object = Array.isArray(value) ? [] : Object.create(prototype);
  seen.set(value, output);
  for (const key of Object.keys(value)) write(output, key, clone((value as Record<string, unknown>)[key], seen));
  return output as T;
}
export function matches(match: Match, node: Shape, path: string, depth: number, index: number): boolean {
  const local = path.replace(/^\$\.?/, '');
  if (match.path) {
    const pattern = match.path.replace(/^\$\.?/, '').split('.');
    const parts = local.split('.');
    if ((!local && match.path !== '$') || pattern.length !== parts.length || pattern.some((p, i) => p !== '*' && p !== parts[i])) return false;
  }
  if (match.kind && match.kind !== node.kind) return false;
  if (match.under && local !== match.under && !local.startsWith(`${match.under}.`)) return false;
  if (match.depth !== undefined && !(typeof match.depth === 'function' ? match.depth(depth) : match.depth === depth)) return false;
  if (match.index !== undefined && !(typeof match.index === 'function' ? match.index(index) : Array.isArray(match.index) ? match.index.includes(index) : match.index === index)) return false;
  if (match.metadata && Object.entries(match.metadata).some(([k, v]) => node.metadata?.[k] !== v)) return false;
  return !match.predicate || match.predicate(node, path);
}
export function specificity(match: Match): number {
  return (match.path ? 100 + match.path.split('.').filter(k => k !== '*').length : 0) + (match.index !== undefined ? 200 : 0) + (match.under ? 20 : 0) + (match.depth !== undefined ? 10 : 0);
}
