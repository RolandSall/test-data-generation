import type { Shape } from '../shape.js';
import { GenerationError } from '../error.js';

/** Look through wrappers without looping on recursive lazy/union descriptors. */
function hasPath(node: Shape, parts: readonly string[], seen: ReadonlySet<Shape> = new Set()): boolean {
  if (!parts.length) return true;
  if (seen.has(node)) return false;
  const visited = new Set(seen).add(node);
  if (node.kind === 'object') {
    const child = Object.hasOwn(node.fields ?? {}, parts[0]!) ? node.fields![parts[0]!] : undefined;
    return !!child && hasPath(child, parts.slice(1));
  }
  if (node.kind === 'union') return node.members?.some(member => hasPath(member, parts, visited)) ?? false;
  if (node.kind === 'lazy') return !!node.resolve && hasPath(node.resolve(), parts, visited);
  if (['optional', 'nullable', 'transform'].includes(node.kind)) return !!node.element && hasPath(node.element, parts, visited);
  return false;
}

export function checkSelectionPath(model: Shape, path: string): void {
  if (!hasPath(model, path.split('.'))) {
    throw new GenerationError('CONFIGURATION', `Unknown selectable field ${path}; declare it in the runtime shape`, path);
  }
}
