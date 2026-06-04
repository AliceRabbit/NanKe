import type { GenerationProfile } from '$lib/schemas/profile';
import type { GenerationChunk, ProviderRequest } from '$lib/schemas/provider';
import { parseSseStream, type ProviderAdapter, type ProviderFetch } from './ProviderAdapter';

type GeminiChunk = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; thought?: boolean; thoughtSignature?: string }>;
    };
    finishReason?: string;
    finishMessage?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
    blockReasonMessage?: string;
  };
};

function withDefinedValues<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '')) as Partial<T>;
}

function optionalNumber(value: number | undefined, options: { allowZero?: boolean } = {}): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (!options.allowZero && value === 0) return undefined;
  return value;
}

function positiveNumber(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function optionalInteger(value: number | undefined, options: { skipOne?: boolean } = {}): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return undefined;
  if (options.skipOne && value === 1) return undefined;
  return value;
}

function optionalNonNegativeInteger(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return undefined;
  return value;
}

function geminiRole(role: string): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user';
}

export function buildGeminiThinkingConfig(profile: GenerationProfile) {
  const reasoning = profile.reasoning?.gemini;
  if (!reasoning) return undefined;

  const config = withDefinedValues({
    includeThoughts: reasoning.includeThoughts ? true : undefined,
    thinkingBudget: reasoning.mode === 'off' ? 0 : reasoning.mode === 'budget' ? optionalNonNegativeInteger(reasoning.budget) : undefined,
    thinkingLevel: reasoning.mode === 'level' ? reasoning.level : undefined
  });

  return Object.keys(config).length ? config : undefined;
}

export function buildGeminiRequest(request: ProviderRequest, profile: GenerationProfile) {
  const systemText = request.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');

  const contents = request.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: geminiRole(message.role),
      parts: [{ text: message.content }]
    }));

  const stop = request.stop.length ? request.stop : profile.sampler.stop;
  const generationConfig = withDefinedValues({
    temperature: optionalNumber(request.temperature ?? profile.sampler.temperature, { allowZero: true }),
    topP: positiveNumber(request.topP ?? profile.sampler.topP),
    topK: optionalInteger(request.topK ?? profile.sampler.topK),
    maxOutputTokens: positiveNumber(request.maxTokens ?? profile.sampler.maxTokens),
    stopSequences: stop?.length ? stop : undefined,
    frequencyPenalty: optionalNumber(request.frequencyPenalty ?? profile.sampler.frequencyPenalty),
    presencePenalty: optionalNumber(request.presencePenalty ?? profile.sampler.presencePenalty),
    seed: request.seed ?? profile.sampler.seed,
    candidateCount: optionalInteger(request.n ?? profile.sampler.n, { skipOne: true }),
    thinkingConfig: buildGeminiThinkingConfig(profile)
  });

  return withDefinedValues({
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents,
    generationConfig: Object.keys(generationConfig).length ? generationConfig : undefined
  });
}

function vertexBaseUrl(location: string): string {
  return location === 'global' ? 'https://aiplatform.googleapis.com/v1' : `https://${location}-aiplatform.googleapis.com/v1`;
}

function withQuery(url: string, params: Record<string, string | undefined>): string {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value) parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}

