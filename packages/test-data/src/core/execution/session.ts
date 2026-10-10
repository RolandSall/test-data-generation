import { GenerationError } from '../error.js';
import { Random, defaultSeed, type Seed } from '../random.js';
import { constrain, type Shape } from '../shape.js';
import type { GeneratorContext } from '../instructions.js';
import type { RunOptions } from '../recipe.js';
import { UniquenessStore } from './uniqueness.js';

type SessionOptions = RunOptions & Required<Pick<RunOptions,
  'maxDepth' | 'maxAttempts' | 'maxNodes' | 'strict' | 'cycle' | 'nullProbability' | 'optionalProbability'>>;

/** Shared across roots in a batch/session, never shared between independent runs. */
export class GenerationSession {
  readonly seed: Seed;
  readonly now: Date;
  readonly random: Random;
  readonly options: SessionOptions;
  readonly uniqueness = new UniquenessStore();
  private readonly states = new Map<object, unknown>();
  private readonly defaults = new WeakMap<Shape, Shape>();

  constructor(options: RunOptions = {}) {
    this.seed = options.seed ?? defaultSeed();
    this.random = new Random(this.seed);
    this.now = new Date(options.now ?? new Date());
    if (!Number.isFinite(this.now.getTime())) {
      throw new GenerationError('CONFIGURATION', 'Invalid clock', '$', this.seed);
    }
    this.options = {
      maxDepth: 8, maxAttempts: 100, maxNodes: 100000, strict: true,
      cycle: 'omit', nullProbability: 0.2, optionalProbability: 0, ...options,
    };
    for (const key of ['maxDepth', 'maxAttempts', 'maxNodes'] as const) {
      if (!Number.isSafeInteger(this.options[key]) || this.options[key] < (key === 'maxDepth' ? 0 : 1)) {
        throw new GenerationError('CONFIGURATION', 'Invalid ' + key, '$', this.seed);
      }
    }
    for (const probability of [this.options.nullProbability, this.options.optionalProbability]) {
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new GenerationError('CONFIGURATION', 'Invalid null/optional probability', '$', this.seed);
      }
    }
  }

  context(path: string, index: number, root: unknown): GeneratorContext {
    return {
      random: this.random, now: new Date(this.now), path, index, root,
      state: <T>(key: object, initialize: () => T): T => {
        if (!this.states.has(key)) this.states.set(key, initialize());
        return this.states.get(key) as T;
      },
    };
  }

  withDefaults(node: Shape): Shape {
    const defaults = this.options.defaults?.[node.kind];
    if (!defaults) return node;
    const cached = this.defaults.get(node);
    if (cached) return cached;
    const configured = constrain(node, { ...defaults, ...node.constraints });
    this.defaults.set(node, configured);
    this.defaults.set(configured, configured);
    return configured;
  }
}
