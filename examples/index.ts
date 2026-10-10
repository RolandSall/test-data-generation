import { createPerson, createFamily, fillPersonDetails } from './people/index.js';
import { createOrder, createDiscountedBatch } from './orders/index.js';
import { readSequentialPeople, readShuffledPeople, overrideImportedFields } from './feeds/index.js';

const examples = {
  person: createPerson,
  family: createFamily,
  fill: fillPersonDetails,
  order: createOrder,
  'discounted-orders': createDiscountedBatch,
  feeds: readSequentialPeople,
  'shuffled-feeds': readShuffledPeople,
  'feed-overrides': overrideImportedFields,
};

const selected = process.argv[2];
if (selected && !Object.hasOwn(examples, selected)) {
  throw new Error(`Unknown example '${selected}'. Choose: ${Object.keys(examples).join(', ')}`);
}
for (const [name, run] of Object.entries(examples)) {
  if (selected && name !== selected) continue;
  console.log(`\n${name}`);
  console.log(JSON.stringify(await run(), null, 2));
}
