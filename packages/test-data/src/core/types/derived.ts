export interface Derived<Value> {
  readonly paths: readonly string[];
  readonly compute: (...values: readonly unknown[]) => Value;
}
