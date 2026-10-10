import ts from 'typescript';
import { resolve } from 'node:path';
import { GenerationError } from '../../core/error.js';

function compilerOptions(tsconfig?: string): ts.CompilerOptions {
  if (!tsconfig) {
    return {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strictNullChecks: true,
      skipLibCheck: true,
    };
  }
  const loaded = ts.readConfigFile(tsconfig, ts.sys.readFile);
  if (loaded.error) {
    throw new GenerationError('CONFIGURATION', ts.flattenDiagnosticMessageText(loaded.error.messageText, '\n'));
  }
  return ts.parseJsonConfigFileContent(loaded.config, ts.sys, resolve(tsconfig, '..')).options;
}

function isModelDeclaration(node: ts.Node): node is ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.ClassDeclaration | ts.EnumDeclaration {
  return ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node);
}

export function loadDeclaration(file: string, name: string, options: { tsconfig?: string }) {
  const path = resolve(file);
  const program = ts.createProgram([path], compilerOptions(options.tsconfig));
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(path);
  if (!source) throw new GenerationError('CONFIGURATION', `Missing type source ${file}`);

  const declaration = source.statements.filter(isModelDeclaration).find(node => node.name?.text === name);
  if (!declaration?.name) throw new GenerationError('CONFIGURATION', `Unknown declaration ${name}`);
  return { checker, source, type: checker.getTypeAtLocation(declaration.name) };
}
