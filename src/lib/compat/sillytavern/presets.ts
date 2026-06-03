import {
  sillyTavernContextPresetSchema,
  sillyTavernInstructPresetSchema,
  sillyTavernOpenAiPresetSchema
} from '$lib/schemas/legacy-sillytavern';
import { createDefaultGenerationProfile, type GenerationProfile, type PromptSlot } from '$lib/schemas/profile';
import { createCompatReport } from './report';

type PresetKind = 'openai' | 'context' | 'instruct' | 'unknown';

export function detectSillyTavernPresetKind(raw: unknown): PresetKind {
  if (!raw || typeof raw !== 'object') return 'unknown';
  const value = raw as Record<string, unknown>;
  if ('chat_completion_source' in value || 'prompts' in value || 'prompt_order' in value) return 'openai';
  if ('story_string' in value) return 'context';
  if ('input_sequence' in value || 'output_sequence' in value || 'system_sequence' in value) return 'instruct';
  return 'unknown';
}

function slotsFromOpenAiPreset(prompts: Array<Record<string, unknown>> | undefined): PromptSlot[] {
  if (!prompts?.length) return createDefaultGenerationProfile().prompt.slots;
  return prompts.map((prompt, index) => ({
    id: String(prompt.identifier ?? `prompt-${index}`),
    source: prompt.marker ? markerSource(String(prompt.identifier ?? 'custom')) : 'custom',
    role: prompt.role === 'user' || prompt.role === 'assistant' ? prompt.role : 'system',
    enabled: true,
    label: String(prompt.name ?? prompt.identifier ?? `Prompt ${index + 1}`),
    content: String(prompt.content ?? '')
  }));
}

function markerSource(identifier: string): PromptSlot['source'] {
  if (identifier === 'worldInfoBefore') return 'worldbook-before';
  if (identifier === 'worldInfoAfter') return 'worldbook-after';
  if (identifier === 'dialogueExamples') return 'examples';
  if (identifier === 'chatHistory') return 'history';
  if (identifier === 'charDescription') return 'character-description';
  if (identifier === 'charPersonality') return 'character-personality';
  if (identifier === 'scenario') return 'scenario';
  if (identifier === 'personaDescription') return 'persona';
  return 'custom';
}

export function importSillyTavernPreset(raw: unknown): { profile: GenerationProfile; report: ReturnType<typeof createCompatReport>; kind: PresetKind } {
  const kind = detectSillyTavernPresetKind(raw);
  const report = createCompatReport('preset');

  if (kind === 'openai') {
    const parsed = sillyTavernOpenAiPresetSchema.parse(raw);
    const providerType = parsed.chat_completion_source === 'makersuite' || parsed.chat_completion_source === 'vertexai' ? 'gemini' : 'openai-compatible';
    const profile = createDefaultGenerationProfile({
      name: String((raw as Record<string, unknown>).name ?? 'Imported ST OpenAI Preset'),
      provider:
        providerType === 'gemini'
          ? { type: 'gemini', model: parsed.google_model ?? 'gemini-2.5-pro', apiKeyEnv: 'GEMINI_API_KEY' }
          : { type: 'openai-compatible', model: parsed.openai_model ?? 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1', apiKeyEnv: 'OPENAI_API_KEY' },
      sampler: {
        temperature: parsed.temperature,
        topP: parsed.top_p,
        topK: parsed.top_k,
        maxTokens: parsed.openai_max_tokens,
        contextTokens: parsed.openai_max_context
      },
      prompt: {
        mode: 'chat',
        slots: slotsFromOpenAiPreset(parsed.prompts)
      },
      legacy: { source: 'sillytavern', raw, report }
    });
    report.mapped.push('chat_completion_source', 'model', 'temperature', 'top_p', 'top_k', 'openai_max_context', 'openai_max_tokens', 'prompts');
    report.preservedAsExtras.push('prompt_order', 'provider-specific fields');
    return { profile, report, kind };
  }

  if (kind === 'context') {
    const parsed = sillyTavernContextPresetSchema.parse(raw);
    const profile = createDefaultGenerationProfile({
      name: parsed.name ?? 'Imported ST Context Preset',
      prompt: {
        mode: 'text',
        slots: [
          { id: 'story-string', source: 'system', role: 'system', enabled: true, label: 'Story String', content: parsed.story_string },
          { id: 'history', source: 'history', role: 'user', enabled: true, label: 'Chat History', content: '' }
        ]
      },
      legacy: { source: 'sillytavern', raw, report }
    });
    report.mapped.push('story_string', 'example_separator', 'chat_start');
    return { profile, report, kind };
  }

  if (kind === 'instruct') {
    const parsed = sillyTavernInstructPresetSchema.parse(raw);
    const profile = createDefaultGenerationProfile({
      name: parsed.name ?? 'Imported ST Instruct Preset',
      prompt: {
        mode: 'text',
        slots: createDefaultGenerationProfile().prompt.slots,
        instruct: {
          inputSequence: parsed.input_sequence,
          outputSequence: parsed.output_sequence,
          systemSequence: parsed.system_sequence,
          stopSequence: parsed.stop_sequence,
          wrap: parsed.wrap,
          inputSuffix: parsed.input_suffix,
          outputSuffix: parsed.output_suffix,
          systemSuffix: parsed.system_suffix,
          sequencesAsStopStrings: parsed.sequences_as_stop_strings
        }
      },
      legacy: { source: 'sillytavern', raw, report }
    });
    report.mapped.push('input_sequence', 'output_sequence', 'system_sequence', 'stop_sequence');
    return { profile, report, kind };
  }

  report.unsupported.push('Unknown SillyTavern preset shape.');
  return {
    profile: createDefaultGenerationProfile({
      name: 'Unsupported ST Preset',
      legacy: { source: 'sillytavern', raw, report }
    }),
    report,
    kind
  };
}
