import { shape, type Shape } from '@integration-testing/test-data-generation';
import type { Address } from '../models/address.js';

export const AddressShape: Shape<Address> = shape.object({
  street: shape.string({ minLength: 5, maxLength: 30 }),
  city: shape.string({ minLength: 3, maxLength: 20 }),
  postalCode: shape.string({ minLength: 5, maxLength: 5, alphabet: '0123456789' }),
});
