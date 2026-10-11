export class Customer {
  constructor(readonly name: string, readonly age: number) {}
  greet(): string { return `Hello, ${this.name}`; }
}
