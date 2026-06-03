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
