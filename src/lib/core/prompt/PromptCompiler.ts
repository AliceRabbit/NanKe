import type { Character } from '$lib/schemas/character';
import { createMessage, type NankeMessage } from '$lib/schemas/message';
import type { GenerationProfile, PromptSlot } from '$lib/schemas/profile';
import type { ActivatedWorldEntry } from '$lib/core/worldbook/WorldBookActivation';
import { applyRegexScripts, REGEX_PLACEMENT } from '$lib/core/regex';
import { trimMessagesToBudget } from './TokenBudgeter';
import type { CompiledPrompt, PromptWarning } from './PromptGraph';

export type PromptCompilerInput = {
  profile: GenerationProfile;
  character?: Character;
  messages: NankeMessage[];
  activatedWorldEntries?: ActivatedWorldEntry[];
  persona?: string;
  userName?: string;
};

type MacroState = {
  mode: 'none' | 'sillytavern';
  variables: Map<string, string>;
  unsupported: Set<string>;
  lastUserMessage: string;
};

function lastUserMessage(messages: NankeMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'user') return message.content;
  }
  return '';
}

function formatRuntimeValue(format: string | undefined, value: string): string {
  if (!value) return '';
  if (!format?.trim()) return value;
  if (format.includes('{0}')) return format.replaceAll('{0}', value);
  if (format.includes('{{content}}')) return format.replaceAll('{{content}}', value);
  return format;
}

function renderSillyTavernMacro(expression: string, state: MacroState): string {
  const trimmed = expression.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return '';

  if (trimmed.startsWith('setvar::')) {
    const [, rest] = trimmed.split('setvar::');
    const separatorIndex = rest.indexOf('::');
    const key = separatorIndex >= 0 ? rest.slice(0, separatorIndex).trim() : rest.trim();
    const value = separatorIndex >= 0 ? rest.slice(separatorIndex + 2) : '';
    if (key) state.variables.set(key, renderSillyTavernTemplate(value, state));
    return '';
  }

  if (trimmed.startsWith('getvar::')) {
    const key = trimmed.slice('getvar::'.length).trim();
    return state.variables.get(key) ?? '';
  }

  if (trimmed === 'lastUserMessage') return state.lastUserMessage;
  if (trimmed === 'date') return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (trimmed === 'time') return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());

  const macroName = trimmed.split(/::|\s+/)[0] ?? trimmed;
  state.unsupported.add(macroName);
  return `{{${expression}}}`;
}

function renderSillyTavernTemplate(template: string, state: MacroState): string {
  return template.replace(/\{\{([\s\S]*?)\}\}/g, (_, expression: string) => renderSillyTavernMacro(expression, state));
}

function regexScripts(input: PromptCompilerInput) {
  return input.profile.regex.enabled === false ? [] : input.profile.regex.scripts;
}

function regexMacros(input: Pick<PromptCompilerInput, 'character' | 'userName'>): Record<string, string | undefined> {
  const charName = input.character?.name ?? 'Assistant';
  return {
    char: charName,
    charIfNotGroup: charName,
    user: input.userName ?? 'User'
  };
}

export function renderPromptTemplate(
  template: string,
  input: Pick<PromptCompilerInput, 'character' | 'persona' | 'userName'> & Partial<Pick<PromptCompilerInput, 'messages'>>,
  macroState?: MacroState
): string {
  const charName = input.character?.name ?? 'Assistant';
  const values: Record<string, string> = {
    char: charName,
    charIfNotGroup: charName,
    user: input.userName ?? 'User',
    description: input.character?.description ?? '',
    personality: input.character?.personality ?? '',
    scenario: input.character?.scenario ?? '',
    persona: input.persona ?? ''
  };

  const rendered = Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, value), template);
  if (macroState?.mode === 'sillytavern') return renderSillyTavernTemplate(rendered, macroState);
  return rendered;
}

function worldContent(input: PromptCompilerInput, position: 'before' | 'after', slot?: PromptSlot, macroState?: MacroState): string {
  const content = (input.activatedWorldEntries ?? [])
    .filter((entry) => entry.entry.position === position)
    .map((entry) => {
      const plain = applyRegexScripts(entry.entry.content, regexScripts(input), {
        placement: REGEX_PLACEMENT.WORLD_INFO,
        macros: regexMacros(input)
      });
      return applyRegexScripts(plain, regexScripts(input), {
        placement: REGEX_PLACEMENT.WORLD_INFO,
        isPrompt: true,
        macros: regexMacros(input)
      });
    })
    .filter(Boolean)
    .join('\n\n');
  return renderPromptTemplate(formatRuntimeValue(slot?.content, content), input, macroState);
}

