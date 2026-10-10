import { defineFixture } from '@integration-testing/test-data-generation';
import { fromZod } from '@integration-testing/test-data-generation/zod';
import * as z from 'zod';

export const AccountSchema = z.object({
  name: z.string().min(3).max(15),
  age: z.number().int().min(18).max(65),
  enabled: z.boolean(),
});

export const accounts = defineFixture(fromZod(AccountSchema));
