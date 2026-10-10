import { shape } from '@integration-testing/test-data-generation';
import { Person } from '../models/person.js';
import { PersonDetailsShape } from './person-details-shape.js';

export const PersonShape = shape.transform(PersonDetailsShape, details => new Person(details));
