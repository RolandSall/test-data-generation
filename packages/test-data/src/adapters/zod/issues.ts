import * as core from 'zod/v4/core';
import type { Issue } from '../../core/issue.js';
import { GenerationError } from '../../core/error.js';

export function zodIssues(source: core.$ZodType, value: unknown): readonly Issue[] {
  const result = core.safeParse(source, value);
  return result.success ? [] : result.error.issues.map(issue => ({ path: '$' + issue.path.map(key => '.' + String(key)).join(''), message: issue.message }));
}
export function parseZod(source: core.$ZodType, value: unknown): unknown {
  const result = core.safeParse(source, value);
  if (result.success) return result.data;
  const first = result.error.issues[0]!;
  throw new GenerationError('VALIDATION', result.error.issues.map(issue => issue.message).join('; '), '$' + first.path.map(key => '.' + String(key)).join(''));
}
