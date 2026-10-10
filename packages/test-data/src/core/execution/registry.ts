import { GenerationError } from '../error.js';
import { matches, specificity } from '../path.js';
import type { Completion, Rule } from '../instructions.js';
import type { Provider, ResolvedConfig } from '../recipe.js';
import type { Seed } from '../random.js';
import type { NodeLocation } from './types.js';

interface Scoped<T> { value: T; scope: string; used: boolean }

function relative(path: string, scope: string): string | undefined {
  if (path === scope) return '$';
  return path.startsWith(scope + '.') ? '$.' + path.slice(scope.length + 1) : undefined;
}

/** Registration, insertion scopes, precedence and strict-use accounting for one graph. */
export class RuleRegistry {
  private readonly rules: Scoped<Rule>[] = [];
  private readonly callbacks: Scoped<Completion>[] = [];
  private readonly providers: Scoped<Provider>[] = [];

  constructor(private readonly seed: Seed) {}

  register(config: ResolvedConfig<unknown>, scope: string): void {
    for (const rule of config.rules ?? []) {
      if (rule.nullable !== undefined && (!Number.isFinite(rule.nullable) || rule.nullable < 0 || rule.nullable > 1)) {
        throw new GenerationError('CONFIGURATION', 'Invalid rule nullable probability', scope, this.seed);
      }
    }
    this.rules.push(...(config.rules ?? []).map(value => ({ value, scope, used: false })));
    this.callbacks.push(...(config.complete ?? []).map(value => ({ value, scope, used: false })));
    this.providers.push(...(config.providers ?? []).map(value => ({ value, scope, used: false })));
  }

  matchingRules(location: NodeLocation): Rule[] {
    return this.rules.filter(rule => {
      const local = relative(location.path, rule.scope);
      const scopeDepth = rule.scope === '$' ? 0 : rule.scope.split('.').length - 1;
      const matched = local !== undefined && matches(
        rule.value.match, location.node, local, location.depth - scopeDepth, location.index,
      );
      if (matched) rule.used = true;
      return matched;
    }).map(rule => rule.value);
  }

  winner(rules: readonly Rule[]): Rule | undefined {
    return rules.map((rule, order) => ({ rule, order })).sort((a, b) =>
      specificity(b.rule.match) - specificity(a.rule.match) || b.order - a.order,
    )[0]?.rule;
  }

  provider(location: NodeLocation): Provider | undefined {
    return [...this.providers].reverse().find(provider =>
      relative(location.path, provider.scope) !== undefined && provider.value.match(location.node),
    )?.value;
  }

  matchingCallbacks(location: NodeLocation, supplied: boolean): Completion[] {
    return this.callbacks.filter(callback => {
      const local = relative(location.path, callback.scope);
      const eligible = local !== undefined && (!supplied || callback.value.includeSupplied) &&
        matches(callback.value.match, location.node, local, location.depth, location.index);
      if (eligible) callback.used = true;
      return eligible;
    }).map(callback => callback.value);
  }

  hasUsedOverrides(): boolean {
    return this.rules.some(rule => rule.used && rule.value.use !== undefined);
  }

  assertUsed(): void {
    const unused = [
      ...this.rules.filter(rule => !rule.used && !rule.value.optional),
      ...this.callbacks.filter(callback => !callback.used && !callback.value.optional),
    ];
    if (unused.length) {
      throw new GenerationError('UNUSED_RULE', unused.length + ' rule/callback(s) matched no eligible node', unused[0]!.scope, this.seed);
    }
  }
}
