import { describe, expect, it } from 'vitest';
import { PromptCompiler } from '$lib/core/prompt/PromptCompiler';
import { createCharacter } from '$lib/schemas/character';
import { createMessage } from '$lib/schemas/message';
import { createDefaultGenerationProfile } from '$lib/schemas/profile';

describe('PromptCompiler', () => {
  it('compiles ordered prompt slots with character data and chat history', () => {
    const profile = createDefaultGenerationProfile();
    const character = createCharacter({
      name: 'Seraphina',
      description: 'Guardian of the glade.',
      personality: 'Warm and vigilant.'
    });

    const compiled = new PromptCompiler().compile({
      profile,
      character,
      messages: [createMessage({ role: 'user', content: 'Hello.' })]
    });

    expect(compiled.messages.map((message) => message.content)).toContain('Guardian of the glade.');
    expect(compiled.messages.at(-1)?.content).toBe('Hello.');
    expect(compiled.tokenReport.estimatedPromptTokens).toBeGreaterThan(0);
  });

  it('injects user persona and uses persona name for user macros', () => {
    const profile = createDefaultGenerationProfile();

    const compiled = new PromptCompiler().compile({
      profile,
      persona: 'Mira is a careful archivist.',
      userName: 'Mira',
      messages: [createMessage({ role: 'user', content: 'Hello.' })]
    });

    expect(compiled.messages.map((message) => message.content)).toContain("Write Assistant's next reply in a fictional chat between Assistant and Mira.");
    expect(compiled.messages.map((message) => message.content)).toContain('Mira is a careful archivist.');
  });

  it('renders SillyTavern macros used by imported Izumi presets', () => {
    const profile = createDefaultGenerationProfile({
      prompt: {
        ...createDefaultGenerationProfile().prompt,
        slots: [
          {
            id: 'macro',
            source: 'system',
            role: 'system',
            enabled: true,
            label: 'Macro',
            content:
              '{{setvar::tone::bright}}{{getvar::tone}} {{LastUserMessage}} {{lastChatMessage}} {{random::a,b}} {{roll 1d1}} {{date}} {{time}} {{// hidden}}'
          },
          { id: 'history', source: 'history', role: 'user', enabled: true, label: 'History', content: '' }
        ]
      }
    });

    const compiled = new PromptCompiler().compile({
      profile,
      messages: [createMessage({ role: 'user', content: 'Hello.' }), createMessage({ role: 'assistant', content: 'Hi.' })]
    });
    const content = compiled.messages[0].content;

    expect(content).toContain('bright Hello. Hi.');
    expect(content).toMatch(/\b[ab]\b/);
    expect(content).toContain('1');
    expect(content).not.toContain('{{');
    expect(compiled.warnings.some((warning) => warning.code === 'unsupported-sillytavern-macros')).toBe(false);
  });

  it('supports nested and scoped SillyTavern condition macros', () => {
    const profile = createDefaultGenerationProfile({
      prompt: {
        ...createDefaultGenerationProfile().prompt,
        slots: [
          {
            id: 'macro',
            source: 'system',
            role: 'system',
            enabled: true,
            label: 'Macro',
            content: '{{.enabled = yes}}{{if .enabled}}Hello {{char}}{{else}}Nope{{/if}}'
          }
        ]
      }
    });

    const compiled = new PromptCompiler().compile({
      profile,
      character: createCharacter({ name: 'Izumi' }),
      messages: []
    });

    expect(compiled.messages[0].content).toBe('Hello Izumi');
  });

  it('trims oldest non-system messages when context budget is exceeded', () => {
    const profile = createDefaultGenerationProfile({
      sampler: { contextTokens: 90, maxTokens: 10 }
    });

    const compiled = new PromptCompiler().compile({
      profile,
      messages: [
        createMessage({ role: 'user', content: 'A'.repeat(200) }),
        createMessage({ role: 'user', content: 'latest' })
      ]
    });

    expect(compiled.tokenReport.trimmedMessages).toBeGreaterThan(0);
    expect(compiled.messages.some((message) => message.content === 'latest')).toBe(true);
  });
});
