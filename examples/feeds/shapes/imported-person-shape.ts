import { shape, type Shape } from '@integration-testing/test-data-generation';
import type { ImportedPerson } from '../models/imported-person.js';

export const ImportedPersonShape: Shape<ImportedPerson> = shape.object({
  id: shape.string(),
  firstName: shape.string(),
  lastName: shape.string(),
  displayName: shape.string(),
  age: shape.integer({ min: 0, max: 120 }),
  city: shape.string(),
  active: shape.boolean(),
});
