import { createMessage, type NankeMessage } from '$lib/schemas/message';
import { createCompatReport } from './report';

type LegacyChatLine = {
  name?: string;
  is_user?: boolean;
  mes?: string;
  send_date?: string;
  chat_metadata?: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

export function importSillyTavernChatJsonl(jsonl: string, conversationId?: string) {
  const report = createCompatReport('chat-jsonl');
  const messages: NankeMessage[] = [];
  let metadata: Record<string, unknown> = {};

  for (const [index, line] of jsonl.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line) as LegacyChatLine;
    if (index === 0 && parsed.chat_metadata) {
      metadata = parsed.chat_metadata;
      report.mapped.push('chat_metadata');
      continue;
    }
    messages.push(
      createMessage({
        conversationId,
        role: parsed.is_user ? 'user' : 'assistant',
        name: parsed.name,
        content: parsed.mes ?? '',
        createdAt: parsed.send_date ? Date.parse(parsed.send_date) || Date.now() : Date.now(),
        metadata: parsed.extra ?? {}
      })
    );
  }

  report.mapped.push('messages', 'name', 'is_user', 'mes', 'send_date', 'extra');
  return { messages, metadata, report };
}
