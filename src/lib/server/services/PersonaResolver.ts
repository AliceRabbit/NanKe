import type { UserPersona } from '$lib/schemas/user-persona';
import type { createRequestContext } from '$lib/server/request-context';
import { AppError } from '$lib/server/errors';

export type PersonaResolutionSource = 'explicit' | 'conversation' | 'character' | 'default' | 'fallback';

export type PersonaResolution = {
  persona?: UserPersona;
  source: PersonaResolutionSource;
};

export type PersonaResolutionInput = {
  explicitPersonaId?: string;
  conversationPersonaId?: string;
  characterId?: string;
};

export function resolvePersonaForGeneration(context: ReturnType<typeof createRequestContext>, input: PersonaResolutionInput): PersonaResolution {
  if (input.explicitPersonaId) {
    const persona = context.personas.get(input.explicitPersonaId);
    if (!persona) throw new AppError('Persona not found.', 404, 'persona_not_found');
    return { persona, source: 'explicit' };
  }

  if (input.conversationPersonaId) {
    const persona = context.personas.get(input.conversationPersonaId);
    if (persona) return { persona, source: 'conversation' };
  }

  if (input.characterId) {
    const persona = context.personas.resolveForCharacter(input.characterId);
    if (persona) return { persona, source: 'character' };
  }

  const persona = context.personas.getDefault();
  if (persona) return { persona, source: 'default' };

  return { source: 'fallback' };
}
