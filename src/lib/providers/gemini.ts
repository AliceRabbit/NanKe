import {
  ApiError,
  GoogleGenAI,
  ThinkingLevel,
  type GenerateContentConfig,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type GoogleGenAIOptions,
  type ThinkingConfig
} from '@google/genai';
import type { GenerationProfile } from '$lib/schemas/profile';
import type { GenerationChunk, ProviderRequest } from '$lib/schemas/provider';
import type { ProviderAdapter } from './ProviderAdapter';
import {
  coerceGeminiThinkingLevel,
  geminiModelUsesThinkingLevel,
  geminiThinkingBudgetFromLevel
} from './gemini-thinking';

type GeminiModelsClient = {
  generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
  generateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>>;
};

export type GeminiClient = {
  models: GeminiModelsClient;
};

export type GeminiClientFactory = (profile: GenerationProfile) => GeminiClient;

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

function geminiRole(role: string): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user';
}

const thinkingLevels = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH
} as const;

export function buildGeminiThinkingConfig(profile: GenerationProfile): ThinkingConfig | undefined {
  const thinking = profile.thinking?.gemini;
  if (!thinking) return undefined;

  const usesThinkingLevel = geminiModelUsesThinkingLevel(profile.provider.model);
  const thinkingLevel = thinking.mode === 'level' ? coerceGeminiThinkingLevel(profile.provider.model, thinking.level) : undefined;

  const config: ThinkingConfig = withDefinedValues({
    includeThoughts: thinking.includeThoughts ? true : undefined,
    thinkingBudget: !usesThinkingLevel && thinkingLevel ? geminiThinkingBudgetFromLevel(thinkingLevel) : undefined,
    thinkingLevel: usesThinkingLevel && thinkingLevel ? thinkingLevels[thinkingLevel] : undefined
  });

  return Object.keys(config).length ? config : undefined;
}

export function buildGeminiRequest(request: ProviderRequest, profile: GenerationProfile, signal?: AbortSignal): GenerateContentParameters {
  if (profile.provider.type !== 'gemini') throw new Error('Invalid profile for Gemini adapter.');

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
  const config: GenerateContentConfig = withDefinedValues({
    systemInstruction: systemText || undefined,
    temperature: optionalNumber(request.temperature ?? profile.sampler.temperature, { allowZero: true }),
    topP: positiveNumber(request.topP ?? profile.sampler.topP),
    topK: optionalInteger(request.topK ?? profile.sampler.topK),
    maxOutputTokens: positiveNumber(request.maxTokens ?? profile.sampler.maxTokens),
    stopSequences: stop?.length ? stop : undefined,
    frequencyPenalty: optionalNumber(request.frequencyPenalty ?? profile.sampler.frequencyPenalty),
    presencePenalty: optionalNumber(request.presencePenalty ?? profile.sampler.presencePenalty),
    seed: request.seed ?? profile.sampler.seed,
    candidateCount: optionalInteger(request.n ?? profile.sampler.n, { skipOne: true }),
    thinkingConfig: buildGeminiThinkingConfig(profile),
    abortSignal: signal
  });

  return {
    model: profile.provider.model,
    contents,
    ...(Object.keys(config).length ? { config } : {})
  };
}

export function buildGeminiClientOptions(profile: GenerationProfile): GoogleGenAIOptions {
  if (profile.provider.type !== 'gemini') throw new Error('Invalid profile for Gemini adapter.');

  const vertex = profile.provider.vertex;
  if (!vertex) {
    const apiKey = profile.provider.apiKey?.trim();
    if (!apiKey) throw new Error('Gemini API key is required.');
    return { vertexai: false, apiKey, apiVersion: 'v1beta' };
  }

  if (vertex.mode === 'express') {
    const apiKey = vertex.apiKey?.trim();
    if (!apiKey) throw new Error('Vertex Express API key is required.');
    return { vertexai: true, apiKey, apiVersion: 'v1' };
  }

  const project = vertex.projectId?.trim();
  if (!project) throw new Error('Google Cloud project ID is required for Vertex AI.');
  return {
    vertexai: true,
    project,
    location: vertex.location?.trim() || 'us-central1',
    apiVersion: 'v1'
  };
}

export function createGeminiClient(profile: GenerationProfile): GeminiClient {
  return new GoogleGenAI(buildGeminiClientOptions(profile));
}

function emptyGeminiResultError(payload: GenerateContentResponse): string | undefined {
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

function geminiOutputChunks(payload: GenerateContentResponse): GenerationChunk[] {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  let text = '';
  let thinking = '';

  for (const part of parts) {
    const partText = part.text ?? '';
    if (!partText) continue;
    if (part.thought === true) {
      thinking += partText;
    } else {
      text += partText;
    }
  }

  return [
    ...(thinking ? [{ type: 'thinking' as const, text: thinking, raw: payload }] : []),
    ...(text ? [{ type: 'text' as const, text, raw: payload }] : [])
  ];
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === 'AbortError');
}

function providerErrorChunk(error: unknown): GenerationChunk {
  const text = error instanceof Error ? error.message : String(error);
  return error instanceof ApiError ? { type: 'error', text, raw: { status: error.status } } : { type: 'error', text };
}

export function createGeminiAdapter(clientFactory: GeminiClientFactory = createGeminiClient): ProviderAdapter {
  return {
    type: 'gemini',
    async *stream(request: ProviderRequest, profile: GenerationProfile, signal?: AbortSignal): AsyncIterable<GenerationChunk> {
      if (profile.provider.type !== 'gemini') {
        throw new Error('Invalid profile for Gemini adapter.');
      }

      try {
        const client = clientFactory(profile);
        const params = buildGeminiRequest(request, profile, signal);
        const streaming = request.stream ?? profile.request.stream;

        if (!streaming) {
          const payload = await client.models.generateContent(params);
          const chunks = geminiOutputChunks(payload);
          if (!chunks.length) {
            const emptyResultError = emptyGeminiResultError(payload);
            if (emptyResultError) {
              yield { type: 'error', text: emptyResultError, raw: payload };
              return;
            }
          }
          for (const chunk of chunks) yield chunk;
          yield { type: 'done', text: '' };
          return;
        }

        let sawOutput = false;
        let emptyResultError: string | undefined;
        const response = await client.models.generateContentStream(params);
        for await (const payload of response) {
          const chunks = geminiOutputChunks(payload);
          if (chunks.length) sawOutput = true;
          for (const chunk of chunks) yield chunk;
          emptyResultError = emptyGeminiResultError(payload) ?? emptyResultError;
        }

        if (!sawOutput && emptyResultError) {
          yield { type: 'error', text: emptyResultError };
          return;
        }

        yield { type: 'done', text: '' };
      } catch (error) {
        if (isAbortError(error, signal)) throw error;
        yield providerErrorChunk(error);
      }
    }
  };
}
