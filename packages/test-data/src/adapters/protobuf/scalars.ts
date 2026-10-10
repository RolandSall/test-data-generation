import { shape, type Shape } from '../../core/shape.js';
import { GenerationError } from '../../core/error.js';

const SIGNED_32_MIN = -(2 ** 31);
const SIGNED_32_MAX = 2 ** 31 - 1;
const UNSIGNED_32_MAX = 2 ** 32 - 1;
const SIGNED_64_MIN = -(2n ** 63n);
const SIGNED_64_MAX = 2n ** 63n - 1n;
const UNSIGNED_64_MAX = 2n ** 64n - 1n;

const signed32 = () => shape.integer({ min: SIGNED_32_MIN, max: SIGNED_32_MAX });
const unsigned32 = () => shape.integer({ min: 0, max: UNSIGNED_32_MAX });
const floating = () => shape.number({ min: -10000, max: 10000 });

// protobufjs accepts decimal strings for full-width 64-bit values. Its message
// constructor converts them to Long without passing through a lossy number.
const signed64 = () => shape.transform(shape.bigint({ bigMin: SIGNED_64_MIN, bigMax: SIGNED_64_MAX }), value => value.toString());
const unsigned64 = () => shape.transform(shape.bigint({ bigMin: 0n, bigMax: UNSIGNED_64_MAX }), value => value.toString());

const SCALAR_FACTORIES: Readonly<Record<string, () => Shape>> = {
  string: shape.string,
  bytes: shape.bytes,
  bool: shape.boolean,
  double: floating, float: floating,
  int32: signed32, sint32: signed32, sfixed32: signed32,
  uint32: unsigned32, fixed32: unsigned32,
  int64: signed64, sint64: signed64, sfixed64: signed64,
  uint64: unsigned64, fixed64: unsigned64,
};

export function readScalar(type: string): Shape {
  const factory = Object.hasOwn(SCALAR_FACTORIES, type) ? SCALAR_FACTORIES[type] : undefined;
  if (!factory) throw new GenerationError('CONFIGURATION', `Unsupported protobuf field ${type}`);
  return factory();
}

export function readMapKey(type: string): Shape {
  const factories: Readonly<Record<string, () => Shape>> = { string: shape.string, bool: shape.boolean };
  return Object.hasOwn(factories, type) ? factories[type]!() : shape.integer({ min: 0, max: 10000 });
}
