import { GenerationError } from '../error.js';
import { isFixture } from '../fixture-identity.js';
import { clone, isPlain } from '../path.js';
import { instruction, isInstruction, value, type GeneratorContext, type Rule } from '../instructions.js';
import { scalarIssues } from '../validation.js';
import { buildObject } from './objects.js';
import { buildCollection } from './collections.js';
import { GraphReference } from './references.js';
import { generateScalar } from './scalars.js';
import type { GraphState } from './graph-state.js';
import { isCollection, type BuildRequest, type NodeLocation, type NodeRequest, type NodeTraversal } from './types.js';

/** Recursive dispatch and instruction precedence. Builders own shape-specific construction. */
export class GraphTraversal implements NodeTraversal {
  constructor(private readonly state: GraphState) {}

  visit(request: NodeRequest): unknown {
    const { session, registry } = this.state;
    const node = session.withDefaults(request.node);
    const location = { ...request, node };
    const { path, depth, input, config, skipUse = false } = request;
    let { existing, provided = false } = request;
    this.state.enter(location);
    const eligible = registry.matchingRules(location);
    const explicit = input !== undefined && !isPlain(input);
    let use = explicit ? input : skipUse ? undefined : registry.winner(eligible)?.use;
    const context = this.state.context(location);
    if (use === undefined && isFixture(input)) use = input;
    if (isFixture(use)) {
      const nested = use.resolve();
      registry.register(nested, path);
      return this.visit({ ...location, node: use.shape, input: nested.fields, existing, provided, config: nested, skipUse: true });
    }

    const missing = !provided || existing === undefined || (existing === null && this.state.mode === 'nullish');
    if (use === undefined && (!isPlain(input) || Object.keys(input).length === 0) && missing && this.state.mode !== 'blank' && this.state.mode !== 'rules' &&
      session.options.schemaDefaults === 'preserve' && !registry.provider(location)) {
      if (node.defaultFactory) use = value(node.defaultFactory());
      else if (Object.hasOwn(node, 'defaultValue')) use = value(node.defaultValue);
    }

    if (isInstruction(use)) {
      switch (use[instruction]) {
        case 'omit': return undefined;
        case 'value': case 'shared': {
          const output = use[instruction] === 'shared' ? use.value : clone(use.value);
          this.state.queueCallbacks(location, output, true);
          return output;
        }
        case 'fresh': {
          const output = use.factory!(context);
          this.state.queueCallbacks(location, output, true);
          return output;
        }
        case 'reference': return new GraphReference(use.target!);
        case 'populate':
          existing = use.factory!(context);
          provided = true;
          use = undefined;
          break;
      }
    }
    const blank = (this.state.mode === 'blank' && use === undefined) ||
      (isInstruction(use) && use[instruction] === 'blank');
    if (blank) use = undefined;
    const fields = isPlain(input) ? input : undefined;
    if (node.kind === 'lazy') {
      return this.visit({ ...location, node: node.resolve!(), input, existing, provided, config, skipUse: false });
    }
    if (node.kind === 'optional' || node.kind === 'nullable') {
      if (use === null || (use === undefined && provided && existing === null && this.state.mode !== 'nullish')) return null;
      const probability = node.kind === 'optional' ? session.options.optionalProbability : session.options.nullProbability;
      if (use === undefined && !provided && !blank && session.random.boolean(probability)) {
        return node.kind === 'optional' ? undefined : null;
      }
      return this.visit({ ...location, node: node.element!, input: use ?? fields, existing, provided, config, skipUse });
    }
    if (node.kind === 'reference' && use === undefined) return new GraphReference(node.target!);
    if (depth > session.options.maxDepth) return this.state.cutoff(path);
    const hasExisting = existing !== undefined && (existing !== null || this.state.mode !== 'nullish');
    if (provided && use === undefined && !fields && node.kind !== 'object' && !isCollection(node)) {
      if (this.state.mode === 'rules' || hasExisting) return existing;
    }
    const preserving = provided && use === undefined && hasExisting;
    const build: BuildRequest = {
      ...location, fields, existing, provided, config, blank,
    };
    return this.generate({
      request: build, use, explicit, preserving, context, rules: eligible,
    });
  }

