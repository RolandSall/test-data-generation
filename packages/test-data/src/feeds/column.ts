import type { GeneratorContext } from '../core/instructions/generator.js';

export interface Column {
  readonly from?: string;
  readonly decode?: (value: unknown) => unknown;
  readonly compute?: (get: (name: string) => unknown, context: GeneratorContext) => unknown;
  readonly transforms?: readonly ((value: unknown, context: GeneratorContext) => unknown)[];
  readonly nullable?: number;
}
