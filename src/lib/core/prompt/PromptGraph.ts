import type { NankeMessage } from '$lib/schemas/message';
import type { ActivatedWorldEntry } from '$lib/core/worldbook/WorldBookActivation';
import type { TokenReport } from './TokenBudgeter';

export type PromptWarning = {
  code: string;
  message: string;
};

export type CompiledPrompt = {
  messages: NankeMessage[];
  tokenReport: TokenReport;
  activatedWorldEntries: ActivatedWorldEntry[];
  warnings: PromptWarning[];
};
