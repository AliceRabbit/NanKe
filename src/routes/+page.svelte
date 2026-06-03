<script lang="ts">
  import { onMount } from 'svelte';
  import { applyRegexScripts, hasRegexScriptForPlacement, REGEX_PLACEMENT } from '$lib/core/regex';
  import type { RegexPlacement, RegexScript } from '$lib/schemas/regex';
  import {
    ArrowDown,
    ArrowUp,
    Bot,
    BookOpen,
    Copy,
    Download,
    GripHorizontal,
    MessageSquare,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Send,
    Save,
    Settings2,
    Trash2,
    Upload,
    UserRound,
    SquarePen,
    X
  } from '@lucide/svelte';

  type ProviderType = 'openai-compatible' | 'gemini';
  type OpenAICompatibility = 'strict-openai' | 'extended';
  type VertexMode = 'express' | 'oauth';
  type PromptRole = 'system' | 'user' | 'assistant';
  type PromptMode = 'chat' | 'text';
  type MacroMode = 'none' | 'sillytavern';
  type PromptSlotSource =
    | 'system'
    | 'character-system'
    | 'character-description'
    | 'character-personality'
    | 'scenario'
    | 'persona'
    | 'worldbook-before'
    | 'worldbook-after'
    | 'examples'
    | 'history'
    | 'post-history'
    | 'custom';
  type PromptSlot = {
    id: string;
    source: PromptSlotSource;
    role: PromptRole;
    enabled?: boolean;
    content?: string;
    label?: string;
    injection?: {
      position?: 'relative' | 'absolute';
      depth?: number;
      order?: number;
      triggers?: string[];
    };
    legacy?: {
      source?: string;
      identifier?: string;
      marker?: boolean;
      systemPrompt?: boolean;
      forbidOverrides?: boolean;
      ordered?: boolean;
      enabledInPromptOrder?: boolean;
      enabledInPrompt?: boolean;
      originalIndex?: number;
    };
  };
  type Profile = {
    id: string;
    name: string;
    provider:
      | {
          type: 'openai-compatible';
          model: string;
          endpoint?: string;
          apiKey?: string;
          compatibility?: OpenAICompatibility;
        }
      | {
          type: 'gemini';
          model: string;
          endpoint?: string;
          apiKey?: string;
          vertex?: { mode?: VertexMode; projectId?: string; location?: string; apiKey?: string; accessToken?: string };
        };
    sampler?: {
      temperature?: number;
      topP?: number;
      topK?: number;
      topA?: number;
      minP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      repetitionPenalty?: number;
      maxTokens?: number;
      contextTokens?: number;
      seed?: number;
      n?: number;
      stop?: string[];
    };
    request?: {
      stream?: boolean;
    };
    prompt?: {
      mode?: PromptMode;
      macroMode?: MacroMode;
      squashSystemMessages?: boolean;
      slots?: PromptSlot[];
    };
    regex?: {
      enabled?: boolean;
      scripts?: RegexScript[];
    };
    metadata?: Record<string, unknown> & {
      sillyTavern?: {
        kind?: string;
        promptManager?: {
          promptCount?: number;
          orderedPromptCount?: number;
          enabledPromptCount?: number;
          inactivePromptCount?: number;
        };
      };
    };
    legacy?: { source: 'sillytavern'; raw: unknown; report: unknown };
    createdAt: number;
    updatedAt: number;
  };
  type Character = {
    id: string;
    name: string;
    firstMessage?: string;
    avatarAssetId?: string;
    worldBookIds?: string[];
    characterBook?: { id: string; name: string; entries: unknown[] };
  };
  type UserPersona = {
    id: string;
    name: string;
    description: string;
    avatarAssetId?: string;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
  };
  type WorldBook = { id: string; name: string; entries: unknown[]; metadata?: { source?: string; characterId?: string; characterName?: string } };
  type Conversation = { id: string; title: string; characterId?: string; personaId?: string; profileId?: string; messages?: ChatMessage[] };
  type ChatMessage = { role: 'user' | 'assistant' | 'system'; name?: string; content: string };
  type ZoomedAvatar = { key: string; name: string; role: ChatMessage['role']; src: string; initials: string };
  type ImportKind = 'preset' | 'character-card-json' | 'character-card-png' | 'worldbook' | 'chat-jsonl';
  type View = 'chat' | 'characters' | 'personas' | 'worldbooks' | 'profiles';
  type Drawer = 'chats' | 'characters' | 'personas' | 'worldbooks' | 'profiles' | 'import' | 'inspector' | null;

  const promptSources: PromptSlotSource[] = [
    'system',
    'character-system',
    'character-description',
    'character-personality',
    'scenario',
    'persona',
    'worldbook-before',
    'worldbook-after',
    'examples',
    'history',
    'post-history',
    'custom'
  ];
  const promptRoles: PromptRole[] = ['system', 'user', 'assistant'];
  const promptTriggerOptions = ['normal', 'continue', 'impersonate', 'swipe', 'regenerate', 'quiet'];
  const maxContextTokens = 2_000_000;

  let profiles: Profile[] = [];
  let characters: Character[] = [];
  let personas: UserPersona[] = [];
  let worldBooks: WorldBook[] = [];
  let conversations: Conversation[] = [];
  let activeView: View = 'chat';
  let activeDrawer: Drawer = null;
  let activeProfileId = '';
  let activeCharacterId = '';
  let activePersonaId = '';
  let activeConversationId = '';
  let messages: ChatMessage[] = [];
  let input = '';
  let status = 'Ready';
  let importKind: ImportKind = 'preset';
  let importName = '';
  let importText = '';
  let importFileName = '';
  let importFileBase64 = '';
  let inspector = '';
  let newCharacterName = '';
  let newCharacterDescription = '';
  let newPersonaName = '';
  let newPersonaDescription = '';
  let newPersonaDefault = false;
  let personaDraftId = '';
  let personaDraftName = '';
  let personaDraftDescription = '';
  let personaDraftDefault = false;
  let newWorldBookName = '';
  let openingPreviewCharacterId = '';
  let zoomedAvatar: ZoomedAvatar | null = null;
  let profileQuery = '';
  let profileDraftId = '';
  let profileDraftName = '';
  let profileDraftProviderType: ProviderType = 'openai-compatible';
  let profileDraftProviderModel = '';
  let profileDraftProviderEndpoint = '';
  let profileDraftApiKey = '';
  let profileDraftOpenAICompatibility: OpenAICompatibility = 'strict-openai';
  let profileDraftVertexEnabled = false;
  let profileDraftVertexMode: VertexMode = 'express';
  let profileDraftVertexProjectId = '';
  let profileDraftVertexLocation = '';
  let profileDraftVertexApiKey = '';
  let profileDraftVertexAccessToken = '';
  let profileDraftTemperature = '';
  let profileDraftTopP = '';
  let profileDraftTopK = '';
  let profileDraftTopA = '';
  let profileDraftMinP = '';
  let profileDraftFrequencyPenalty = '';
  let profileDraftPresencePenalty = '';
  let profileDraftRepetitionPenalty = '';
  let profileDraftMaxTokens = '';
  let profileDraftContextTokens = '';
  let profileDraftSeed = '';
  let profileDraftN = '';
  let profileDraftStop = '';
  let profileDraftStream = true;
  let profileDraftMode: PromptMode = 'chat';
  let profileDraftMacroMode: MacroMode = 'none';
  let profileDraftSquashSystemMessages = false;
  let profileDraftRegexEnabled = true;
  let profileDraftRegexScripts: RegexScript[] = [];
  let profileDraftSlots: PromptSlot[] = [];
  let promptSlotQuery = '';
  let activePromptSlotId = '';
  let promptEditorSlotId = '';
  let promptEditorInitialSlot: PromptSlot | null = null;

  $: activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  $: activeProfileStats = profileStats(activeProfile);
  $: filteredProfiles = filterProfiles(profiles, profileQuery);
  $: draftPromptStats = promptSlotStats(profileDraftSlots);
  $: filteredPromptSlots = filterPromptSlots(profileDraftSlots, promptSlotQuery);
  $: activePromptSlot = profileDraftSlots.find((slot) => slot.id === activePromptSlotId);
  $: promptEditorSlot = profileDraftSlots.find((slot) => slot.id === promptEditorSlotId);
  $: activeCharacter = characters.find((character) => character.id === activeCharacterId);
  $: activeCharacterWorldBooks = boundWorldBooksForCharacter(activeCharacter);
  $: activePersona = personas.find((persona) => persona.id === activePersonaId);
  $: activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  $: drawerTitle =
    activeDrawer === 'chats'
      ? 'Chats'
      : activeDrawer === 'characters'
        ? 'Characters'
        : activeDrawer === 'personas'
          ? 'Personas'
          : activeDrawer === 'worldbooks'
            ? 'World Books'
            : activeDrawer === 'profiles'
              ? 'Profiles'
              : activeDrawer === 'import'
                ? 'Import'
                : activeDrawer === 'inspector'
                  ? 'Inspector'
                  : '';
  $: drawerIsRight = activeDrawer === 'import' || activeDrawer === 'inspector';
  $: if (activeProfileId !== profileDraftId) {
    loadProfileDraft(activeProfile);
  }
  $: if (profileDraftSlots.length && !profileDraftSlots.some((slot) => slot.id === activePromptSlotId)) {
    activePromptSlotId = profileDraftSlots[0].id;
  }
  $: if (promptEditorSlotId && !profileDraftSlots.some((slot) => slot.id === promptEditorSlotId)) {
    promptEditorSlotId = '';
    promptEditorInitialSlot = null;
  }
  $: if (activePersonaId !== personaDraftId) {
    personaDraftId = activePersonaId;
    personaDraftName = activePersona?.name ?? '';
    personaDraftDescription = activePersona?.description ?? '';
    personaDraftDefault = activePersona?.isDefault ?? false;
  }
  $: if (!activeConversationId) {
    const opening = activeCharacter?.firstMessage?.trim() ? renderCharacterTemplate(activeCharacter.firstMessage) : '';
    const canReplacePreview = Boolean(openingPreviewCharacterId) && messages.length === 1 && messages[0]?.role === 'assistant';
    const shouldShowOpening = Boolean(opening) && (messages.length === 0 || (canReplacePreview && (openingPreviewCharacterId !== activeCharacterId || messages[0].content !== opening)));
    if (shouldShowOpening) {
      messages = [{ role: 'assistant', name: activeCharacter?.name, content: opening }];
      openingPreviewCharacterId = activeCharacterId;
    } else if (!opening && canReplacePreview) {
      messages = [];
      openingPreviewCharacterId = '';
    }
  }

  onMount(() => {
    void refreshAll();
  });

  function openLibrary(view: Exclude<View, 'chat'>) {
    activeView = view;
    activeDrawer = activeDrawer === view ? null : view;
  }

  function openDrawer(drawer: Exclude<Drawer, null>) {
    activeDrawer = activeDrawer === drawer ? null : drawer;
  }

  function openPresetImport() {
    importKind = 'preset';
    activeDrawer = 'import';
  }

  function closeDrawer() {
    activeDrawer = null;
  }

  function startNewConversation() {
    activeConversationId = '';
    openingPreviewCharacterId = '';
    messages = [];
    activeView = 'chat';
    closeDrawer();
  }

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as T;
  }

  async function refreshAll() {
    status = 'Loading';
    profiles = await fetchJson<Profile[]>('/api/profiles');
    characters = await fetchJson<Character[]>('/api/characters');
    personas = await fetchJson<UserPersona[]>('/api/personas');
    worldBooks = await fetchJson<WorldBook[]>('/api/worldbooks');
    conversations = await fetchJson<Conversation[]>('/api/conversations');
    activeProfileId ||= profiles[0]?.id ?? '';
    activeCharacterId ||= characters[0]?.id ?? '';
    activePersonaId ||= personas.find((persona) => persona.isDefault)?.id ?? personas[0]?.id ?? '';
    status = 'Ready';
  }

  function profileStats(profile?: Profile) {
    const slots = profile?.prompt?.slots ?? [];
    const promptManager = profile?.metadata?.sillyTavern?.promptManager;
    const total = promptManager?.promptCount ?? slots.length;
    const ordered = promptManager?.orderedPromptCount ?? slots.filter((slot) => slot.legacy?.ordered !== false).length;
    const enabled = promptManager?.enabledPromptCount ?? slots.filter((slot) => slot.enabled !== false).length;
    const inactive = promptManager?.inactivePromptCount ?? Math.max(0, total - enabled);
    return { total, ordered, enabled, inactive };
  }

  function profileOrigin(profile: Profile) {
    const kind = profile.metadata?.sillyTavern?.kind;
    return kind ? `SillyTavern ${kind}` : 'NanKe native';
  }

  function profileSamplerLine(profile: Profile) {
    const sampler = profile.sampler ?? {};
    const parts = [
      sampler.temperature !== undefined ? `temp ${sampler.temperature}` : '',
      sampler.topP !== undefined ? `top-p ${sampler.topP}` : '',
      sampler.maxTokens !== undefined ? `${sampler.maxTokens} out` : '',
      sampler.contextTokens !== undefined ? `${sampler.contextTokens} ctx` : '',
      profile.request?.stream === false ? 'non-stream' : 'stream'
    ].filter(Boolean);
    return parts.join(' · ') || 'No sampler details';
  }

  function boundWorldBooksForCharacter(character?: Character) {
    if (!character) return [];
    const ids = new Set(character.worldBookIds ?? []);
    if (character.characterBook?.id) ids.add(character.characterBook.id);
    return worldBooks.filter((worldBook) => ids.has(worldBook.id) || worldBook.metadata?.characterId === character.id);
  }

  function worldBookLine(worldBook: WorldBook) {
    if (worldBook.metadata?.source === 'character-card') {
      return `${worldBook.entries.length} entries · bound to ${worldBook.metadata.characterName ?? 'character'}`;
    }
    return `${worldBook.entries.length} entries`;
  }

  function regexScriptSurface(script: RegexScript) {
    const surfaces = [
      script.placement.includes(1) ? 'input' : '',
      script.placement.includes(2) ? 'output' : '',
      script.placement.includes(5) ? 'world' : '',
      script.placement.includes(6) ? 'reasoning' : ''
    ].filter(Boolean);
    const scope = script.promptOnly ? 'prompt' : script.markdownOnly ? 'display' : 'normal';
    return `${scope}${surfaces.length ? ` · ${surfaces.join('/')}` : ''}`;
  }

  function filterProfiles(items: Profile[], query: string) {
    const text = query.trim().toLowerCase();
    if (!text) return items;
    return items.filter((profile) => [profile.name, profile.provider.type, profile.provider.model, profileOrigin(profile)].join(' ').toLowerCase().includes(text));
  }

  function numberToDraft(value: number | undefined) {
    return value === undefined ? '' : String(value);
  }

  function optionalNumber(value: string) {
    const text = value.trim();
    if (!text) return undefined;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function optionalInteger(value: string) {
    const parsed = optionalNumber(value);
    return parsed === undefined ? undefined : Math.trunc(parsed);
  }

  function clonePromptSlots(slots: PromptSlot[] | undefined): PromptSlot[] {
    return structuredClone(slots ?? []);
  }

  function loadProfileDraft(profile?: Profile) {
    if (!profile) {
      profileDraftId = '';
      profileDraftName = '';
      profileDraftProviderType = 'openai-compatible';
      profileDraftProviderModel = '';
      profileDraftProviderEndpoint = '';
      profileDraftApiKey = '';
      profileDraftOpenAICompatibility = 'strict-openai';
      profileDraftVertexEnabled = false;
      profileDraftVertexMode = 'express';
      profileDraftVertexProjectId = '';
      profileDraftVertexLocation = '';
      profileDraftVertexApiKey = '';
      profileDraftVertexAccessToken = '';
      profileDraftTemperature = '';
      profileDraftTopP = '';
      profileDraftTopK = '';
      profileDraftTopA = '';
      profileDraftMinP = '';
      profileDraftFrequencyPenalty = '';
      profileDraftPresencePenalty = '';
      profileDraftRepetitionPenalty = '';
      profileDraftMaxTokens = '';
      profileDraftContextTokens = '';
      profileDraftSeed = '';
      profileDraftN = '';
      profileDraftStop = '';
      profileDraftStream = true;
      profileDraftMode = 'chat';
      profileDraftMacroMode = 'none';
      profileDraftSquashSystemMessages = false;
      profileDraftRegexEnabled = true;
      profileDraftRegexScripts = [];
      profileDraftSlots = [];
      activePromptSlotId = '';
      promptSlotQuery = '';
      promptEditorSlotId = '';
      promptEditorInitialSlot = null;
      return;
    }

    const sampler = profile.sampler ?? {};
    profileDraftId = profile.id;
    profileDraftName = profile.name;
    profileDraftProviderType = profile.provider.type;
    profileDraftProviderModel = profile.provider.model;
    profileDraftProviderEndpoint = profile.provider.endpoint ?? '';
    profileDraftApiKey = profile.provider.apiKey ?? '';
    profileDraftOpenAICompatibility = profile.provider.type === 'openai-compatible' ? (profile.provider.compatibility ?? 'strict-openai') : 'strict-openai';
    profileDraftVertexEnabled = profile.provider.type === 'gemini' && Boolean(profile.provider.vertex);
    profileDraftVertexMode = profile.provider.type === 'gemini' ? (profile.provider.vertex?.mode ?? 'express') : 'express';
    profileDraftVertexProjectId = profile.provider.type === 'gemini' ? (profile.provider.vertex?.projectId ?? '') : '';
    profileDraftVertexLocation = profile.provider.type === 'gemini' ? (profile.provider.vertex?.location ?? 'us-central1') : 'us-central1';
    profileDraftVertexApiKey = profile.provider.type === 'gemini' ? (profile.provider.vertex?.apiKey ?? '') : '';
    profileDraftVertexAccessToken = profile.provider.type === 'gemini' ? (profile.provider.vertex?.accessToken ?? '') : '';
    profileDraftTemperature = numberToDraft(sampler.temperature);
    profileDraftTopP = numberToDraft(sampler.topP);
    profileDraftTopK = numberToDraft(sampler.topK);
    profileDraftTopA = numberToDraft(sampler.topA);
    profileDraftMinP = numberToDraft(sampler.minP);
    profileDraftFrequencyPenalty = numberToDraft(sampler.frequencyPenalty);
    profileDraftPresencePenalty = numberToDraft(sampler.presencePenalty);
    profileDraftRepetitionPenalty = numberToDraft(sampler.repetitionPenalty);
    profileDraftMaxTokens = numberToDraft(sampler.maxTokens);
    profileDraftContextTokens = numberToDraft(sampler.contextTokens);
    profileDraftSeed = numberToDraft(sampler.seed);
    profileDraftN = numberToDraft(sampler.n);
    profileDraftStop = (sampler.stop ?? []).join('\n');
    profileDraftStream = profile.request?.stream !== false;
    profileDraftMode = profile.prompt?.mode ?? 'chat';
    profileDraftMacroMode = profile.prompt?.macroMode ?? 'none';
    profileDraftSquashSystemMessages = profile.prompt?.squashSystemMessages ?? false;
    profileDraftRegexEnabled = profile.regex?.enabled !== false;
    profileDraftRegexScripts = structuredClone(profile.regex?.scripts ?? []);
    profileDraftSlots = clonePromptSlots(profile.prompt?.slots);
    activePromptSlotId = profileDraftSlots[0]?.id ?? '';
    promptSlotQuery = '';
    promptEditorSlotId = '';
    promptEditorInitialSlot = null;
  }

  function promptSlotStats(slots: PromptSlot[]) {
    const total = slots.length;
    const enabled = slots.filter((slot) => slot.enabled !== false).length;
    const ordered = slots.filter((slot) => slot.legacy?.ordered !== false).length;
    const injected = slots.filter((slot) => slot.injection?.position === 'absolute').length;
    return { total, enabled, ordered, injected };
  }

  function filterPromptSlots(slots: PromptSlot[], query: string) {
    const text = query.trim().toLowerCase();
    if (!text) return slots;
    return slots.filter((slot) => [slot.label, slot.id, slot.source, slot.role, slot.content].join(' ').toLowerCase().includes(text));
  }

  function profileDraftSampler(): Profile['sampler'] {
    const sampler: NonNullable<Profile['sampler']> = {};
    const numbers: Array<[keyof NonNullable<Profile['sampler']>, number | undefined]> = [
      ['temperature', optionalNumber(profileDraftTemperature)],
      ['topP', optionalNumber(profileDraftTopP)],
      ['topK', optionalNumber(profileDraftTopK)],
      ['topA', optionalNumber(profileDraftTopA)],
      ['minP', optionalNumber(profileDraftMinP)],
      ['frequencyPenalty', optionalNumber(profileDraftFrequencyPenalty)],
      ['presencePenalty', optionalNumber(profileDraftPresencePenalty)],
      ['repetitionPenalty', optionalNumber(profileDraftRepetitionPenalty)],
      ['maxTokens', optionalNumber(profileDraftMaxTokens)],
      ['contextTokens', optionalNumber(profileDraftContextTokens)],
      ['seed', optionalInteger(profileDraftSeed)],
      ['n', optionalInteger(profileDraftN)]
    ];

    for (const [key, value] of numbers) {
      if (value !== undefined) sampler[key] = value as never;
    }

    const stop = profileDraftStop
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    if (stop.length) sampler.stop = stop;
    return sampler;
  }

  function profileDraftProvider(base: Profile): Profile['provider'] {
    const model = profileDraftProviderModel.trim() || base.provider.model;
    const endpoint = profileDraftProviderEndpoint.trim();
    const apiKey = profileDraftApiKey.trim();

    if (profileDraftProviderType === 'gemini') {
      const vertexLocation = profileDraftVertexLocation.trim() || 'us-central1';
      const vertex =
        profileDraftVertexEnabled
          ? {
              mode: profileDraftVertexMode,
              location: vertexLocation,
              ...(profileDraftVertexProjectId.trim() ? { projectId: profileDraftVertexProjectId.trim() } : {}),
              ...(profileDraftVertexMode === 'express' && profileDraftVertexApiKey.trim() ? { apiKey: profileDraftVertexApiKey.trim() } : {}),
              ...(profileDraftVertexMode === 'oauth' && profileDraftVertexAccessToken.trim() ? { accessToken: profileDraftVertexAccessToken.trim() } : {})
            }
          : undefined;
      return {
        type: 'gemini',
        model: model || 'gemini-2.5-pro',
        ...(endpoint ? { endpoint } : {}),
        ...(apiKey ? { apiKey } : {}),
        ...(vertex ? { vertex } : {})
      };
    }

    return {
      type: 'openai-compatible',
      model: model || 'gpt-4o-mini',
      endpoint: endpoint || 'https://api.openai.com/v1',
      ...(apiKey ? { apiKey } : {}),
      compatibility: profileDraftOpenAICompatibility
    };
  }

  function changeProfileProviderType(value: ProviderType) {
    if (value === profileDraftProviderType) return;
    profileDraftProviderType = value;
    if (value === 'gemini') {
      profileDraftProviderEndpoint = '';
      profileDraftProviderModel ||= 'gemini-2.5-pro';
      profileDraftVertexLocation ||= 'us-central1';
      return;
    }

    profileDraftProviderEndpoint = 'https://api.openai.com/v1';
    profileDraftProviderModel ||= 'gpt-4o-mini';
    profileDraftVertexEnabled = false;
    profileDraftVertexMode = 'express';
    profileDraftVertexProjectId = '';
    profileDraftVertexLocation = '';
    profileDraftVertexApiKey = '';
    profileDraftVertexAccessToken = '';
  }

  function normalizedPromptSlot(slot: PromptSlot): PromptSlot {
    const injection = slot.injection
      ? {
          position: slot.injection.position ?? 'relative',
          depth: Math.max(0, Math.trunc(slot.injection.depth ?? 4)),
          order: slot.injection.order ?? 100,
          triggers: slot.injection.triggers ?? []
        }
      : undefined;

    return {
      ...slot,
      id: slot.id || crypto.randomUUID(),
      source: slot.source ?? 'custom',
      role: slot.role ?? 'system',
      enabled: slot.enabled !== false,
      label: slot.label?.trim() || slot.id || 'Prompt',
      content: slot.content ?? '',
      ...(injection ? { injection } : {})
    };
  }

  function buildProfileFromDraft(base: Profile): Profile {
    return {
      ...base,
      name: profileDraftName.trim(),
      provider: profileDraftProvider(base),
      sampler: profileDraftSampler(),
      request: {
        ...(base.request ?? {}),
        stream: profileDraftStream
      },
      prompt: {
        ...(base.prompt ?? {}),
        mode: profileDraftMode,
        macroMode: profileDraftMacroMode,
        squashSystemMessages: profileDraftSquashSystemMessages,
        slots: profileDraftSlots.map(normalizedPromptSlot)
      },
      regex: {
        enabled: profileDraftRegexEnabled,
        scripts: structuredClone(profileDraftRegexScripts)
      }
    };
  }

  async function saveProfilePayload(profile: Profile) {
    return fetchJson<Profile>('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
  }

  async function saveActiveProfile() {
    if (!activeProfile) return false;
    if (!profileDraftName.trim()) {
      status = 'Profile name required';
      return false;
    }

    status = 'Saving';
    try {
      const saved = await saveProfilePayload(buildProfileFromDraft(activeProfile));
      profiles = profiles.map((profile) => (profile.id === saved.id ? saved : profile));
      activeProfileId = saved.id;
      loadProfileDraft(saved);
      status = 'Ready';
      return true;
    } catch (error) {
      console.error(error);
      status = 'Profile save failed';
      return false;
    }
  }

  async function duplicateActiveProfile() {
    if (!activeProfile) return;
    if (!profileDraftName.trim()) {
      status = 'Profile name required';
      return;
    }

    const now = Date.now();
    const copy = buildProfileFromDraft(activeProfile);
    const duplicate: Profile = {
      ...copy,
      id: crypto.randomUUID(),
      name: `${copy.name} Copy`,
      createdAt: now,
      updatedAt: now,
      metadata: structuredClone(copy.metadata ?? {}),
      legacy: copy.legacy ? structuredClone(copy.legacy) : undefined
    };

    status = 'Saving';
    try {
      const saved = await saveProfilePayload(duplicate);
      profiles = [...profiles, saved].sort((a, b) => a.name.localeCompare(b.name));
      activeProfileId = saved.id;
      loadProfileDraft(saved);
      status = 'Ready';
    } catch (error) {
      console.error(error);
      status = 'Profile copy failed';
    }
  }

  function slotMeta(slot: PromptSlot) {
    const parts: string[] = [slot.source, slot.role];
    if (slot.legacy?.source === 'sillytavern') parts.push('ST');
    if (slot.legacy?.marker) parts.push('marker');
    if (slot.injection?.position === 'absolute') parts.push(`@${slot.injection.depth ?? 4}`);
    if (slot.enabled === false) parts.push('off');
    return parts.join(' · ');
  }

  function slotKind(slot: PromptSlot) {
    if (slot.injection?.position === 'absolute') return 'In-chat';
    if (slot.legacy?.marker) return 'Marker';
    if (slot.legacy?.systemPrompt && slot.legacy?.forbidOverrides) return 'Important';
    if (slot.legacy?.systemPrompt) return 'System';
    if (slot.source === 'custom') return 'Custom';
    return 'Runtime';
  }

  function slotTokenEstimate(slot: PromptSlot) {
    const contentLength = (slot.content ?? '').length;
    if (!contentLength) return '-';
    return `~${Math.max(1, Math.ceil(contentLength / 4))}`;
  }

  function isFirstPromptSlot(slot: PromptSlot) {
    return profileDraftSlots.findIndex((item) => item.id === slot.id) <= 0;
  }

  function isLastPromptSlot(slot: PromptSlot) {
    const index = profileDraftSlots.findIndex((item) => item.id === slot.id);
    return index < 0 || index >= profileDraftSlots.length - 1;
  }

  function canRemovePromptSlot(slot: PromptSlot) {
    return slot.source === 'custom' && profileDraftSlots.length > 1;
  }

  function addDraftPromptSlot() {
    const slot: PromptSlot = {
      id: `custom-${crypto.randomUUID()}`,
      source: 'custom',
      role: 'system',
      enabled: true,
      label: 'Custom Prompt',
      content: '',
      injection: { position: 'relative', depth: 4, order: 100, triggers: [] }
    };
    profileDraftSlots = [...profileDraftSlots, slot];
    activePromptSlotId = slot.id;
    promptSlotQuery = '';
  }

  function duplicateDraftPromptSlot(slot: PromptSlot | undefined = activePromptSlot) {
    if (!slot) return;
    const copy: PromptSlot = {
      ...structuredClone(slot),
      id: `custom-${crypto.randomUUID()}`,
      source: 'custom',
      label: `${slot.label || slot.id} Copy`,
      legacy: undefined
    };
    const index = profileDraftSlots.findIndex((item) => item.id === slot.id);
    profileDraftSlots = [...profileDraftSlots.slice(0, index + 1), copy, ...profileDraftSlots.slice(index + 1)];
    activePromptSlotId = copy.id;
  }

  function removeDraftPromptSlot(slot: PromptSlot | undefined = activePromptSlot) {
    if (!slot || !canRemovePromptSlot(slot)) return;
    profileDraftSlots = profileDraftSlots.filter((item) => item.id !== slot.id);
    activePromptSlotId = profileDraftSlots[0]?.id ?? '';
    if (promptEditorSlotId === slot.id) {
      promptEditorSlotId = '';
      promptEditorInitialSlot = null;
    }
  }

  function moveDraftPromptSlot(slot: PromptSlot | undefined, direction: -1 | 1) {
    if (!slot) return;
    const index = profileDraftSlots.findIndex((item) => item.id === slot.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= profileDraftSlots.length) return;
    const next = [...profileDraftSlots];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    profileDraftSlots = next;
    activePromptSlotId = slot.id;
  }

  function updateDraftSlot(id: string, patch: Partial<PromptSlot>) {
    profileDraftSlots = profileDraftSlots.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot));
  }

  function replaceDraftSlot(slot: PromptSlot) {
    profileDraftSlots = profileDraftSlots.map((item) => (item.id === slot.id ? structuredClone(slot) : item));
  }

  function updateDraftSlotLegacy(id: string, patch: Partial<NonNullable<PromptSlot['legacy']>>) {
    profileDraftSlots = profileDraftSlots.map((slot) => {
      if (slot.id !== id || !slot.legacy) return slot;
      return { ...slot, legacy: { ...slot.legacy, ...patch } };
    });
  }

  function updateDraftSlotInjection(id: string, patch: NonNullable<PromptSlot['injection']> | undefined) {
    profileDraftSlots = profileDraftSlots.map((slot) => {
      if (slot.id !== id) return slot;
      if (!patch) return { ...slot, injection: undefined };
      return {
        ...slot,
        injection: {
          position: patch.position ?? slot.injection?.position ?? 'relative',
          depth: patch.depth ?? slot.injection?.depth ?? 4,
          order: patch.order ?? slot.injection?.order ?? 100,
          triggers: patch.triggers ?? slot.injection?.triggers ?? []
        }
      };
    });
  }

  function setPromptInjectionPosition(slot: PromptSlot, position: 'none' | 'relative' | 'absolute') {
    if (position === 'none') {
      updateDraftSlotInjection(slot.id, undefined);
      return;
    }
    updateDraftSlotInjection(slot.id, {
      position,
      depth: slot.injection?.depth ?? 4,
      order: slot.injection?.order ?? 100,
      triggers: slot.injection?.triggers ?? []
    });
  }

  function togglePromptTrigger(slot: PromptSlot, trigger: string) {
    const triggers = new Set(slot.injection?.triggers ?? []);
    if (triggers.has(trigger)) triggers.delete(trigger);
    else triggers.add(trigger);
    updateDraftSlotInjection(slot.id, {
      position: slot.injection?.position ?? 'relative',
      depth: slot.injection?.depth ?? 4,
      order: slot.injection?.order ?? 100,
      triggers: [...triggers]
    });
  }

  function openPromptEditor(slot: PromptSlot | undefined = activePromptSlot) {
    if (!slot) return;
    activePromptSlotId = slot.id;
    promptEditorSlotId = slot.id;
    promptEditorInitialSlot = structuredClone(slot);
  }

  function closePromptEditor() {
    promptEditorSlotId = '';
    promptEditorInitialSlot = null;
  }

  function resetPromptEditor() {
    if (!promptEditorInitialSlot) return;
    replaceDraftSlot(promptEditorInitialSlot);
    activePromptSlotId = promptEditorInitialSlot.id;
  }

  async function savePromptEditor() {
    const saved = await saveActiveProfile();
    if (saved) closePromptEditor();
  }

  function exportActiveProfile() {
    if (!activeProfile) return;
    const blob = new Blob([JSON.stringify(activeProfile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeProfile.name.replace(/[\\/:*?"<>|]+/g, '_')}.nanke-profile.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function ensureConversation(): Promise<string> {
    if (activeConversationId) return activeConversationId;
    const conversation = await fetchJson<Conversation>('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.slice(0, 40) || 'New Chat',
        characterId: activeCharacterId || undefined,
        personaId: activePersonaId || undefined,
        profileId: activeProfileId || undefined
      })
    });
    activeConversationId = conversation.id;
    conversations = [conversation, ...conversations];
    if (activeCharacter?.firstMessage && messages.length === 0) {
      messages = [{ role: 'assistant', name: activeCharacter.name, content: renderCharacterTemplate(activeCharacter.firstMessage) }];
    }
    return activeConversationId;
  }

  async function loadConversation(id: string) {
    activeConversationId = id;
    openingPreviewCharacterId = '';
    activeView = 'chat';
    const conversation = await fetchJson<Conversation>(`/api/conversations?id=${encodeURIComponent(id)}`);
    messages = conversation.messages ?? [];
    activeCharacterId = conversation.characterId ?? activeCharacterId;
    activePersonaId = conversation.personaId ?? activePersonaId;
    activeProfileId = conversation.profileId ?? activeProfileId;
    closeDrawer();
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content) return;
    input = '';
    inspector = '';
    const conversationId = await ensureConversation();
    messages = [
      ...messages,
      { role: 'user', name: activePersona?.name, content },
      { role: 'assistant', name: activeCharacter?.name, content: '' }
    ];
    status = 'Generating';

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        profileId: activeProfileId || undefined,
        characterId: activeCharacterId || undefined,
        personaId: activePersonaId || undefined,
        message: content
      })
    });

    if (!response.body || !response.ok) {
      status = 'Error';
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const next = [...messages];
      next[next.length - 1] = { ...next[next.length - 1], role: 'assistant', content: `${next[next.length - 1].content}${chunk}` };
      messages = next;
    }
    status = 'Ready';
  }

  async function inspectCurrentPrompt() {
    const content = input.trim() || 'Inspect prompt';
    const conversationId = await ensureConversation();
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        profileId: activeProfileId || undefined,
        characterId: activeCharacterId || undefined,
        personaId: activePersonaId || undefined,
        message: content,
        dryRun: true
      })
    });
    inspector = await response.text();
  }

  async function openInspector() {
    await inspectCurrentPrompt();
    activeDrawer = 'inspector';
  }

  function renderCharacterTemplate(template: string): string {
    const charName = activeCharacter?.name ?? 'Assistant';
    const userName = activePersona?.name ?? 'User';
    return template.replaceAll('{{char}}', charName).replaceAll('{{charIfNotGroup}}', charName).replaceAll('{{user}}', userName);
  }

  function messageSpeaker(message: ChatMessage): string {
    if (message.name?.trim()) return message.name;
    if (message.role === 'assistant') return activeCharacter?.name ?? 'Assistant';
    if (message.role === 'user') return activePersona?.name ?? 'User';
    return 'System';
  }

  function messageAvatarUrl(message: ChatMessage): string {
    if (message.role === 'assistant' && activeCharacter?.avatarAssetId) return `/api/assets/${activeCharacter.avatarAssetId}`;
    if (message.role === 'user' && activePersona?.avatarAssetId) return `/api/assets/${activePersona.avatarAssetId}`;
    return '';
  }

  function messageInitials(message: ChatMessage): string {
    const speaker = messageSpeaker(message).trim();
    return Array.from(speaker)[0]?.toUpperCase() ?? '?';
  }

  function messageRegexPlacement(message: ChatMessage) {
    if (message.role === 'assistant') return REGEX_PLACEMENT.AI_OUTPUT;
    if (message.role === 'user') return REGEX_PLACEMENT.USER_INPUT;
    return undefined;
  }

  function messageRegexMacros() {
    const charName = activeCharacter?.name ?? 'Assistant';
    return {
      char: charName,
      charIfNotGroup: charName,
      user: activePersona?.name ?? 'User'
    };
  }

  function activeDisplayRegexScripts() {
    if (activeProfile?.regex?.enabled === false) return [];
    return activeProfile?.regex?.scripts ?? [];
  }

  function messageUsesDisplayRegex(message: ChatMessage, index: number) {
    const placement = messageRegexPlacement(message);
    if (placement === undefined) return false;
    const options = {
      placement,
      isMarkdown: true,
      depth: messages.length - index,
      macros: messageRegexMacros()
    };
    return (
      hasRegexScriptForPlacement(activeDisplayRegexScripts(), options) ||
      hasRegexScriptForPlacement(activeDisplayRegexScripts(), {
        ...options,
        placement: REGEX_PLACEMENT.MD_DISPLAY
      })
    );
  }

  function messageDisplayContent(message: ChatMessage, index: number) {
    const placement = messageRegexPlacement(message);
    if (placement === undefined) return message.content;
    const options = {
      placement,
      isMarkdown: true,
      depth: messages.length - index,
      macros: messageRegexMacros()
    };
    const roleDisplay = applyRegexScripts(message.content, activeDisplayRegexScripts(), options);
    return applyRegexScripts(roleDisplay, activeDisplayRegexScripts(), {
      ...options,
      placement: REGEX_PLACEMENT.MD_DISPLAY
    });
  }

  function openZoomedAvatar(message: ChatMessage) {
    const src = messageAvatarUrl(message);
    const name = messageSpeaker(message);
    const key = `${message.role}:${name}:${src}`;

    if (zoomedAvatar?.key === key) {
      zoomedAvatar = null;
      return;
    }

    zoomedAvatar = {
      key,
      name,
      role: message.role,
      src,
      initials: messageInitials(message)
    };
  }

  async function readImportFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      importFileName = '';
      importFileBase64 = '';
      return;
    }

    importFileName = file.name;
    importName ||= file.name.replace(/\.[^.]+$/, '');
    const result = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const value = String(reader.result ?? '');
        resolve(value);
      });
      reader.addEventListener('error', () => reject(reader.error ?? new Error('Could not read file.')));
      if (importKind === 'character-card-png') reader.readAsDataURL(file);
      else reader.readAsText(file);
    });
    if (importKind === 'character-card-png') {
      importFileBase64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      importText = '';
    } else {
      importText = result;
      importFileBase64 = '';
    }
  }

  async function runImport() {
    status = 'Importing';
    const data =
      importKind === 'chat-jsonl'
        ? importText
        : importKind === 'character-card-png'
          ? importFileBase64 || importText.trim()
          : JSON.parse(importText);
    const result = await fetchJson<{ type: string; item?: { id: string } }>('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: importKind, name: importName || undefined, data })
    });
    importText = '';
    importFileName = '';
    importFileBase64 = '';
    importName = '';
    await refreshAll();
    if (result.type === 'character' && result.item?.id) {
      activeCharacterId = result.item.id;
    } else if (result.type === 'profile' && result.item?.id) {
      activeProfileId = result.item.id;
    }
  }

  async function createCharacter() {
    const name = newCharacterName.trim();
    if (!name) return;
    status = 'Saving';
    const character = await fetchJson<Character>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: newCharacterDescription.trim() })
    });
    characters = [...characters, character];
    activeCharacterId = character.id;
    newCharacterName = '';
    newCharacterDescription = '';
    status = 'Ready';
  }

  async function createPersona() {
    const name = newPersonaName.trim();
    if (!name) return;
    status = 'Saving';
    const persona = await fetchJson<UserPersona>('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: newPersonaDescription.trim(), isDefault: newPersonaDefault })
    });
    personas = newPersonaDefault
      ? [persona, ...personas.filter((item) => item.id !== persona.id).map((item) => ({ ...item, isDefault: false }))]
      : [...personas, persona];
    activePersonaId = persona.id;
    newPersonaName = '';
    newPersonaDescription = '';
    newPersonaDefault = false;
    status = 'Ready';
  }

  async function saveActivePersona() {
    if (!activePersona) return;
    const name = personaDraftName.trim();
    if (!name) return;
    status = 'Saving';
    const persona = await fetchJson<UserPersona>('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...activePersona,
        name,
        description: personaDraftDescription.trim(),
        isDefault: personaDraftDefault
      })
    });
    personas = personas.map((item) => {
      if (item.id === persona.id) return persona;
      return persona.isDefault ? { ...item, isDefault: false } : item;
    });
    personaDraftId = persona.id;
    personaDraftName = persona.name;
    personaDraftDescription = persona.description;
    personaDraftDefault = persona.isDefault;
    status = 'Ready';
  }

  async function createWorldBook() {
    const name = newWorldBookName.trim();
    if (!name) return;
    status = 'Saving';
    const worldBook = await fetchJson<WorldBook>('/api/worldbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, entries: [] })
    });
    worldBooks = [...worldBooks, worldBook];
    newWorldBookName = '';
    status = 'Ready';
  }
