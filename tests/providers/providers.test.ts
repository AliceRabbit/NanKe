import { describe, expect, it } from 'vitest';
import { parseSseStream } from '$lib/providers/ProviderAdapter';
import { buildGeminiRequest, createGeminiAdapter, geminiUrl } from '$lib/providers/gemini';
import { buildOpenAICompatibleRequest, createOpenAICompatibleAdapter, openAICompatibleUrl } from '$lib/providers/openai-compatible';
import { createDefaultGenerationProfile } from '$lib/schemas/profile';

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of source) {
    items.push(item);
  }
  return items;
}

describe('provider request mapping', () => {
  it('maps canonical messages to strict OpenAI-compatible request bodies', () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'openai-compatible', model: 'test-model', endpoint: 'http://localhost:1234/v1', compatibility: 'strict-openai' },
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

  it('can build non-streaming OpenAI-compatible request bodies', () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'openai-compatible', model: 'test-model', endpoint: 'http://localhost:1234/v1', compatibility: 'strict-openai' },
      request: { stream: false },
      sampler: { maxTokens: 128 }
    });

    const body = buildOpenAICompatibleRequest({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile) as Record<string, unknown>;

    expect(body.stream).toBe(false);
    expect(body).not.toHaveProperty('stream_options');
  });

  it('keeps extended sampler fields for custom OpenAI-compatible endpoints', () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'openai-compatible', model: 'test-model', endpoint: 'http://localhost:1234/v1/chat/completions', compatibility: 'extended' },
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
      provider: { type: 'gemini', model: 'gemini-2.5-pro' }
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
    expect(geminiUrl(profile, false)).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent');
  });

  it('filters disabled SillyTavern sampler defaults from Gemini request bodies', () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro' },
      sampler: {
        temperature: 1,
        topP: 0.99,
        topK: 0,
        topA: 0,
        minP: 0,
        frequencyPenalty: 0,
        presencePenalty: 0,
        repetitionPenalty: 1,
        maxTokens: 30000,
        contextTokens: 2000000,
        n: 1
      }
    });

    const body = buildGeminiRequest({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile) as Record<string, unknown>;
    const generationConfig = body.generationConfig as Record<string, unknown>;

    expect(generationConfig.temperature).toBe(1);
    expect(generationConfig.topP).toBe(0.99);
    expect(generationConfig.maxOutputTokens).toBe(30000);
    expect(generationConfig).not.toHaveProperty('topK');
    expect(generationConfig).not.toHaveProperty('topA');
    expect(generationConfig).not.toHaveProperty('minP');
    expect(generationConfig).not.toHaveProperty('frequencyPenalty');
    expect(generationConfig).not.toHaveProperty('presencePenalty');
    expect(generationConfig).not.toHaveProperty('repetitionPenalty');
    expect(generationConfig).not.toHaveProperty('candidateCount');
  });

  it('adds SSE mode to custom Gemini streaming endpoints', () => {
    const profile = createDefaultGenerationProfile({
      provider: {
        type: 'gemini',
        model: 'gemini-2.5-pro',
        endpoint: 'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-pro:streamGenerateContent?key=test-key'
      }
    });

    expect(geminiUrl(profile)).toBe('https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-pro:streamGenerateContent?key=test-key&alt=sse');
  });

  it('parses SSE events without a trailing blank line', async () => {
    const payloads = await collect(parseSseStream(new Response('data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}')));

    expect(payloads).toEqual([{ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }]);
  });

  it('treats legacy Vertex profiles without mode as OAuth profiles', () => {
    const profile = createDefaultGenerationProfile({
      provider: {
        type: 'gemini',
        model: 'gemini-2.5-pro',
        vertex: { projectId: 'legacy-project', location: 'global', accessToken: 'legacy-token' } as never
      }
    });

    expect(profile.provider.type).toBe('gemini');
    if (profile.provider.type !== 'gemini') throw new Error('Expected Gemini profile');
    expect(profile.provider.vertex?.mode).toBe('oauth');
    expect(geminiUrl(profile)).toBe('https://aiplatform.googleapis.com/v1/projects/legacy-project/locations/global/publishers/google/models/gemini-2.5-pro:streamGenerateContent?alt=sse');
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
        compatibility: 'strict-openai'
      }
    });

    const chunks = [];
    for await (const chunk of createOpenAICompatibleAdapter(fetchImpl).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile)) {
      chunks.push(chunk);
    }

    expect(chunks[0]).toEqual(expect.objectContaining({ type: 'text', text: 'ok' }));
    expect(calls[0].headers.Authorization).toBe('Bearer direct-openai-key');
    expect(calls[0].headers['OpenAI-Organization']).toBeUndefined();
    expect(calls[0].headers['OpenAI-Project']).toBeUndefined();
  });

  it('normalizes non-streaming OpenAI and Gemini responses through adapters', async () => {
    const openAIProfile = createDefaultGenerationProfile({
      provider: { type: 'openai-compatible', model: 'test-model', endpoint: 'https://api.openai.com/v1', compatibility: 'strict-openai' },
      request: { stream: false }
    });
    const openAIFetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'openai ok' } }] }));
    const openAIChunks = [];
    for await (const chunk of createOpenAICompatibleAdapter(openAIFetch).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, openAIProfile)) {
      openAIChunks.push(chunk);
    }

    const geminiProfile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro' },
      request: { stream: false }
    });
    const geminiFetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'gemini ok' }] } }] }));
    const geminiChunks = [];
    for await (const chunk of createGeminiAdapter(geminiFetch).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, geminiProfile)) {
      geminiChunks.push(chunk);
    }

    expect(openAIChunks[0]).toEqual(expect.objectContaining({ type: 'text', text: 'openai ok' }));
    expect(geminiChunks[0]).toEqual(expect.objectContaining({ type: 'text', text: 'gemini ok' }));
  });

  it('normalizes Gemini JSON array stream responses', async () => {
    const geminiProfile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro' }
    });
    const geminiFetch = async () =>
      new Response(
        JSON.stringify([
          { candidates: [{ content: { parts: [{ text: 'first ' }] } }] },
          { candidates: [{ content: { parts: [{ text: 'second' }] } }] }
        ])
      );

    const chunks = await collect(createGeminiAdapter(geminiFetch).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, geminiProfile));

    expect(chunks.filter((chunk) => chunk.type === 'text').map((chunk) => chunk.text).join('')).toBe('first second');
  });

  it('surfaces Gemini stream events that finish without text', async () => {
    const geminiProfile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro' }
    });
    const geminiFetch = async () => new Response('data: {"candidates":[{"content":{"role":"model"},"finishReason":"MAX_TOKENS"}]}\n\n');

    const chunks = await collect(createGeminiAdapter(geminiFetch).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, geminiProfile));

    expect(chunks[0]).toEqual(expect.objectContaining({ type: 'error' }));
    expect(chunks[0].text).toContain('MAX_TOKENS');
  });

  it('uses x-goog-api-key for Gemini AI Studio, key query for Vertex Express, and bearer auth for Vertex OAuth', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const geminiStream = 'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n';
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), headers: init?.headers as Record<string, string> });
      return new Response(geminiStream);
    };

    const aiStudioProfile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro', apiKey: 'gemini-key' }
    });
    for await (const _chunk of createGeminiAdapter(fetchImpl).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, aiStudioProfile)) {
      // drain stream
    }

    const vertexExpressProfile = createDefaultGenerationProfile({
      provider: {
        type: 'gemini',
        model: 'gemini-2.5-pro',
        vertex: { mode: 'express', location: 'global', apiKey: 'vertex-express-key' }
      }
    });
    for await (const _chunk of createGeminiAdapter(fetchImpl).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, vertexExpressProfile)) {
      // drain stream
    }

    const vertexOAuthProfile = createDefaultGenerationProfile({
      provider: {
        type: 'gemini',
        model: 'gemini-2.5-pro',
        vertex: { mode: 'oauth', projectId: 'project-id', location: 'us-central1', accessToken: 'vertex-token' }
      }
    });
    for await (const _chunk of createGeminiAdapter(fetchImpl).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, vertexOAuthProfile)) {
      // drain stream
    }

    expect(calls[0].headers['x-goog-api-key']).toBe('gemini-key');
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[1].url).toContain('https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-pro:streamGenerateContent');
    expect(calls[1].url).toContain('key=vertex-express-key');
    expect(calls[1].headers['x-goog-api-key']).toBeUndefined();
    expect(calls[1].headers.Authorization).toBeUndefined();
    expect(calls[2].headers.Authorization).toBe('Bearer vertex-token');
    expect(calls[2].headers['x-goog-api-key']).toBeUndefined();
    expect(calls[2].url).toContain('/projects/project-id/locations/us-central1/publishers/google/models/gemini-2.5-pro:streamGenerateContent');
  });
});
