import type { ColumnMetadata } from './column-metadata.js';
export type { ColumnMetadata } from './column-metadata.js';
import { annotate, constrain, decimalShape, shape, type Shape } from '../core/shape.js';

/** ORM-neutral descriptor adapter. Does not insert or query a database. */
export function fromColumns<T = Record<string, unknown>>(columns: Readonly<Record<string, ColumnMetadata>>): Shape<T> {
  return shape.object(Object.fromEntries(Object.entries(columns).map(([key, column]) => {
    const factories: Record<ColumnMetadata['type'], () => Shape> = {
      string: shape.string, integer: shape.integer, number: shape.number, boolean: shape.boolean,
      date: shape.date, bigint: shape.bigint, decimal: decimalShape, bytes: shape.bytes,
    };
    const constraints = { ...(column.length === undefined ? {} : { maxLength: column.length }),
      ...(column.precision === undefined ? {} : { precision: column.precision }), ...(column.scale === undefined ? {} : { scale: column.scale }),
      ...(column.minimum === undefined ? {} : { min: column.minimum }), ...(column.maximum === undefined ? {} : { max: column.maximum }) };
    let node = annotate(constrain(column.enum ? shape.enum(column.enum) : factories[column.type](), constraints), { column: key, ...column });
    if (column.nullable) node = shape.nullable(node);
    return [key, node];
  }))) as Shape<T>;
}
