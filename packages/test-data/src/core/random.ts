import { randomBytes } from 'node:crypto';

export type Seed = number | string;

export function defaultSeed(): number { return randomBytes(4).readUInt32LE(); }

/** xoshiro128** with four independently mixed seed words. No global RNG state. */
export class Random {
  private state: number[];
  constructor(readonly seed: Seed) {
    if (typeof seed === 'number' && !Number.isSafeInteger(seed)) throw new RangeError('Seed must be a safe integer or string');
    let hash = 2166136261;
    for (const c of String(seed)) hash = Math.imul(hash ^ c.codePointAt(0)!, 16777619);
    this.state = Array.from({ length: 4 }, () => {
      hash = (hash + 0x9e3779b9) | 0;
      let n = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad);
      n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
      return (n ^ (n >>> 15)) >>> 0;
    });
    if (this.state.every(n => n === 0)) this.state = [1, 0, 0, 0];
  }
  uint32(): number {
    const [a, b, c, d] = this.state as [number, number, number, number];
    const product = Math.imul(b, 5);
    const result = Math.imul((product << 7) | (product >>> 25), 9) >>> 0;
    const t = b << 9;
    const nb = b ^ c ^ a;
    const nd = d ^ b;
    this.state = [(a ^ nd) >>> 0, nb >>> 0, (c ^ a ^ t) >>> 0, ((nd << 11) | (nd >>> 21)) >>> 0];
    return result;
  }
  next(): number { return ((this.uint32() >>> 5) * 67108864 + (this.uint32() >>> 6)) / 9007199254740992; }
  int(min: number, max: number): number {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) throw new RangeError(`Invalid integer range [${min}, ${max}]`);
    return Number(this.bigint(BigInt(min), BigInt(max)));
  }
  bigint(min: bigint, max: bigint): bigint {
    if (min > max) throw new RangeError('Invalid bigint range');
    const width = max - min + 1n;
    const bits = (width - 1n).toString(2).length;
    const words = Math.ceil(bits / 32);
    const mask = (1n << BigInt(bits)) - 1n;
    let candidate: bigint;
    do {
      candidate = 0n;
      for (let i = 0; i < words; i++) candidate = (candidate << 32n) | BigInt(this.uint32());
      candidate &= mask;
    } while (candidate >= width);
    return min + candidate;
  }
  float(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max || !Number.isFinite(max - min)) throw new RangeError('Invalid floating-point range');
    return min + this.next() * (max - min);
  }
  boolean(probability = 0.5): boolean {
    if (probability < 0 || probability > 1 || !Number.isFinite(probability)) throw new RangeError('Probability must be between zero and one');
    return this.next() < probability;
  }
  pick<T>(values: readonly T[]): T {
    if (!values.length) throw new RangeError('Cannot choose from an empty domain');
    return values[this.int(0, values.length - 1)]!;
  }
  shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }
  text(length: number, alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'): string {
    if (!Number.isSafeInteger(length) || length < 0 || !alphabet.length) throw new RangeError('Invalid text parameters');
    return Array.from({ length }, () => this.pick([...alphabet])).join('');
  }
  fork(label: string): Random { return new Random(`${this.seed}:${label}`); }
}
