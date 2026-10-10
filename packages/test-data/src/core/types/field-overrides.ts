import type { Generator } from '../instructions/generator.js';
import type { Operation } from '../instructions/operations.js';
import type { Fixture } from '../recipe.js';
import type { LeafValue } from './leaf-values.js';

/** A partial field tree: every supplied instruction must match that field's type. */
export type Fields<Model> = {
  [Key in keyof Model]?: FieldInstruction<Model[Key]>;
};

/** Plain object fields can be configured recursively; leaf values are replacements. */
type NestedFields<Value> =
  NonNullable<Value> extends LeafValue ? never :
  NonNullable<Value> extends object ? Fields<NonNullable<Value>> :
  never;

export type FieldInstruction<Value> =
  | Value
  | Generator<Value>
  | Operation<Value>
  | Fixture<Value>
  | NestedFields<Value>;
