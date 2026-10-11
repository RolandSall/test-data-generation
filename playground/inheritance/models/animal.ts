import type { NamedAnimal } from './named-animal.js';

export abstract class Animal implements NamedAnimal {
  constructor(readonly id: string, readonly name: string, readonly active: boolean) {
    if (!name.trim()) throw new Error('An animal needs a name');
  }
  abstract speak(): string;
  describe(): string { return `${this.name}: ${this.speak()}`; }
}
