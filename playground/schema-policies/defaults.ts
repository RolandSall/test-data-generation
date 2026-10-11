import { defineFixture } from '@integration-testing/test-data-generation';
import { fromZod } from '@integration-testing/test-data-generation/zod';
import { z } from 'zod';
import { runOptions } from '../run-options.js';
const accounts = defineFixture(fromZod(z.object({ status: z.string().default('pending'), nickname: z.string().optional() })));
export function defaultsDemo() {
  return {
    generated: accounts.one(runOptions),
    declared: accounts.one({ ...runOptions, schemaDefaults: 'preserve', optionalProbability: 1 }),
    supplied: accounts.one({ ...runOptions, schemaDefaults: 'preserve', fields: { status: '', nickname: '' } }),
  };
}
