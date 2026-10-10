import * as core from 'zod/v4/core';

/** Validate parsed values without feeding them back through input transformations. */
export function createOutputSchemaReader() {
  const cache = new WeakMap<core.$ZodType, core.$ZodType>();
  const read = (source: core.$ZodType): core.$ZodType => {
    const cached = cache.get(source); if (cached) return cached;
    let output: core.$ZodType;
    cache.set(source, new core.$ZodLazy({ type: 'lazy', getter: () => output }));
    const definition = (source as core.$ZodTypes)._zod.def;
    const replacement: Record<string, unknown> = {};
    switch (definition.type) {
      case 'pipe': {
        output = read(definition.out);
        if (definition.checks?.length) output = copy(output, { checks: [...output._zod.def.checks ?? [], ...definition.checks] });
        cache.set(source, output); return output;
      }
      case 'transform':
        output = new core.$ZodUnknown({ type: 'unknown', ...(definition.checks ? { checks: definition.checks } : {}) });
        cache.set(source, output); return output;
      case 'object': replacement.shape = Object.fromEntries(Object.entries(definition.shape).map(([key, child]) => [key, read(child)]));
        if (definition.catchall) replacement.catchall = read(definition.catchall); break;
      case 'array': replacement.element = read(definition.element); break;
      case 'tuple': replacement.items = definition.items.map(read); if (definition.rest) replacement.rest = read(definition.rest); break;
      case 'map': replacement.keyType = read(definition.keyType); replacement.valueType = read(definition.valueType); break;
      case 'record': replacement.keyType = read(definition.keyType); replacement.valueType = read(definition.valueType); break;
      case 'set': replacement.valueType = read(definition.valueType); break;
      case 'union': replacement.options = definition.options.map(read); break;
      case 'intersection': replacement.left = read(definition.left); replacement.right = read(definition.right); break;
      case 'lazy': replacement.getter = () => read(definition.getter()); break;
      case 'optional': case 'nullable': case 'default': case 'prefault': case 'catch': case 'nonoptional': case 'readonly':
        replacement.innerType = read(definition.innerType); break;
    }
    // Overwrites are parsing operations; validation must not run them again.
    if (definition.checks) replacement.checks = definition.checks.filter(check => check._zod.def.check !== 'overwrite');
    output = copy(source, replacement);
    cache.set(source, output); return output;
  };
  return read;
}

function copy(source: core.$ZodType, replacement: Record<string, unknown>): core.$ZodType {
  // Preserve deferred default getters instead of evaluating them during extraction.
  const definition = Object.create(Object.getPrototypeOf(source._zod.def), Object.getOwnPropertyDescriptors(source._zod.def)) as core.$ZodType['_zod']['def'];
  for (const [key, value] of Object.entries(replacement)) Object.defineProperty(definition, key, { value, enumerable: true, configurable: true });
  return core.util.clone(source, definition);
}
