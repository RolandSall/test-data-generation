import { defineFixture, integer, select, shape } from '@integration-testing/test-data-generation';
import { Customer } from '../models/customer.js';

const CustomerInput = shape.object({ name: shape.string(), age: shape.integer() });
const CustomerShape = shape.transform(CustomerInput, data => new Customer(data.name, data.age));
export const PropertyOrderShape = shape.object({
  customer: CustomerShape,
  preferences: shape.object({ email: shape.boolean(), security: shape.object({ rememberMe: shape.boolean() }) }),
});
const selectors = select(PropertyOrderShape);
export const propertyOrders = defineFixture(PropertyOrderShape, { rules: [
  // customer is typed as the actual Customer class. IDE rename follows its name property.
  selectors.field(order => order.customer.name).use('Ada'),
  selectors.field(order => order.customer.age).use(integer({ min: 18, max: 65 })),
  selectors.all('boolean', { under: order => order.preferences }).use(true),
] });
