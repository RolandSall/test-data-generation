import { OMITTED } from './execution/omitted.js';
import { GenerationError } from './error.js';
import type { Fixture, ResolvedConfig, RunOptions } from './recipe.js';
import { validateShape } from './validation.js';
import { GenerationSession } from './execution/session.js';
import { GraphState } from './execution/graph-state.js';
import { GraphTraversal } from './execution/traversal.js';
import { resolveReferences } from './execution/references.js';
import type { GenerationMode } from './execution/types.js';

/** Coordinate one graph's lifecycle while retaining its batch/session state. */
export class Engine {
  private readonly session: GenerationSession;

  constructor(options: RunOptions = {}) {
    this.session = new GenerationSession(options);
  }

  get seed() { return this.session.seed; }
  get now() { return this.session.now; }
  get random() { return this.session.random; }

  make<T>(fixture: Fixture<T>, options: RunOptions<T> = {}, index = 0, existing?: unknown, mode: GenerationMode = 'generate'): T {
    const state = new GraphState(this.session, mode);
    const traversal = new GraphTraversal(state);
    const config = fixture.resolve(options);
    state.registry.register(config as ResolvedConfig<unknown>, '$');
    try {
      let output = traversal.visit({
        node: fixture.shape, path: '$', depth: 0, index,
        input: config.fields, existing, provided: existing !== undefined,
        config: config as ResolvedConfig<unknown>,
      });
      if (output === OMITTED) output = undefined;
      state.root = output;
      output = resolveReferences(output, output, this.seed);
      output = state.effects.complete(
        output,
        (path, index) => state.context({ path, index }),
        replacement => { state.root = replacement; },
      );
      if ((options.check ?? config.options?.check ?? this.session.options.check) === 'schema') {
        const issues = validateShape(fixture.shape, output, this.now);
        if (issues.length) {
          throw new GenerationError('VALIDATION', issues.map(issue => issue.path + ': ' + issue.message).join('; '), '$', this.seed);
        }
      }
      if (options.strict ?? config.options?.strict ?? this.session.options.strict) state.registry.assertUsed();
      return output as T;
    } catch (error) {
      state.effects.uniqueness.rollback();
      if (error instanceof GenerationError) throw error;
      throw new GenerationError(
        'CONSTRUCTION', error instanceof Error ? error.message : String(error), '$', this.seed, { cause: error },
      );
    }
  }
}