function slotContent(slot: PromptSlot, input: PromptCompilerInput, macroState?: MacroState): string {
  if (slot.source === 'custom' || slot.source === 'system') return renderPromptTemplate(slot.content, input, macroState);
  if (slot.source === 'character-system') return renderPromptTemplate(formatRuntimeValue(slot.content, input.character?.systemPrompt ?? ''), input, macroState);
  if (slot.source === 'character-description') return renderPromptTemplate(formatRuntimeValue(slot.content, input.character?.description ?? ''), input, macroState);
  if (slot.source === 'character-personality') return renderPromptTemplate(formatRuntimeValue(slot.content, input.character?.personality ?? ''), input, macroState);
  if (slot.source === 'scenario') return renderPromptTemplate(formatRuntimeValue(slot.content, input.character?.scenario ?? ''), input, macroState);
  if (slot.source === 'persona') return renderPromptTemplate(formatRuntimeValue(slot.content, input.persona ?? ''), input, macroState);
  if (slot.source === 'worldbook-before') return worldContent(input, 'before', slot, macroState);
  if (slot.source === 'worldbook-after') return worldContent(input, 'after', slot, macroState);
  if (slot.source === 'examples') return renderPromptTemplate(formatRuntimeValue(slot.content, input.character?.exampleMessages ?? ''), input, macroState);
  if (slot.source === 'post-history') return renderPromptTemplate(formatRuntimeValue(slot.content, input.character?.postHistoryInstructions ?? ''), input, macroState);
  return '';
}

function promptMessage(slot: PromptSlot, content: string): NankeMessage {
  return createMessage({
    role: slot.role,
    content,
    createdAt: Date.now(),
    metadata: {
      promptSlotId: slot.id,
      promptSlotLabel: slot.label,
      promptSlotSource: slot.source,
      ...(slot.legacy ? { legacy: slot.legacy } : {})
    }
  });
}

function squashSystemMessages(messages: NankeMessage[]): NankeMessage[] {
  const squashed: NankeMessage[] = [];
  for (const message of messages) {
    if (message.role !== 'system' || message.name || !message.content) {
      squashed.push(message);
      continue;
    }

    const previous = squashed.at(-1);
    if (previous?.role === 'system' && !previous.name) {
      previous.content = [previous.content, message.content].filter(Boolean).join('\n');
      previous.metadata = {
        ...previous.metadata,
        squashedPromptSlotIds: [
          ...((previous.metadata.squashedPromptSlotIds as string[] | undefined) ?? []),
          ...(previous.metadata.promptSlotId ? [String(previous.metadata.promptSlotId)] : []),
          ...(message.metadata.promptSlotId ? [String(message.metadata.promptSlotId)] : [])
        ]
      };
    } else {
      squashed.push(message);
    }
  }
  return squashed;
}

function injectAbsolutePrompts(messages: NankeMessage[], injections: NankeMessage[]): NankeMessage[] {
  if (!injections.length) return messages;
  const result = [...messages];
  const grouped = new Map<number, NankeMessage[]>();
  for (const injection of injections) {
    const depth = Number(injection.metadata.injectionDepth ?? 4);
    grouped.set(depth, [...(grouped.get(depth) ?? []), injection]);
  }

  const depths = [...grouped.keys()].sort((a, b) => a - b);
  let inserted = 0;
  for (const depth of depths) {
    const group = grouped.get(depth) ?? [];
    const index = Math.max(0, result.length - depth + inserted);
    result.splice(index, 0, ...group);
    inserted += group.length;
  }
  return result;
}

function absoluteInjectionMessage(slot: PromptSlot, content: string): NankeMessage {
  const message = promptMessage(slot, content);
  return {
    ...message,
    metadata: {
      ...message.metadata,
      injectionPosition: 'absolute',
      injectionDepth: slot.injection?.depth ?? 4,
      injectionOrder: slot.injection?.order ?? 100
    }
  };
}

