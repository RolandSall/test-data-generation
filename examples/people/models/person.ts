import type { PersonDetails } from './person-details.js';
import type { Address } from './address.js';
import type { Contact } from './contact.js';
import type { NotificationPreferences } from './notification-preferences.js';

/** A real application class: generation must call its constructor. */
export class Person implements PersonDetails {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly age: number;
  readonly home: Address;
  readonly contacts: Contact[];
  readonly preferences: NotificationPreferences;

  constructor(details: PersonDetails) {
    if (!Number.isInteger(details.age) || details.age < 0 || details.age > 120) {
      throw new RangeError('Person age must be an integer between 0 and 120');
    }
    this.id = details.id;
    this.firstName = details.firstName;
    this.lastName = details.lastName;
    this.age = details.age;
    this.home = details.home;
    this.contacts = details.contacts;
    this.preferences = details.preferences;
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  isAdult(): boolean {
    return this.age >= 18;
  }
}
