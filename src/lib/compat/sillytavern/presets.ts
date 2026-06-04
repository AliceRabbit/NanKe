import {
  sillyTavernContextPresetSchema,
  sillyTavernInstructPresetSchema,
  sillyTavernOpenAiPresetSchema
} from '$lib/schemas/legacy-sillytavern';
import {
  createDefaultGenerationProfile,
  type GenerationProfile,
  type PromptSlot,
  type ProviderProfile,
  type ReasoningProfile,
  type SamplerProfile
} from '$lib/schemas/profile';
import { regexScriptSchema, type RegexPlacement, type RegexScript } from '$lib/schemas/regex';
import { createCompatReport } from './report';

type PresetKind = 'openai' | 'context' | 'instruct' | 'unknown';
type RecordValue = Record<string, unknown>;

type PromptOrderEntry = {
  identifier: string;
  enabled?: boolean;
};

const ST_GLOBAL_PROMPT_ORDER_ID = 100001;

const OPENAI_PRESET_KEYS = new Set([
  'extensions',
  'temperature',
  'frequency_penalty',
  'presence_penalty',
  'top_p',
  'top_k',
  'top_a',
  'min_p',
  'repetition_penalty',
  'max_context_unlocked',
  'openai_max_context',
  'openai_max_tokens',
  'names_behavior',
  'send_if_empty',
  'impersonation_prompt',
  'new_chat_prompt',
  'new_group_chat_prompt',
  'new_example_chat_prompt',
  'continue_nudge_prompt',
  'bias_preset_selected',
  'wi_format',
  'scenario_format',
  'personality_format',
  'group_nudge_prompt',
  'stream_openai',
  'prompts',
  'prompt_order',
  'assistant_prefill',
  'assistant_impersonation',
  'use_sysprompt',
  'squash_system_messages',
  'media_inlining',
  'inline_image_quality',
  'continue_prefill',
  'continue_postfix',
  'function_calling',
  'show_thoughts',
  'reasoning_effort',
  'verbosity',
  'enable_web_search',
  'seed',
  'n',
  'request_images',
  'request_image_aspect_ratio',
  'request_image_resolution',
  'chat_completion_source',
  'openai_model',
  'custom_model',
  'custom_url',
  'google_model',
  'vertexai_model',
  'vertexai_auth_mode',
  'vertexai_region',
  'vertexai_express_project_id'
]);

export function detectSillyTavernPresetKind(raw: unknown): PresetKind {
  if (!raw || typeof raw !== 'object') return 'unknown';
  const value = raw as RecordValue;
  if ('chat_completion_source' in value || 'prompts' in value || 'prompt_order' in value || 'openai_max_context' in value) return 'openai';
  if ('story_string' in value) return 'context';
  if ('input_sequence' in value || 'output_sequence' in value || 'system_sequence' in value) return 'instruct';
  return 'unknown';
}

