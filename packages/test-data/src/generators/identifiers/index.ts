import type { IdentifierOptions } from './identifier-options.js';
export type { IdentifierOptions } from './identifier-options.js';
import { generator, type Generator, type GeneratorContext } from '../../core/instructions.js';
import { generateEan13, generateIsbn13, generateIsbn10 } from './publications.js';

export type Identifier = 'EAN' | 'ISBN' | 'ISBN10';


const IDENTIFIER_GENERATORS: Record<Identifier, (context: GeneratorContext, options: IdentifierOptions) => string> = {
  EAN: generateEan13, ISBN: generateIsbn13, ISBN10: generateIsbn10,
};

export const IDENTIFIER_KINDS: readonly Identifier[] = Object.freeze(Object.keys(IDENTIFIER_GENERATORS) as Identifier[]);

export function checksumId(options: IdentifierOptions): Generator<string> {
  return generator(context => IDENTIFIER_GENERATORS[options.kind](context, options));
}
