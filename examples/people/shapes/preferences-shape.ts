import { shape, type Shape } from '@integration-testing/test-data-generation';
import type { NotificationPreferences } from '../models/notification-preferences.js';

export const PreferencesShape: Shape<NotificationPreferences> = shape.object({
  email: shape.boolean(),
  sms: shape.boolean(),
  security: shape.object({ rememberMe: shape.boolean(), requireTwoFactor: shape.boolean() }),
});
