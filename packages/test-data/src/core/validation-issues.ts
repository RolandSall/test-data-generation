import type { Shape } from './shape.js';
import type { Issue } from './issue.js';

export function validationIssues(node: Shape, value: unknown, path: string): Issue[] {
  return (node.validate?.(value) ?? []).map(issue => typeof issue === 'string'
    ? { path, message: issue }
    : { path: relativeIssuePath(path, issue.path), message: issue.message });
}
export function relativeIssuePath(parent: string, child: string): string {
  return child === '$' ? parent : parent + child.replace(/^\$/, '');
}
