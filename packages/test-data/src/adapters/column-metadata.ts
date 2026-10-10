export interface ColumnMetadata {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'date' | 'bigint' | 'decimal' | 'bytes';
  length?: number;
  precision?: number;
  scale?: number;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  enum?: readonly unknown[];
}
