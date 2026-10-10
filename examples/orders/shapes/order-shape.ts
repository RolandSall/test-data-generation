import { shape, type Shape } from '@integration-testing/test-data-generation';
import { PersonShape, type Address } from '@integration-testing/examples-people';
import type { Order } from '../models/order.js';
import { OrderLineShape } from './order-line-shape.js';

export const OrderShape: Shape<Order> = shape.object({
  id: shape.string(),
  customer: PersonShape,
  lines: shape.array(OrderLineShape, { minSize: 3, maxSize: 3 }),
  billingAddress: shape.reference<Address>('customer.home'),
  shippingAddress: shape.reference<Address>('customer.home'),
  status: shape.enum(['pending', 'shipped', 'cancelled']),
  subtotal: shape.integer({ min: 0 }),
  discountRate: shape.integer({ min: 0, max: 100 }),
  discountTotal: shape.integer({ min: 0 }),
  total: shape.integer({ min: 0 }),
});
