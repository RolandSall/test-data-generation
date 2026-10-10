import { shape, type Shape } from '@integration-testing/test-data-generation';
import type { PersonDetails } from '../models/person-details.js';
import { AddressShape } from './address-shape.js';
import { ContactShape } from './contact-shape.js';
import { PreferencesShape } from './preferences-shape.js';

export const PersonDetailsShape: Shape<PersonDetails> = shape.object({
  id: shape.string(),
  firstName: shape.string(),
  lastName: shape.string(),
  age: shape.integer({ min: 0, max: 120 }),
  home: AddressShape,
  contacts: shape.array(ContactShape, { minSize: 2, maxSize: 2 }),
  preferences: PreferencesShape,
});
