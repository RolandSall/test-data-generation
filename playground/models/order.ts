import { shape, type Infer } from '@integration-testing/test-data-generation';

export const OrderShape = shape.object({
  id: shape.string(),
  status: shape.enum(['pending', 'shipped', 'cancelled']),
  refunded: shape.boolean(),
  createdAt: shape.date(),
  customer: shape.object({
    name: shape.string(),
    address: shape.object({ city: shape.string(), postalCode: shape.string() }),
    preferences: shape.object({
      email: shape.boolean(),
      sms: shape.boolean(),
      security: shape.object({ rememberMe: shape.boolean() }),
    }),
  }),
  items: shape.array(shape.object({
    sku: shape.string(),
    quantity: shape.integer({ min: 1, max: 5 }),
    unitPrice: shape.integer({ min: 10, max: 100 }),
  }), { minSize: 2, maxSize: 2 }),
  total: shape.integer({ min: 0 }),
});

export type Order = Infer<typeof OrderShape>;
