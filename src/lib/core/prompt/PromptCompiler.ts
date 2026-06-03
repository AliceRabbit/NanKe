import type { Character } from '$lib/schemas/character';
import { createMessage, type NankeMessage } from '$lib/schemas/message';
import type { GenerationProfile, PromptSlot } from '$lib/schemas/profile';
import type { ActivatedWorldEntry } from '$lib/core/worldbook/WorldBookActivation';
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

export function renderPromptTemplate(template: string, input: Pick<PromptCompilerInput, 'character' | 'persona' | 'userName'>): string {
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

  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, value), template);
}

function worldContent(input: PromptCompilerInput, position: 'before' | 'after'): string {
  return (input.activatedWorldEntries ?? [])
    .filter((entry) => entry.entry.position === position)
    .map((entry) => entry.entry.content)
    .filter(Boolean)
    .join('\n\n');
}

function slotContent(slot: PromptSlot, input: PromptCompilerInput): string {
  if (slot.source === 'custom' || slot.source === 'system') return renderPromptTemplate(slot.content, input);
  if (slot.source === 'character-system') return renderPromptTemplate(input.character?.systemPrompt ?? '', input);
  if (slot.source === 'character-description') return renderPromptTemplate(input.character?.description ?? '', input);
  if (slot.source === 'character-personality') return renderPromptTemplate(input.character?.personality ?? '', input);
  if (slot.source === 'scenario') return renderPromptTemplate(input.character?.scenario ?? '', input);
  if (slot.source === 'persona') return input.persona ?? '';
  if (slot.source === 'worldbook-before') return worldContent(input, 'before');
  if (slot.source === 'worldbook-after') return worldContent(input, 'after');
  if (slot.source === 'examples') return renderPromptTemplate(input.character?.exampleMessages ?? '', input);
  if (slot.source === 'post-history') return input.character?.postHistoryInstructions ?? '';
  return '';
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

    for (const slot of input.profile.prompt.slots) {
      if (!slot.enabled) continue;
      if (slot.source === 'history') {
        compiled.push(...input.messages);
        continue;
      }
      if (slot.source === 'post-history') {
        const postHistory = renderPromptTemplate(input.character?.postHistoryInstructions ?? '', input).trim();
        if (postHistory) {
          compiled.push(createMessage({ role: slot.role, content: postHistory, name: slot.label || undefined, createdAt: Date.now() }));
        }
        const depthPrompt = input.character?.depthPrompt;
        if (depthPrompt?.prompt.trim()) {
          compiled.push(
            createMessage({
              role: depthPrompt.role,
              content: renderPromptTemplate(depthPrompt.prompt, input).trim(),
              name: 'Depth Prompt',
              createdAt: Date.now()
            })
          );
        }
        continue;
      }
      const content = slotContent(slot, input).trim();
      if (!content) continue;
      compiled.push(createMessage({ role: slot.role, content, name: slot.label || undefined, createdAt: Date.now() }));
    }

    if (compiled.length === 0) {
      warnings.push({ code: 'empty-prompt', message: 'Prompt compiled without messages.' });
    }

    const modeMessages = input.profile.prompt.mode === 'text' ? compileTextMode(compiled, input) : compiled;
    const { messages, report } = trimMessagesToBudget(modeMessages, input.profile.sampler.contextTokens, input.profile.sampler.maxTokens);

    return {
      messages,
      tokenReport: report,
      activatedWorldEntries: input.activatedWorldEntries ?? [],
      warnings
    };
  }
}