  blankNode(request: NodeLocation): unknown {
    const node = this.state.session.withDefaults(request.node);
    if (node.kind === 'lazy') return this.blankNode({ ...request, node: node.resolve!() });
    if (node.kind === 'optional' || node.kind === 'nullable') return this.blankNode({ ...request, node: node.element! });
    if (request.depth > this.state.session.options.maxDepth || this.state.parents.has(node)) return undefined;
    const build = { ...request, node, blank: true };
    if (node.kind === 'object') return buildObject(this.state, this, build);
    if (isCollection(node)) return buildCollection(this.state, this, build);
    return undefined;
  }

  private generate(attempt: GenerationRequest): unknown {
    const { request, use, explicit, rules } = attempt;
    const { path, config, blank } = request;
    const { session, effects } = this.state;
    const nullRule = [...rules].reverse().find(rule => rule.nullable !== undefined);
    for (let count = 0; count < session.options.maxAttempts; count++) {
      const checkpoint = effects.checkpoint();
      const nullable = !explicit && !blank && nullRule !== undefined && session.random.boolean(nullRule.nullable!);
      const output = nullable ? null : this.construct(attempt);
      if (!this.accepts(attempt, output, nullable) || !effects.uniqueness.reserve(output, rules, config)) {
        effects.rollback(checkpoint);
        continue;
      }
      if (use === undefined || (isInstruction(use) && use[instruction] === 'generator')) {
        this.state.queueCallbacks(request, output, false);
      }
      return output;
    }
    throw new GenerationError('RETRY_EXHAUSTED', 'Generation rejected ' + session.options.maxAttempts + ' attempts', path, session.seed);
  }

  private construct(attempt: GenerationRequest): unknown {
    const { request, use, context } = attempt;
    const { node, fields, blank } = request;
    if (isInstruction(use) && use[instruction] === 'generator') return use.generate(context);
    if (use !== undefined) {
      const output = clone(use);
      this.state.queueCallbacks(request, output, true);
      return output;
    }
    if (node.kind === 'union' && !blank) {
      return this.visit({ ...request, node: this.state.session.random.pick(node.members!), input: fields, skipUse: false });
    }
    if (node.kind === 'transform' && !blank) {
      return node.transform!(this.visit({ ...request, node: node.element!, input: fields }));
    }
    const build = { ...request, existing: attempt.preserving ? request.existing : undefined };
    if (node.kind === 'object') return buildObject(this.state, this, build);
    if (isCollection(node)) return buildCollection(this.state, this, build);
    if (blank || this.state.mode === 'rules') return undefined;
    const provider = this.state.registry.provider(request);
    return provider ? provider.generate.generate(context) : generateScalar(node, context);
  }

  private accepts(attempt: GenerationRequest, output: unknown, nullable: boolean): boolean {
    const { request, use, preserving, rules } = attempt;
    const { node, fields, config, blank } = request;
    if (rules.some(rule => rule.filter && !rule.filter(output))) return false;
    const hasOverrides = node.kind === 'object' && (
      fields && Object.keys(fields).length > 0 || config?.source ||
      Object.keys(config?.computed ?? {}).length > 0 || this.state.registry.hasUsedOverrides()
    );
    if (use === undefined && !nullable && !blank && !preserving && !hasOverrides) {
      if (scalarIssues(node, output, this.state.session.now).length || node.validate?.(output).length) return false;
    }
    return !config?.filter || config.filter(output);
  }
}

interface GenerationRequest {
  request: BuildRequest;
  use: unknown;
  explicit: boolean;
  preserving: boolean;
  context: GeneratorContext;
  rules: readonly Rule[];
}
