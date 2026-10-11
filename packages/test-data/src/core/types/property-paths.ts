import type { LeafValue } from './leaf-values.js';

type StringKey<Model> = keyof Model & string;
type PropertyValue<Model, Key extends string> =
  Key extends keyof NonNullable<Model> ? NonNullable<Model>[Key] : never;

/** The tuple counts visited object levels; no numeric predecessor table is needed. */
type VisitedLevels = readonly unknown[];

type FieldPaths<Value, Key extends string, Limit extends number, Visited extends VisitedLevels> =
  NonNullable<Value> extends (...args: never[]) => unknown ? never :
  NonNullable<Value> extends LeafValue ? Key :
  Key | `${Key}.${ObjectPaths<Value, Limit, [...Visited, unknown]>}`;

type PropertyPaths<Model, Limit extends number, Visited extends VisitedLevels> = {
  [Key in StringKey<Model>]: FieldPaths<Model[Key], Key, Limit, Visited>;
}[StringKey<Model>];

type ObjectPaths<Model, Limit extends number, Visited extends VisitedLevels> =
  Visited['length'] extends Limit ? never :
  NonNullable<Model> extends object ? PropertyPaths<NonNullable<Model>, Limit, Visited> :
  never;

/**
 * Valid dotted field names, e.g. 'customer' | 'customer.name'.
 * The default five-level limit bounds compiler recursion, independently of runtime maxDepth.
 */
export type Paths<Model, Depth extends number = 5> = ObjectPaths<Model, Depth, []>;

/** The value type at a dotted path; nullable parent objects are unwrapped for lookup. */
export type AtPath<Model, Path extends string> =
  Path extends `${infer Head}.${infer Tail}`
    ? AtPath<PropertyValue<Model, Head>, Tail>
    : PropertyValue<Model, Path>;

/** Keeps dependency order and infers one callback argument per selected path. */
export type ValuesAtPaths<Model, Dependencies extends readonly string[]> = {
  [Index in keyof Dependencies]: AtPath<Model, Dependencies[Index]>;
};
