import { defineFixture } from '@integration-testing/test-data-generation';
import { fromZod } from '@integration-testing/test-data-generation/zod';
import { z } from 'zod';
import { runOptions } from '../run-options.js';
export const amountSchema = z.object({ order: z.object({ amount: z.literal('42').transform(Number) }) });
export function modesDemo() {
  const raw = defineFixture(fromZod(amountSchema, { mode: 'input' })).one(runOptions);
  const output = defineFixture(fromZod(amountSchema)).one(runOptions);
  return { raw, output, parsedByCaller: amountSchema.parse(raw) };
}
