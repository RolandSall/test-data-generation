import { orders } from '../fixtures/orders.js';
import { exampleOptions } from '../../run-options.js';

export function createDiscountedBatch() {
  return orders.extend({ filter: order => order.total >= 100, unique: ['id'] })
    .many(3, { ...exampleOptions, case: 'discounted' });
}
