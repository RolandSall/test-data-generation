import type { Issue } from './issue.js';
export type { Issue } from './issue.js';
import { Decimal, type Shape } from './shape.js';
import { getPath } from './path.js';

export function scalarIssues(node: Shape, value: unknown, now: Date): string[] {
  const c = node.constraints, issues: string[] = [];
  const fail = (condition: boolean, message: string) => { if (condition) issues.push(message); };
  if (node.kind === 'string') {
    if (typeof value !== 'string') return ['Expected string'];
    fail(value.length < (c.minLength ?? 0), 'String is too short'); fail(value.length > (c.maxLength ?? Infinity), 'String is too long');
    if (c.pattern) fail(!new RegExp(c.pattern.source, c.pattern.flags.replace(/[gy]/g, '')).test(value), 'String does not match pattern');
    if (c.format === 'email') fail(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Invalid email');
    if (c.format === 'uuid') fail(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), 'Invalid UUID');
    if (c.format === 'url') { try { new URL(value); } catch { issues.push('Invalid URL'); } }
  } else if (node.kind === 'number' || node.kind === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return ['Expected finite number'];
    fail(node.kind === 'integer' && !Number.isSafeInteger(value), 'Expected safe integer');
    fail(value < (c.min ?? -Infinity), 'Number below minimum'); fail(value > (c.max ?? Infinity), 'Number above maximum');
    if (c.multipleOf !== undefined) fail(Math.abs(value / c.multipleOf - Math.round(value / c.multipleOf)) > 1e-8, 'Not a multiple');
  } else if (node.kind === 'bigint') {
    fail(typeof value !== 'bigint', 'Expected bigint');
    if (typeof value === 'bigint') fail((c.bigMin !== undefined && value < c.bigMin) || (c.bigMax !== undefined && value > c.bigMax), 'Bigint outside range');
  }
  else if (node.kind === 'boolean') fail(typeof value !== 'boolean', 'Expected boolean');
  else if (node.kind === 'date') {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return ['Expected valid Date'];
    fail(value.getTime() < (c.min ?? -Infinity) || value.getTime() > (c.max ?? Infinity), 'Date outside range');
    fail(!!c.past && value.getTime() >= now.getTime(), 'Expected past date'); fail(!!c.future && value.getTime() <= now.getTime(), 'Expected future date');
  } else if (node.kind === 'bytes') {
    if (!(value instanceof Uint8Array)) return ['Expected bytes'];
    fail(value.length < (c.minLength ?? 0) || value.length > (c.maxLength ?? Infinity), 'Byte length outside range');
  } else if (node.kind === 'decimal') {
    if (!(value instanceof Decimal)) return ['Expected Decimal'];
    fail(c.scale !== undefined && value.scale !== c.scale, 'Unexpected decimal scale');
    fail(c.precision !== undefined && value.units.toString().replace('-', '').length > c.precision, 'Decimal exceeds precision');
  } else if (node.kind === 'literal' || node.kind === 'enum') fail(!node.values?.some(v => Object.is(v, value)), 'Value outside declared domain');
  return issues;
}
export function validateShape(node: Shape, value: unknown, now = new Date('2020-01-01'), path = '$', seen = new WeakMap<object, Set<Shape>>()): Issue[] {
  if (typeof value === 'object' && value !== null) {
    const shapes = seen.get(value) ?? new Set<Shape>();
    if (shapes.has(node)) return [];
    shapes.add(node); seen.set(value, shapes);
  }
  const issues = scalarIssues(node, value, now).map(message => ({ path, message }));
  const child = (s: Shape, v: unknown, key: string) => validateShape(s, v, now, `${path}.${key}`, seen);
  if (node.kind === 'lazy') issues.push(...validateShape(node.resolve!(), value, now, path, seen));
  else if (node.kind === 'optional' || node.kind === 'nullable') {
    if (!(node.kind === 'optional' && value === undefined) && !(node.kind === 'nullable' && value === null)) issues.push(...validateShape(node.element!, value, now, path, seen));
  } else if (node.kind === 'union') {
    const candidates = node.members!.map(member => validateShape(member, value, now, path, new WeakMap()));
    if (!candidates.some(candidate => !candidate.length)) issues.push({ path, message: 'No union member matched' });
  } else if (node.kind === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) issues.push({ path, message: 'Expected object' });
    else for (const [key, member] of Object.entries(node.fields!)) issues.push(...child(member, getPath(value, key), key));
  } else if (['array', 'tuple', 'set', 'map', 'record'].includes(node.kind)) {
    const valid = node.kind === 'set' ? value instanceof Set : node.kind === 'map' ? value instanceof Map : node.kind === 'record' ? typeof value === 'object' && value !== null && !Array.isArray(value) : Array.isArray(value);
    if (!valid) issues.push({ path, message: `Expected ${node.kind}` });
    else {
      const entries: [unknown, unknown][] = value instanceof Map ? [...value.entries()] : value instanceof Set ? [...value].map((v, i) => [i, v]) : Object.entries(value as object);
      const c = node.constraints;
      if (entries.length < (c.minSize ?? 0) || entries.length > (c.maxSize ?? Infinity)) issues.push({ path, message: 'Collection size outside range' });
      if (node.kind === 'tuple' && entries.length !== node.members!.length) issues.push({ path, message: 'Unexpected tuple length' });
      if (c.unique && new Set(entries.map(([, v]) => stableKey(v))).size !== entries.length) issues.push({ path, message: 'Collection elements are not unique' });
      for (const [key, item] of entries) {
        if (node.kind === 'map') issues.push(...child(node.key!, key, 'key'));
        const member = node.kind === 'tuple' ? node.members![Number(key)] : node.element;
        if (member) issues.push(...child(member, item, String(key)));
      }
    }
  }
  issues.push(...(node.validate?.(value) ?? []).map(message => ({ path, message })));
  return issues;
}
export function stableKey(value: unknown): string {
  const active = new WeakSet<object>();
  const encode = (v: unknown): unknown => {
    if (v === null) return ['null'];
    if (typeof v !== 'object') return [typeof v, typeof v === 'bigint' ? v.toString() : v];
    if (active.has(v)) throw new TypeError('Cannot structurally compare cyclic values; supply a uniqueness key');
    active.add(v);
    try {
      if (v instanceof Date) return ['date', v.toISOString()];
      if (v instanceof Uint8Array) return ['bytes', [...v]];
      if (v instanceof Map) return ['map', [...v].map(([k, value]) => [encode(k), encode(value)])];
      if (v instanceof Set) return ['set', [...v].map(encode)];
      if (Array.isArray(v)) return ['array', v.map(encode)];
      return ['object', Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => [k, encode(value)])];
    } finally { active.delete(v); }
  };
  return JSON.stringify(encode(value));
}
