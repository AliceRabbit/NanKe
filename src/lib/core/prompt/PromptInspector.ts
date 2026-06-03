import type { CompiledPrompt } from './PromptGraph';

export type PromptInspectorModel = {
  messages: Array<{
    role: string;
    name?: string;
    label?: string;
    source?: string;
    preview: string;
    chars: number;
  }>;
  tokenReport: CompiledPrompt['tokenReport'];
  activatedWorldEntries: Array<{
    worldBookName: string;
    comment: string;
    reason: string;
  }>;
  warnings: CompiledPrompt['warnings'];
};

export function inspectPrompt(prompt: CompiledPrompt): PromptInspectorModel {
  return {
    messages: prompt.messages.map((message) => ({
      role: message.role,
      name: message.name,
      label: typeof message.metadata.promptSlotLabel === 'string' ? message.metadata.promptSlotLabel : undefined,
      source: typeof message.metadata.promptSlotSource === 'string' ? message.metadata.promptSlotSource : undefined,
      preview: message.content.length > 180 ? `${message.content.slice(0, 177)}...` : message.content,
      chars: message.content.length
    })),
    tokenReport: prompt.tokenReport,
    activatedWorldEntries: prompt.activatedWorldEntries.map((item) => ({
      worldBookName: item.worldBookName,
      comment: item.entry.comment,
      reason: item.reason
    })),
    warnings: prompt.warnings
  };
}
