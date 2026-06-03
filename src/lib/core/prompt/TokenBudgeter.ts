import type { NankeMessage } from '$lib/schemas/message';

export type TokenReport = {
  estimatedPromptTokens: number;
  maxContextTokens: number;
  reservedResponseTokens: number;
  trimmedMessages: number;
};

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateMessageTokens(message: Pick<NankeMessage, 'role' | 'name' | 'content'>): number {
  return estimateTokens(message.content) + 4 + (message.name ? estimateTokens(message.name) : 0);
}

export function trimMessagesToBudget(messages: NankeMessage[], contextTokens = 8192, maxTokens = 512): { messages: NankeMessage[]; report: TokenReport } {
  const budget = Math.max(1, contextTokens - maxTokens);
  const kept = [...messages];
  let trimmedMessages = 0;

  const total = () => kept.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
  while (kept.length > 1 && total() > budget) {
    const removableIndex = kept.findIndex((message) => message.role !== 'system');
    if (removableIndex === -1) break;
    kept.splice(removableIndex, 1);
    trimmedMessages += 1;
  }

  return {
    messages: kept,
    report: {
      estimatedPromptTokens: total(),
      maxContextTokens: contextTokens,
      reservedResponseTokens: maxTokens,
      trimmedMessages
    }
  };
}
