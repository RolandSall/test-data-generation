export interface NamedAnimal {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  speak(): string;
}
