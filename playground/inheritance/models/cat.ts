import { Animal } from './animal.js';

export class Cat extends Animal {
  readonly species = 'cat';
  constructor(id: string, name: string, active: boolean, readonly lives: number) {
    super(id, name, active);
    if (lives < 1 || lives > 9) throw new Error('Lives must be between 1 and 9');
  }
  override speak(): string { return 'Meow!'; }
}
