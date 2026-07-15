import { ApiError, GoogleGenAI, ThinkingLevel, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { parseSseStream } from '$lib/providers/ProviderAdapter';
import {
  buildGeminiClientOptions,
  buildGeminiRequest,
  createGeminiAdapter,
  createGeminiClient,
  type GeminiClientFactory
} from '$lib/providers/gemini';
import { buildOpenAICompatibleRequest, createOpenAICompatibleAdapter, openAICompatibleUrl } from '$lib/providers/openai-compatible';
import { createDefaultGenerationProfile } from '$lib/schemas/profile';

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of source) {
    items.push(item);
  }
  return items;
}

function geminiResponse(value: unknown): GenerateContentResponse {
  return value as GenerateContentResponse;
}

function fakeGeminiClient(responses: GenerateContentResponse[]) {
  const generateCalls: GenerateContentParameters[] = [];
  const streamCalls: GenerateContentParameters[] = [];
  const factory: GeminiClientFactory = () => ({
    models: {
      async generateContent(params) {
        generateCalls.push(params);
        return responses[0] ?? geminiResponse({});
      },
      async generateContentStream(params) {
        streamCalls.push(params);
        return (async function* () {
          for (const response of responses) yield response;
        })();
      }
    }
  });

  return { factory, generateCalls, streamCalls };
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

  it('maps OpenAI-compatible reasoning effort when configured', () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'openai-compatible', model: 'test-model', endpoint: 'http://localhost:1234/v1', compatibility: 'strict-openai' },
      thinking: {
        openai: { effort: 'high' },
        gemini: { includeThoughts: false, mode: 'default', level: 'medium' }
      }
    });

    const body = buildOpenAICompatibleRequest({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile) as Record<string, unknown>;

    expect(body.reasoning_effort).toBe('high');
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

  it('maps canonical messages to Google Gen AI SDK parameters', () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro' }
    });

    const params = buildGeminiRequest(
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

    const contents = params.contents as Array<{ role: string }>;
    expect(params.model).toBe('gemini-2.5-pro');
    expect(params.config?.systemInstruction).toBe('System text');
    expect(contents[0].role).toBe('model');
    expect(contents[1].role).toBe('user');
    expect(params.config?.maxOutputTokens).toBe(512);
  });

  it('maps Gemini thinking budgets into SDK config', () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro' },
      thinking: {
        openai: { effort: 'default' },
        gemini: { includeThoughts: true, mode: 'budget', budget: 1024, level: 'medium' }
      }
    });

    const params = buildGeminiRequest({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile);

    expect(params.config?.thinkingConfig).toEqual({ includeThoughts: true, thinkingBudget: 1024 });
  });

  it('maps Gemini 3 thinking levels to the SDK enum', () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-3-pro' },
      thinking: {
        openai: { effort: 'default' },
        gemini: { includeThoughts: true, mode: 'level', level: 'low' }
      }
    });

    const params = buildGeminiRequest({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile);

    expect(params.config?.thinkingConfig).toEqual({ includeThoughts: true, thinkingLevel: ThinkingLevel.LOW });
  });

  it('filters disabled SillyTavern sampler defaults from Gemini SDK config', () => {
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

    const config = buildGeminiRequest({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile).config;

    expect(config?.temperature).toBe(1);
    expect(config?.topP).toBe(0.99);
    expect(config?.maxOutputTokens).toBe(30000);
    expect(config).not.toHaveProperty('topK');
    expect(config).not.toHaveProperty('topA');
    expect(config).not.toHaveProperty('minP');
    expect(config).not.toHaveProperty('frequencyPenalty');
    expect(config).not.toHaveProperty('presencePenalty');
    expect(config).not.toHaveProperty('repetitionPenalty');
    expect(config).not.toHaveProperty('candidateCount');
  });

  it('drops retired custom Gemini endpoint and access token fields from stored profiles', () => {
    const profile = createDefaultGenerationProfile({
      provider: {
        type: 'gemini',
        model: 'gemini-2.5-pro',
        endpoint: 'https://example.com/custom',
        vertex: { projectId: 'legacy-project', location: 'global', accessToken: 'legacy-token' }
      } as never
    });

    expect(profile.provider).not.toHaveProperty('endpoint');
    expect(profile.provider.type).toBe('gemini');
    if (profile.provider.type !== 'gemini') throw new Error('Expected Gemini profile');
    expect(profile.provider.vertex).toEqual({ mode: 'oauth', projectId: 'legacy-project', location: 'global' });
    expect(profile.provider.vertex).not.toHaveProperty('accessToken');
  });

  it('maps all supported Google authentication modes to official SDK options', () => {
    const aiStudio = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro', apiKey: 'gemini-key' }
    });
    const vertexExpress = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro', vertex: { mode: 'express', apiKey: 'express-key' } }
    });
    const vertexAdc = createDefaultGenerationProfile({
      provider: {
        type: 'gemini',
        model: 'gemini-2.5-pro',
        vertex: { mode: 'oauth', projectId: 'project-id', location: 'us-central1' }
      }
    });

    expect(buildGeminiClientOptions(aiStudio)).toEqual({ vertexai: false, apiKey: 'gemini-key', apiVersion: 'v1beta' });
    expect(buildGeminiClientOptions(vertexExpress)).toEqual({ vertexai: true, apiKey: 'express-key', apiVersion: 'v1' });
    expect(buildGeminiClientOptions(vertexAdc)).toEqual({
      vertexai: true,
      project: 'project-id',
      location: 'us-central1',
      apiVersion: 'v1'
    });
    expect(createGeminiClient(aiStudio)).toBeInstanceOf(GoogleGenAI);
  });

  it('parses OpenAI-compatible SSE events without a trailing blank line', async () => {
    const payloads = await collect(parseSseStream(new Response('data: {"choices":[{"delta":{"content":"ok"}}]}')));

    expect(payloads).toEqual([{ choices: [{ delta: { content: 'ok' } }] }]);
  });

  it('sends OpenAI-compatible provider authentication headers', async () => {
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

    const chunks = await collect(createOpenAICompatibleAdapter(fetchImpl).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile));

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
    const openAIChunks = await collect(createOpenAICompatibleAdapter(openAIFetch).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, openAIProfile));

    const geminiProfile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro' },
      request: { stream: false }
    });
    const fake = fakeGeminiClient([geminiResponse({ candidates: [{ content: { parts: [{ text: 'gemini ok' }] } }] })]);
    const geminiChunks = await collect(createGeminiAdapter(fake.factory).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, geminiProfile));

    expect(openAIChunks[0]).toEqual(expect.objectContaining({ type: 'text', text: 'openai ok' }));
    expect(geminiChunks[0]).toEqual(expect.objectContaining({ type: 'text', text: 'gemini ok' }));
    expect(fake.generateCalls).toHaveLength(1);
    expect(fake.streamCalls).toHaveLength(0);
  });

  it('normalizes native thinking chunks from OpenAI-compatible and Gemini providers', async () => {
    const openAIProfile = createDefaultGenerationProfile({
      provider: { type: 'openai-compatible', model: 'test-model', endpoint: 'https://api.openai.com/v1', compatibility: 'strict-openai' }
    });
    const openAIStream = 'data: {"choices":[{"delta":{"reasoning_content":"thinking ","content":"answer"}}]}\n\n';
    const openAIChunks = await collect(createOpenAICompatibleAdapter(async () => new Response(openAIStream)).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, openAIProfile));

    const geminiProfile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro' }
    });
    const fake = fakeGeminiClient([
      geminiResponse({ candidates: [{ content: { parts: [{ text: 'thinking ', thought: true }, { text: 'answer' }] } }] })
    ]);
    const geminiChunks = await collect(createGeminiAdapter(fake.factory).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, geminiProfile));

    expect(openAIChunks[0]).toEqual(expect.objectContaining({ type: 'thinking', text: 'thinking ' }));
    expect(openAIChunks[1]).toEqual(expect.objectContaining({ type: 'text', text: 'answer' }));
    expect(geminiChunks[0]).toEqual(expect.objectContaining({ type: 'thinking', text: 'thinking ' }));
    expect(geminiChunks[1]).toEqual(expect.objectContaining({ type: 'text', text: 'answer' }));
  });

  it('normalizes multiple Google SDK stream chunks', async () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro' }
    });
    const fake = fakeGeminiClient([
      geminiResponse({ candidates: [{ content: { parts: [{ text: 'first ' }] } }] }),
      geminiResponse({ candidates: [{ content: { parts: [{ text: 'second' }] } }] })
    ]);

    const chunks = await collect(createGeminiAdapter(fake.factory).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile));

    expect(chunks.filter((chunk) => chunk.type === 'text').map((chunk) => chunk.text).join('')).toBe('first second');
    expect(fake.streamCalls).toHaveLength(1);
  });

  it('surfaces Gemini stream events that finish without text', async () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro' }
    });
    const fake = fakeGeminiClient([geminiResponse({ candidates: [{ content: { role: 'model' }, finishReason: 'MAX_TOKENS' }] })]);

    const chunks = await collect(createGeminiAdapter(fake.factory).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile));

    expect(chunks[0]).toEqual(expect.objectContaining({ type: 'error' }));
    expect(chunks[0].text).toContain('MAX_TOKENS');
  });

  it('normalizes official SDK API errors', async () => {
    const profile = createDefaultGenerationProfile({
      provider: { type: 'gemini', model: 'gemini-2.5-pro' }
    });
    const error = new ApiError({ message: 'quota exceeded', status: 429 });
    const factory: GeminiClientFactory = () => ({
      models: {
        async generateContent() {
          throw error;
        },
        async generateContentStream() {
          throw error;
        }
      }
    });

    const chunks = await collect(createGeminiAdapter(factory).stream({ messages: [{ role: 'user', content: 'Hello' }], stop: [] }, profile));

    expect(chunks[0]).toEqual({ type: 'error', text: 'quota exceeded', raw: { status: 429 } });
  });
});
