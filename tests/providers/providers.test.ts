import { describe, expect, it } from 'vitest';
import { buildGeminiRequest, createGeminiAdapter, geminiUrl } from '$lib/providers/gemini';
import { buildOpenAICompatibleRequest, createOpenAICompatibleAdapter, openAICompatibleUrl } from '$lib/providers/openai-compatible';
import { createDefaultGenerationProfile } from '$lib/schemas/profile';

describe('provider request mapping', () => {
  it('maps canonical messages to strict OpenAI-compatible request bodies', () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'openai-compatible', model: 'test-model', endpoint: 'http://localhost:1234/v1', apiKeyEnv: 'TEST_KEY', compatibility: 'strict-openai' },
      sampler: { topK: 40, maxTokens: 128 }
    });

    const body = buildOpenAICompatibleRequest(
      {
        messages: [{ role: 'user', content: 'Hello' }],
        stop: [],
        maxTokens: 128
      },
      profile
    ) as Record<string, unknown>;

    expect(body.model).toBe('test-model');
    expect((body.messages as unknown[])[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(body.stream).toBe(true);
    expect(body.max_completion_tokens).toBe(128);
    expect(body).not.toHaveProperty('top_k');
    expect(body).not.toHaveProperty('max_tokens');
    expect(openAICompatibleUrl(profile)).toBe('http://localhost:1234/v1/chat/completions');
  });

  it('keeps extended sampler fields for custom OpenAI-compatible endpoints', () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'openai-compatible', model: 'test-model', endpoint: 'http://localhost:1234/v1/chat/completions', apiKeyEnv: 'TEST_KEY', compatibility: 'extended' },
      sampler: { topK: 40, minP: 0.1, repetitionPenalty: 1.05, maxTokens: 256 }
    });

    const body = buildOpenAICompatibleRequest({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile) as Record<string, unknown>;

    expect(body.top_k).toBe(40);
    expect(body.min_p).toBe(0.1);
    expect(body.repetition_penalty).toBe(1.05);
    expect(body.max_tokens).toBe(256);
    expect(openAICompatibleUrl(profile)).toBe('http://localhost:1234/v1/chat/completions');
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
    ) as Record<string, unknown>;

    const systemInstruction = body.systemInstruction as { parts: Array<{ text: string }> };
    const contents = body.contents as Array<{ role: string }>;
    const generationConfig = body.generationConfig as { maxOutputTokens: number };
    expect(systemInstruction.parts[0].text).toBe('System text');
    expect(contents[0].role).toBe('model');
    expect(contents[1].role).toBe('user');
    expect(generationConfig.maxOutputTokens).toBe(512);
    expect(geminiUrl(profile)).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse');
  });

  it('sends provider authentication headers through adapters', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const okStream = 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n';
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), headers: init?.headers as Record<string, string> });
      return new Response(okStream);
    };

    const profile = createDefaultGenerationProfile({
      provider: {
        type: 'openai-compatible',
        model: 'test-model',
        endpoint: 'https://api.openai.com/v1',
        apiKey: 'direct-openai-key',
        apiKeyEnv: 'TEST_KEY',
        organization: 'org_test',
        project: 'proj_test',
        compatibility: 'strict-openai'
      }
    });

    const chunks = [];
    for await (const chunk of createOpenAICompatibleAdapter(fetchImpl).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile)) {
      chunks.push(chunk);
    }

    expect(chunks[0]).toEqual(expect.objectContaining({ type: 'text', text: 'ok' }));
    expect(calls[0].headers.Authorization).toBe('Bearer direct-openai-key');
    expect(calls[0].headers['X-OpenAI-Organization']).toBe('org_test');
    expect(calls[0].headers['X-OpenAI-Project']).toBe('proj_test');
  });

  it('uses x-goog-api-key for Gemini AI Studio and bearer auth for Vertex', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const geminiStream = 'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n';
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), headers: init?.headers as Record<string, string> });
      return new Response(geminiStream);
    };

    const aiStudioProfile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro', apiKey: 'gemini-key', apiKeyEnv: 'GEMINI_API_KEY' }
    });
    for await (const _chunk of createGeminiAdapter(fetchImpl).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, aiStudioProfile)) {
      // drain stream
    }

    const vertexProfile = createDefaultGenerationProfile({
      provider: {
        type: 'gemini',
        model: 'gemini-2.5-pro',
        apiKeyEnv: 'GEMINI_API_KEY',
        vertex: { projectId: 'project-id', location: 'us-central1', accessToken: 'vertex-token', accessTokenEnv: 'GOOGLE_VERTEX_ACCESS_TOKEN' }
      }
    });
    for await (const _chunk of createGeminiAdapter(fetchImpl).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, vertexProfile)) {
      // drain stream
    }

    expect(calls[0].headers['x-goog-api-key']).toBe('gemini-key');
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[1].headers.Authorization).toBe('Bearer vertex-token');
    expect(calls[1].headers['x-goog-api-key']).toBeUndefined();
    expect(calls[1].url).toContain('/projects/project-id/locations/us-central1/publishers/google/models/gemini-2.5-pro:streamGenerateContent');
  });
});
