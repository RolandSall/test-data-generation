import type { Operation } from './operation.js';
export type { Operation } from './operation.js';
import { instruction } from './marker.js';
import type { GeneratorContext } from './generator.js';



export const value = <T>(input: T): Operation<T> =>
  Object.freeze({ [instruction]: 'value', value: input });

export const shared = <T>(input: T): Operation<T> =>
  Object.freeze({ [instruction]: 'shared', value: input });

export const fresh = <T>(factory: (context: GeneratorContext) => T): Operation<T> =>
  Object.freeze({ [instruction]: 'fresh' as const, factory });

export const populate = <T>(factory: (context: GeneratorContext) => T): Operation<T> =>
  Object.freeze({ [instruction]: 'populate' as const, factory });

export const omit = (): Operation<never> =>
  Object.freeze({ [instruction]: 'omit' as const });

export const blank = <T>(): Operation<T> =>
  Object.freeze({ [instruction]: 'blank' as const });

export const reference = <T>(target: string): Operation<T> =>
  Object.freeze({ [instruction]: 'reference' as const, target });
