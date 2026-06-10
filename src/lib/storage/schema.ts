import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Character } from '$lib/schemas/character';
import type { Conversation } from '$lib/schemas/conversation';
import type { MessageNode, NankeMessage } from '$lib/schemas/message';
import type { GenerationProfile } from '$lib/schemas/profile';
import type { UserPersona } from '$lib/schemas/user-persona';
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
  personaId: text('persona_id'),
  profileId: text('profile_id'),
  rootNodeId: text('root_node_id'),
  activeLeafId: text('active_leaf_id'),
  nodeCount: integer('node_count').notNull().default(0),
  branchCount: integer('branch_count').notNull().default(0),
  activeDepth: integer('active_depth').notNull().default(0),
  lastPreview: text('last_preview'),
  revision: integer('revision').notNull().default(0),
  archivedAt: integer('archived_at'),
  data: text('data', { mode: 'json' }).$type<Conversation>().notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

export const messageNodes = sqliteTable('message_nodes', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  parentId: text('parent_id'),
  kind: text('kind').notNull(),
  role: text('role'),
  speakerId: text('speaker_id'),
  speakerName: text('speaker_name'),
  speakerAvatarAssetId: text('speaker_avatar_asset_id'),
  content: text('content').notNull().default(''),
  thinking: text('thinking'),
  siblingOrder: integer('sibling_order').notNull(),
  depth: integer('depth').notNull(),
  status: text('status').notNull(),
  lastActiveLeafId: text('last_active_leaf_id'),
  tokenEstimate: integer('token_estimate'),
  data: text('data', { mode: 'json' }).$type<MessageNode>().notNull(),
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

export const messageAssets = sqliteTable('message_assets', {
  id: text('id').primaryKey(),
  messageNodeId: text('message_node_id').notNull(),
  assetId: text('asset_id').notNull(),
  kind: text('kind').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
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

export const userPersonas = sqliteTable('user_personas', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull(),
  data: text('data', { mode: 'json' }).$type<UserPersona>().notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

export const personaCharacterBindings = sqliteTable(
  'persona_character_bindings',
  {
    personaId: text('persona_id').notNull(),
    characterId: text('character_id').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (table) => [primaryKey({ columns: [table.personaId, table.characterId] })]
);

export const importReports = sqliteTable('import_reports', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  data: text('data', { mode: 'json' }).$type<CompatReport>().notNull(),
  createdAt: integer('created_at').notNull()
});