function sortedAbsoluteMessages(injections: NankeMessage[]): NankeMessage[] {
  const roleRank: Record<string, number> = { system: 0, user: 1, assistant: 2, tool: 3 };
  return [...injections].sort((a, b) => {
    const orderA = Number(a.metadata.injectionOrder ?? 100);
    const orderB = Number(b.metadata.injectionOrder ?? 100);
    if (orderA !== orderB) return orderB - orderA;
    return (roleRank[a.role] ?? 3) - (roleRank[b.role] ?? 3);
  });
}

function compileTextMode(messages: NankeMessage[], input: PromptCompilerInput): NankeMessage[] {
  const instruct = input.profile.prompt.instruct;
  if (!instruct) return messages;

  const text = messages
    .map((message) => {
      if (message.role === 'system') return `${instruct.systemSequence}${instruct.systemSequence ? '\n' : ''}${message.content}${instruct.systemSuffix}`;
      if (message.role === 'assistant') return `${instruct.outputSequence}${instruct.outputSequence ? '\n' : ''}${message.content}${instruct.outputSuffix}`;
      return `${instruct.inputSequence}${instruct.inputSequence ? '\n' : ''}${message.content}${instruct.inputSuffix}`;
    })
    .join('');

  return [
    createMessage({
      role: 'user',
      content: text.trim(),
      createdAt: Date.now()
    })
  ];
}

export class PromptCompiler {
  compile(input: PromptCompilerInput): CompiledPrompt {
    const warnings: PromptWarning[] = [];
    const compiled: NankeMessage[] = [];
    const absoluteInjections: NankeMessage[] = [];
    const macroState: MacroState = {
      mode: input.profile.prompt.macroMode ?? 'none',
      variables: new Map(),
      unsupported: new Set(),
      lastUserMessage: lastUserMessage(input.messages)
    };

    for (const slot of input.profile.prompt.slots) {
      if (!slot.enabled) continue;
      if (slot.injection?.triggers?.length) {
        warnings.push({ code: 'prompt-trigger-not-evaluated', message: `Prompt slot "${slot.label || slot.id}" has generation triggers that are not evaluated in this request.` });
      }
      if (slot.source === 'history') {
        compiled.push(...injectAbsolutePrompts(input.messages, sortedAbsoluteMessages(absoluteInjections)));
        continue;
      }
      if (slot.source === 'post-history') {
        const postHistory = slotContent(slot, input, macroState).trim();
        if (postHistory) {
          compiled.push(promptMessage(slot, postHistory));
        }
        const depthPrompt = input.character?.depthPrompt;
        if (depthPrompt?.prompt.trim()) {
          compiled.push(
            createMessage({
              role: depthPrompt.role,
              content: renderPromptTemplate(depthPrompt.prompt, input, macroState).trim(),
              name: 'Depth Prompt',
              createdAt: Date.now()
            })
          );
        }
        continue;
      }
      const content = slotContent(slot, input, macroState).trim();
      if (!content) continue;
      if (slot.injection?.position === 'absolute') {
        absoluteInjections.push(absoluteInjectionMessage(slot, content));
        continue;
      }
      compiled.push(promptMessage(slot, content));
    }

    if (absoluteInjections.length && !input.profile.prompt.slots.some((slot) => slot.enabled && slot.source === 'history')) {
      compiled.push(...sortedAbsoluteMessages(absoluteInjections));
    }

    if (macroState.unsupported.size) {
      warnings.push({
        code: 'unsupported-sillytavern-macros',
        message: `Unsupported SillyTavern macros left unchanged: ${[...macroState.unsupported].sort().join(', ')}.`
      });
    }

    if (compiled.length === 0) {
      warnings.push({ code: 'empty-prompt', message: 'Prompt compiled without messages.' });
    }

    const chatMessages = input.profile.prompt.squashSystemMessages ? squashSystemMessages(compiled) : compiled;
    const modeMessages = input.profile.prompt.mode === 'text' ? compileTextMode(chatMessages, input) : chatMessages;
    const { messages, report } = trimMessagesToBudget(modeMessages, input.profile.sampler.contextTokens, input.profile.sampler.maxTokens);

    return {
      messages,
      tokenReport: report,
      activatedWorldEntries: input.activatedWorldEntries ?? [],
      warnings
    };
  }
}
