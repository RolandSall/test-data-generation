import { GenerationError } from '../error.js';
import { write } from '../path.js';
import { computeFields } from './computed.js';
import { decodeColumn, projectFeed } from './feed-projection.js';
import { GraphReference } from './references.js';
import type { GraphState } from './graph-state.js';
import type { BuildRequest, NodeTraversal } from './types.js';

export function buildObject(state: GraphState, traversal: NodeTraversal, request: BuildRequest): unknown {
  const { node, path, depth, index, fields, existing, config, blank } = request;
  const { seed, options } = state.session;
  const parent = state.parents.get(node);
  if (parent !== undefined && existing === undefined) {
    return options.cycle === 'reference' ? new GraphReference(parent) : state.cutoff(path);
  }
  const data = typeof existing === 'object' && existing !== null ? existing : {};
  if (Object.isFrozen(data) && (fields || state.mode !== 'rules')) {
    throw new GenerationError('CONSTRUCTION', 'Cannot populate frozen object', path, seed);
  }
  if (path === '$') state.root = data;
  const declared = node.fields ?? {};
  for (const key of Object.keys(fields ?? {})) {
    if (!Object.hasOwn(declared, key)) throw new GenerationError('CONFIGURATION', 'Unknown field ' + key, path, seed);
  }
  for (const key of Object.keys(config?.computed ?? {})) {
    if (!Object.hasOwn(declared, key)) throw new GenerationError('CONFIGURATION', 'Unknown computed field ' + key, path, seed);
    if (Object.hasOwn(fields ?? {}, key)) throw new GenerationError('DEPENDENCY', 'Field ' + key + ' is both computed and overridden', path, seed);
  }
  const feed = projectFeed(config, declared, state.context(request), blank);
  state.parents.set(node, path);
  try {
    for (const [key, member] of Object.entries(declared)) {
      if (Object.hasOwn(config?.computed ?? {}, key)) continue;
      const hasExisting = Object.hasOwn(data, key);
      const existingValue = hasExisting ? (data as Record<string, unknown>)[key] : undefined;
      const hasInput = Object.hasOwn(fields ?? {}, key);
      const hasFeed = Object.hasOwn(feed, key);
      const memberPath = path + '.' + key;
      const input = hasInput ? fields![key] : hasFeed ? decodeColumn(member, feed[key], memberPath, seed) : undefined;
      const location = { node: member, path: memberPath, depth: depth + 1, index };
      const output = blank && !hasInput
        ? traversal.blankNode(location)
        : traversal.visit({ ...location, input, existing: existingValue, provided: hasExisting });
      if (output !== undefined || hasExisting || hasInput) write(data, key, output);
    }
    if (state.mode !== 'blank' && !blank) computeFields(data, config, path, seed);
    const output = node.factory && existing === undefined ? constructInstance(request, data, seed) : data;
    if (path === '$') state.root = output;
    return output;
  } finally {
    state.parents.delete(node);
  }
}

function constructInstance(request: BuildRequest, data: object, seed: number | string): object {
  const { node, fields, path } = request;
  let output: object;
  try {
    output = node.factory!(data as Record<string, unknown>) as object;
  } catch (cause) {
    throw new GenerationError('CONSTRUCTION', 'Class factory failed', path, seed, { cause });
  }
  for (const [key, value] of Object.entries(data)) {
    const setter = node.setters?.[key];
    if (setter) setter(output, value);
    else if (!Object.hasOwn(output, key) || Object.hasOwn(fields ?? {}, key)) write(output, key, value);
  }
  return output;
}
