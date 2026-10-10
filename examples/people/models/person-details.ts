import type { Address } from './address.js';
import type { Contact } from './contact.js';
import type { NotificationPreferences } from './notification-preferences.js';

export interface PersonDetails {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  home: Address;
  contacts: Contact[];
  preferences: NotificationPreferences;
}
