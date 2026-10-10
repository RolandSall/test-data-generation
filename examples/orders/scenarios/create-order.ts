import { orders } from '../fixtures/orders.js';
import { exampleOptions } from '../../run-options.js';

export function createOrder() {
  return orders.one({ ...exampleOptions, case: 'shipped' });
}