function asRecord(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function intValue(value: unknown): number | undefined {
  const number = numberValue(value);
  return number === undefined ? undefined : Math.trunc(number);
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function arrayOfRecords(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter((item): item is RecordValue => !!item && typeof item === 'object' && !Array.isArray(item)) : [];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function regexPlacementValue(value: unknown): RegexPlacement | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return number === 0 || number === 1 || number === 2 || number === 3 || number === 5 || number === 6 ? number : undefined;
}

function regexSubstitutionValue(value: unknown): 0 | 1 | 2 {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return number === 1 || number === 2 ? number : 0;
}

function normalizeRole(value: unknown): PromptSlot['role'] {
  return value === 'user' || value === 'assistant' ? value : 'system';
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

function promptSource(prompt: RecordValue, identifier: string): PromptSlot['source'] {
  if (booleanValue(prompt.marker) === true) return markerSource(identifier);
  if (identifier === 'main') return 'system';
  return 'custom';
}

function promptContent(prompt: RecordValue, source: PromptSlot['source'], preset: RecordValue): string {
  if (source === 'worldbook-before' || source === 'worldbook-after') return stringValue(preset.wi_format) ?? '{0}';
  if (source === 'character-personality') return stringValue(preset.personality_format) ?? '{{personality}}';
  if (source === 'scenario') return stringValue(preset.scenario_format) ?? '{{scenario}}';
  return String(prompt.content ?? '');
}

function normalizePromptOrders(value: unknown): Array<{ characterId?: string | number; order: PromptOrderEntry[] }> {
  return arrayOfRecords(value)
    .map((item) => {
      const order = arrayOfRecords(item.order)
        .map((entry) => ({
          identifier: String(entry.identifier ?? ''),
          enabled: booleanValue(entry.enabled)
        }))
        .filter((entry) => entry.identifier);
      return {
        characterId: typeof item.character_id === 'string' || typeof item.character_id === 'number' ? item.character_id : undefined,
        order
      };
    })
    .filter((item) => item.order.length);
}

function activePromptOrder(rawPromptOrder: unknown): { characterId?: string | number; order: PromptOrderEntry[] } | undefined {
  const orders = normalizePromptOrders(rawPromptOrder);
  return orders.find((item) => String(item.characterId) === String(ST_GLOBAL_PROMPT_ORDER_ID)) ?? orders[0];
}

function uniqueSlotId(identifier: string, used: Set<string>): string {
  if (!used.has(identifier)) {
    used.add(identifier);
    return identifier;
  }

  let suffix = 2;
  while (used.has(`${identifier}-${suffix}`)) suffix += 1;
  const id = `${identifier}-${suffix}`;
  used.add(id);
  return id;
}

function promptToSlot(
  prompt: RecordValue,
  options: {
    preset: RecordValue;
    originalIndex: number;
    ordered: boolean;
    orderEntry?: PromptOrderEntry;
    usedIds: Set<string>;
  }
): PromptSlot {
  const identifier = String(prompt.identifier ?? `prompt-${options.originalIndex + 1}`);
  const source = promptSource(prompt, identifier);
  const promptEnabled = booleanValue(prompt.enabled);
  const orderEnabled = options.orderEntry ? options.orderEntry.enabled !== false : undefined;
  const enabled = options.ordered ? orderEnabled !== false : false;
  const injectionPosition = numberValue(prompt.injection_position) === 1 ? 'absolute' : 'relative';

  return {
    id: uniqueSlotId(identifier, options.usedIds),
    source,
    role: normalizeRole(prompt.role),
    enabled,
    label: String(prompt.name ?? identifier),
    content: promptContent(prompt, source, options.preset),
    injection: {
      position: injectionPosition,
      depth: intValue(prompt.injection_depth) ?? 4,
      order: numberValue(prompt.injection_order) ?? 100,
      triggers: Array.isArray(prompt.injection_trigger) ? prompt.injection_trigger.map(String).filter(Boolean) : []
    },
    legacy: {
      source: 'sillytavern',
      identifier,
      marker: booleanValue(prompt.marker) ?? false,
      systemPrompt: booleanValue(prompt.system_prompt) ?? false,
      forbidOverrides: booleanValue(prompt.forbid_overrides) ?? false,
      ordered: options.ordered,
      enabledInPromptOrder: orderEnabled,
      enabledInPrompt: promptEnabled,
      originalIndex: options.originalIndex
    }
  };
}

function slotsFromOpenAiPreset(preset: RecordValue, report: ReturnType<typeof createCompatReport>): PromptSlot[] {
  const prompts = arrayOfRecords(preset.prompts);
  if (!prompts.length) {
    report.warnings.push('OpenAI preset has no prompts array; default NanKe prompt slots were used.');
    return createDefaultGenerationProfile().prompt.slots;
  }

  const usedIds = new Set<string>();
  const promptByIdentifier = new Map<string, { prompt: RecordValue; originalIndex: number }>();
  prompts.forEach((prompt, index) => {
    const identifier = String(prompt.identifier ?? `prompt-${index + 1}`);
    promptByIdentifier.set(identifier, { prompt: { ...prompt, identifier }, originalIndex: index });
  });

  const ordered = activePromptOrder(preset.prompt_order);
  const orderedIdentifiers = new Set<string>();
  const slots: PromptSlot[] = [];

  if (ordered) {
    for (const entry of ordered.order) {
      orderedIdentifiers.add(entry.identifier);
      const item = promptByIdentifier.get(entry.identifier);
      if (!item) {
        report.warnings.push(`Prompt order references missing prompt "${entry.identifier}".`);
        continue;
      }
      slots.push(promptToSlot(item.prompt, { preset, originalIndex: item.originalIndex, ordered: true, orderEntry: entry, usedIds }));
    }
  } else {
    report.warnings.push('OpenAI preset has no prompt_order; prompts array order was used.');
    prompts.forEach((prompt, index) => {
      slots.push(promptToSlot(prompt, { preset, originalIndex: index, ordered: true, usedIds }));
    });
  }

  prompts.forEach((prompt, index) => {
    const identifier = String(prompt.identifier ?? `prompt-${index + 1}`);
    if (orderedIdentifiers.has(identifier)) return;
    slots.push(promptToSlot({ ...prompt, identifier }, { preset, originalIndex: index, ordered: false, usedIds }));
  });

  const unorderedCount = slots.filter((slot) => slot.legacy?.ordered === false).length;
  if (unorderedCount) report.preservedAsExtras.push(`${unorderedCount} prompts not present in active prompt_order`);

  return slots;
}

function providerFromOpenAiPreset(preset: RecordValue, report?: ReturnType<typeof createCompatReport>): ProviderProfile {
  const source = stringValue(preset.chat_completion_source);
  const geminiSource = source === 'makersuite' || source === 'google' || source === 'google_ai_studio' || source === 'vertexai';

  if (geminiSource) {
    const model = source === 'vertexai' ? stringValue(preset.vertexai_model) ?? stringValue(preset.google_model) : stringValue(preset.google_model);
    const projectId = stringValue(preset.vertexai_express_project_id);
    const location = stringValue(preset.vertexai_region) ?? 'us-central1';
    const vertexAuthMode = stringValue(preset.vertexai_auth_mode) === 'full' ? 'oauth' : 'express';
    if (source === 'vertexai' && vertexAuthMode === 'oauth' && !projectId) {
      report?.warnings.push('Vertex AI full/service-account mode was present, but the preset does not contain service-account credentials or project id; imported as Vertex Express with raw fields preserved.');
    }
    return {
      type: 'gemini',
      model: model ?? 'gemini-2.5-pro',
      ...(source === 'vertexai'
        ? {
            vertex: {
              mode: vertexAuthMode === 'oauth' && projectId ? 'oauth' : 'express',
              ...(projectId ? { projectId } : {}),
              location
            }
          }
        : {})
    };
  }

  const endpoint = stringValue(preset.custom_url);
  const compatibility = endpoint || (source && source !== 'openai') ? 'extended' : 'strict-openai';
  return {
    type: 'openai-compatible',
    model: stringValue(preset.openai_model) ?? stringValue(preset.custom_model) ?? 'gpt-4o-mini',
    endpoint: endpoint && URL.canParse(endpoint) ? endpoint : 'https://api.openai.com/v1',
    compatibility
  };
}

function samplerFromOpenAiPreset(preset: RecordValue): SamplerProfile {
  const seed = intValue(preset.seed);
  const n = intValue(preset.n);
  return {
    temperature: numberValue(preset.temperature),
    topP: numberValue(preset.top_p),
    topK: numberValue(preset.top_k),
    topA: numberValue(preset.top_a),
    minP: numberValue(preset.min_p),
    frequencyPenalty: numberValue(preset.frequency_penalty),
    presencePenalty: numberValue(preset.presence_penalty),
    repetitionPenalty: numberValue(preset.repetition_penalty),
    maxTokens: numberValue(preset.openai_max_tokens),
    contextTokens: numberValue(preset.openai_max_context),
    ...(seed !== undefined && seed >= 0 ? { seed } : {}),
    ...(n !== undefined && n > 0 ? { n } : {})
  };
}

function reasoningFromOpenAiPreset(preset: RecordValue, provider: ProviderProfile): ReasoningProfile {
  const effort = stringValue(preset.reasoning_effort);
  const openAiEffort =
    effort === 'none' || effort === 'minimal' || effort === 'low' || effort === 'medium' || effort === 'high' || effort === 'xhigh' ? effort : 'default';
  const showThoughts = booleanValue(preset.show_thoughts);
  const gemini = {
    includeThoughts: provider.type === 'gemini' ? showThoughts === true : false,
    mode: 'default' as const,
    level: 'medium' as const
  };

  return {
    display: showThoughts !== false,
    openByDefault: false,
    openai: { effort: openAiEffort },
    gemini
  };
}

export function importSillyTavernRegexScripts(value: unknown): RegexScript[] {
  return arrayOfRecords(value).map((script, index) => {
    const placements = Array.isArray(script.placement) ? script.placement : [script.placement];
    return regexScriptSchema.parse({
      id: stringValue(script.id) ?? `st-regex-${index + 1}`,
      scriptName: stringValue(script.scriptName) ?? stringValue(script.name) ?? `ST Regex ${index + 1}`,
      findRegex: stringValue(script.findRegex) ?? '',
      replaceString: typeof script.replaceString === 'string' ? script.replaceString : '',
      trimStrings: arrayOfStrings(script.trimStrings),
      placement: placements.map(regexPlacementValue).filter((item) => item !== undefined),
      disabled: booleanValue(script.disabled) ?? false,
      markdownOnly: booleanValue(script.markdownOnly) ?? false,
      promptOnly: booleanValue(script.promptOnly) ?? false,
      runOnEdit: booleanValue(script.runOnEdit) ?? false,
      substituteRegex: regexSubstitutionValue(script.substituteRegex),
      minDepth: intValue(script.minDepth) ?? null,
      maxDepth: intValue(script.maxDepth) ?? null,
      legacy: { source: 'sillytavern', raw: script, originalIndex: index }
    });
  });
}

function regexScriptsFromOpenAiPreset(preset: RecordValue): RegexScript[] {
  return importSillyTavernRegexScripts(asRecord(preset.extensions).regex_scripts);
}

function openAiMetadata(preset: RecordValue, slots: PromptSlot[]) {
  const orderedSlots = slots.filter((slot) => slot.legacy?.ordered !== false);
  const enabledSlots = orderedSlots.filter((slot) => slot.enabled);
  return {
    sillyTavern: {
      kind: 'openai',
      promptManager: {
        globalPromptOrderId: ST_GLOBAL_PROMPT_ORDER_ID,
        promptCount: arrayOfRecords(preset.prompts).length,
        orderedPromptCount: orderedSlots.length,
        enabledPromptCount: enabledSlots.length,
        inactivePromptCount: slots.length - enabledSlots.length,
        activePromptOrderCharacterId: activePromptOrder(preset.prompt_order)?.characterId
      },
      settings: Object.fromEntries(Object.entries(preset).filter(([key]) => key !== 'prompts' && key !== 'prompt_order' && key !== 'extensions')),
      extensions: preset.extensions
    }
  };
}

function reportOpenAiPreset(preset: RecordValue, report: ReturnType<typeof createCompatReport>) {
  const mappedKeys = [
    'temperature',
    'top_p',
    'top_k',
    'top_a',
    'min_p',
    'frequency_penalty',
    'presence_penalty',
    'repetition_penalty',
    'openai_max_context',
    'openai_max_tokens',
    'seed',
    'n',
    'prompts',
    'prompt_order',
    'wi_format',
    'scenario_format',
    'personality_format',
    'squash_system_messages',
    'stream_openai',
    'show_thoughts',
    'reasoning_effort',
    'chat_completion_source',
    'model',
    'vertexai_auth_mode',
    'vertexai_region',
    'vertexai_express_project_id',
    'extensions'
  ];
  report.mapped.push(...mappedKeys.filter((key) => key === 'model' || key in preset));
  if (arrayOfRecords(asRecord(preset.extensions).regex_scripts).length) report.mapped.push('extensions.regex_scripts');

  for (const key of Object.keys(preset)) {
    if (!OPENAI_PRESET_KEYS.has(key)) report.preservedAsExtras.push(`raw.${key}`);
  }

  if ('extensions' in preset) {
    report.preservedAsExtras.push('extensions.SPreset', 'extensions.tavern_helper', 'extensions.regex_scripts');
  }

  const featureWarnings = [
    ['function_calling', 'Function calling setting is preserved, but NanKe v1 tool calling is not implemented yet.'],
    ['enable_web_search', 'Web search setting is preserved, but NanKe v1 provider adapters do not execute it.'],
    ['request_images', 'Image request setting is preserved, but NanKe v1 image generation is not implemented.'],
    ['media_inlining', 'Media inlining setting is preserved; multimodal prompt assembly is not implemented yet.']
  ] as const;

  for (const [key, message] of featureWarnings) {
    if (preset[key]) report.warnings.push(message);
  }

  if (!('chat_completion_source' in preset)) report.warnings.push('No chat_completion_source was present; NanKe imported it as OpenAI-compatible.');
}

export function importSillyTavernPreset(
  raw: unknown,
  fallbackName?: string
): { profile: GenerationProfile; report: ReturnType<typeof createCompatReport>; kind: PresetKind } {
  const kind = detectSillyTavernPresetKind(raw);
  const report = createCompatReport('preset');

  if (kind === 'openai') {
    const parsed = sillyTavernOpenAiPresetSchema.parse(raw);
    const preset = asRecord(parsed);
    const slots = slotsFromOpenAiPreset(preset, report);
    const regexScripts = regexScriptsFromOpenAiPreset(preset);
    const provider = providerFromOpenAiPreset(preset, report);
    const profile = createDefaultGenerationProfile({
      name: stringValue(preset.name) ?? fallbackName ?? 'Imported ST OpenAI Preset',
      provider,
      sampler: samplerFromOpenAiPreset(preset),
      request: { stream: booleanValue(preset.stream_openai) ?? true },
      reasoning: reasoningFromOpenAiPreset(preset, provider),
      prompt: {
        mode: 'chat',
        slots,
        macroMode: 'sillytavern',
        squashSystemMessages: booleanValue(preset.squash_system_messages) ?? false
      },
      regex: { enabled: true, scripts: regexScripts },
      metadata: openAiMetadata(preset, slots),
      legacy: { source: 'sillytavern', raw, report }
    });
    reportOpenAiPreset(preset, report);
    return { profile, report, kind };
  }

  if (kind === 'context') {
    const parsed = sillyTavernContextPresetSchema.parse(raw);
    const profile = createDefaultGenerationProfile({
      name: parsed.name ?? fallbackName ?? 'Imported ST Context Preset',
      prompt: {
        mode: 'text',
        macroMode: 'sillytavern',
        squashSystemMessages: false,
        slots: [
          { id: 'story-string', source: 'system', role: 'system', enabled: true, label: 'Story String', content: parsed.story_string },
          { id: 'history', source: 'history', role: 'user', enabled: true, label: 'Chat History', content: '' }
        ]
      },
      metadata: { sillyTavern: { kind: 'context' } },
      legacy: { source: 'sillytavern', raw, report }
    });
    report.mapped.push('story_string', 'example_separator', 'chat_start');
    return { profile, report, kind };
  }

  if (kind === 'instruct') {
    const parsed = sillyTavernInstructPresetSchema.parse(raw);
    const profile = createDefaultGenerationProfile({
      name: parsed.name ?? fallbackName ?? 'Imported ST Instruct Preset',
      prompt: {
        mode: 'text',
        macroMode: 'sillytavern',
        squashSystemMessages: false,
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
      metadata: { sillyTavern: { kind: 'instruct' } },
      legacy: { source: 'sillytavern', raw, report }
    });
    report.mapped.push('input_sequence', 'output_sequence', 'system_sequence', 'stop_sequence');
    return { profile, report, kind };
  }

  report.unsupported.push('Unknown SillyTavern preset shape.');
  return {
    profile: createDefaultGenerationProfile({
      name: fallbackName ?? 'Unsupported ST Preset',
      legacy: { source: 'sillytavern', raw, report }
    }),
    report,
    kind
  };
}
