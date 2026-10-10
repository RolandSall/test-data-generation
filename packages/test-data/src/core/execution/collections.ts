import { OMITTED } from './omitted.js';
import { GenerationError } from '../error.js';
import type { Shape } from '../shape.js';
import { stableKey } from '../validation.js';
import type { GraphState } from './graph-state.js';
import type { BuildRequest, NodeTraversal } from './types.js';

export function buildCollection(state: GraphState, traversal: NodeTraversal, request: BuildRequest): unknown {
  const { node, path, depth, existing, blank } = request;
  if (existing !== undefined && !blank) {
    const preserved = populateExisting(traversal, request);
    if (preserved !== undefined) return preserved;
  }
  const count = collectionSize(state, request);
  const output: unknown[] = [];
  const keys = new Set<string>();
  const map = new Map<unknown, unknown>();
  const distinct = node.kind === 'set' || node.constraints.unique || node.kind === 'map' || node.kind === 'record';
  for (let index = 0; index < count; index++) {
    let accepted = false;
    for (let attempt = 0; attempt < state.session.options.maxAttempts; attempt++) {
      const checkpoint = state.effects.checkpoint();
      const key = collectionKey(state, traversal, request, index);
      const element = node.kind === 'tuple' ? node.members![index]! : node.element!;
      const valuePath = node.kind === 'record' ? path + '.' + String(key)
        : node.kind === 'map' ? path + '.' + index + '.value' : path + '.' + index;
      const generated = traversal.visit({ node: element, path: valuePath, depth: depth + 1, index });
      const value = generated === OMITTED ? undefined : generated;
      const identity = node.kind === 'map' || node.kind === 'record' ? stableKey(key) : distinct ? stableKey(value) : '';
      if (distinct && keys.has(identity)) {
        state.effects.rollback(checkpoint);
        continue;
      }
      keys.add(identity);
      output.push(value);
      if (node.kind === 'map' || node.kind === 'record') map.set(key, value);
      accepted = true;
      break;
    }
    if (!accepted) {
      throw new GenerationError('RETRY_EXHAUSTED', 'Could not satisfy collection size/uniqueness', path, state.session.seed);
    }
  }
  if (node.kind === 'map') return map;
  if (node.kind === 'record') return Object.fromEntries(map.entries());
  return node.kind === 'set' ? new Set(output) : output;
}

function populateExisting(traversal: NodeTraversal, request: BuildRequest): unknown {
  const { node, path, depth, index, existing } = request;
  const element = (value: unknown, i: number, member = node.element!, memberPath = path + '.' + i) =>
    normalizeOmission(traversal.visit({ node: member, path: memberPath, depth: depth + 1, index: i, existing: value, provided: true }));
  if (Array.isArray(existing)) {
    return existing.map((value: unknown, i) => element(value, i, node.kind === 'tuple' ? node.members![i]! : node.element!));
  }
  if (existing instanceof Set) return new Set([...existing].map((value: unknown, i) => element(value, i)));
  if (existing instanceof Map) {
    return new Map([...existing.entries()].map(([key, value]: [unknown, unknown], i) =>
      [key, element(value, i, node.element!, path + '.' + i + '.value')],
    ));
  }
  if (node.kind === 'record' && typeof existing === 'object' && existing !== null) {
    return Object.fromEntries(Object.entries(existing).map(([key, value]) =>
      [key, element(value, index, node.element!, path + '.' + key)],
    ));
  }
  return undefined;
}

function finiteDomain(node: Shape): readonly unknown[] | undefined {
  if (node.values) return node.values;
  if (node.kind === 'boolean') return [false, true];
  if (node.kind === 'union' && node.members!.every(member => finiteDomain(member))) {
    return node.members!.flatMap(member => [...finiteDomain(member)!]);
  }
  return undefined;
}

function collectionSize(state: GraphState, request: BuildRequest): number {
  const { node, path, blank } = request;
  const domain = node.kind === 'map' || node.kind === 'record'
    ? node.key && finiteDomain(node.key)?.length : node.element ? finiteDomain(node.element)?.length : undefined;
  const distinct = node.kind === 'set' || node.kind === 'map' || node.kind === 'record' ||
    (node.kind === 'array' && node.constraints.unique);
  const min = node.constraints.minSize ?? (distinct && domain !== undefined ? Math.min(2, domain) : 2);
  const max = node.constraints.maxSize ?? (distinct && domain !== undefined ? Math.max(min, Math.min(6, domain)) : Math.max(min, 6));
  const count = blank ? 0 : node.kind === 'tuple' ? node.members!.length : state.session.random.int(min, max);
  if (distinct && domain !== undefined && count > domain) {
    throw new GenerationError('CONSTRAINT', 'Requested ' + count + ' distinct values from a domain of ' + domain, path, state.session.seed);
  }
  return count;
}

function collectionKey(state: GraphState, traversal: NodeTraversal, request: BuildRequest, index: number): unknown {
  const { node, path, depth } = request;
  if (node.kind === 'map' || node.kind === 'record' && node.key) {
    const key = traversal.visit({ node: node.key!, path: path + '.' + index + '.key', depth: depth + 1, index });
    const normalized = normalizeOmission(key);
    return node.kind === 'record' ? String(normalized) : normalized;
  }
  return node.kind === 'record' ? state.session.random.text(8) : undefined;
}

function normalizeOmission(value: unknown): unknown { return value === OMITTED ? undefined : value; }
