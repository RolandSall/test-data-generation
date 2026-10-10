import { defineFixture, fixtureRun, sequence, shape } from '@integration-testing/test-data-generation';
import { orders } from './recipes/orders.js';
import { contactsFromCsv } from './recipes/contacts.js';
import { accounts } from './recipes/accounts.js';
import { runOptions } from './run-options.js';

const demos = {
  orders: () => orders.one(runOptions),
  cancelled: () => orders.one({ ...runOptions, case: 'cancelled' }),
  batch: () => orders.many(3, runOptions),
  feeds: async () => (await contactsFromCsv()).many(3, runOptions),
  sessions: () => {
    const tickets = defineFixture(shape.object({ id: shape.integer() }), { fields: { id: sequence({ start: 100 }) } });
    const run = fixtureRun(runOptions);
    return [run.make(tickets), run.make(tickets), run.make(tickets)];
  },
  zod: () => accounts.one(runOptions),
};

const selected = process.argv[2];
if (selected && !Object.hasOwn(demos, selected)) {
  throw new Error(`Unknown demo '${selected}'. Choose: ${Object.keys(demos).join(', ')}`);
}
for (const [name, run] of Object.entries(demos)) {
  if (selected && name !== selected) continue;
  console.log(`\n${name} (seed=${runOptions.seed}, now=${runOptions.now})`);
  console.log(JSON.stringify(await run(), null, 2));
}
