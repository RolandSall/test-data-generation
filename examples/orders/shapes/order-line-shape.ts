import { shape, type Shape } from '@integration-testing/test-data-generation';
import type { OrderLine } from '../models/order-line.js';

export const OrderLineShape: Shape<OrderLine> = shape.object({
  sku: shape.string(),
  quantity: shape.integer({ min: 1, max: 4 }),
  unitPrice: shape.integer({ min: 10, max: 50 }),
  lineTotal: shape.integer({ min: 10, max: 200 }),
});
