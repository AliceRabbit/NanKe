import { regexProfileSchema, type RegexProfile } from '$lib/schemas/regex';
import { getDatabaseHandle } from '../db';

const globalRegexKey = 'toolbox.global_regex.v1';

export class ToolboxRepository {
  constructor(private readonly sqlite = getDatabaseHandle().sqlite) {}

  getGlobalRegex(): RegexProfile {
    const row = this.sqlite.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(globalRegexKey) as { value: string } | undefined;
    if (!row) return regexProfileSchema.parse({});
    return regexProfileSchema.parse(JSON.parse(row.value));
  }

  saveGlobalRegex(value: RegexProfile): RegexProfile {
    const regex = regexProfileSchema.parse(value);
    this.sqlite
      .prepare(
        `
        INSERT INTO app_meta (key, value, updated_at)
        VALUES (@key, @value, @updatedAt)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `
      )
      .run({ key: globalRegexKey, value: JSON.stringify(regex), updatedAt: Date.now() });
    return regex;
  }
}