export function geminiUrl(profile: GenerationProfile, stream = true): string {
  if (profile.provider.type !== 'gemini') throw new Error('Invalid profile for Gemini adapter.');
  if (profile.provider.endpoint) return stream ? withQuery(profile.provider.endpoint, { alt: 'sse' }) : profile.provider.endpoint;
  const method = stream ? 'streamGenerateContent' : 'generateContent';
  if (profile.provider.vertex) {
    const mode = profile.provider.vertex.mode ?? 'express';
    const location = profile.provider.vertex.location ?? 'us-central1';
    const model = encodeURIComponent(profile.provider.model);

    if (mode === 'express') {
      const projectPath = profile.provider.vertex.projectId
        ? `/projects/${encodeURIComponent(profile.provider.vertex.projectId)}/locations/${encodeURIComponent(location)}`
        : '';
      return withQuery(`${vertexBaseUrl(location)}${projectPath}/publishers/google/models/${model}:${method}`, {
        key: profile.provider.vertex.apiKey?.trim(),
        alt: stream ? 'sse' : undefined
      });
    }

    return withQuery(
      `${vertexBaseUrl(location)}/projects/${encodeURIComponent(profile.provider.vertex.projectId ?? '')}/locations/${encodeURIComponent(location)}/publishers/google/models/${model}:${method}`,
      { alt: stream ? 'sse' : undefined }
    );
  }
  return withQuery(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.provider.model)}:${method}`, {
    alt: stream ? 'sse' : undefined
  });
}

function geminiHeaders(profile: GenerationProfile, apiKey?: string, vertexToken?: string): HeadersInit {
  if (profile.provider.type !== 'gemini') throw new Error('Invalid profile for Gemini adapter.');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (profile.provider.vertex) {
    const mode = profile.provider.vertex.mode ?? 'express';
    if (mode === 'oauth' && vertexToken) headers.Authorization = `Bearer ${vertexToken}`;
    return headers;
  }

  if (apiKey) headers['x-goog-api-key'] = apiKey;
  return headers;
}

async function readProviderError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `${response.status} ${response.statusText}`;
  const sseData = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n');
  try {
    const parsed = JSON.parse(sseData || text) as { error?: { message?: string }; message?: string };
    return parsed.error?.message ?? parsed.message ?? text;
  } catch {
    return text;
  }
}

function emptyGeminiResultError(payload: GeminiChunk): string | undefined {
  const feedback = payload.promptFeedback;
  if (feedback?.blockReason) {
    return feedback.blockReasonMessage ?? `Gemini blocked the prompt: ${feedback.blockReason}`;
  }

  const candidate = payload.candidates?.[0];
  const finishReason = candidate?.finishReason;
  if (!finishReason || finishReason === 'STOP') return undefined;
  const message = candidate.finishMessage ? ` ${candidate.finishMessage}` : '';
  return `Gemini returned no text. Finish reason: ${finishReason}.${message}`;
}

function splitGeminiCandidateText(payload: GeminiChunk) {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  let text = '';
  let reasoning = '';

  for (const part of parts) {
    const partText = part.text ?? '';
    if (!partText) continue;
    if (part.thought === true) {
      reasoning += partText;
    } else {
      text += partText;
    }
  }

  return { text, reasoning };
}

export function createGeminiAdapter(fetchImpl: ProviderFetch = fetch): ProviderAdapter {
  return {
    type: 'gemini',
    async *stream(request: ProviderRequest, profile: GenerationProfile, signal?: AbortSignal): AsyncIterable<GenerationChunk> {
      if (profile.provider.type !== 'gemini') {
        throw new Error('Invalid profile for Gemini adapter.');
      }

      const apiKey = profile.provider.apiKey?.trim();
      const vertexToken = profile.provider.vertex?.accessToken?.trim();
      const streaming = request.stream ?? profile.request.stream;

      const response = await fetchImpl(geminiUrl(profile, streaming), {
        method: 'POST',
        signal,
        headers: geminiHeaders(profile, apiKey, vertexToken),
        body: JSON.stringify(buildGeminiRequest(request, profile))
      });

      if (!response.ok) {
        yield { type: 'error', text: await readProviderError(response), raw: { status: response.status } };
        return;
      }

      if (!streaming) {
        const payload = (await response.json()) as GeminiChunk;
        const { text, reasoning } = splitGeminiCandidateText(payload);
        if (reasoning) yield { type: 'reasoning', text: reasoning, raw: payload };
        if (text) yield { type: 'text', text, raw: payload };
        yield { type: 'done', text: '' };
        return;
      }

      let sawOutput = false;
      let emptyResultError: string | undefined;
      for await (const payload of parseSseStream(response)) {
        const chunk = payload as GeminiChunk;
        const { text, reasoning } = splitGeminiCandidateText(chunk);
        if (reasoning) {
          sawOutput = true;
          yield { type: 'reasoning', text: reasoning, raw: payload };
        }
        if (text) {
          sawOutput = true;
          yield { type: 'text', text, raw: payload };
        } else {
          emptyResultError = emptyGeminiResultError(chunk) ?? emptyResultError;
        }
      }

      if (!sawOutput && emptyResultError) {
        yield { type: 'error', text: emptyResultError };
        return;
      }

      yield { type: 'done', text: '' };
    }
  };
}
