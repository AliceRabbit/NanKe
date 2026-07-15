import { describe, expect, it } from 'vitest';
import {
  appSettingsVariables,
  defaultAppSettings,
  normalizeAppSettings,
  persistAppSettings,
  readAppSettings
} from '$lib/ui/features/settings/app-settings';

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
    value: () => value
  };
}

describe('application interface settings', () => {
  it('normalizes unknown and out-of-range values', () => {
    expect(
      normalizeAppSettings({
        fontFamily: 'unknown' as never,
        chatFontFamily: 'serif',
        fontWeight: 900,
        uiFontSize: 2,
        chatFontSize: 100,
        chatBubbleWidth: 20,
        avatarShape: 'unknown' as never
      })
    ).toEqual({
      ...defaultAppSettings(),
      chatFontFamily: 'serif',
      fontWeight: 650,
      uiFontSize: 12,
      chatFontSize: 24,
      chatBubbleWidth: 420
    });
  });

  it('recovers from malformed storage and persists normalized settings', () => {
    const malformed = memoryStorage('{');
    expect(readAppSettings(malformed)).toEqual(defaultAppSettings());

    const stored = memoryStorage();
    const settings = persistAppSettings(stored, { ...defaultAppSettings(), uiFontSize: 99 });
    expect(settings.uiFontSize).toBe(18);
    expect(JSON.parse(stored.value() ?? '{}')).toEqual(settings);
  });

  it('produces the root variables used by portalled UI', () => {
    const variables = appSettingsVariables({
      ...defaultAppSettings(),
      chatFontFamily: 'mono',
      avatarShape: 'circle'
    });

    expect(variables['--app-chat-font-family']).toContain('Cascadia Code');
    expect(variables['--app-message-avatar-radius']).toBe('999px');
    expect(variables['--app-chat-bubble-width']).toBe('760px');
  });
});
