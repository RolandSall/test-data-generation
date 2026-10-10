export type { TypeContext } from './type-context.js';
import type ts from 'typescript';
import type { Shape } from '../../core/shape.js';

export type TypeReader = (type: ts.Type) => Shape;
