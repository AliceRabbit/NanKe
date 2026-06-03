import { describe, expect, it } from 'vitest';
import { buildGeminiRequest } from '$lib/providers/gemini';
import { buildOpenAICompatibleRequest } from '$lib/providers/openai-compatible';
import { createDefaultGenerationProfile } from '$lib/schemas/profile';

describe('provider request mapping', () => {
  it('maps canonical messages to OpenAI-compatible request bodies', () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'openai-compatible', model: 'test-model', endpoint: 'http://localhost:1234/v1', apiKeyEnv: 'TEST_KEY' }
    });

    const body = buildOpenAICompatibleRequest(
      {
        messages: [{ role: 'user', content: 'Hello' }],
        stop: [],
        maxTokens: 128
      },
      profile
    );

    expect(body.model).toBe('test-model');
    expect(body.messages[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(body.stream).toBe(true);
  });

  it('maps system messages into Gemini systemInstruction', () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro', apiKeyEnv: 'GEMINI_API_KEY' }
    });

    const body = buildGeminiRequest(
      {
        messages: [
          { role: 'system', content: 'System text' },
          { role: 'assistant', content: 'Previous answer' },
          { role: 'user', content: 'Next question' }
        ],
        stop: []
      },
      profile
    );

    expect(body.systemInstruction?.parts[0].text).toBe('System text');
    expect(body.contents[0].role).toBe('model');
    expect(body.contents[1].role).toBe('user');
  });
});
