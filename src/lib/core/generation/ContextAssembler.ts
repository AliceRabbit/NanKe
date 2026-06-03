import type { Character } from '$lib/schemas/character';
import type { NankeMessage } from '$lib/schemas/message';
import type { GenerationProfile } from '$lib/schemas/profile';
import type { WorldBook } from '$lib/schemas/worldbook';

export type GenerationContext = {
  profile: GenerationProfile;
  character?: Character;
  messages: NankeMessage[];
  worldBooks: WorldBook[];
  persona?: string;
  userName?: string;
};

export function assembleContext(context: GenerationContext): GenerationContext {
  return context;
}
