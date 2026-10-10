import { readFile } from 'node:fs/promises';
import { parseSettings, resolveSettings, type SettingsOptions } from '../../core/settings.js';

export async function readSettingsFile(path: string, options: {
  environment?: Readonly<Record<string, string | undefined>>;
  overrides?: SettingsOptions;
} = {}): Promise<SettingsOptions> {
  const contents = await readFile(path, 'utf8');
  return resolveSettings({ defaults: parseSettings(contents), ...options });
}
