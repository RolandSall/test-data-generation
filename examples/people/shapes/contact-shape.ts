import { shape, type Shape } from '@integration-testing/test-data-generation';
import type { Contact } from '../models/contact.js';

export const ContactShape: Shape<Contact> = shape.union([
  shape.object({ kind: shape.literal('email'), value: shape.string({ format: 'email' }) }),
  shape.object({ kind: shape.literal('phone'), value: shape.string({ pattern: /^\+[1-9]\d{9}$/ }) }),
]);
