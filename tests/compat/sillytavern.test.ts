import { describe, expect, it } from 'vitest';
import { importSillyTavernChatJsonl, importSillyTavernPreset, importSillyTavernWorldBook } from '$lib/compat/sillytavern';

describe('SillyTavern compat importers', () => {
  it('imports world info entries into NanKe world books', () => {
    const { worldBook, report } = importSillyTavernWorldBook(
      {
        entries: {
          '0': {
            uid: 0,
            key: ['forest'],
            keysecondary: [],
            comment: 'forest',
            content: 'Forest lore.',
            position: 0,
            disable: false
          }
        }
      },
      'Imported'
    );

    expect(worldBook.name).toBe('Imported');
    expect(worldBook.entries[0].keys).toEqual(['forest']);
    expect(report.mapped).toContain('entries');
  });

  it('imports openai presets into generation profiles', () => {
    const { profile, kind, report } = importSillyTavernPreset({
      chat_completion_source: 'openai',
      openai_model: 'gpt-4o-mini',
      temperature: 0.8,
      openai_max_tokens: 300,
      prompts: [{ identifier: 'main', name: 'Main', role: 'system', content: 'Write as {{char}}.' }]
    });

    expect(kind).toBe('openai');
    expect(profile.provider.type).toBe('openai-compatible');
    expect(profile.sampler.temperature).toBe(0.8);
    expect(report.preservedAsExtras).toContain('prompt_order');
  });

  it('imports chat jsonl messages', () => {
    const { messages, metadata } = importSillyTavernChatJsonl(
      [
        JSON.stringify({ chat_metadata: { integrity: 'abc' } }),
        JSON.stringify({ name: 'User', is_user: true, mes: 'Hi' }),
        JSON.stringify({ name: 'Bot', is_user: false, mes: 'Hello' })
      ].join('\n'),
      'conversation'
    );

    expect(metadata.integrity).toBe('abc');
    expect(messages).toHaveLength(2);
    expect(messages[1].role).toBe('assistant');
  });
});
