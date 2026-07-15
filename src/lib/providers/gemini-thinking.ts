export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

export const geminiThinkingLevels = ['minimal', 'low', 'medium', 'high'] as const;

export type GeminiThinkingLevelName = (typeof geminiThinkingLevels)[number];

// Matches Google's Gemini 2.5 reasoning-effort compatibility table.
const legacyBudgetsByLevel: Record<GeminiThinkingLevelName, number> = {
  minimal: 1024,
  low: 1024,
  medium: 8192,
  high: 24576
};

function canonicalGeminiModelId(model: string): string {
  return model.trim().toLowerCase().split('/').filter(Boolean).at(-1) ?? '';
}

export function geminiModelUsesThinkingLevel(model: string): boolean {
  const match = /^gemini-(\d+)(?=[.-]|$)/.exec(canonicalGeminiModelId(model));
  return match ? Number(match[1]) >= 3 : false;
}

export function supportedGeminiThinkingLevels(model: string): readonly GeminiThinkingLevelName[] {
  const modelId = canonicalGeminiModelId(model);

  if (/^gemini-3(?:\.0)?-pro(?:-|$)/.test(modelId)) return ['low', 'high'];
  if (/^gemini-3\.1-flash-lite-image(?:-|$)/.test(modelId)) return ['minimal', 'high'];
  if (/^gemini-3\.1-pro(?:-|$)/.test(modelId)) return ['low', 'medium', 'high'];
  return geminiThinkingLevels;
}

export function coerceGeminiThinkingLevel(model: string, level: GeminiThinkingLevelName): GeminiThinkingLevelName {
  const supported = supportedGeminiThinkingLevels(model);
  if (supported.includes(level)) return level;

  const requestedIndex = geminiThinkingLevels.indexOf(level);
  return supported.reduce((closest, candidate) => {
    const closestDistance = Math.abs(geminiThinkingLevels.indexOf(closest) - requestedIndex);
    const candidateDistance = Math.abs(geminiThinkingLevels.indexOf(candidate) - requestedIndex);
    return candidateDistance < closestDistance ? candidate : closest;
  });
}

export function geminiThinkingLevelFromBudget(budget: number | undefined): GeminiThinkingLevelName {
  if (typeof budget !== 'number' || !Number.isFinite(budget)) return 'medium';
  if (budget <= 0) return 'minimal';
  if (budget <= 1024) return 'low';
  if (budget <= 8192) return 'medium';
  return 'high';
}

export function geminiThinkingBudgetFromLevel(level: GeminiThinkingLevelName): number {
  return legacyBudgetsByLevel[level];
}
