import { Animal } from './animal.js';

export class Dog extends Animal {
  readonly species = 'dog';
  constructor(id: string, name: string, active: boolean, readonly trained: boolean) {
    super(id, name, active);
  }
  override speak(): string { return this.trained ? 'Sit, then woof!' : 'Woof!'; }
}
