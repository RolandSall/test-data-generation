import { listOf, mapValue, sequence } from '@integration-testing/test-data-generation';
import { OrderLineShape } from '../shapes/order-line-shape.js';

export const orderLines = listOf(OrderLineShape, {
  count: 3,
  fields: { sku: mapValue(sequence({ start: 100 }), next => `SKU-${next}`) },
  computed: ({ derive }) => ({
    lineTotal: derive(['quantity', 'unitPrice'], (quantity, price) => quantity * price),
  }),
});
