import type { GeneratorContext } from './generator-context.js';
export type { GeneratorContext } from './generator-context.js';
import { instruction } from './marker.js';


export interface Generator<T> {
  readonly [instruction]: 'generator';
  readonly generate: (context: GeneratorContext) => T;
  readonly domainSize?: number;
}

export function generator<T>(generate: (context: GeneratorContext) => T, domainSize?: number): Generator<T> {
  return Object.freeze({
    [instruction]: 'generator' as const,
    generate,
    ...(domainSize === undefined ? {} : { domainSize }),
  });
}
