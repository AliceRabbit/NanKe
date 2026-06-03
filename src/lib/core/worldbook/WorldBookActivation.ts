import type { WorldBookEntry } from '$lib/schemas/worldbook';

export type ActivatedWorldEntry = {
  worldBookId: string;
  worldBookName: string;
  entry: WorldBookEntry;
  reason: string;
  matchedKeys: string[];
};
