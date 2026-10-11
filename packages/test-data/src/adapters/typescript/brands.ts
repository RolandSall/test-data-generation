import ts from 'typescript';
import type { Shape } from '../../core/shape.js';
import { GenerationError } from '../../core/error.js';
import { readScalar } from './scalars.js';

/** Only readonly unique-symbol literal markers are erased from primitive brands. */
export function readBrandedPrimitive(type: ts.Type, checker: ts.TypeChecker): Shape | undefined {
  if (!type.isIntersection()) return undefined;
  const primitives = type.types.filter(member => member.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike));
  if (!primitives.length) return undefined;
  const markers = type.types.filter(member => !primitives.includes(member));
  const valid = primitives.length === 1 && markers.length > 0 && markers.every(marker => {
    if (!(marker.flags & ts.TypeFlags.Object) || checker.getIndexInfosOfType(marker).length ||
      marker.getCallSignatures().length || marker.getConstructSignatures().length) return false;
    const properties = checker.getPropertiesOfType(marker);
    return properties.length > 0 && properties.every(property => {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      if (!declaration || !ts.isPropertySignature(declaration) || declaration.questionToken ||
        !declaration.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword) ||
        !ts.isComputedPropertyName(declaration.name)) return false;
      const key = checker.getTypeAtLocation(declaration.name.expression);
      const value = checker.getTypeOfSymbolAtLocation(property, declaration);
      return !!(key.flags & ts.TypeFlags.UniqueESSymbol) && (value.isStringLiteral() || value.isNumberLiteral());
    });
  });
  if (!valid) throw new GenerationError('CONFIGURATION',
    `Intersection ${checker.typeToString(type)} is not a supported primitive brand; supply an explicit shape/provider instead of discarding its constraints`);
  return readScalar(primitives[0]!, checker);
}
