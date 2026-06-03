import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Character } from '$lib/schemas/character';
import type { Conversation } from '$lib/schemas/conversation';
import type { NankeMessage } from '$lib/schemas/message';
import type { GenerationProfile } from '$lib/schemas/profile';
import type { WorldBook } from '$lib/schemas/worldbook';
import type { CompatReport } from '$lib/compat/sillytavern/report';

export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  data: text('data', { mode: 'json' }).$type<Character>().notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  characterId: text('character_id'),
  profileId: text('profile_id'),
  data: text('data', { mode: 'json' }).$type<Conversation>().notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  role: text('role').notNull(),
  data: text('data', { mode: 'json' }).$type<NankeMessage>().notNull(),
  createdAt: integer('created_at').notNull()
});

export const worldBooks = sqliteTable('world_books', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  data: text('data', { mode: 'json' }).$type<WorldBook>().notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

export const generationProfiles = sqliteTable('generation_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  providerType: text('provider_type').notNull(),
  data: text('data', { mode: 'json' }).$type<GenerationProfile>().notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

export const importReports = sqliteTable('import_reports', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  data: text('data', { mode: 'json' }).$type<CompatReport>().notNull(),
  createdAt: integer('created_at').notNull()
});
