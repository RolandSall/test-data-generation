export interface Constraints {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  minSize?: number;
  maxSize?: number;
  multipleOf?: number;
  pattern?: RegExp;
  format?: string;
  alphabet?: string;
  precision?: number;
  scale?: number;
  unique?: boolean;
  past?: boolean;
  future?: boolean;
  bigMin?: bigint;
  bigMax?: bigint;
}
