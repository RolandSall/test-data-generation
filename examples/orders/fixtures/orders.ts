import { defineFixture, uuid } from '@integration-testing/test-data-generation';
import { people } from '@integration-testing/examples-people';
import { OrderShape } from '../shapes/order-shape.js';
import { orderLines } from './order-lines.js';

export const orders = defineFixture(OrderShape, {
  fields: { id: uuid(), customer: people, lines: orderLines, discountRate: 10 },
  computed: ({ derive }) => ({
    subtotal: derive(['lines'], lines => lines.reduce((sum, line) => sum + line.lineTotal, 0)),
    discountTotal: derive(['subtotal', 'discountRate'], (subtotal, rate) => Math.round(subtotal * rate / 100)),
    total: derive(['subtotal', 'discountTotal'], (subtotal, discount) => subtotal - discount),
  }),
  cases: {
    shipped: { fields: { status: 'shipped' } },
    cancelled: { fields: { status: 'cancelled', discountRate: 0 } },
    discounted: { fields: { discountRate: 20 } },
  },
});
