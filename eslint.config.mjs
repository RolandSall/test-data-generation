import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { basename } from 'node:path';

const interfaceFile = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      multiple: 'Keep one exported interface declaration per file.',
      filename: 'Declare interface {{name}} in {{filename}}.',
      anonymous: 'Name the exported interface so its file can match its name.',
    },
  },
  create(context) {
    let declarations = 0;
    function checkExport(node) {
        const declaration = node.declaration;
        if (declaration?.type !== 'TSInterfaceDeclaration') return;
        if (++declarations > 1) context.report({ node: declaration, messageId: 'multiple' });
        const name = declaration.id?.name;
        if (!name) {
          context.report({ node: declaration, messageId: 'anonymous' });
          return;
        }
        const filename = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() + '.ts';
        if (basename(context.filename) !== filename) {
          context.report({ node: declaration, messageId: 'filename', data: { name, filename } });
        }
    }
    return { ExportNamedDeclaration: checkExport, ExportDefaultDeclaration: checkExport };
  },
};
export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/*.config.ts', '**/fixtures/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['packages/test-data/src/**/*.ts', 'examples/**/*.ts'], plugins: { structure: { rules: { 'interface-file': interfaceFile } } }, rules: { 'structure/interface-file': 'error' } },
  { files: ['**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
);
