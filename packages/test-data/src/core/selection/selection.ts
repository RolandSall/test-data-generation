import type { Generator } from '../instructions/generator.js';
import type { Operation } from '../instructions/operation.js';
import type { Fixture } from '../recipe.js';
import type { Rule } from '../types/rule.js';

/** A selection accepts a complete replacement, generator, operation or nested fixture. */
export interface Selection<Value> {
  use(instruction: Value | Generator<Value> | Operation<Value> | Fixture<Value>): Rule;
}
