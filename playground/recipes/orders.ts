import { defineFixture, generator, uuid } from '@integration-testing/test-data-generation';
import { OrderShape } from '../models/order.js';

export const orders = defineFixture(OrderShape, {
  fields: {
    id: uuid(),
    customer: {
      name: generator(({ random }) => random.pick(['Ada', 'Grace', 'Linus'])),
      address: { city: 'Beirut' },
    },
  },
  rules: [{ match: { kind: 'boolean', under: 'customer.preferences' }, use: true }],
  computed: ({ derive }) => ({
    refunded: derive(['status'], status => status === 'cancelled'),
    total: derive(['items'], items => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)),
  }),
  cases: {
    cancelled: { fields: { status: 'cancelled' } },
    shipped: { fields: { status: 'shipped' } },
  },
});
