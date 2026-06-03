import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDefaultGenerationProfile } from '$lib/schemas/profile';
import { createMessage } from '$lib/schemas/message';
import { createCharacter } from '$lib/schemas/character';
import { PromptCompiler } from '$lib/core/prompt/PromptCompiler';
import { WorldBookEngine } from '$lib/core/worldbook/WorldBookEngine';
import {
  importSillyTavernCharacterCard,
  importSillyTavernChatJsonl,
  importSillyTavernPreset,
  importSillyTavernWorldBook,
  readSillyTavernCardJsonFromPng
} from '$lib/compat/sillytavern';

const workspaceTestCardPath = path.resolve(process.cwd(), '..', '测试用', '测试用角色卡.png');
const workspaceCardTest = fs.existsSync(workspaceTestCardPath) ? it : it.skip;
const workspaceTestPresetPath = path.resolve(process.cwd(), '..', '测试用', '测试用预设.json');
const workspacePresetTest = fs.existsSync(workspaceTestPresetPath) ? it : it.skip;

describe('SillyTavern compat importers', () => {
  it('imports world info entries into NanKe world books', () => {
    const { worldBook, report } = importSillyTavernWorldBook(
      {
        entries: {
          '0': {
            uid: 0,
            key: ['forest'],
            keysecondary: [],
            comment: 'forest',
            content: 'Forest lore.',
            position: 0,
            disable: false
          }
        }
      },
      'Imported'
    );

    expect(worldBook.name).toBe('Imported');
    expect(worldBook.entries[0].keys).toEqual(['forest']);
    expect(report.mapped).toContain('entries');
  });

  it('imports openai presets into generation profiles', () => {
    const { profile, kind, report } = importSillyTavernPreset({
      chat_completion_source: 'openai',
      openai_model: 'gpt-4o-mini',
      temperature: 0.8,
      openai_max_tokens: 300,
      prompts: [{ identifier: 'main', name: 'Main', role: 'system', content: 'Write as {{char}}.' }]
    });

    expect(kind).toBe('openai');
    expect(profile.provider.type).toBe('openai-compatible');
    expect(profile.sampler.temperature).toBe(0.8);
    expect(report.mapped).toContain('prompts');
  });

  it('imports chat jsonl messages', () => {
    const { messages, metadata } = importSillyTavernChatJsonl(
      [
        JSON.stringify({ chat_metadata: { integrity: 'abc' } }),
        JSON.stringify({ name: 'User', is_user: true, mes: 'Hi' }),
        JSON.stringify({ name: 'Bot', is_user: false, mes: 'Hello' })
      ].join('\n'),
      'conversation'
    );

    expect(metadata.integrity).toBe('abc');
    expect(messages).toHaveLength(2);
    expect(messages[1].role).toBe('assistant');
  });

  workspaceCardTest('imports the workspace SillyTavern v3 PNG character card without losing embedded features', () => {
    const raw = readSillyTavernCardJsonFromPng(fs.readFileSync(workspaceTestCardPath)) as {
      spec?: string;
      data?: Record<string, unknown>;
    };
    const { character, report } = importSillyTavernCharacterCard(raw);

    expect(raw.spec).toBe('chara_card_v3');
    expect(character.name).toBe('联合国全球协调部队');
    expect(character.description.length).toBeGreaterThan(2900);
    expect(character.firstMessage.length).toBeGreaterThan(900);
    expect(character.talkativeness).toBe(0.5);
    expect(character.favorite).toBe(false);
    expect(character.extensions.world).toBe('UNGCF');
    expect(character.depthPrompt?.depth).toBe(4);
    expect(character.depthPrompt?.role).toBe('system');
    expect(character.depthPrompt?.prompt).toContain('联合国全球协调部队');
    expect(character.characterBook?.name).toBe('UNGCF');
    expect(character.characterBook?.entries).toHaveLength(5);
    expect(character.characterBook?.entries[0].keys).toContain('人工智能');
    expect(character.characterBook?.entries[0].position).toBe('after');
    expect(character.characterBook?.entries[0].extensions.use_regex).toBe(true);
    expect(report.unsupported).not.toContain('data.character_book');
    expect(character.legacy?.raw).toBe(raw);

    const worldBook = character.characterBook;
    expect(worldBook).toBeDefined();
    if (!worldBook) return;

    const activated = new WorldBookEngine().activate([worldBook], [createMessage({ role: 'user', content: '尤尼现在在哪里？' })]);
    expect(activated.some((entry) => entry.entry.keys.includes('尤尼'))).toBe(true);

    const compiled = new PromptCompiler().compile({
      profile: createDefaultGenerationProfile(),
      character,
      messages: [createMessage({ role: 'user', content: '尤尼现在在哪里？' })],
      activatedWorldEntries: activated,
      userName: '测试用户'
    });
    expect(compiled.messages.some((message) => message.content.includes('尤尼'))).toBe(true);
    expect(compiled.messages.some((message) => message.name === 'Depth Prompt' && message.content.includes('联合国全球协调部队'))).toBe(true);
  });

  workspacePresetTest('imports the workspace SillyTavern OpenAI preset with prompt manager semantics', () => {
    const raw = JSON.parse(fs.readFileSync(workspaceTestPresetPath, 'utf8'));
    const { profile, kind, report } = importSillyTavernPreset(raw, '测试用预设');

    expect(kind).toBe('openai');
    expect(profile.name).toBe('测试用预设');
    expect(profile.prompt.macroMode).toBe('sillytavern');
    expect(profile.prompt.squashSystemMessages).toBe(true);
    expect(profile.sampler.contextTokens).toBe(2_000_000);
    expect(profile.sampler.maxTokens).toBe(30_000);
    expect(profile.sampler.frequencyPenalty).toBe(0);
    expect(profile.sampler.repetitionPenalty).toBe(1);
    expect(profile.prompt.slots).toHaveLength(203);
    expect(profile.prompt.slots.filter((slot) => slot.enabled)).toHaveLength(52);
    expect(profile.prompt.slots.filter((slot) => slot.legacy?.ordered === false)).toHaveLength(31);
    expect(profile.prompt.slots.find((slot) => slot.id === 'personaDescription')?.source).toBe('persona');
    expect(profile.prompt.slots.find((slot) => slot.id === 'worldInfoBefore')?.source).toBe('worldbook-before');
    expect(profile.prompt.slots.find((slot) => slot.id === 'chatHistory')?.source).toBe('history');
    expect(report.preservedAsExtras).toContain('31 prompts not present in active prompt_order');
    expect(report.preservedAsExtras).toContain('extensions.regex_scripts');

    const metadata = profile.metadata.sillyTavern as {
      promptManager: { promptCount: number; orderedPromptCount: number; enabledPromptCount: number };
      extensions?: { regex_scripts?: unknown[] };
    };
    expect(metadata.promptManager.promptCount).toBe(203);
    expect(metadata.promptManager.orderedPromptCount).toBe(172);
    expect(metadata.promptManager.enabledPromptCount).toBe(52);
    expect(metadata.extensions?.regex_scripts?.length).toBeGreaterThan(0);

    const compiled = new PromptCompiler().compile({
      profile,
      character: createCharacter({
        name: '联合国全球协调部队',
        description: '测试角色描述。',
        personality: '测试性格。',
        scenario: '测试场景。',
        exampleMessages: 'Master: 你好\n联合国全球协调部队: 你好。'
      }),
      persona: 'Master 是测试用户。',
      userName: 'Master',
      messages: [createMessage({ role: 'user', content: '开始测试' })]
    });
    const joined = compiled.messages.map((message) => message.content).join('\n\n');
    expect(joined).toContain('<Master_input>');
    expect(joined).toContain('开始测试');
    expect(joined).not.toContain('{{setvar::');
    expect(joined).not.toContain('{{getvar::');
    expect(joined).not.toContain('{{lastUserMessage}}');
    expect(joined).not.toContain('{{//');
    expect(compiled.messages.some((message) => message.name?.includes('主提示'))).toBe(false);
    expect(compiled.warnings.some((warning) => warning.code === 'unsupported-sillytavern-macros')).toBe(false);
  });

  it('imports SillyTavern Vertex AI presets as Vertex Express by default', () => {
    const { profile, kind } = importSillyTavernPreset({
      name: 'Vertex Express Preset',
      chat_completion_source: 'vertexai',
      vertexai_model: 'gemini-2.5-pro',
      vertexai_auth_mode: 'express',
      vertexai_region: 'global',
      vertexai_express_project_id: 'optional-project',
      prompts: [],
      prompt_order: []
    });

    expect(kind).toBe('openai');
    expect(profile.provider.type).toBe('gemini');
    if (profile.provider.type !== 'gemini') throw new Error('Expected Gemini profile');
    expect(profile.provider.vertex).toEqual({
      mode: 'express',
      projectId: 'optional-project',
      location: 'global'
    });
  });
});
