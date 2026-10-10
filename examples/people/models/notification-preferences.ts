import type { SecurityPreferences } from './security-preferences.js';

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  security: SecurityPreferences;
}