</script>

<svelte:head>
  <title>NanKe</title>
</svelte:head>

<main class="workspace">
  <aside class="rail" aria-label="Navigation">
    <div class="brand">NK</div>
    <button
      class="icon-button"
      class:active={activeView === 'chat' && activeDrawer !== 'chats'}
      title="Chat"
      aria-label="Chat"
      aria-pressed={activeView === 'chat' && activeDrawer !== 'chats'}
      on:click={() => {
        activeView = 'chat';
        closeDrawer();
      }}
    >
      <MessageSquare size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'characters'}
      title="Characters"
      aria-label="Characters"
      aria-pressed={activeDrawer === 'characters'}
      on:click={() => openLibrary('characters')}
    >
      <Bot size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'personas'}
      title="Personas"
      aria-label="Personas"
      aria-pressed={activeDrawer === 'personas'}
      on:click={() => openLibrary('personas')}
    >
      <UserRound size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'worldbooks'}
      title="World Books"
      aria-label="World Books"
      aria-pressed={activeDrawer === 'worldbooks'}
      on:click={() => openLibrary('worldbooks')}
    >
      <BookOpen size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'profiles'}
      title="Profiles"
      aria-label="Profiles"
      aria-pressed={activeDrawer === 'profiles'}
      on:click={() => openLibrary('profiles')}
    >
      <Settings2 size={20} />
    </button>
    <div class="rail-spacer"></div>
    <button
      class="icon-button"
      class:active={activeDrawer === 'import'}
      title="Import"
      aria-label="Import"
      aria-pressed={activeDrawer === 'import'}
      on:click={() => openDrawer('import')}
    >
      <Upload size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'inspector'}
      title="Prompt Inspector"
      aria-label="Prompt Inspector"
      aria-pressed={activeDrawer === 'inspector'}
      on:click={openInspector}
    >
      <Search size={20} />
    </button>
  </aside>

  <section class="stage" aria-label="Chat workspace">
    <header class="chatbar">
      <div class="scene">
        <button class="conversation-button" type="button" on:click={() => openDrawer('chats')}>
          <MessageSquare size={16} />
          <span>{activeConversation?.title ?? 'New Chat'}</span>
        </button>
      </div>

      <div class="context-strip" aria-label="Current context">
        <button class="context-chip" type="button" on:click={() => openLibrary('characters')}>
          <Bot size={15} />
          <span>{activeCharacter?.name ?? 'No character'}</span>
        </button>
        <button class="context-chip" type="button" on:click={() => openLibrary('personas')}>
          <UserRound size={15} />
          <span>{activePersona?.name ?? 'User'}</span>
        </button>
        <button class="context-chip profile" type="button" on:click={() => openLibrary('profiles')}>
          <Settings2 size={15} />
          <span>{activeProfile ? `${activeProfile.name} · ${activeProfile.provider.model}` : 'No profile'}</span>
        </button>
        <span class="status-pill">{status}</span>
      </div>

      <div class="toolbar" aria-label="Chat actions">
        <button class="tool-button" type="button" on:click={startNewConversation} title="New chat" aria-label="New chat">
          <SquarePen size={17} />
        </button>
        <button class="tool-button" type="button" on:click={openInspector} title="Prompt Inspector" aria-label="Prompt Inspector">
          <Search size={17} />
        </button>
        <button class="tool-button" type="button" on:click={refreshAll} title="Refresh" aria-label="Refresh">
          <RefreshCw size={17} />
        </button>
      </div>
    </header>

    <div class="messages" aria-live="polite">
      <div class="message-stack">
        {#if messages.length === 0}
          <div class="empty-state">
            <MessageSquare size={28} />
            <h1>{activeCharacter?.name ?? 'NanKe'}</h1>
            <p>
              {activePersona?.name ?? 'User'} · {activeProfile ? `${activeProfile.provider.type} · ${activeProfile.provider.model}` : 'No profile selected'}
            </p>
          </div>
        {/if}
        {#each messages as message, index}
          <article class="message-row {message.role}">
            <button class="message-avatar" type="button" aria-label={`Open avatar for ${messageSpeaker(message)}`} on:click={() => openZoomedAvatar(message)}>
              {#if messageAvatarUrl(message)}
                <img src={messageAvatarUrl(message)} alt="" />
              {:else}
                <span>{messageInitials(message)}</span>
              {/if}
            </button>
            <div class="message {message.role}">
              <strong>{messageSpeaker(message)}</strong>
              {#if messageUsesDisplayRegex(message, index)}
                <div class="message-content rich">{@html messageDisplayContent(message, index)}</div>
              {:else}
                <p class="message-content">{message.content}</p>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    </div>

    <form class="composer" on:submit|preventDefault={sendMessage}>
      <textarea bind:value={input} rows="3" placeholder="Message"></textarea>
      <button class="primary" type="submit"><Send size={18} /><span>Send</span></button>
    </form>
  </section>

  {#if zoomedAvatar}
    <section class="avatar-viewer" aria-label="Avatar preview" title={zoomedAvatar.name}>
      <div class="avatar-viewer-controls">
        <span aria-hidden="true"><GripHorizontal size={18} /></span>
        <button type="button" title="Close avatar preview" aria-label="Close avatar preview" on:click={() => (zoomedAvatar = null)}>
          <X size={18} />
        </button>
      </div>
      <div class="avatar-viewer-image" class:user={zoomedAvatar.role === 'user'}>
        {#if zoomedAvatar.src}
          <img src={zoomedAvatar.src} alt={`${zoomedAvatar.name} avatar`} />
        {:else}
          <span>{zoomedAvatar.initials}</span>
        {/if}
      </div>
    </section>
  {/if}

  {#if activeDrawer}
    <button class="scrim" type="button" aria-label="Close drawer" on:click={closeDrawer}></button>
    <aside class="drawer" class:right={drawerIsRight} class:profiles={activeDrawer === 'profiles'} aria-label={drawerTitle}>
      <header class="drawer-header">
        <h2>{drawerTitle}</h2>
        <button class="tool-button" type="button" title="Close" aria-label="Close" on:click={closeDrawer}>
          <X size={18} />
        </button>
      </header>

      {#if activeDrawer === 'chats'}
        <div class="drawer-actions">
          <button class="secondary full" type="button" on:click={startNewConversation}>
            <MessageSquare size={16} />New Chat
          </button>
        </div>
        <div class="item-list">
          {#each conversations as conversation}
            <button
              class="drawer-item"
              class:active={conversation.id === activeConversationId}
              type="button"
              on:click={() => loadConversation(conversation.id)}
            >
              <strong>{conversation.title}</strong>
              <span>{conversation.id}</span>
            </button>
          {/each}
        </div>
      {:else if activeDrawer === 'characters'}
        <form class="editor" on:submit|preventDefault={createCharacter}>
          <input bind:value={newCharacterName} placeholder="Name" />
          <textarea bind:value={newCharacterDescription} rows="5" placeholder="Description"></textarea>
          <button class="primary full" type="submit"><Bot size={16} />Create</button>
        </form>

        {#if activeCharacter}
          <section class="bound-worldbooks">
            <div>
              <strong>{activeCharacter.name}</strong>
              <span>{activeCharacterWorldBooks.length} bound world book{activeCharacterWorldBooks.length === 1 ? '' : 's'}</span>
            </div>
            {#if activeCharacterWorldBooks.length}
              <div class="bound-worldbook-list">
                {#each activeCharacterWorldBooks as worldBook}
                  <article>
                    <strong>{worldBook.name}</strong>
                    <span>{worldBook.entries.length} entries</span>
                  </article>
                {/each}
              </div>
            {:else}
              <span class="drawer-empty compact">No character-bound world book</span>
            {/if}
          </section>
        {/if}

        <div class="item-list">
          {#each characters as character}
            <button
              class="drawer-item"
              class:active={character.id === activeCharacterId}
              type="button"
              on:click={() => (activeCharacterId = character.id)}
            >
              <strong>{character.name}</strong>
              <span>{((character.worldBookIds?.length ?? 0) || (character.characterBook ? 1 : 0)) ? 'has character book' : character.id}</span>
            </button>
          {/each}
        </div>
      {:else if activeDrawer === 'personas'}
        <form class="editor" on:submit|preventDefault={createPersona}>
          <input bind:value={newPersonaName} placeholder="Name" />
          <textarea bind:value={newPersonaDescription} rows="5" placeholder="Description"></textarea>
          <label class="checkbox-row">
            <input type="checkbox" bind:checked={newPersonaDefault} />
            <span>Default</span>
          </label>
          <button class="primary full" type="submit"><UserRound size={16} />Create</button>
        </form>

        {#if activePersona}
          <form class="editor compact-editor" on:submit|preventDefault={saveActivePersona}>
            <input bind:value={personaDraftName} placeholder="Name" />
            <textarea bind:value={personaDraftDescription} rows="6" placeholder="Description"></textarea>
            <label class="checkbox-row">
              <input type="checkbox" bind:checked={personaDraftDefault} />
              <span>Default</span>
            </label>
            <button class="secondary full" type="submit"><UserRound size={16} />Save</button>
          </form>
        {/if}

        <div class="item-list">
          {#each personas as persona}
            <button
              class="drawer-item"
              class:active={persona.id === activePersonaId}
              type="button"
              on:click={() => (activePersonaId = persona.id)}
            >
              <strong>{persona.name}</strong>
              <span>{persona.isDefault ? 'Default' : persona.id}</span>
            </button>
          {/each}
        </div>
      {:else if activeDrawer === 'worldbooks'}
        <form class="editor" on:submit|preventDefault={createWorldBook}>
          <input bind:value={newWorldBookName} placeholder="Name" />
          <button class="primary full" type="submit"><BookOpen size={16} />Create</button>
        </form>

        <div class="item-list">
          {#each worldBooks as worldBook}
            <article class="drawer-card">
              <strong>{worldBook.name}</strong>
              <span>{worldBookLine(worldBook)}</span>
            </article>
          {/each}
        </div>
      {:else if activeDrawer === 'profiles'}
        <div class="profile-workspace">
          <div class="profile-panel">
            <div class="preset-toolbar" aria-label="Preset tools">
              <select aria-label="Selected profile" bind:value={activeProfileId}>
                {#each profiles as profile}
                  <option value={profile.id}>{profile.name}</option>
                {/each}
              </select>
              <div class="preset-actions">
                <button class="tool-button" type="button" on:click={openPresetImport} title="Import preset" aria-label="Import preset">
                  <Upload size={16} />
                </button>
                <button class="tool-button" type="button" on:click={saveActiveProfile} title="Update current profile" aria-label="Update current profile" disabled={!activeProfile}>
                  <Save size={16} />
                </button>
                <button class="tool-button" type="button" on:click={duplicateActiveProfile} title="Save profile as" aria-label="Save profile as" disabled={!activeProfile}>
                  <Copy size={16} />
                </button>
                <button class="tool-button" type="button" on:click={exportActiveProfile} title="Export profile" aria-label="Export profile" disabled={!activeProfile}>
                  <Download size={16} />
                </button>
                <button class="tool-button" type="button" on:click={inspectCurrentPrompt} title="Prompt Inspector" aria-label="Prompt Inspector" disabled={!activeProfile}>
                  <Search size={16} />
                </button>
              </div>
            </div>

            {#if activeProfile}
              <section class="profile-summary" aria-label="Active profile summary">
                <div class="profile-summary-heading">
                  <div>
                    <strong>{activeProfile.name}</strong>
                    <span>{profileOrigin(activeProfile)}</span>
                  </div>
                  <span class="provider-pill">{activeProfile.provider.type}</span>
                </div>
                <div class="profile-model">{activeProfile.provider.model}</div>
                <div class="profile-chips" aria-label="Prompt statistics">
                  <span>{activeProfileStats.enabled} enabled</span>
                  <span>{activeProfileStats.ordered} ordered</span>
                  <span>{activeProfileStats.total} total</span>
                  {#if activeProfile.prompt?.macroMode === 'sillytavern'}
                    <span>ST macros</span>
                  {/if}
                  {#if activeProfile.prompt?.squashSystemMessages}
                    <span>squash system</span>
                  {/if}
                  <span>{activeProfile.request?.stream === false ? 'non-stream' : 'stream'}</span>
                  {#if activeProfile.regex?.scripts?.length}
                    <span>{activeProfile.regex.scripts.length} regex</span>
                  {/if}
                </div>
                <div class="profile-sampler">{profileSamplerLine(activeProfile)}</div>
              </section>
            {/if}

            <input class="profile-search" bind:value={profileQuery} placeholder="Search profiles" aria-label="Search profiles" />
          </div>

          {#if activeProfile}
            <form class="profile-editor" on:submit|preventDefault={saveActiveProfile}>
              <div class="profile-editor-header">
                <div>
                  <strong>Preset Editor</strong>
                  <span>{draftPromptStats.enabled}/{draftPromptStats.total} prompts · {draftPromptStats.injected} injections</span>
                </div>
                <div class="preset-actions">
                  <button class="tool-button" type="submit" title="Save changes" aria-label="Save changes">
                    <Save size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={duplicateActiveProfile} title="Save as copy" aria-label="Save as copy">
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <section class="provider-editor" aria-label="Provider settings">
                <label class="profile-name-field">
                  <span>Name</span>
                  <input bind:value={profileDraftName} placeholder="Preset name" />
                </label>

                <div class="provider-segment" aria-label="Provider type">
                  <button class:active={profileDraftProviderType === 'openai-compatible'} type="button" on:click={() => changeProfileProviderType('openai-compatible')}>
                    <strong>OpenAI-compatible</strong>
                    <span>Custom endpoint</span>
                  </button>
                  <button class:active={profileDraftProviderType === 'gemini'} type="button" on:click={() => changeProfileProviderType('gemini')}>
                    <strong>Gemini</strong>
                    <span>AI Studio / Vertex</span>
                  </button>
                </div>

                <div class="provider-config">
                  <label>
                    <span>Model</span>
                    <input bind:value={profileDraftProviderModel} placeholder={profileDraftProviderType === 'gemini' ? 'gemini-2.5-pro' : 'gpt-4o-mini'} />
                  </label>
                  <label>
                    <span>Endpoint</span>
                    <input
                      bind:value={profileDraftProviderEndpoint}
                      placeholder={profileDraftProviderType === 'gemini' ? 'Optional full streamGenerateContent URL' : 'https://api.openai.com/v1'}
                    />
                  </label>
                </div>

                {#if profileDraftProviderType === 'gemini'}
                  <div class="vertex-strip">
                    <button class:active={profileDraftVertexEnabled} type="button" on:click={() => (profileDraftVertexEnabled = !profileDraftVertexEnabled)}>
                      Vertex
                    </button>
                    {#if profileDraftVertexEnabled}
                      <div class="mini-segment vertex-mode-selector" aria-label="Vertex mode">
                        <button class:active={profileDraftVertexMode === 'express'} type="button" on:click={() => (profileDraftVertexMode = 'express')}>Express</button>
                        <button class:active={profileDraftVertexMode === 'oauth'} type="button" on:click={() => (profileDraftVertexMode = 'oauth')}>OAuth</button>
                      </div>
                    {/if}
                  </div>
                  {#if profileDraftVertexEnabled}
                    <div class="provider-config">
                      <label>
                        <span>{profileDraftVertexMode === 'oauth' ? 'Project' : 'Project (optional)'}</span>
                        <input bind:value={profileDraftVertexProjectId} placeholder="project-id" />
                      </label>
                      <label>
                        <span>Location</span>
                        <input bind:value={profileDraftVertexLocation} placeholder="us-central1" />
                      </label>
                    </div>
                  {/if}
                {/if}

                {#if profileDraftProviderType === 'openai-compatible'}
                  <div class="credential-panel">
                    <div class="credential-panel-head">
                      <strong>Authentication</strong>
                      <span>Bearer API key</span>
                    </div>
                    <div class="credential-grid single">
                      <label>
                        <span>API Key</span>
                        <input bind:value={profileDraftApiKey} type="password" autocomplete="off" placeholder="sk-..." />
                      </label>
                    </div>
                    <div class="compatibility-strip" aria-label="OpenAI-compatible request mode">
                      <button class:active={profileDraftOpenAICompatibility === 'strict-openai'} type="button" on:click={() => (profileDraftOpenAICompatibility = 'strict-openai')}>
                        <strong>OpenAI strict</strong>
                        <span>official fields</span>
                      </button>
                      <button class:active={profileDraftOpenAICompatibility === 'extended'} type="button" on:click={() => (profileDraftOpenAICompatibility = 'extended')}>
                        <strong>Extended</strong>
                        <span>top_k, min_p, max_tokens</span>
                      </button>
                    </div>
                  </div>
                {:else if !profileDraftVertexEnabled}
                  <div class="credential-panel">
                    <div class="credential-panel-head">
                      <strong>Authentication</strong>
                      <span>AI Studio key is sent as x-goog-api-key</span>
                    </div>
                    <div class="credential-grid single">
                      <label>
                        <span>API Key</span>
                        <input bind:value={profileDraftApiKey} type="password" autocomplete="off" placeholder="AIza..." />
                      </label>
                    </div>
                  </div>
                {:else}
                  <div class="credential-panel">
                    <div class="credential-panel-head">
                      <strong>{profileDraftVertexMode === 'express' ? 'Vertex Express' : 'Vertex OAuth'}</strong>
                      <span>{profileDraftVertexMode === 'express' ? 'Express API key' : 'Google Cloud access token'}</span>
                    </div>
                    <div class="credential-grid single">
                      {#if profileDraftVertexMode === 'express'}
                        <label>
                          <span>API Key</span>
                          <input bind:value={profileDraftVertexApiKey} type="password" autocomplete="off" placeholder="AIza..." />
                        </label>
                      {:else}
                        <label>
                          <span>Access Token</span>
                          <input bind:value={profileDraftVertexAccessToken} type="password" autocomplete="off" placeholder="ya29..." />
                        </label>
                      {/if}
                    </div>
                  </div>
                {/if}
              </section>

              <section class="request-panel" aria-label="Request parameters">
                <div class="request-panel-header">
                  <strong>Request Parameters</strong>
                  <span>{profileDraftMaxTokens || '512'} out · {profileDraftContextTokens || '8192'} ctx · {profileDraftStream ? 'stream' : 'single'}</span>
                </div>

                <div class="request-flow-strip" aria-label="Response mode">
                  <button class:active={profileDraftStream} type="button" on:click={() => (profileDraftStream = true)}>
                    <strong>Streaming</strong>
                    <span>Incremental tokens</span>
                  </button>
                  <button class:active={!profileDraftStream} type="button" on:click={() => (profileDraftStream = false)}>
                    <strong>Single response</strong>
                    <span>One complete reply</span>
                  </button>
                </div>

                <div class="sampler-control-list">
                  <label class="sampler-control">
                    <span class="sampler-control-head">
                      <span>Temperature</span>
                      <output>{profileDraftTemperature || '1'}</output>
                    </span>
                    <span class="sampler-control-body">
                      <input class="sampler-range" type="range" min="0" max="2" step="0.01" value={profileDraftTemperature || '1'} on:input={(event) => (profileDraftTemperature = (event.currentTarget as HTMLInputElement).value)} />
                      <input class="sampler-number" value={profileDraftTemperature} inputmode="decimal" placeholder="1" on:input={(event) => (profileDraftTemperature = (event.currentTarget as HTMLInputElement).value)} />
                    </span>
                  </label>

                  <label class="sampler-control">
                    <span class="sampler-control-head">
                      <span>Top P</span>
                      <output>{profileDraftTopP || '1'}</output>
                    </span>
                    <span class="sampler-control-body">
                      <input class="sampler-range" type="range" min="0" max="1" step="0.01" value={profileDraftTopP || '1'} on:input={(event) => (profileDraftTopP = (event.currentTarget as HTMLInputElement).value)} />
                      <input class="sampler-number" value={profileDraftTopP} inputmode="decimal" placeholder="1" on:input={(event) => (profileDraftTopP = (event.currentTarget as HTMLInputElement).value)} />
                    </span>
                  </label>

                  <label class="sampler-control">
                    <span class="sampler-control-head">
                      <span>Top K</span>
                      <output>{profileDraftTopK || '0'}</output>
                    </span>
                    <span class="sampler-control-body">
                      <input class="sampler-range" type="range" min="0" max="200" step="1" value={profileDraftTopK || '0'} on:input={(event) => (profileDraftTopK = (event.currentTarget as HTMLInputElement).value)} />
                      <input class="sampler-number" value={profileDraftTopK} inputmode="numeric" placeholder="0" on:input={(event) => (profileDraftTopK = (event.currentTarget as HTMLInputElement).value)} />
                    </span>
                  </label>

                  <label class="sampler-control">
                    <span class="sampler-control-head">
                      <span>Max Tokens</span>
                      <output>{profileDraftMaxTokens || '512'}</output>
                    </span>
                    <span class="sampler-control-body">
                      <input class="sampler-range" type="range" min="16" max="4096" step="16" value={profileDraftMaxTokens || '512'} on:input={(event) => (profileDraftMaxTokens = (event.currentTarget as HTMLInputElement).value)} />
                      <input class="sampler-number" value={profileDraftMaxTokens} inputmode="numeric" placeholder="512" on:input={(event) => (profileDraftMaxTokens = (event.currentTarget as HTMLInputElement).value)} />
                    </span>
                  </label>

                  <label class="sampler-control">
                    <span class="sampler-control-head">
                      <span>Context</span>
                      <output>{profileDraftContextTokens || '8192'}</output>
                    </span>
                    <span class="sampler-control-body">
                      <input
                        class="sampler-range"
                        type="range"
                        min="1024"
                        max={maxContextTokens}
                        step="1024"
                        value={profileDraftContextTokens || '8192'}
                        on:input={(event) => (profileDraftContextTokens = (event.currentTarget as HTMLInputElement).value)}
                      />
                      <input
                        class="sampler-number"
                        value={profileDraftContextTokens}
                        inputmode="numeric"
                        min="1024"
                        max={maxContextTokens}
                        placeholder="8192"
                        on:input={(event) => (profileDraftContextTokens = (event.currentTarget as HTMLInputElement).value)}
                      />
                    </span>
                  </label>
                </div>

                <details class="advanced-sampler">
                  <summary>Advanced</summary>
                  <div class="advanced-sampler-grid">
                    <label>
                      <span>Top A</span>
                      <input bind:value={profileDraftTopA} inputmode="decimal" />
                    </label>
                    <label>
                      <span>Min P</span>
                      <input bind:value={profileDraftMinP} inputmode="decimal" />
                    </label>
                    <label>
                      <span>Freq Penalty</span>
                      <input bind:value={profileDraftFrequencyPenalty} inputmode="decimal" />
                    </label>
                    <label>
                      <span>Presence</span>
                      <input bind:value={profileDraftPresencePenalty} inputmode="decimal" />
                    </label>
                    <label>
                      <span>Rep Penalty</span>
                      <input bind:value={profileDraftRepetitionPenalty} inputmode="decimal" />
                    </label>
                    <label>
                      <span>Seed</span>
                      <input bind:value={profileDraftSeed} inputmode="numeric" />
                    </label>
                    <label>
                      <span>N</span>
                      <input bind:value={profileDraftN} inputmode="numeric" />
                    </label>
                  </div>
                </details>

                <label class="profile-textarea-label">
                  <span>Stop strings</span>
                  <textarea bind:value={profileDraftStop} rows="3" placeholder="One stop string per line"></textarea>
                </label>
              </section>

              <div class="profile-mode-strip">
                <div class="segmented-field">
                  <span>Mode</span>
                  <div class="mini-segment" aria-label="Prompt mode">
                    <button class:active={profileDraftMode === 'chat'} type="button" on:click={() => (profileDraftMode = 'chat')}>Chat</button>
                    <button class:active={profileDraftMode === 'text'} type="button" on:click={() => (profileDraftMode = 'text')}>Text</button>
                  </div>
                </div>
                <div class="segmented-field">
                  <span>Macros</span>
                  <div class="mini-segment" aria-label="Macro mode">
                    <button class:active={profileDraftMacroMode === 'none'} type="button" on:click={() => (profileDraftMacroMode = 'none')}>None</button>
                    <button class:active={profileDraftMacroMode === 'sillytavern'} type="button" on:click={() => (profileDraftMacroMode = 'sillytavern')}>ST</button>
                  </div>
                </div>
                <button class="toggle-pill" class:active={profileDraftSquashSystemMessages} type="button" on:click={() => (profileDraftSquashSystemMessages = !profileDraftSquashSystemMessages)}>
                  Squash system
                </button>
              </div>

              <section class="regex-panel" aria-label="Regex scripts">
                <div class="regex-panel-header">
                  <div>
                    <strong>Regex Scripts</strong>
                    <span>{profileDraftRegexScripts.filter((script) => !script.disabled).length}/{profileDraftRegexScripts.length} active · profile-bound</span>
                  </div>
                  <button class="toggle-pill" class:active={profileDraftRegexEnabled} type="button" on:click={() => (profileDraftRegexEnabled = !profileDraftRegexEnabled)}>
                    {profileDraftRegexEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                {#if profileDraftRegexScripts.length}
                  <div class="regex-script-list">
                    {#each profileDraftRegexScripts as script}
                      <article class="regex-script-row" class:disabled={script.disabled}>
                        <div>
                          <strong>{script.scriptName}</strong>
                          <span>{regexScriptSurface(script)}</span>
                        </div>
                        <button
                          class="mini-toggle"
                          class:active={!script.disabled}
                          type="button"
                          on:click={() => {
                            script.disabled = !script.disabled;
                            profileDraftRegexScripts = [...profileDraftRegexScripts];
                          }}
                        >
                          {script.disabled ? 'Off' : 'On'}
                        </button>
                      </article>
                    {/each}
                  </div>
                {:else}
                  <span class="drawer-empty compact">No regex scripts in this profile</span>
                {/if}
              </section>
            </form>

            <section class="prompt-manager-panel" aria-label="Prompt Manager">
              <div class="prompt-manager-header">
                <div>
                  <strong>Prompt Manager</strong>
                  <span>{draftPromptStats.enabled} enabled · {draftPromptStats.ordered} ordered · {draftPromptStats.total} total</span>
                </div>
                <div class="preset-actions">
                  <button class="tool-button" type="button" on:click={addDraftPromptSlot} title="Add prompt" aria-label="Add prompt">
                    <Plus size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={() => openPromptEditor(activePromptSlot)} title="Edit selected prompt" aria-label="Edit selected prompt" disabled={!activePromptSlot}>
                    <Pencil size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={() => duplicateDraftPromptSlot(activePromptSlot)} title="Duplicate selected prompt" aria-label="Duplicate selected prompt" disabled={!activePromptSlot}>
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div class="prompt-manager-toolbar">
                <input class="profile-search" bind:value={promptSlotQuery} placeholder="Search prompts" aria-label="Search prompts" />
                {#if activePromptSlot}
                  <div class="prompt-selection-summary">
                    <strong>{activePromptSlot.label || activePromptSlot.id}</strong>
                    <span>{slotMeta(activePromptSlot)} · {slotTokenEstimate(activePromptSlot)} tokens</span>
                  </div>
                {/if}
              </div>

              <div class="prompt-slot-list" aria-label="Prompt slots">
                <div class="prompt-slot-list-header" aria-hidden="true">
                  <span></span>
                  <span>Prompt</span>
                  <span>Type</span>
                  <span>Tokens</span>
                  <span>Actions</span>
                </div>
                {#each filteredPromptSlots as slot}
                  <article class="prompt-slot-row" class:active={slot.id === activePromptSlotId}>
                    <span class="prompt-slot-grip" title="Order">
                      <GripHorizontal size={14} />
                    </span>
                    <input
                      class="prompt-slot-toggle"
                      type="checkbox"
                      checked={slot.enabled !== false}
                      title="Toggle prompt"
                      aria-label={`Toggle ${slot.label || slot.id}`}
                      on:change={(event) => updateDraftSlot(slot.id, { enabled: (event.currentTarget as HTMLInputElement).checked })}
                    />
                    <button class="prompt-slot-main" type="button" on:click={() => (activePromptSlotId = slot.id)}>
                      <strong>{slot.label || slot.id}</strong>
                      <span>{slotMeta(slot)}</span>
                    </button>
                    <span class="prompt-kind-badge">{slotKind(slot)}</span>
                    <span class="prompt-token-count">{slotTokenEstimate(slot)}</span>
                    <span class="prompt-row-actions">
                      <button type="button" on:click={() => moveDraftPromptSlot(slot, -1)} title="Move up" aria-label={`Move ${slot.label || slot.id} up`} disabled={isFirstPromptSlot(slot)}>
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" on:click={() => moveDraftPromptSlot(slot, 1)} title="Move down" aria-label={`Move ${slot.label || slot.id} down`} disabled={isLastPromptSlot(slot)}>
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" on:click={() => openPromptEditor(slot)} title="Edit prompt" aria-label={`Edit ${slot.label || slot.id}`}>
                        <Pencil size={14} />
                      </button>
                      <button type="button" on:click={() => duplicateDraftPromptSlot(slot)} title="Duplicate prompt" aria-label={`Duplicate ${slot.label || slot.id}`}>
                        <Copy size={14} />
                      </button>
                      <button type="button" on:click={() => removeDraftPromptSlot(slot)} title="Remove prompt" aria-label={`Remove ${slot.label || slot.id}`} disabled={!canRemovePromptSlot(slot)}>
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </article>
                {:else}
                  <div class="drawer-empty">No matching prompts</div>
                {/each}
              </div>
            </section>

            {#if promptEditorSlot}
              <div class="prompt-editor-overlay" role="dialog" aria-modal="true" aria-label="Edit prompt">
                <form class="prompt-editor-window" on:submit|preventDefault={savePromptEditor}>
                  <header class="prompt-editor-titlebar">
                    <div>
                      <h3>Edit Prompt</h3>
                      <span>{promptEditorSlot.legacy?.identifier ?? promptEditorSlot.id} · {slotKind(promptEditorSlot)} · {slotTokenEstimate(promptEditorSlot)} tokens</span>
                    </div>
                    <div class="preset-actions">
                      <button class="tool-button" type="button" on:click={resetPromptEditor} title="Reset prompt" aria-label="Reset prompt">
                        <RotateCcw size={16} />
                      </button>
                      <button class="tool-button" type="submit" title="Save prompt" aria-label="Save prompt">
                        <Save size={16} />
                      </button>
                      <button class="tool-button" type="button" on:click={closePromptEditor} title="Close prompt editor" aria-label="Close prompt editor">
                        <X size={16} />
                      </button>
                    </div>
                  </header>

                  <div class="prompt-editor-fields">
                    <label>
                      <span>Name</span>
                      <input value={promptEditorSlot.label ?? ''} on:input={(event) => updateDraftSlot(promptEditorSlot.id, { label: (event.currentTarget as HTMLInputElement).value })} />
                    </label>
                    <div class="segmented-field">
                      <span>Role</span>
                      <div class="mini-segment three" aria-label="Prompt role">
                        {#each promptRoles as role}
                          <button class:active={promptEditorSlot.role === role} type="button" on:click={() => updateDraftSlot(promptEditorSlot.id, { role })}>
                            {role}
                          </button>
                        {/each}
                      </div>
                    </div>
                    <label>
                      <span>Source</span>
                      <select value={promptEditorSlot.source} on:change={(event) => updateDraftSlot(promptEditorSlot.id, { source: (event.currentTarget as HTMLSelectElement).value as PromptSlotSource })}>
                        {#each promptSources as source}
                          <option value={source}>{source}</option>
                        {/each}
                      </select>
                    </label>
                    <div class="segmented-field">
                      <span>Position</span>
                      <div class="mini-segment three" aria-label="Prompt injection position">
                        <button class:active={!promptEditorSlot.injection} type="button" on:click={() => setPromptInjectionPosition(promptEditorSlot, 'none')}>None</button>
                        <button class:active={promptEditorSlot.injection?.position === 'relative'} type="button" on:click={() => setPromptInjectionPosition(promptEditorSlot, 'relative')}>Relative</button>
                        <button class:active={promptEditorSlot.injection?.position === 'absolute'} type="button" on:click={() => setPromptInjectionPosition(promptEditorSlot, 'absolute')}>In-chat</button>
                      </div>
                    </div>
                  </div>

                  {#if promptEditorSlot.injection}
                    <div class="prompt-editor-fields compact">
                      <label>
                        <span>Depth</span>
                        <input
                          value={promptEditorSlot.injection.depth ?? 4}
                          inputmode="numeric"
                          on:input={(event) =>
                            updateDraftSlotInjection(promptEditorSlot.id, {
                              ...promptEditorSlot.injection,
                              depth: optionalInteger((event.currentTarget as HTMLInputElement).value) ?? 0
                            })}
                        />
                      </label>
                      <label>
                        <span>Order</span>
                        <input
                          value={promptEditorSlot.injection.order ?? 100}
                          inputmode="numeric"
                          on:input={(event) =>
                            updateDraftSlotInjection(promptEditorSlot.id, {
                              ...promptEditorSlot.injection,
                              order: optionalNumber((event.currentTarget as HTMLInputElement).value) ?? 100
                            })}
                        />
                      </label>
                    </div>
                  {/if}

                  <div class="prompt-trigger-panel">
                    <span>Triggers</span>
                    <div class="prompt-trigger-options" aria-label="Generation triggers">
                      {#each promptTriggerOptions as trigger}
                        <button class:active={(promptEditorSlot.injection?.triggers ?? []).includes(trigger)} type="button" on:click={() => togglePromptTrigger(promptEditorSlot, trigger)}>
                          {trigger}
                        </button>
                      {/each}
                    </div>
                  </div>

                  <div class="prompt-editor-source">
                    <span><strong>Source:</strong> {promptEditorSlot.legacy?.source === 'sillytavern' ? 'SillyTavern preset' : 'NanKe profile'}</span>
                    <label class="checkbox-row">
                      <input
                        type="checkbox"
                        checked={promptEditorSlot.legacy?.forbidOverrides ?? false}
                        disabled={!promptEditorSlot.legacy}
                        on:change={(event) => updateDraftSlotLegacy(promptEditorSlot.id, { forbidOverrides: (event.currentTarget as HTMLInputElement).checked })}
                      />
                      <span>Forbid Overrides</span>
                    </label>
                  </div>

                  <label class="profile-textarea-label prompt-content-label">
                    <span>Prompt</span>
                    <textarea
                      rows="14"
                      value={promptEditorSlot.content ?? ''}
                      placeholder="The prompt to be sent."
                      on:input={(event) => updateDraftSlot(promptEditorSlot.id, { content: (event.currentTarget as HTMLTextAreaElement).value })}
                    ></textarea>
                  </label>

                  <footer class="prompt-editor-footer">
                    <button class="secondary" type="button" on:click={closePromptEditor}><X size={16} />Close</button>
                    <button class="secondary" type="button" on:click={resetPromptEditor}><RotateCcw size={16} />Reset</button>
                    <button class="primary" type="submit"><Save size={16} />Save</button>
                  </footer>
                </form>
              </div>
            {/if}
          {/if}

          <section class="profile-list-section" aria-label="Profiles">
            <div class="profile-list">
              {#each filteredProfiles as profile}
                {@const stats = profileStats(profile)}
                <button
                  class="profile-row"
                  class:active={profile.id === activeProfileId}
                  type="button"
                  on:click={() => (activeProfileId = profile.id)}
                >
                  <span class="profile-row-main">
                    <strong>{profile.name}</strong>
                    <span>{profile.provider.type} · {profile.provider.model}</span>
                  </span>
                  <span class="profile-row-meta">
                    <span>{stats.enabled}/{stats.total}</span>
                    <span>{profileOrigin(profile)}</span>
                  </span>
                </button>
              {:else}
                <div class="drawer-empty">No matching profiles</div>
              {/each}
            </div>
          </section>
        </div>
      {:else if activeDrawer === 'import'}
        <div class="import-panel">
          <select aria-label="Import kind" bind:value={importKind}>
            <option value="preset">Preset</option>
            <option value="character-card-json">Character JSON</option>
            <option value="character-card-png">Character PNG</option>
            <option value="worldbook">World Book</option>
            <option value="chat-jsonl">Chat JSONL</option>
          </select>
          <input bind:value={importName} placeholder="Name" />
          <label class="file-picker">
            <Upload size={16} />
            <span>{importFileName || (importKind === 'character-card-png' ? 'Choose PNG character card' : 'Choose import file')}</span>
            <input
              type="file"
              accept={importKind === 'character-card-png' ? 'image/png,.png' : importKind === 'chat-jsonl' ? '.jsonl,.ndjson,.txt' : '.json,application/json,.txt'}
              on:change={readImportFile}
            />
          </label>
          <textarea
            bind:value={importText}
            rows="10"
            placeholder={importKind === 'character-card-png' ? 'Optional base64 PNG data' : 'JSON or JSONL'}
          ></textarea>
          <button class="secondary full" type="button" on:click={runImport}><Download size={16} />Import</button>
        </div>
      {:else if activeDrawer === 'inspector'}
        <div class="inspector-panel">
          <button class="secondary full" type="button" on:click={inspectCurrentPrompt}><Search size={16} />Inspect</button>
          <pre>{inspector}</pre>
        </div>
      {/if}
    </aside>
  {/if}
</main>

<style>
  .workspace {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    min-height: 100vh;
    background: #f5f6f4;
    color: #1e2420;
  }

  .rail {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    height: 100vh;
    padding: 14px 10px;
    background: #203229;
    color: #fff;
  }

  .brand {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: 8px;
    color: #f5f3ee;
    font-weight: 800;
    letter-spacing: 0;
  }

  .rail-spacer {
    flex: 1;
  }

  .icon-button,
  .tool-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 8px;
    width: 40px;
    height: 40px;
    background: transparent;
    color: inherit;
  }

  .tool-button {
    border: 1px solid #d6d8d3;
    background: #fff;
    color: #26302a;
  }

  .icon-button.active,
  .icon-button:hover {
    background: #e0efe6;
    color: #183125;
  }

  .tool-button:hover {
    border-color: #a9c8b3;
    background: #edf6f0;
  }

  .tool-button:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  .stage {
    min-width: 0;
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
  }

  .chatbar {
    display: grid;
    grid-template-columns: minmax(180px, 0.75fr) minmax(280px, 1.45fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 72px;
    border-bottom: 1px solid #dfe1dc;
    padding: 12px 20px;
    background: #fbfcfa;
  }

  .scene {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .conversation-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    border: 1px solid #e0e4df;
    border-radius: 8px;
    padding: 9px 10px;
    background: #fff;
    color: #1f2924;
    font: inherit;
    font-weight: 700;
  }

  .conversation-button:hover {
    background: #f0f2ee;
  }

  .conversation-button span,
  .context-chip span,
  .status-pill {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .context-strip {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 0.7fr) minmax(0, 1.25fr) auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .context-chip,
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    min-height: 40px;
    border: 1px solid #e0e4df;
    border-radius: 8px;
    background: #fff;
    color: #26302a;
    padding: 8px 10px;
    font-size: 13px;
    text-align: left;
  }

  .context-chip:hover,
  .context-chip:focus-visible {
    border-color: #a9c8b3;
    background: #edf6f0;
    outline: 0;
  }

  .context-chip.profile {
    color: #1c4d35;
  }

  .status-pill {
    justify-content: center;
    min-width: 78px;
    border-color: #bfd5c7;
    background: #edf6f0;
    color: #1c4d35;
    font-weight: 700;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
  }

  select,
  input,
  textarea {
    width: 100%;
    border: 1px solid #cfd4cd;
    border-radius: 8px;
    background: #fff;
    color: #1f2421;
    padding: 10px 12px;
  }

  textarea {
    resize: vertical;
  }

  .messages {
    min-height: 0;
    overflow: auto;
    padding: 24px;
  }

  .message-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(100%, 880px);
    min-height: 100%;
    margin: 0 auto;
  }

  .empty-state {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 8px;
    min-height: 52vh;
    color: #66706a;
    text-align: center;
  }

  .empty-state h1 {
    margin: 0;
    color: #1e2420;
    font-size: 24px;
    letter-spacing: 0;
  }

  .empty-state p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .message-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: min(100%, 760px);
    align-self: flex-start;
  }

  .message-row.user {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .message-row.system {
    align-self: center;
  }

  .message-avatar {
    flex: 0 0 40px;
    width: 40px;
    height: 40px;
    padding: 0;
    overflow: hidden;
    border: 1px solid #d9ddd7;
    border-radius: 8px;
    background: #f0f2ee;
    color: inherit;
    cursor: zoom-in;
  }

  .message-avatar:hover,
  .message-avatar:focus-visible {
    border-color: #92bfa4;
    box-shadow: 0 0 0 3px rgb(146 191 164 / 22%);
    outline: 0;
  }

  .message-avatar img,
  .message-avatar span {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
  }

  .message-avatar img {
    object-fit: cover;
  }

  .message-avatar span {
    background: #203229;
    color: #fff;
    font-weight: 800;
  }

  .message-row.user .message-avatar span {
    background: #1c6b43;
  }

  .message {
    min-width: 0;
    flex: 1 1 auto;
    border: 1px solid #dfe1dc;
    border-radius: 8px;
    background: #fff;
    padding: 12px 14px;
    box-shadow: 0 1px 0 rgb(31 36 33 / 4%);
  }

  .message.user {
    border-color: #b6d2bf;
    background: #eaf5ee;
  }

  .message.assistant {
    background: #fff;
  }

  .message strong {
    display: block;
    margin-bottom: 6px;
    color: #68716b;
    font-size: 12px;
    text-transform: none;
  }

  .message-content {
    margin: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .message-content.rich :global(*) {
    max-width: 100%;
  }

  .message-content.rich :global(p) {
    margin: 0 0 0.7em;
  }

  .message-content.rich :global(p:last-child) {
    margin-bottom: 0;
  }

  .composer {
    display: grid;
    grid-template-columns: minmax(0, 820px) auto;
    justify-content: center;
    gap: 12px;
    border-top: 1px solid #dfe1dc;
    padding: 14px 20px;
    background: #fff;
  }

  .avatar-viewer {
    position: fixed;
    --rail-width: 64px;
    --stage-width: calc(100vw - var(--rail-width));
    --chat-width: min(880px, var(--stage-width));
    --chat-left: calc(var(--rail-width) + (var(--stage-width) - var(--chat-width)) / 2);
    --left-gap-width: calc(var(--chat-left) - var(--rail-width));
    --viewer-margin: 12px;
    --max-avatar-viewer-width: min(430px, calc(90vh * 0.666));
    top: 78px;
    left: calc(var(--rail-width) + max(var(--viewer-margin), calc((var(--left-gap-width) - var(--max-avatar-viewer-width)) / 2)));
    z-index: 25;
    display: block;
    width: max(0px, calc(var(--left-gap-width) - var(--viewer-margin) * 2));
    max-width: var(--max-avatar-viewer-width);
    max-height: calc(100vh - 96px);
    background: transparent;
  }

  .avatar-viewer-image {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    min-height: 0;
    max-height: calc(100vh - 168px);
    background: transparent;
  }

  .avatar-viewer-image img {
    display: block;
    width: 100%;
    max-height: calc(100vh - 96px);
    object-fit: contain;
    border-radius: 10px;
    box-shadow: 0 18px 46px rgb(20 24 22 / 22%);
  }

  .avatar-viewer-image span {
    display: grid;
    place-items: center;
    width: min(72vw, 260px);
    aspect-ratio: 1;
    border-radius: 8px;
    background: #203229;
    box-shadow: 0 18px 46px rgb(20 24 22 / 22%);
    color: #fff;
    font-size: 96px;
    font-weight: 800;
  }

  .avatar-viewer-image.user span {
    background: #1c6b43;
  }

  .avatar-viewer-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    left: 8px;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease;
  }

  .avatar-viewer:hover .avatar-viewer-controls,
  .avatar-viewer:focus-within .avatar-viewer-controls {
    opacity: 1;
  }

  .avatar-viewer-controls span,
  .avatar-viewer-controls button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid rgb(255 255 255 / 28%);
    border-radius: 8px;
    background: rgb(31 36 33 / 72%);
    color: #fff;
    pointer-events: auto;
    backdrop-filter: blur(8px);
  }

  .avatar-viewer-controls button {
    cursor: pointer;
  }

  .avatar-viewer-controls button:hover,
  .avatar-viewer-controls button:focus-visible {
    background: rgb(28 107 67 / 88%);
    outline: 0;
  }

  .primary,
  .secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 8px;
    border: 1px solid #1c6b43;
    padding: 10px 14px;
    background: #1c6b43;
    color: #fff;
    min-height: 42px;
  }

  .secondary {
    border-color: #cfd4cd;
    background: #fff;
    color: #1f2421;
  }

  .secondary:hover,
  .primary:hover {
    filter: brightness(0.98);
  }

  .full {
    width: 100%;
  }

  .scrim {
    position: fixed;
    inset: 0 0 0 64px;
    z-index: 20;
    border: 0;
    background: rgb(20 24 22 / 28%);
  }

  .drawer {
    position: fixed;
    inset: 0 auto 0 64px;
    z-index: 30;
    display: flex;
    flex-direction: column;
    width: min(390px, calc(100vw - 64px));
    border-right: 1px solid #d7dad4;
    background: #ffffff;
    box-shadow: 16px 0 36px rgb(28 36 31 / 14%);
  }

  .drawer.right {
    inset: 0 0 0 auto;
    width: min(440px, calc(100vw - 64px));
    border-right: 0;
    border-left: 1px solid #d7dad4;
    box-shadow: -16px 0 36px rgb(28 36 31 / 14%);
  }

  .drawer.profiles {
    width: min(720px, calc(100vw - 64px));
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 64px;
    border-bottom: 1px solid #e1e3de;
    padding: 12px 16px;
  }

  .drawer-header h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0;
  }

  .drawer-actions,
  .editor,
  .import-panel,
  .inspector-panel {
    display: grid;
    gap: 10px;
    padding: 16px;
  }

  .compact-editor {
    border-top: 1px solid #eef0ec;
    border-bottom: 1px solid #eef0ec;
    background: #fafbf9;
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #4f5a53;
    font-size: 13px;
  }

  .checkbox-row input {
    width: auto;
  }

  .file-picker {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    border: 1px dashed #a9b7ad;
    border-radius: 8px;
    background: #f8faf7;
    color: #2f3a34;
    padding: 10px 12px;
    overflow: hidden;
  }

  .file-picker span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-picker input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .item-list {
    display: grid;
    gap: 8px;
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 0 16px 16px;
  }

  .bound-worldbooks {
    display: grid;
    gap: 10px;
    border-top: 1px solid #eef0ec;
    border-bottom: 1px solid #eef0ec;
    background: #fbfcfa;
    padding: 12px 16px;
  }

  .bound-worldbooks > div:first-child,
  .bound-worldbook-list article {
    display: grid;
    gap: 3px;
  }

  .bound-worldbooks span,
  .bound-worldbook-list span {
    color: #66716a;
    font-size: 12px;
  }

  .bound-worldbook-list {
    display: grid;
    gap: 6px;
  }

  .bound-worldbook-list article {
    border: 1px solid #e0e4df;
    border-radius: 7px;
    background: #fff;
    padding: 8px 10px;
  }

  .drawer-item,
  .drawer-card {
    display: grid;
    gap: 5px;
    border: 1px solid #dfe1dc;
    border-radius: 8px;
    background: #fff;
    padding: 11px 12px;
    color: #202823;
    text-align: left;
  }

  .drawer-item.active,
  .drawer-item:hover {
    border-color: #9dc7ad;
    background: #edf6f0;
  }

  .drawer-item span,
  .drawer-card span {
    color: #6c756f;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .drawer-empty.compact {
    border: 1px dashed #d9ddd6;
    border-radius: 7px;
    background: #fff;
    padding: 9px 10px;
    text-align: center;
  }

  .profile-panel {
    display: grid;
    gap: 12px;
    border-bottom: 1px solid #e6e8e3;
    padding: 14px 16px 16px;
    background: #fbfcfa;
  }

  .profile-workspace {
    display: grid;
    align-content: start;
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    background: #fff;
  }

  .preset-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
  }

  .preset-toolbar select {
    min-height: 40px;
    padding-block: 8px;
  }

  .preset-actions {
    display: flex;
    gap: 6px;
  }

  .preset-actions .tool-button {
    width: 38px;
    height: 38px;
    border-radius: 7px;
  }

  .profile-summary {
    display: grid;
    gap: 9px;
    border: 1px solid #dfe3dc;
    border-radius: 8px;
    background: #fff;
    padding: 12px;
  }

  .profile-summary-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .profile-summary-heading div {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .profile-summary-heading strong,
  .profile-row strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-summary-heading span,
  .profile-model,
  .profile-sampler,
  .profile-row-main span,
  .profile-row-meta {
    color: #66716a;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .provider-pill {
    flex: 0 0 auto;
    border: 1px solid #bfd5c7;
    border-radius: 999px;
    background: #edf6f0;
    color: #22533b !important;
    padding: 3px 7px;
    font-size: 11px !important;
    line-height: 1.2;
  }

  .profile-model {
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .profile-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .profile-chips span {
    border: 1px solid #e0e4df;
    border-radius: 999px;
    background: #f5f7f4;
    color: #2f3a34;
    padding: 4px 8px;
    font-size: 12px;
    line-height: 1.1;
  }

  .profile-search {
    min-height: 38px;
    padding-block: 8px;
  }

  .profile-editor,
  .prompt-manager-panel {
    display: grid;
    gap: 12px;
    border-bottom: 1px solid #e6e8e3;
    padding: 14px 16px 16px;
    background: #fff;
  }

  .profile-editor-header,
  .prompt-manager-header,
  .prompt-editor-titlebar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .profile-editor-header div,
  .prompt-manager-header div,
  .prompt-editor-titlebar div {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .profile-editor-header span,
  .prompt-manager-header span,
  .prompt-editor-titlebar span,
  .provider-editor span,
  .credential-panel span,
  .request-panel span,
  .advanced-sampler-grid span,
  .profile-textarea-label span,
  .profile-mode-strip span,
  .prompt-slot-row span {
    color: #66716a;
    font-size: 12px;
  }

  .provider-editor,
  .request-panel,
  .regex-panel {
    display: grid;
    gap: 12px;
    border: 1px solid #e0e4df;
    border-radius: 8px;
    background: #fbfcfa;
    padding: 12px;
  }

  .profile-name-field {
    display: grid;
    gap: 5px;
  }

  .provider-segment,
  .mini-segment {
    display: grid;
    gap: 6px;
    border: 1px solid #dfe3dc;
    border-radius: 8px;
    background: #f1f3ef;
    padding: 4px;
  }

  .provider-segment {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .provider-segment button,
  .mini-segment button,
  .toggle-pill,
  .vertex-strip > button {
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: #314039;
  }

  .provider-segment button {
    display: grid;
    gap: 3px;
    padding: 10px;
    text-align: left;
  }

  .provider-segment button.active,
  .mini-segment button.active,
  .toggle-pill.active,
  .vertex-strip > button.active {
    border-color: #a9c8b3;
    background: #ffffff;
    color: #174b32;
    box-shadow: 0 1px 3px rgb(29 39 33 / 8%);
  }

  .provider-config,
  .vertex-strip {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 10px;
  }

  .vertex-strip {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
  }

  .provider-config label,
  .credential-grid label {
    display: grid;
    min-width: 0;
    gap: 5px;
  }

  .vertex-strip > button {
    min-height: 36px;
    border-color: #d6d8d3;
    background: #fff;
    padding: 0 12px;
  }

  .vertex-mode-selector {
    max-width: 260px;
  }

  .request-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .credential-panel {
    display: grid;
    gap: 10px;
    border-top: 1px solid #e7eae5;
    padding-top: 10px;
  }

  .credential-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .credential-panel-head strong {
    color: #26302a;
    font-size: 13px;
  }

  .credential-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .credential-grid.single {
    grid-template-columns: minmax(0, 1fr);
  }

  .compatibility-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    border: 1px solid #dfe3dc;
    border-radius: 8px;
    background: #f1f3ef;
    padding: 4px;
  }

  .request-flow-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    border: 1px solid #dfe3dc;
    border-radius: 8px;
    background: #f1f3ef;
    padding: 4px;
  }

  .request-flow-strip button {
    display: grid;
    gap: 2px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: #314039;
    padding: 8px 10px;
    text-align: left;
  }

  .request-flow-strip button.active {
    border-color: #a9c8b3;
    background: #fff;
    color: #174b32;
    box-shadow: 0 1px 3px rgb(29 39 33 / 8%);
  }

  .compatibility-strip button {
    display: grid;
    gap: 2px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: #314039;
    padding: 8px 10px;
    text-align: left;
  }

  .compatibility-strip button.active {
    border-color: #a9c8b3;
    background: #fff;
    color: #174b32;
    box-shadow: 0 1px 3px rgb(29 39 33 / 8%);
  }

  .request-panel-header span {
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .sampler-control-list {
    display: grid;
    gap: 10px;
  }

  .sampler-control {
    display: grid;
    gap: 6px;
  }

  .sampler-control-head,
  .sampler-control-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
  }

  .sampler-control output {
    min-width: 56px;
    border: 1px solid #dfe3dc;
    border-radius: 999px;
    background: #fff;
    color: #26302a;
    padding: 3px 8px;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 12px;
  }

  .sampler-range {
    height: 30px;
    min-height: 30px !important;
    padding: 0 !important;
    accent-color: #1c6b43;
  }

  .sampler-number {
    width: 76px;
    min-height: 32px !important;
    border-radius: 7px !important;
    padding: 6px 8px !important;
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .advanced-sampler {
    border-top: 1px solid #e7eae5;
    padding-top: 8px;
  }

  .advanced-sampler summary {
    cursor: pointer;
    color: #314039;
    font-size: 13px;
    font-weight: 700;
  }

  .advanced-sampler-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    padding-top: 10px;
  }

  .profile-textarea-label,
  .advanced-sampler-grid label,
  .segmented-field {
    display: grid;
    min-width: 0;
    gap: 5px;
  }

  .profile-name-field input,
  .provider-config input,
  .credential-grid input,
  .advanced-sampler-grid input,
  .profile-textarea-label textarea {
    min-height: 36px;
    border-radius: 7px;
    padding: 8px 10px;
    font-size: 13px;
  }

  .profile-mode-strip {
    display: grid;
    grid-template-columns: minmax(0, 150px) minmax(0, 150px) auto;
    align-items: end;
    gap: 10px;
  }

  .regex-panel-header,
  .regex-script-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .regex-panel-header div,
  .regex-script-row div {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .regex-panel-header span,
  .regex-script-row span {
    color: #66716a;
    font-size: 12px;
  }

  .regex-script-list {
    display: grid;
    gap: 6px;
    max-height: 260px;
    overflow: auto;
  }

  .regex-script-row {
    border: 1px solid #e0e4df;
    border-radius: 7px;
    background: #fff;
    padding: 8px 10px;
  }

  .regex-script-row.disabled {
    opacity: 0.62;
  }

  .mini-toggle {
    min-width: 44px;
    min-height: 30px;
    border: 1px solid #d6d8d3;
    border-radius: 999px;
    background: #fff;
    color: #66716a;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 700;
  }

  .mini-toggle.active {
    border-color: #a9c8b3;
    background: #edf6f0;
    color: #174b32;
  }

  .mini-segment {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mini-segment.three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .mini-segment button,
  .toggle-pill {
    min-height: 36px;
    padding: 0 10px;
  }

  .toggle-pill {
    border-color: #d6d8d3;
    background: #fff;
  }

  .profile-toggle {
    min-height: 36px;
    align-content: center;
    justify-content: flex-start;
  }

  .prompt-manager-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(190px, auto);
    gap: 10px;
    align-items: center;
  }

  .prompt-selection-summary {
    display: grid;
    min-width: 0;
    gap: 3px;
    border: 1px solid #e0e4df;
    border-radius: 8px;
    background: #fbfcfa;
    padding: 8px 10px;
  }

  .prompt-selection-summary strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prompt-slot-list {
    display: grid;
    align-content: start;
    max-height: 520px;
    overflow: auto;
    border: 1px solid #dfe3dc;
    border-radius: 8px;
    background: #fbfcfa;
  }

  .prompt-slot-list-header,
  .prompt-slot-row {
    display: grid;
    grid-template-columns: 26px 28px minmax(0, 1fr) 86px 62px 176px;
    align-items: center;
    gap: 8px;
  }

  .prompt-slot-list-header {
    position: sticky;
    top: 0;
    z-index: 1;
    border-bottom: 1px solid #e2e6e0;
    background: #f5f7f4;
    color: #66716a;
    padding: 8px 10px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .prompt-slot-row {
    border-bottom: 1px solid #eef0ec;
    background: #fff;
    padding: 8px 10px;
  }

  .prompt-slot-row:last-child {
    border-bottom: 0;
  }

  .prompt-slot-row.active {
    background: #edf6f0;
    box-shadow: inset 3px 0 0 #1c6b43;
  }

  .prompt-slot-grip {
    display: grid;
    place-items: center;
    color: #8b968f;
  }

  .prompt-slot-toggle {
    width: 16px;
    height: 16px;
    margin: 0 auto;
  }

  .prompt-slot-main {
    display: grid;
    gap: 3px;
    min-width: 0;
    border: 0;
    background: transparent;
    color: #202823;
    padding: 0;
    text-align: left;
  }

  .prompt-slot-main strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prompt-kind-badge,
  .prompt-token-count {
    justify-self: start;
    border: 1px solid #e0e4df;
    border-radius: 999px;
    background: #f8faf7;
    color: #2f3a34;
    padding: 3px 7px;
    font-size: 11px;
    line-height: 1.1;
  }

  .prompt-token-count {
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .prompt-row-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
  }

  .prompt-row-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: 1px solid #d6d8d3;
    border-radius: 6px;
    background: #fff;
    color: #26302a;
  }

  .prompt-row-actions button:hover {
    border-color: #a9c8b3;
    background: #edf6f0;
  }

  .prompt-row-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.38;
  }

  .prompt-editor-overlay {
    position: fixed;
    inset: 64px auto 0 64px;
    z-index: 42;
    display: grid;
    align-items: start;
    width: min(720px, calc(100vw - 64px));
    overflow: auto;
    border-right: 1px solid #d7dad4;
    background: rgb(250 251 249 / 96%);
    box-shadow: 16px 0 36px rgb(28 36 31 / 14%);
    backdrop-filter: blur(8px);
    padding: 16px;
  }

  .prompt-editor-window {
    display: grid;
    gap: 12px;
    border: 1px solid #dfe3dc;
    border-radius: 8px;
    background: #fff;
    padding: 14px;
  }

  .prompt-editor-titlebar {
    border-bottom: 1px solid #eef0ec;
    padding-bottom: 12px;
  }

  .prompt-editor-titlebar h3 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0;
  }

  .prompt-editor-fields {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
  }

  .prompt-editor-fields.compact {
    grid-template-columns: repeat(2, minmax(0, 130px));
  }

  .prompt-editor-fields label,
  .prompt-trigger-panel {
    display: grid;
    min-width: 0;
    gap: 5px;
  }

  .prompt-editor-fields input,
  .prompt-editor-fields select {
    min-height: 36px;
    border-radius: 7px;
    padding: 8px 10px;
    font-size: 13px;
  }

  .prompt-trigger-options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .prompt-trigger-options button {
    min-height: 30px;
    border: 1px solid #d6d8d3;
    border-radius: 999px;
    background: #fff;
    color: #314039;
    padding: 0 10px;
    font-size: 12px;
  }

  .prompt-trigger-options button.active {
    border-color: #a9c8b3;
    background: #edf6f0;
    color: #174b32;
  }

  .prompt-editor-source {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid #e0e4df;
    border-radius: 8px;
    background: #fbfcfa;
    padding: 9px 10px;
    color: #4f5a53;
    font-size: 12px;
  }

  .prompt-content-label textarea {
    min-height: 260px;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    line-height: 1.5;
  }

  .prompt-editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    border-top: 1px solid #eef0ec;
    padding-top: 12px;
  }

  .profile-list-section {
    display: grid;
    border-bottom: 1px solid #eef0ec;
  }

  .profile-list {
    display: grid;
    align-content: start;
    gap: 0;
    min-height: 0;
  }

  .profile-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: 0;
    border-bottom: 1px solid #eef0ec;
    background: #fff;
    color: #202823;
    padding: 10px 16px;
    text-align: left;
  }

  .profile-row:hover,
  .profile-row.active {
    background: #edf6f0;
  }

  .profile-row.active {
    box-shadow: inset 3px 0 0 #1c6b43;
  }

  .profile-row-main {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .profile-row-meta {
    display: grid;
    justify-items: end;
    gap: 3px;
    text-align: right;
    white-space: nowrap;
  }

  .drawer-empty {
    color: #66716a;
    padding: 18px 16px;
    font-size: 13px;
  }

  pre {
    min-height: 260px;
    max-height: 62vh;
    margin: 0;
    border: 1px solid #dfe1dc;
    border-radius: 8px;
    background: #f6f7f5;
    color: #303832;
    overflow: auto;
    overflow-wrap: anywhere;
    padding: 12px;
    white-space: pre-wrap;
    font-size: 12px;
  }

  @media (max-width: 860px) {
    .workspace {
      grid-template-columns: 56px minmax(0, 1fr);
    }

    .rail {
      padding: 10px 8px;
    }

    .brand,
    .icon-button,
    .tool-button {
      width: 40px;
      height: 40px;
    }

    .chatbar {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
    }

    .conversation-button {
      max-width: 100%;
    }

    .context-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .context-chip.profile,
    .status-pill {
      grid-column: auto;
    }

    .toolbar {
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .messages {
      padding: 18px 12px;
    }

    .composer {
      grid-template-columns: minmax(0, 1fr);
      padding: 12px;
    }

    .scrim {
      left: 56px;
    }

    .drawer {
      left: 56px;
      width: calc(100vw - 56px);
    }

    .drawer.profiles {
      width: calc(100vw - 56px);
    }

    .drawer.right {
      width: calc(100vw - 56px);
    }

    .provider-config,
    .vertex-strip,
    .credential-grid,
    .credential-grid.single,
    .compatibility-strip {
      grid-template-columns: minmax(0, 1fr);
    }

    .advanced-sampler-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .profile-mode-strip {
      grid-template-columns: minmax(0, 1fr);
    }

    .prompt-manager-toolbar,
    .prompt-editor-fields {
      grid-template-columns: minmax(0, 1fr);
    }

    .prompt-slot-list-header {
      display: none;
    }

    .prompt-slot-row {
      grid-template-columns: 26px 28px minmax(0, 1fr);
    }

    .prompt-kind-badge,
    .prompt-token-count {
      display: none;
    }

    .prompt-row-actions {
      grid-column: 3;
      justify-content: flex-start;
    }

    .prompt-editor-overlay {
      inset: 64px auto 0 56px;
      width: calc(100vw - 56px);
      padding: 10px;
    }

    .prompt-editor-source {
      align-items: flex-start;
      flex-direction: column;
    }

    .avatar-viewer {
      --rail-width: 56px;
      --viewer-margin: 8px;
      top: 72px;
      max-height: calc(100vh - 92px);
    }

    .avatar-viewer-image img {
      max-height: calc(100vh - 92px);
    }
  }
</style>
