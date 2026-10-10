// Stable internal entry point; implementation and type utilities have separate owners.
export { instruction, isInstruction } from './instructions/marker.js';
export { generator } from './instructions/generator.js';
export type { Generator, GeneratorContext } from './instructions/generator.js';
export { value, shared, fresh, populate, omit, blank, reference } from './instructions/operations.js';
export type { Operation } from './instructions/operations.js';
export { deriveContext } from './instructions/derive.js';
export type { Fields, FieldInstruction } from './types/field-overrides.js';
export type { Paths, AtPath } from './types/property-paths.js';
export type { Derived, DeriveContext } from './types/derived-fields.js';
export type { Match, Rule, Completion } from './types/matching.js';
