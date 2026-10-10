import type { instruction } from './marker.js';
import type { GeneratorContext } from './generator-context.js';

type OperationKind = 'value' | 'shared' | 'fresh' | 'populate' | 'omit' | 'blank' | 'reference';

export interface Operation<T> {
  readonly [instruction]: OperationKind;
  readonly value?: T;
  readonly factory?: (context: GeneratorContext) => T;
  readonly target?: string;
}
