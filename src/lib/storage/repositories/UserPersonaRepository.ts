import type Database from 'better-sqlite3';
import { asc, eq } from 'drizzle-orm';
import { userPersonaSchema, type UserPersona } from '$lib/schemas/user-persona';
import { personaCharacterBindings, userPersonas } from '../schema';
import { getDatabase, getDatabaseHandle } from '../db';

export type PersonaCharacterBinding = {
  personaId: string;
  characterId: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type UserPersonaDeleteResult = {
  deleted: boolean;
  id: string;
  affectedConversationIds: string[];
  affectedCharacterIds: string[];
  removedCharacterBindings: number;
  defaultCleared: boolean;
};

type PersonaCharacterBindingRow = {
  persona_id: string;
  character_id: string;
  enabled: number;
  created_at: number;
  updated_at: number;
};

type ConversationPersonaRow = {
  id: string;
  data: string;
  created_at: number;
  updated_at: number;
};

export class UserPersonaRepository {
  constructor(
    private readonly db = getDatabase(),
    private readonly sqliteHandle?: Database.Database
  ) {}

  private get sqlite(): Database.Database {
    return this.sqliteHandle ?? getDatabaseHandle().sqlite;
  }

  list(): UserPersona[] {
    return this.db.select().from(userPersonas).orderBy(asc(userPersonas.name)).all().map((row) => userPersonaSchema.parse(row.data));
  }

  get(id: string): UserPersona | undefined {
    const row = this.db.select().from(userPersonas).where(eq(userPersonas.id, id)).get();
    return row ? userPersonaSchema.parse(row.data) : undefined;
  }

  getDefault(): UserPersona | undefined {
    const row = this.db.select().from(userPersonas).where(eq(userPersonas.isDefault, true)).get();
    return row ? userPersonaSchema.parse(row.data) : undefined;
  }

  listCharacterBindings(characterId?: string): PersonaCharacterBinding[] {
    const rows = characterId
      ? (this.sqlite
          .prepare(
            `
            SELECT *
            FROM persona_character_bindings
            WHERE character_id = @characterId
            ORDER BY enabled DESC, updated_at DESC
          `
          )
          .all({ characterId }) as PersonaCharacterBindingRow[])
      : (this.sqlite
          .prepare(
            `
            SELECT *
            FROM persona_character_bindings
            ORDER BY character_id ASC, enabled DESC, updated_at DESC
          `
          )
          .all() as PersonaCharacterBindingRow[]);
    return rows.map(hydratePersonaCharacterBinding);
  }

  resolveForCharacter(characterId: string): UserPersona | undefined {
    const row = this.sqlite
      .prepare(
        `
        SELECT persona_id
        FROM persona_character_bindings
        WHERE character_id = @characterId AND enabled = 1
        ORDER BY updated_at DESC
        LIMIT 1
      `
      )
      .get({ characterId }) as { persona_id: string } | undefined;
    return row ? this.get(row.persona_id) : undefined;
  }

  setCharacterBinding(personaId: string, characterId: string, enabled = true): PersonaCharacterBinding {
    const persona = this.get(personaId);
    if (!persona) throw new Error(`Persona not found: ${personaId}`);
    const now = Date.now();
    this.db
      .insert(personaCharacterBindings)
      .values({
        personaId,
        characterId,
        enabled,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [personaCharacterBindings.personaId, personaCharacterBindings.characterId],
        set: {
          enabled,
          updatedAt: now
        }
      })
      .run();
    return { personaId, characterId, enabled, createdAt: now, updatedAt: now };
  }

  removeCharacterBinding(personaId: string, characterId: string): boolean {
    const result = this.sqlite
      .prepare(
        `
        DELETE FROM persona_character_bindings
        WHERE persona_id = @personaId AND character_id = @characterId
      `
      )
      .run({ personaId, characterId });
    return result.changes > 0;
  }

  save(persona: UserPersona): UserPersona {
    const updated = { ...persona, updatedAt: Date.now() };
    if (updated.isDefault) {
      for (const existing of this.list()) {
        if (existing.id !== updated.id && existing.isDefault) {
          this.save({ ...existing, isDefault: false });
        }
      }
    }

    this.db
      .insert(userPersonas)
      .values({
        id: updated.id,
        name: updated.name,
        isDefault: updated.isDefault,
        data: updated,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      })
      .onConflictDoUpdate({
        target: userPersonas.id,
        set: {
          name: updated.name,
          isDefault: updated.isDefault,
          data: updated,
          updatedAt: updated.updatedAt
        }
      })
      .run();
    return updated;
  }

  duplicate(id: string): UserPersona | undefined {
    const source = this.get(id);
    if (!source) return undefined;
    return this.save(
      userPersonaSchema.parse({
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} Copy`,
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    );
  }

  delete(id: string): UserPersonaDeleteResult {
    const persona = this.get(id);
    if (!persona) {
      return {
        deleted: false,
        id,
        affectedConversationIds: [],
        affectedCharacterIds: [],
        removedCharacterBindings: 0,
        defaultCleared: false
      };
    }

    const conversationRows = this.sqlite
      .prepare(
        `
        SELECT id, data, created_at, updated_at
        FROM conversations
        WHERE persona_id = @id
      `
      )
      .all({ id }) as ConversationPersonaRow[];
    const bindingRows = this.listCharacterBindings().filter((binding) => binding.personaId === id);
    const affectedConversationIds = conversationRows.map((row) => row.id);
    const affectedCharacterIds = bindingRows.map((binding) => binding.characterId);
    const now = Date.now();

    const transaction = this.sqlite.transaction(() => {
      const updateConversation = this.sqlite.prepare(
        `
        UPDATE conversations
        SET persona_id = NULL,
            data = @data,
            updated_at = @updatedAt
        WHERE id = @id
      `
      );
      for (const row of conversationRows) {
        const data = parseConversationData(row.data);
        delete data.personaId;
        updateConversation.run({
          id: row.id,
          data: JSON.stringify({ ...data, updatedAt: now }),
          updatedAt: now
        });
      }

      this.sqlite.prepare(`DELETE FROM persona_character_bindings WHERE persona_id = @id`).run({ id });
      this.sqlite.prepare(`DELETE FROM user_personas WHERE id = @id`).run({ id });
    });
    transaction();

    return {
      deleted: true,
      id,
      affectedConversationIds,
      affectedCharacterIds,
      removedCharacterBindings: bindingRows.length,
      defaultCleared: persona.isDefault
    };
  }
}

function hydratePersonaCharacterBinding(row: PersonaCharacterBindingRow): PersonaCharacterBinding {
  return {
    personaId: row.persona_id,
    characterId: row.character_id,
    enabled: row.enabled !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseConversationData(data: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
