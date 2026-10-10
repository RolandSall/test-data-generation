import { GenerationError } from '../error.js';

const message = 'Property selector must return a single field access, for example model => model.customer.name';
const invalid = () => new GenerationError('CONFIGURATION', message);

/** Record property access without constructing a model or invoking its getters. */
export function propertyPath<Model>(accessor: (model: Model) => unknown): string {
  const paths = new WeakMap<object, readonly string[]>();
  const recorded: string[][] = [];
  const proxy = (path: readonly string[]): object => {
    const token = new Proxy(Object.create(null) as object, {
      get: (_target, key) => {
        if (typeof key !== 'string') throw invalid();
        const child = [...path, key];
        recorded.push(child);
        return proxy(child);
      },
      set: () => { throw invalid(); },
      deleteProperty: () => { throw invalid(); },
      defineProperty: () => { throw invalid(); },
      has: () => { throw invalid(); },
      ownKeys: () => { throw invalid(); },
      getOwnPropertyDescriptor: () => { throw invalid(); },
      getPrototypeOf: () => { throw invalid(); },
    });
    paths.set(token, path);
    return token;
  };
  try {
    const selected = accessor(proxy([]) as Model);
    const path = typeof selected === 'object' && selected !== null ? paths.get(selected) : undefined;
    if (!path?.length || recorded.some(read => read.some((part, index) => path[index] !== part))) throw invalid();
    return path.join('.');
  } catch (cause) {
    if (cause instanceof GenerationError) throw cause;
    throw new GenerationError('CONFIGURATION', message, '$', undefined, { cause });
  }
}
