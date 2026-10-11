import { shape } from '@integration-testing/test-data-generation';

export const PersonShape = shape.object({
  name: shape.string(),
  age: shape.integer({ min: 18, max: 65 }),
  active: shape.boolean(),
  address: shape.object({ city: shape.string(), country: shape.string() }),
  preferences: shape.object({
    email: shape.boolean(),
    sms: shape.boolean(),
    security: shape.object({ rememberMe: shape.boolean() }),
  }),
});
