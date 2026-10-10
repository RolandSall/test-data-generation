import type ts from 'typescript';
import type { TypeReader } from './context.js';

export interface TypeContext {
  checker: ts.TypeChecker;
  source: ts.SourceFile;
  read: TypeReader;
}
