import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';

test('TypeScript rename connects property selectors to their actual class member', { timeout: 15_000 }, () => {
  const file = resolve('packages/test-data/test/selector-rename-sample.ts');
  const source = `
import { select, shape } from '../src/index.js';
class Customer { constructor(readonly name: string) {} }
const input = shape.object({ name: shape.string() });
const model = shape.transform(input, data => new Customer(data.name));
const fields = select(model);
fields.field(customer => customer.name).use('Ada');
fields.field('name').use('Legacy');
`;
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => ({ module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, target: ts.ScriptTarget.ES2023, strict: true, skipLibCheck: true }),
    getCurrentDirectory: () => process.cwd(),
    getScriptFileNames: () => [file],
    getScriptVersion: () => '0',
    getScriptSnapshot: path => {
      const text = path === file ? source : ts.sys.readFile(path);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
    fileExists: path => path === file || ts.sys.fileExists(path),
    readFile: path => path === file ? source : ts.sys.readFile(path),
    readDirectory: ts.sys.readDirectory,
  };
  const service = ts.createLanguageService(host);
  try {
    expect(service.getSemanticDiagnostics(file)).toEqual([]);
    const declaration = source.indexOf('readonly name') + 'readonly '.length;
    const references = service.findRenameLocations(file, declaration, false, false) ?? [];
    const accessor = source.indexOf('customer.name') + 'customer.'.length;
    const literal = source.indexOf("field('name')") + "field('".length;
    expect(references.some(reference => reference.fileName === file && reference.textSpan.start === accessor)).toBe(true);
    expect(references.some(reference => reference.fileName === file && reference.textSpan.start === literal)).toBe(false);
  } finally {
    service.dispose();
  }
});
