export type CompatKind = 'character-card' | 'worldbook' | 'preset' | 'chat-jsonl';

export type CompatReport = {
  source: 'sillytavern';
  kind: CompatKind;
  mapped: string[];
  preservedAsExtras: string[];
  unsupported: string[];
  warnings: string[];
};

export function createCompatReport(kind: CompatKind): CompatReport {
  return {
    source: 'sillytavern',
    kind,
    mapped: [],
    preservedAsExtras: [],
    unsupported: [],
    warnings: []
  };
}
