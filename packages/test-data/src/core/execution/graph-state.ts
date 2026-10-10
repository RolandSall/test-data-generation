import { GenerationError } from '../error.js';
import type { GeneratorContext } from '../instructions.js';
import type { Shape } from '../shape.js';
import { AttemptEffects } from './effects.js';
import { RuleRegistry } from './registry.js';
import type { GenerationSession } from './session.js';
import type { GenerationMode, NodeLocation } from './types.js';

/** Mutable state for one generated root. Session counters and RNG are separate. */
export class GraphState {
  root: unknown;
  private nodes = 0;
  readonly parents = new Map<Shape, string>();
  readonly registry: RuleRegistry;
  readonly effects: AttemptEffects;

  constructor(readonly session: GenerationSession, readonly mode: GenerationMode) {
    this.registry = new RuleRegistry(session.seed);
    this.effects = new AttemptEffects(session.uniqueness.transaction());
  }

  context(location: Pick<NodeLocation, 'path' | 'index'>): GeneratorContext {
    return this.session.context(location.path, location.index, this.root);
  }

  enter(location: NodeLocation): void {
    if (++this.nodes > this.session.options.maxNodes) {
      throw new GenerationError('DEPTH', 'Node budget exceeded', location.path, this.session.seed);
    }
    this.session.options.trace?.({ path: location.path, kind: location.node.kind, action: 'visit' });
  }

  cutoff(path: string): unknown {
    this.session.options.trace?.({ path, kind: 'cutoff', action: 'depth/cycle' });
    if (this.session.options.cycle === 'error') {
      throw new GenerationError('DEPTH', 'Graph depth/cycle cutoff', path, this.session.seed);
    }
    return this.session.options.cycle === 'null' ? null : undefined;
  }

  queueCallbacks(location: NodeLocation, value: unknown, supplied: boolean): void {
    if (value === null || value === undefined) return;
    this.effects.queue(this.registry.matchingCallbacks(location, supplied), location.path, location.index);
  }
}
