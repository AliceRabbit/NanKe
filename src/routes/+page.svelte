<script lang="ts">
  import { onMount } from 'svelte';
  import { applyRegexScripts, REGEX_PLACEMENT } from '$lib/core/regex';
  import { renderMessageMarkdown } from '$lib/ui/markdown';
  import type { Character } from '$lib/schemas/character';
  import type { RegexPlacement, RegexScript } from '$lib/schemas/regex';
  import type { WorldBook, WorldBookEntry } from '$lib/schemas/worldbook';
  import {
    Archive,
    ArchiveRestore,
    ArrowDown,
    ArrowUp,
    Bot,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    CircleStop,
    Copy,
    Download,
    FileInput,
    GripHorizontal,
    Image,
    MessageCircle,
    MessageSquare,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Send,
    Save,
    Settings2,
    Star,
    Trash2,
    Upload,
    UserRound,
    SquarePen,
    X
  } from '@lucide/svelte';

  type ProviderType = 'openai-compatible' | 'gemini';
  type OpenAICompatibility = 'strict-openai' | 'extended';
  type VertexMode = 'express' | 'oauth';
  type OpenAIReasoningEffort = 'default' | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  type GeminiThinkingMode = 'default' | 'off' | 'budget' | 'level';
  type GeminiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';
  type PromptRole = 'system' | 'user' | 'assistant';
  type PromptMode = 'chat' | 'text';
  type MacroMode = 'none' | 'sillytavern';
  type CharacterSortMode = 'favorite' | 'name-asc' | 'name-desc' | 'newest' | 'oldest' | 'tokens-desc';
  type CharacterEditorTab = 'core' | 'prompt' | 'lore' | 'metadata';
  type CharacterPanelMode = 'edit' | 'create';
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
    thinking?: {
      openai?: {
        effort?: OpenAIReasoningEffort;
      };
      gemini?: {
        includeThoughts?: boolean;
        mode?: GeminiThinkingMode;
        budget?: number;
        level?: GeminiThinkingLevel;
      };
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
  type UserPersona = {
    id: string;
    name: string;
    description: string;
    avatarAssetId?: string;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
  };
  type MessageBranch = {
    nodeId: string;
    parentId: string | null;
    current: number;
    total: number;
    siblingNodeIds?: string[];
    isLatest?: boolean;
  };
  type Conversation = {
    id: string;
    title: string;
    characterId?: string;
    personaId?: string;
    profileId?: string;
    rootNodeId?: string;
    activeLeafId?: string;
    nodeCount?: number;
    branchCount?: number;
    activeDepth?: number;
    lastPreview?: string;
    revision?: number;
    archivedAt?: number;
    messages?: ChatMessage[];
    updatedAt?: number;
  };
  type ChatMessage = {
    id?: string;
    conversationId?: string;
    role: 'user' | 'assistant' | 'system';
    name?: string;
    content: string;
    thinking?: string;
    branch?: MessageBranch;
  };
  type ZoomedAvatar = { key: string; name: string; role: ChatMessage['role']; src: string; initials: string };
  type GenerationStreamEvent = { type: 'text' | 'thinking' | 'inspector' | 'done' | 'error'; text?: string; conversationId?: string; activeLeafId?: string };
  type ConversationGroup = { key: string; label: string; avatarUrl: string; count: number; conversations: Conversation[] };
  type ImportKind = 'preset' | 'character-card-json' | 'character-card-png' | 'worldbook' | 'chat-jsonl';
  type View = 'chat' | 'characters' | 'personas' | 'worldbooks' | 'profiles';
  type Drawer = 'chats' | 'characters' | 'personas' | 'worldbooks' | 'profiles' | 'import' | 'inspector' | null;
  type SamplerField = Exclude<keyof NonNullable<Profile['sampler']>, 'stop'>;

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
  const worldBookPositions: Array<{ value: WorldBookEntry['position']; label: string }> = [
    { value: 'before', label: 'Before Char' },
    { value: 'after', label: 'After Char' },
    { value: 'depth', label: '@ Depth' }
  ];
  const worldBookSortModes = [
    { value: 'order-desc', label: 'Order desc' },
    { value: 'order-asc', label: 'Order asc' },
    { value: 'title-asc', label: 'Title A-Z' },
    { value: 'title-desc', label: 'Title Z-A' },
    { value: 'depth-asc', label: 'Depth asc' },
    { value: 'probability-desc', label: 'Trigger desc' }
  ];
  const characterSortModes: Array<{ value: CharacterSortMode; label: string }> = [
    { value: 'favorite', label: 'Favorites' },
    { value: 'name-asc', label: 'A-Z' },
    { value: 'name-desc', label: 'Z-A' },
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'tokens-desc', label: 'Most tokens' }
  ];
  const maxContextTokens = 2_000_000;
  const maxOutputTokenRange = 65_536;
  const openAIStrictSamplerFields = new Set<SamplerField>([
    'temperature',
    'topP',
    'frequencyPenalty',
    'presencePenalty',
    'maxTokens',
    'contextTokens',
    'seed',
    'n'
  ]);
  const openAIExtendedSamplerFields = new Set<SamplerField>([
    ...openAIStrictSamplerFields,
    'topK',
    'topA',
    'minP',
    'repetitionPenalty'
  ]);
  const geminiSamplerFields = new Set<SamplerField>([
    'temperature',
    'topP',
    'topK',
    'frequencyPenalty',
    'presencePenalty',
    'maxTokens',
    'contextTokens',
    'seed',
    'n'
  ]);
  const samplerFieldList: SamplerField[] = [
    'temperature',
    'topP',
    'topK',
    'topA',
    'minP',
    'frequencyPenalty',
    'presencePenalty',
    'repetitionPenalty',
    'maxTokens',
    'contextTokens',
    'seed',
    'n'
  ];

  let profiles: Profile[] = [];
  let characters: Character[] = [];
  let personas: UserPersona[] = [];
  let worldBooks: WorldBook[] = [];
  let conversations: Conversation[] = [];
  let conversationQuery = '';
  let showArchivedConversations = false;
  let activeView: View = 'chat';
  let activeDrawer: Drawer = null;
  let activeProfileId = '';
  let activeCharacterId = '';
  let activePersonaId = '';
  let activeConversationId = '';
  let messages: ChatMessage[] = [];
  let input = '';
  let status = 'Ready';
  let generationAbortController: AbortController | null = null;
  let isGenerating = false;
  let importKind: ImportKind = 'preset';
  let importName = '';
  let importText = '';
  let importFileName = '';
  let importFileBase64 = '';
  let inspector = '';
  let newCharacterName = '';
  let newCharacterDescription = '';
  let newCharacterPersonality = '';
  let newCharacterScenario = '';
  let newCharacterFirstMessage = '';
  let newCharacterAlternateGreetings = '';
  let newCharacterExampleMessages = '';
  let newCharacterSystemPrompt = '';
  let newCharacterPostHistoryInstructions = '';
  let newCharacterCreatorNotes = '';
  let newCharacterTags = '';
  let newCharacterCreator = '';
  let newCharacterCharacterVersion = '';
  let newCharacterTalkativeness = '';
  let newCharacterFavorite = false;
  let characterQuery = '';
  let characterSortMode: CharacterSortMode = 'favorite';
  let characterPanelMode: CharacterPanelMode = 'edit';
  let characterEditorTab: CharacterEditorTab = 'core';
  let characterDraftId = '';
  let characterDraftName = '';
  let characterDraftDescription = '';
  let characterDraftPersonality = '';
  let characterDraftScenario = '';
  let characterDraftFirstMessage = '';
  let characterDraftAlternateGreetings = '';
  let characterDraftExampleMessages = '';
  let characterDraftSystemPrompt = '';
  let characterDraftPostHistoryInstructions = '';
  let characterDraftCreatorNotes = '';
  let characterDraftTags = '';
  let characterDraftCreator = '';
  let characterDraftCharacterVersion = '';
  let characterDraftTalkativeness = '';
  let characterDraftFavorite = false;
  let newPersonaName = '';
  let newPersonaDescription = '';
  let newPersonaDefault = false;
  let personaDraftId = '';
  let personaDraftName = '';
  let personaDraftDescription = '';
  let personaDraftDefault = false;
  let newWorldBookName = '';
  let activeWorldBookId = '';
  let worldBookDraftId = '';
  let worldBookDraftName = '';
  let worldBookDraftEntries: WorldBookEntry[] = [];
  let activeWorldBookEntryId = '';
  let worldBookEntryQuery = '';
  let worldBookSortMode = 'order-desc';
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
  let profileDraftOpenAIReasoningEffort: OpenAIReasoningEffort = 'default';
  let profileDraftGeminiIncludeThoughts = false;
  let profileDraftGeminiThinkingMode: GeminiThinkingMode = 'default';
  let profileDraftGeminiThinkingBudget = '';
  let profileDraftGeminiThinkingLevel: GeminiThinkingLevel = 'medium';
  let profileDraftMode: PromptMode = 'chat';
  let profileDraftMacroMode: MacroMode = 'none';
  let profileDraftSquashSystemMessages = false;
  let activeSamplerFields = openAIStrictSamplerFields;
  let samplerVisible = samplerVisibility(activeSamplerFields);
  let samplerPanelHeading = 'OpenAI Chat Parameters';
  let maxTokensFieldLabel = 'Max Completion';
  let candidateCountFieldLabel = 'N';
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
  $: activeSamplerFields =
    profileDraftProviderType === 'gemini'
      ? geminiSamplerFields
      : profileDraftOpenAICompatibility === 'extended'
        ? openAIExtendedSamplerFields
        : openAIStrictSamplerFields;
  $: samplerVisible = samplerVisibility(activeSamplerFields);
  $: samplerPanelHeading =
    profileDraftProviderType === 'gemini'
      ? 'Gemini GenerationConfig'
      : profileDraftOpenAICompatibility === 'extended'
        ? 'Extended Chat Parameters'
        : 'OpenAI Chat Parameters';
  $: maxTokensFieldLabel =
    profileDraftProviderType === 'gemini' ? 'Max Output' : profileDraftOpenAICompatibility === 'extended' ? 'Max Tokens' : 'Max Completion';
  $: candidateCountFieldLabel = profileDraftProviderType === 'gemini' ? 'Candidates' : 'N';
  $: draftModelUsesGeminiThinkingLevel = profileDraftProviderType === 'gemini' && /^gemini-3(?:\.|-|$)/i.test(profileDraftProviderModel.trim());
  $: showAdvancedSampler =
    samplerVisible.topA ||
    samplerVisible.minP ||
    samplerVisible.frequencyPenalty ||
    samplerVisible.presencePenalty ||
    samplerVisible.repetitionPenalty ||
    samplerVisible.seed ||
    samplerVisible.n;
  $: activeCharacter = characters.find((character) => character.id === activeCharacterId);
  $: activeCharacterWorldBooks = boundWorldBooksForCharacter(activeCharacter);
  $: filteredCharacters = filterCharacters(characters, characterQuery, characterSortMode);
  $: activeCharacterStats = characterStats(activeCharacter);
  $: createCharacterStats = characterCreateStats();
  $: activeWorldBook = worldBooks.find((worldBook) => worldBook.id === activeWorldBookId);
  $: filteredWorldBookEntries = filterWorldBookEntries(worldBookDraftEntries, worldBookEntryQuery, worldBookSortMode);
  $: activeWorldBookEntry = worldBookDraftEntries.find((entry) => entry.id === activeWorldBookEntryId);
  $: activePersona = personas.find((persona) => persona.id === activePersonaId);
  $: activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  $: conversationGroups = groupConversations(conversations, conversationQuery, showArchivedConversations);
  $: isGenerating = generationAbortController !== null;
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
  $: if (activeCharacterId !== characterDraftId) {
    loadCharacterDraft(activeCharacter);
  }
  $: if (activePersonaId !== personaDraftId) {
    personaDraftId = activePersonaId;
    personaDraftName = activePersona?.name ?? '';
    personaDraftDescription = activePersona?.description ?? '';
    personaDraftDefault = activePersona?.isDefault ?? false;
  }
  $: if (activeWorldBookId !== worldBookDraftId) {
    loadWorldBookDraft(activeWorldBook);
  }
  $: if (worldBookDraftEntries.length && !worldBookDraftEntries.some((entry) => entry.id === activeWorldBookEntryId)) {
    activeWorldBookEntryId = worldBookDraftEntries[0].id;
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

  function rememberConversation(conversation: Conversation) {
    const shouldKeep = showArchivedConversations || !conversation.archivedAt || conversation.id === activeConversationId;
    conversations = [
      ...(shouldKeep ? [conversation] : []),
      ...conversations.filter((item) => item.id !== conversation.id)
    ].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }

  async function refreshConversationState(id: string, options: { close?: boolean } = {}) {
    const conversation = await fetchJson<Conversation>(`/api/conversations?id=${encodeURIComponent(id)}`);
    activeConversationId = conversation.id;
    messages = conversation.messages ?? [];
    activeCharacterId = conversation.characterId ?? activeCharacterId;
    activePersonaId = conversation.personaId ?? activePersonaId;
    activeProfileId = conversation.profileId ?? activeProfileId;
    rememberConversation(conversation);
    if (options.close) closeDrawer();
    return conversation;
  }

  function conversationListUrl() {
    const params = new URLSearchParams();
    if (showArchivedConversations) params.set('includeArchived', 'true');
    return `/api/conversations${params.size ? `?${params}` : ''}`;
  }

  async function refreshConversations() {
    conversations = await fetchJson<Conversation[]>(conversationListUrl());
  }

  async function toggleArchivedConversations() {
    showArchivedConversations = !showArchivedConversations;
    await refreshConversations();
  }

  function groupConversations(items: Conversation[], query: string, includeArchived: boolean): ConversationGroup[] {
    const needle = query.trim().toLowerCase();
    const groups = new Map<string, ConversationGroup>();
    for (const conversation of items) {
      if (!includeArchived && conversation.archivedAt) continue;
      const character = conversation.characterId ? characters.find((item) => item.id === conversation.characterId) : undefined;
      const haystack = `${conversation.title} ${conversation.lastPreview ?? ''} ${character?.name ?? ''}`.toLowerCase();
      if (needle && !haystack.includes(needle)) continue;

      const key = conversation.characterId ?? 'none';
      const group =
        groups.get(key) ??
        ({
          key,
          label: character?.name ?? 'No character',
          avatarUrl: characterAvatarUrl(character),
          count: 0,
          conversations: []
        } satisfies ConversationGroup);
      group.count += 1;
      group.conversations.push(conversation);
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  function conversationSummary(conversation: Conversation) {
    const parts = [
      `${conversation.nodeCount ?? 0} nodes`,
      conversation.branchCount ? `${conversation.branchCount} branches` : '',
      conversation.archivedAt ? 'archived' : ''
    ].filter(Boolean);
    return parts.join(' · ') || 'Empty chat';
  }

  function conversationPreview(conversation: Conversation) {
    return conversation.lastPreview?.trim() || conversation.id;
  }

  function conversationUpdatedLabel(conversation: Conversation) {
    if (!conversation.updatedAt) return '';
    return new Date(conversation.updatedAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async function refreshAll() {
    status = 'Loading';
    profiles = await fetchJson<Profile[]>('/api/profiles');
    characters = await fetchJson<Character[]>('/api/characters');
    personas = await fetchJson<UserPersona[]>('/api/personas');
    worldBooks = await fetchJson<WorldBook[]>('/api/worldbooks');
    conversations = await fetchJson<Conversation[]>(conversationListUrl());
    activeProfileId ||= profiles[0]?.id ?? '';
    activeCharacterId ||= characters[0]?.id ?? '';
    activePersonaId ||= personas.find((persona) => persona.isDefault)?.id ?? personas[0]?.id ?? '';
    if (!activeWorldBookId || !worldBooks.some((worldBook) => worldBook.id === activeWorldBookId)) {
      activeWorldBookId = worldBooks[0]?.id ?? '';
    }
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

  function characterAvatarUrl(character?: Character): string {
    return character?.avatarAssetId ? `/api/assets/${character.avatarAssetId}` : '';
  }

  function characterInitials(character?: Character): string {
    const name = character?.name?.trim() || '?';
    return Array.from(name)[0]?.toUpperCase() ?? '?';
  }

  function characterTextFields(character?: Character) {
    if (!character) return [];
    return [
      character.name,
      character.description,
      character.personality,
      character.scenario,
      character.firstMessage,
      character.exampleMessages,
      character.systemPrompt,
      character.postHistoryInstructions,
      character.creatorNotes,
      character.alternateGreetings.join('\n')
    ];
  }

  function characterTokenEstimate(character?: Character) {
    const totalLength = characterTextFields(character).join('\n').length;
    return Math.max(0, Math.ceil(totalLength / 4));
  }

  function characterStats(character?: Character) {
    const worldBookCount = boundWorldBooksForCharacter(character).length;
    const overrideCount = [character?.systemPrompt, character?.postHistoryInstructions, character?.depthPrompt?.prompt].filter((value) => value?.trim()).length;
    return {
      tokens: characterTokenEstimate(character),
      worldBooks: worldBookCount,
      tags: character?.tags?.length ?? 0,
      greetings: 1 + (character?.alternateGreetings?.length ?? 0),
      overrides: overrideCount
    };
  }

  function characterCreateStats() {
    const text = [
      newCharacterName,
      newCharacterDescription,
      newCharacterPersonality,
      newCharacterScenario,
      newCharacterFirstMessage,
      newCharacterExampleMessages,
      newCharacterSystemPrompt,
      newCharacterPostHistoryInstructions,
      newCharacterCreatorNotes,
      newCharacterAlternateGreetings
    ].join('\n');
    const overrides = [newCharacterSystemPrompt, newCharacterPostHistoryInstructions].filter((value) => value.trim()).length;
    return {
      tokens: Math.max(0, Math.ceil(text.length / 4)),
      greetings: 1 + parseSectionText(newCharacterAlternateGreetings).length,
      tags: parseKeywordText(newCharacterTags).length,
      overrides
    };
  }

  function characterOrigin(character?: Character) {
    if (!character) return 'No character';
    if (character.legacy?.source === 'sillytavern') return 'SillyTavern card';
    return 'NanKe native';
  }

  function characterListLine(character: Character) {
    const stats = characterStats(character);
    const parts = [
      `${stats.tokens} tokens`,
      stats.worldBooks ? `${stats.worldBooks} lore` : '',
      stats.tags ? `${stats.tags} tags` : '',
      character.favorite ? 'favorite' : '',
      characterOrigin(character)
    ].filter(Boolean);
    return parts.join(' · ');
  }

  function filterCharacters(items: Character[], query: string, sortMode: CharacterSortMode) {
    const text = query.trim().toLowerCase();
    const filtered = text
      ? items.filter((character) =>
          [
            character.name,
            character.description,
            character.personality,
            character.scenario,
            character.creator,
            character.characterVersion,
            character.tags.join(' '),
            characterOrigin(character)
          ]
            .join(' ')
            .toLowerCase()
            .includes(text)
        )
      : items;

    return [...filtered].sort((a, b) => {
      if (sortMode === 'name-asc') return a.name.localeCompare(b.name);
      if (sortMode === 'name-desc') return b.name.localeCompare(a.name);
      if (sortMode === 'newest') return b.createdAt - a.createdAt || a.name.localeCompare(b.name);
      if (sortMode === 'oldest') return a.createdAt - b.createdAt || a.name.localeCompare(b.name);
      if (sortMode === 'tokens-desc') return characterTokenEstimate(b) - characterTokenEstimate(a) || a.name.localeCompare(b.name);
      return Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name);
    });
  }

  function sectionText(values: string[] | undefined) {
    return (values ?? []).join('\n---\n');
  }

  function parseSectionText(value: string) {
    return value
      .split(/\n-{3,}\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function loadCharacterDraft(character?: Character) {
    characterDraftId = character?.id ?? '';
    characterDraftName = character?.name ?? '';
    characterDraftDescription = character?.description ?? '';
    characterDraftPersonality = character?.personality ?? '';
    characterDraftScenario = character?.scenario ?? '';
    characterDraftFirstMessage = character?.firstMessage ?? '';
    characterDraftAlternateGreetings = sectionText(character?.alternateGreetings);
    characterDraftExampleMessages = character?.exampleMessages ?? '';
    characterDraftSystemPrompt = character?.systemPrompt ?? '';
    characterDraftPostHistoryInstructions = character?.postHistoryInstructions ?? '';
    characterDraftCreatorNotes = character?.creatorNotes ?? '';
    characterDraftTags = keywordText(character?.tags ?? []);
    characterDraftCreator = character?.creator ?? '';
    characterDraftCharacterVersion = character?.characterVersion ?? '';
    characterDraftTalkativeness = numberToDraft(character?.talkativeness);
    characterDraftFavorite = character?.favorite ?? false;
  }

  function resetNewCharacterDraft() {
    newCharacterName = '';
    newCharacterDescription = '';
    newCharacterPersonality = '';
    newCharacterScenario = '';
    newCharacterFirstMessage = '';
    newCharacterAlternateGreetings = '';
    newCharacterExampleMessages = '';
    newCharacterSystemPrompt = '';
    newCharacterPostHistoryInstructions = '';
    newCharacterCreatorNotes = '';
    newCharacterTags = '';
    newCharacterCreator = '';
    newCharacterCharacterVersion = '';
    newCharacterTalkativeness = '';
    newCharacterFavorite = false;
  }

  function startCharacterCreate() {
    characterPanelMode = 'create';
    characterEditorTab = 'core';
    resetNewCharacterDraft();
  }

  function selectCharacter(character: Character) {
    activeCharacterId = character.id;
    characterPanelMode = 'edit';
  }

  function worldBookLine(worldBook: WorldBook) {
    if (worldBook.metadata?.source === 'character-card') {
      return `${worldBook.entries.length} entries · bound to ${worldBook.metadata.characterName ?? 'character'}`;
    }
    return `${worldBook.entries.length} entries`;
  }

  function worldBookStats(entries: WorldBookEntry[]) {
    const enabled = entries.filter((entry) => entry.enabled !== false).length;
    const constant = entries.filter((entry) => entry.constant).length;
    const regex = entries.filter((entry) => entry.extensions.use_regex === true).length;
    return { total: entries.length, enabled, constant, regex };
  }

  function entryTitle(entry?: WorldBookEntry) {
    if (!entry) return 'No entry';
    return entry.comment.trim() || entry.keys[0] || entry.id;
  }

  function entryTokenEstimate(entry?: WorldBookEntry) {
    if (!entry?.content) return '-';
    return `~${Math.max(1, Math.ceil(entry.content.length / 4))}`;
  }

  function entryStatus(entry: WorldBookEntry) {
    if (entry.enabled === false) return 'disabled';
    if (entry.constant) return 'constant';
    return 'normal';
  }

  function entryStatusLabel(entry: WorldBookEntry) {
    const status = entryStatus(entry);
    if (status === 'disabled') return 'Disabled';
    if (status === 'constant') return 'Constant';
    return 'Normal';
  }

  function entryMetaLine(entry: WorldBookEntry) {
    const parts = [
      entry.position === 'depth' ? `@${entry.depth} ${entry.role}` : entry.position,
      `order ${entry.order}`,
      `${entry.probability}%`,
      entry.selective ? 'selective' : '',
      entry.extensions.use_regex === true ? 'regex' : ''
    ].filter(Boolean);
    return parts.join(' · ');
  }

  function filterWorldBookEntries(entries: WorldBookEntry[], query: string, sortMode: string) {
    const text = query.trim().toLowerCase();
    const filtered = text
      ? entries.filter((entry) => [entry.comment, entry.content, entry.keys.join(' '), entry.secondaryKeys.join(' ')].join(' ').toLowerCase().includes(text))
      : entries;

    return [...filtered].sort((a, b) => {
      if (sortMode === 'order-asc') return a.order - b.order || a.id.localeCompare(b.id);
      if (sortMode === 'title-asc') return entryTitle(a).localeCompare(entryTitle(b));
      if (sortMode === 'title-desc') return entryTitle(b).localeCompare(entryTitle(a));
      if (sortMode === 'depth-asc') return a.depth - b.depth || b.order - a.order;
      if (sortMode === 'probability-desc') return b.probability - a.probability || b.order - a.order;
      return b.order - a.order || a.id.localeCompare(b.id);
    });
  }

  function keywordText(values: string[]) {
    return values.join(', ');
  }

  function parseKeywordText(value: string) {
    return value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function loadWorldBookDraft(worldBook?: WorldBook) {
    worldBookDraftId = worldBook?.id ?? '';
    worldBookDraftName = worldBook?.name ?? '';
    worldBookDraftEntries = structuredClone(worldBook?.entries ?? []);
    activeWorldBookEntryId = worldBookDraftEntries[0]?.id ?? '';
    worldBookEntryQuery = '';
  }

  function createWorldBookEntry(worldBookId: string): WorldBookEntry {
    const id = crypto.randomUUID();
    return {
      id,
      worldBookId,
      keys: [],
      secondaryKeys: [],
      comment: 'New Entry',
      content: '',
      constant: false,
      selective: false,
      enabled: true,
      order: Math.max(100, ...worldBookDraftEntries.map((entry) => entry.order + 1)),
      position: 'before',
      depth: 4,
      role: 'system',
      probability: 100,
      extensions: { useProbability: true }
    };
  }

  function updateWorldBookEntry(id: string, patch: Partial<WorldBookEntry>) {
    worldBookDraftEntries = worldBookDraftEntries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
  }

  function updateWorldBookEntryExtension(id: string, key: string, value: unknown) {
    worldBookDraftEntries = worldBookDraftEntries.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            extensions: {
              ...entry.extensions,
              [key]: value
            }
          }
        : entry
    );
  }

  function setWorldBookEntryState(entry: WorldBookEntry, state: 'normal' | 'constant' | 'disabled') {
    updateWorldBookEntry(entry.id, {
      enabled: state !== 'disabled',
      constant: state === 'constant'
    });
  }

  function addWorldBookEntry() {
    if (!worldBookDraftId) return;
    const entry = createWorldBookEntry(worldBookDraftId);
    worldBookDraftEntries = [entry, ...worldBookDraftEntries];
    activeWorldBookEntryId = entry.id;
    worldBookEntryQuery = '';
  }

  function duplicateWorldBookEntry(entry: WorldBookEntry | undefined = activeWorldBookEntry) {
    if (!entry) return;
    const copy = {
      ...structuredClone(entry),
      id: crypto.randomUUID(),
      comment: `${entryTitle(entry)} Copy`,
      order: entry.order + 1
    };
    const index = worldBookDraftEntries.findIndex((item) => item.id === entry.id);
    worldBookDraftEntries = [...worldBookDraftEntries.slice(0, index + 1), copy, ...worldBookDraftEntries.slice(index + 1)];
    activeWorldBookEntryId = copy.id;
  }

  function removeWorldBookEntry(entry: WorldBookEntry | undefined = activeWorldBookEntry) {
    if (!entry) return;
    worldBookDraftEntries = worldBookDraftEntries.filter((item) => item.id !== entry.id);
    activeWorldBookEntryId = worldBookDraftEntries[0]?.id ?? '';
  }

  function moveWorldBookEntryOrder(entry: WorldBookEntry | undefined, delta: number) {
    if (!entry) return;
    updateWorldBookEntry(entry.id, { order: Math.max(0, entry.order + delta) });
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

  function samplerVisibility(fields: Set<SamplerField>) {
    return Object.fromEntries(samplerFieldList.map((field) => [field, fields.has(field)])) as Record<SamplerField, boolean>;
  }

  function samplerFieldsForDraft(): Set<SamplerField> {
    if (profileDraftProviderType === 'gemini') return geminiSamplerFields;
    return profileDraftOpenAICompatibility === 'extended' ? openAIExtendedSamplerFields : openAIStrictSamplerFields;
  }

  function samplerFieldVisible(field: SamplerField) {
    return samplerFieldsForDraft().has(field);
  }

  function positiveDraftNumber(value: string, options: { allowZero?: boolean; skipOne?: boolean } = {}) {
    const parsed = optionalNumber(value);
    if (parsed === undefined) return undefined;
    if (parsed < 0) return undefined;
    if (!options.allowZero && parsed === 0) return undefined;
    if (options.skipOne && parsed === 1) return undefined;
    return parsed;
  }

  function samplerDraftNumber(field: SamplerField, value: string) {
    if (!samplerFieldVisible(field)) return undefined;
    if (field === 'temperature') return positiveDraftNumber(value, { allowZero: true });
    if (field === 'topP') return positiveDraftNumber(value, { allowZero: true });
    if (field === 'frequencyPenalty' || field === 'presencePenalty') {
      const parsed = optionalNumber(value);
      return parsed === undefined || parsed === 0 ? undefined : parsed;
    }
    if (field === 'repetitionPenalty') return positiveDraftNumber(value, { skipOne: true });
    if (field === 'seed') return optionalInteger(value);
    if (field === 'topK' || field === 'n') {
      const parsed = optionalInteger(value);
      if (parsed === undefined || parsed <= 0 || (field === 'n' && parsed === 1)) return undefined;
      return parsed;
    }
    return positiveDraftNumber(value);
  }

  function nonNegativeIntegerDraft(value: string) {
    const parsed = optionalNumber(value);
    if (parsed === undefined || !Number.isInteger(parsed) || parsed < 0) return undefined;
    return parsed;
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
      profileDraftOpenAIReasoningEffort = 'default';
      profileDraftGeminiIncludeThoughts = false;
      profileDraftGeminiThinkingMode = 'default';
      profileDraftGeminiThinkingBudget = '';
      profileDraftGeminiThinkingLevel = 'medium';
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
    profileDraftOpenAIReasoningEffort = profile.thinking?.openai?.effort ?? 'default';
    profileDraftGeminiIncludeThoughts = profile.thinking?.gemini?.includeThoughts === true;
    profileDraftGeminiThinkingMode = profile.thinking?.gemini?.mode ?? 'default';
    profileDraftGeminiThinkingBudget = numberToDraft(profile.thinking?.gemini?.budget);
    profileDraftGeminiThinkingLevel = profile.thinking?.gemini?.level ?? 'medium';
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
      ['temperature', samplerDraftNumber('temperature', profileDraftTemperature)],
      ['topP', samplerDraftNumber('topP', profileDraftTopP)],
      ['topK', samplerDraftNumber('topK', profileDraftTopK)],
      ['topA', samplerDraftNumber('topA', profileDraftTopA)],
      ['minP', samplerDraftNumber('minP', profileDraftMinP)],
      ['frequencyPenalty', samplerDraftNumber('frequencyPenalty', profileDraftFrequencyPenalty)],
      ['presencePenalty', samplerDraftNumber('presencePenalty', profileDraftPresencePenalty)],
      ['repetitionPenalty', samplerDraftNumber('repetitionPenalty', profileDraftRepetitionPenalty)],
      ['maxTokens', samplerDraftNumber('maxTokens', profileDraftMaxTokens)],
      ['contextTokens', samplerDraftNumber('contextTokens', profileDraftContextTokens)],
      ['seed', samplerDraftNumber('seed', profileDraftSeed)],
      ['n', samplerDraftNumber('n', profileDraftN)]
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

  function profileDraftThinking(): Profile['thinking'] {
    const budget = nonNegativeIntegerDraft(profileDraftGeminiThinkingBudget);
    return {
      openai: {
        effort: profileDraftOpenAIReasoningEffort
      },
      gemini: {
        includeThoughts: profileDraftGeminiIncludeThoughts,
        mode: profileDraftGeminiThinkingMode,
        ...(budget !== undefined ? { budget } : {}),
        level: profileDraftGeminiThinkingLevel
      }
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
      thinking: profileDraftThinking(),
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
    rememberConversation(conversation);
    if (activeCharacter?.firstMessage && messages.length === 0) {
      messages = [{ role: 'assistant', name: activeCharacter.name, content: renderCharacterTemplate(activeCharacter.firstMessage) }];
    }
    return activeConversationId;
  }

  async function loadConversation(id: string) {
    openingPreviewCharacterId = '';
    activeView = 'chat';
    await refreshConversationState(id, { close: true });
  }

  async function renameConversation(event: MouseEvent, conversation: Conversation) {
    event.stopPropagation();
    const title = window.prompt('Rename chat', conversation.title)?.trim();
    if (!title || title === conversation.title) return;
    const updated = await fetchJson<Conversation>('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rename',
        conversationId: conversation.id,
        title
      })
    });
    rememberConversation(updated);
  }

  async function archiveConversation(event: MouseEvent, conversation: Conversation) {
    event.stopPropagation();
    const archived = !conversation.archivedAt;
    const updated = await fetchJson<Conversation>('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'archive',
        conversationId: conversation.id,
        archived
      })
    });
    rememberConversation(updated);
  }

  async function deleteConversation(event: MouseEvent, conversation: Conversation) {
    event.stopPropagation();
    if (!window.confirm(`Delete "${conversation.title}"? This cannot be undone.`)) return;
    await fetchJson<{ deleted: boolean; id: string }>(`/api/conversations?id=${encodeURIComponent(conversation.id)}`, {
      method: 'DELETE'
    });
    conversations = conversations.filter((item) => item.id !== conversation.id);
    if (activeConversationId === conversation.id) {
      activeConversationId = '';
      openingPreviewCharacterId = '';
      messages = [];
      activeView = 'chat';
    }
  }

  async function sendMessage() {
    if (isGenerating) {
      stopGeneration();
      return;
    }

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
    await streamGeneration({
      conversationId,
      profileId: activeProfileId || undefined,
      characterId: activeCharacterId || undefined,
      personaId: activePersonaId || undefined,
      message: content
    });
  }

  async function streamGeneration(body: Record<string, unknown>) {
    status = 'Generating';
    const controller = new AbortController();
    generationAbortController = controller;
    let completedConversationId = typeof body.conversationId === 'string' ? body.conversationId : '';

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.body || !response.ok) {
        const errorMessage = await responseErrorMessage(response);
        replaceAssistantDraft(`Provider error: ${errorMessage}`);
        status = 'Provider error';
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const consumeLine = (line: string) => {
        const event = parseGenerationStreamLine(line);
        if (event.type === 'thinking') appendAssistantDraftThinking(event.text ?? '');
        if (event.type === 'text') appendAssistantDraftText(event.text ?? '');
        if (event.type === 'done') completedConversationId = event.conversationId ?? completedConversationId;
        if (event.type === 'error') {
          replaceAssistantDraft(`Generation error: ${event.text ?? 'Unknown error'}`);
          status = 'Generation error';
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          consumeLine(line);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) {
        consumeLine(buffer);
      }
      status = controller.signal.aborted ? 'Stopped' : 'Ready';
      if (!controller.signal.aborted && completedConversationId) {
        await refreshConversationState(completedConversationId);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        removeEmptyAssistantDraft();
        status = 'Stopped';
      } else {
        replaceAssistantDraft(`Generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        status = 'Generation error';
      }
    } finally {
      if (generationAbortController === controller) {
        generationAbortController = null;
      }
    }
  }

  async function responseErrorMessage(response: Response) {
    const fallback = `${response.status} ${response.statusText}`.trim();
    const text = await response.text();
    if (!text) return fallback;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
      return parsed.error?.message ?? parsed.message ?? text;
    } catch {
      return text;
    }
  }

  function parseGenerationStreamLine(line: string): GenerationStreamEvent {
    const text = line.trim();
    if (!text) return { type: 'done', text: '' };
    try {
      const parsed = JSON.parse(text) as GenerationStreamEvent;
      if (parsed.type === 'text' || parsed.type === 'thinking' || parsed.type === 'inspector' || parsed.type === 'done' || parsed.type === 'error') {
        return parsed;
      }
    } catch {
      return { type: 'text', text: line };
    }
    return { type: 'text', text: line };
  }

  function appendAssistantDraftText(content: string) {
    if (!content) return;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      const next = [...messages];
      next[next.length - 1] = { ...last, content: `${last.content}${content}` };
      messages = next;
      return;
    }
    messages = [...messages, { role: 'assistant', name: activeCharacter?.name, content }];
  }

  function appendAssistantDraftThinking(thinking: string) {
    if (!thinking) return;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      const next = [...messages];
      next[next.length - 1] = { ...last, thinking: `${last.thinking ?? ''}${thinking}` };
      messages = next;
      return;
    }
    messages = [...messages, { role: 'assistant', name: activeCharacter?.name, content: '', thinking }];
  }

  function replaceAssistantDraft(content: string) {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      const next = [...messages];
      next[next.length - 1] = { ...last, content, thinking: '' };
      messages = next;
      return;
    }
    messages = [...messages, { role: 'assistant', name: activeCharacter?.name, content }];
  }

  function removeEmptyAssistantDraft() {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && !last.content.trim() && !last.thinking?.trim()) {
      messages = messages.slice(0, -1);
    }
  }

  function stopGeneration() {
    generationAbortController?.abort();
    status = 'Stopping';
  }

  async function switchMessageSibling(message: ChatMessage, direction: 'left' | 'right') {
    const nodeId = message.branch?.nodeId ?? message.id;
    if (!nodeId || isGenerating) return;
    const conversation = await fetchJson<Conversation>('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'switch-sibling',
        messageId: nodeId,
        direction
      })
    });
    activeConversationId = conversation.id;
    messages = conversation.messages ?? [];
    rememberConversation(conversation);
  }

  async function regenerateAssistantSibling(message: ChatMessage) {
    const nodeId = message.branch?.nodeId ?? message.id;
    if (!nodeId || !activeConversationId || isGenerating) return;
    const lastIndex = messages.findIndex((item) => (item.branch?.nodeId ?? item.id) === nodeId);
    if (lastIndex >= 0) {
      messages = [...messages.slice(0, lastIndex), { role: 'assistant', name: activeCharacter?.name, content: '' }];
    }
    await streamGeneration({
      conversationId: activeConversationId,
      profileId: activeProfileId || undefined,
      characterId: activeCharacterId || undefined,
      personaId: activePersonaId || undefined,
      regenerateNodeId: nodeId
    });
  }

  async function nextMessageBranch(message: ChatMessage) {
    const branch = message.branch;
    if (!branch) return;
    if (branch.current < branch.total) {
      await switchMessageSibling(message, 'right');
      return;
    }
    if (message.role === 'assistant' && branch.isLatest) {
      await regenerateAssistantSibling(message);
    }
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
    const body = await response.text();
    const inspectorEvent = body
      .split(/\r?\n/)
      .map(parseGenerationStreamLine)
      .find((event) => event.type === 'inspector');
    inspector = inspectorEvent?.text ?? body;
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

  function messageDisplayContent(message: ChatMessage, index: number) {
    const placement = messageRegexPlacement(message);
    if (placement === undefined) return renderMessageMarkdown(message.content);
    const options = {
      placement,
      isMarkdown: true,
      depth: messages.length - index,
      macros: messageRegexMacros()
    };
    const roleDisplay = applyRegexScripts(message.content, activeDisplayRegexScripts(), options);
    const markdown = applyRegexScripts(roleDisplay, activeDisplayRegexScripts(), {
      ...options,
      placement: REGEX_PLACEMENT.MD_DISPLAY
    });
    return renderMessageMarkdown(markdown);
  }

  function thinkingDisplayContent(message: ChatMessage, index: number) {
    const content = message.thinking ?? '';
    const options = {
      placement: REGEX_PLACEMENT.REASONING,
      isMarkdown: true,
      depth: messages.length - index,
      macros: messageRegexMacros()
    };
    const thinkingDisplay = applyRegexScripts(content, activeDisplayRegexScripts(), options);
    const markdown = applyRegexScripts(thinkingDisplay, activeDisplayRegexScripts(), {
      ...options,
      placement: REGEX_PLACEMENT.MD_DISPLAY
    });
    return renderMessageMarkdown(markdown);
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

  function openCharacterAvatar(character: Character | undefined = activeCharacter) {
    if (!character) return;
    const src = characterAvatarUrl(character);
    const key = `character:${character.id}:${src}`;
    if (zoomedAvatar?.key === key) {
      zoomedAvatar = null;
      return;
    }
    zoomedAvatar = {
      key,
      name: character.name,
      role: 'assistant',
      src,
      initials: characterInitials(character)
    };
  }

  function openCharacterImport() {
    importKind = 'character-card-png';
    importName = '';
    importText = '';
    importFileName = '';
    importFileBase64 = '';
    activeDrawer = 'import';
  }

  function startChatWithCharacter(character: Character | undefined = activeCharacter) {
    if (!character) return;
    activeCharacterId = character.id;
    activeConversationId = '';
    openingPreviewCharacterId = '';
    messages = [];
    activeView = 'chat';
    closeDrawer();
  }

  function openCharacterWorldBooks(character: Character | undefined = activeCharacter) {
    const firstWorldBook = boundWorldBooksForCharacter(character)[0];
    if (firstWorldBook) {
      activeWorldBookId = firstWorldBook.id;
    }
    activeView = 'worldbooks';
    activeDrawer = 'worldbooks';
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
      body: JSON.stringify({
        name,
        description: newCharacterDescription.trim(),
        personality: newCharacterPersonality.trim(),
        scenario: newCharacterScenario.trim(),
        firstMessage: newCharacterFirstMessage.trim(),
        alternateGreetings: parseSectionText(newCharacterAlternateGreetings),
        exampleMessages: newCharacterExampleMessages.trim(),
        systemPrompt: newCharacterSystemPrompt.trim(),
        postHistoryInstructions: newCharacterPostHistoryInstructions.trim(),
        creatorNotes: newCharacterCreatorNotes.trim(),
        tags: parseKeywordText(newCharacterTags),
        creator: newCharacterCreator.trim(),
        characterVersion: newCharacterCharacterVersion.trim(),
        talkativeness: optionalNumber(newCharacterTalkativeness),
        favorite: newCharacterFavorite
      })
    });
    characters = [...characters, character];
    activeCharacterId = character.id;
    characterPanelMode = 'edit';
    loadCharacterDraft(character);
    resetNewCharacterDraft();
    status = 'Ready';
  }

  async function saveActiveCharacter() {
    if (!activeCharacter) return;
    const name = characterDraftName.trim();
    if (!name) return;
    status = 'Saving';
    const character = await fetchJson<Character>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...activeCharacter,
        name,
        description: characterDraftDescription.trim(),
        personality: characterDraftPersonality.trim(),
        scenario: characterDraftScenario.trim(),
        firstMessage: characterDraftFirstMessage.trim(),
        alternateGreetings: parseSectionText(characterDraftAlternateGreetings),
        exampleMessages: characterDraftExampleMessages.trim(),
        systemPrompt: characterDraftSystemPrompt.trim(),
        postHistoryInstructions: characterDraftPostHistoryInstructions.trim(),
        creatorNotes: characterDraftCreatorNotes.trim(),
        tags: parseKeywordText(characterDraftTags),
        creator: characterDraftCreator.trim(),
        characterVersion: characterDraftCharacterVersion.trim(),
        talkativeness: optionalNumber(characterDraftTalkativeness),
        favorite: characterDraftFavorite,
        updatedAt: Date.now()
      })
    });
    characters = characters.map((item) => (item.id === character.id ? character : item));
    activeCharacterId = character.id;
    loadCharacterDraft(character);
    status = 'Ready';
  }

  async function toggleCharacterFavorite(character: Character | undefined = activeCharacter) {
    if (!character) return;
    status = 'Saving';
    const saved = await fetchJson<Character>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...character,
        favorite: !character.favorite,
        updatedAt: Date.now()
      })
    });
    characters = characters.map((item) => (item.id === saved.id ? saved : item));
    if (activeCharacterId === saved.id) {
      loadCharacterDraft(saved);
    }
    status = 'Ready';
  }

  async function duplicateActiveCharacter() {
    if (!activeCharacter) return;
    status = 'Saving';
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, characterBook: _characterBook, ...rest } = structuredClone(activeCharacter);
    const character = await fetchJson<Character>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...rest,
        name: `${activeCharacter.name} Copy`,
        favorite: false,
        worldBookIds: boundWorldBooksForCharacter(activeCharacter).map((worldBook) => worldBook.id)
      })
    });
    characters = [...characters, character];
    activeCharacterId = character.id;
    loadCharacterDraft(character);
    status = 'Ready';
  }

  async function deleteActiveCharacter() {
    if (!activeCharacter) return;
    const character = activeCharacter;
    if (!confirm(`Delete character "${character.name}"?`)) return;
    status = 'Deleting';
    await fetchJson<{ deleted: boolean }>('/api/characters', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: character.id })
    });
    const index = characters.findIndex((item) => item.id === character.id);
    const remaining = characters.filter((item) => item.id !== character.id);
    characters = remaining;
    activeCharacterId = remaining[Math.min(index, remaining.length - 1)]?.id ?? '';
    if (openingPreviewCharacterId === character.id) {
      openingPreviewCharacterId = '';
      messages = [];
    }
    if (zoomedAvatar?.key.startsWith(`character:${character.id}:`)) {
      zoomedAvatar = null;
    }
    loadCharacterDraft(characters.find((item) => item.id === activeCharacterId));
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
    activeWorldBookId = worldBook.id;
    newWorldBookName = '';
    loadWorldBookDraft(worldBook);
    status = 'Ready';
  }

  async function saveActiveWorldBook() {
    if (!activeWorldBook || !worldBookDraftName.trim()) return;
    status = 'Saving';
    const payload: WorldBook = {
      ...activeWorldBook,
      name: worldBookDraftName.trim(),
      entries: worldBookDraftEntries.map((entry) => ({
        ...entry,
        worldBookId: activeWorldBook.id,
        keys: entry.keys.filter(Boolean),
        secondaryKeys: entry.secondaryKeys.filter(Boolean),
        comment: entry.comment ?? '',
        content: entry.content ?? '',
        order: Number.isFinite(entry.order) ? entry.order : 100,
        depth: Number.isFinite(entry.depth) ? entry.depth : 4,
        probability: Math.min(100, Math.max(0, Number.isFinite(entry.probability) ? entry.probability : 100)),
        extensions: entry.extensions ?? {}
      }))
    };
    const saved = await fetchJson<WorldBook>('/api/worldbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    worldBooks = worldBooks.map((worldBook) => (worldBook.id === saved.id ? saved : worldBook));
    activeWorldBookId = saved.id;
    loadWorldBookDraft(saved);
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
              {#if message.role === 'assistant' && message.thinking?.trim()}
                <details class="thinking-block">
                  <summary>
                    <span>Thinking</span>
                  </summary>
                  <div class="thinking-block-content rich">{@html thinkingDisplayContent(message, index)}</div>
                </details>
              {/if}
              {#if message.content.trim() || !message.thinking?.trim()}
                <div class="message-content rich">{@html messageDisplayContent(message, index)}</div>
              {/if}
              {#if message.branch && (message.branch.total > 1 || (message.role === 'assistant' && message.branch.isLatest))}
                <div class="branch-controls" aria-label="Message branches">
                  <button
                    type="button"
                    title="Previous branch"
                    aria-label="Previous branch"
                    disabled={isGenerating || message.branch.current <= 1}
                    on:click={() => switchMessageSibling(message, 'left')}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span>{message.branch.current}/{message.branch.total}</span>
                  <button
                    type="button"
                    title={message.branch.current < message.branch.total ? 'Next branch' : 'Regenerate branch'}
                    aria-label={message.branch.current < message.branch.total ? 'Next branch' : 'Regenerate branch'}
                    disabled={isGenerating || (message.branch.current >= message.branch.total && !(message.role === 'assistant' && message.branch.isLatest))}
                    on:click={() => nextMessageBranch(message)}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    </div>

    <form class="composer" on:submit|preventDefault={sendMessage}>
      <textarea bind:value={input} rows="3" placeholder="Message"></textarea>
      <button
        class="composer-action"
        class:stopping={isGenerating}
        type={isGenerating ? 'button' : 'submit'}
        title={isGenerating ? 'Stop generation' : 'Send message'}
        aria-label={isGenerating ? 'Stop generation' : 'Send message'}
        disabled={!isGenerating && !input.trim()}
        on:click={() => {
          if (isGenerating) stopGeneration();
        }}
      >
        {#if isGenerating}
          <CircleStop size={20} />
        {:else}
          <Send size={20} />
        {/if}
      </button>
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
    <aside
      class="drawer"
      class:right={drawerIsRight}
      class:characters={activeDrawer === 'characters'}
      class:profiles={activeDrawer === 'profiles'}
      class:worldbooks={activeDrawer === 'worldbooks'}
      aria-label={drawerTitle}
    >
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
          <label class="search-field">
            <Search size={15} />
            <input bind:value={conversationQuery} placeholder="Search chats" aria-label="Search chats" />
          </label>
          <label class="checkbox-row compact">
            <input type="checkbox" checked={showArchivedConversations} on:change={toggleArchivedConversations} />
            <span>Show archived chats</span>
          </label>
        </div>
        <div class="conversation-list">
          {#if conversationGroups.length === 0}
            <div class="drawer-empty compact">No chats found.</div>
          {/if}
          {#each conversationGroups as group}
            <section class="conversation-group" aria-label={group.label}>
              <header>
                <span class="conversation-group-avatar">
                  {#if group.avatarUrl}
                    <img src={group.avatarUrl} alt="" />
                  {:else}
                    <Bot size={15} />
                  {/if}
                </span>
                <strong>{group.label}</strong>
                <small>{group.count}</small>
              </header>
              <div class="conversation-group-items">
                {#each group.conversations as conversation}
                  <article class="conversation-row" class:active={conversation.id === activeConversationId} class:archived={Boolean(conversation.archivedAt)}>
                    <button class="conversation-row-main" type="button" on:click={() => loadConversation(conversation.id)}>
                      <span class="conversation-title-line">
                        <strong>{conversation.title}</strong>
                        <small>{conversationUpdatedLabel(conversation)}</small>
                      </span>
                      <span>{conversationPreview(conversation)}</span>
                      <small>{conversationSummary(conversation)}</small>
                    </button>
                    <div class="conversation-row-actions">
                      <button type="button" title="Rename chat" aria-label="Rename chat" on:click={(event) => renameConversation(event, conversation)}>
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title={conversation.archivedAt ? 'Restore chat' : 'Archive chat'}
                        aria-label={conversation.archivedAt ? 'Restore chat' : 'Archive chat'}
                        on:click={(event) => archiveConversation(event, conversation)}
                      >
                        {#if conversation.archivedAt}
                          <ArchiveRestore size={14} />
                        {:else}
                          <Archive size={14} />
                        {/if}
                      </button>
                      <button class="danger" type="button" title="Delete chat" aria-label="Delete chat" on:click={(event) => deleteConversation(event, conversation)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                {/each}
              </div>
            </section>
          {/each}
        </div>
      {:else if activeDrawer === 'characters'}
        <div class="character-workspace">
          <section class="character-library" aria-label="Character library">
            <div class="character-library-actions">
              <button class="primary" type="button" on:click={startCharacterCreate}>
                <Plus size={16} />New
              </button>
              <button class="secondary" type="button" on:click={openCharacterImport}>
                <FileInput size={16} />Import
              </button>
            </div>

            <div class="character-toolbar">
              <input class="profile-search" bind:value={characterQuery} placeholder="Search characters" aria-label="Search characters" />
              <select bind:value={characterSortMode} aria-label="Sort characters">
                {#each characterSortModes as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>

            <div class="character-list" aria-label="Characters">
              {#each filteredCharacters as character}
                <article class="character-row" class:active={character.id === activeCharacterId}>
                  <button class="character-row-main" type="button" on:click={() => selectCharacter(character)}>
                    <span class="character-avatar-small">
                      {#if characterAvatarUrl(character)}
                        <img src={characterAvatarUrl(character)} alt={`${character.name} avatar`} />
                      {:else}
                        <span>{characterInitials(character)}</span>
                      {/if}
                    </span>
                    <span class="character-row-copy">
                      <strong>{character.name}</strong>
                      <small>{characterListLine(character)}</small>
                    </span>
                  </button>
                  <button
                    class="favorite-button"
                    class:active={character.favorite}
                    type="button"
                    on:click={() => toggleCharacterFavorite(character)}
                    title={character.favorite ? 'Unfavorite' : 'Favorite'}
                    aria-label={`${character.favorite ? 'Unfavorite' : 'Favorite'} ${character.name}`}
                  >
                    <Star size={15} fill={character.favorite ? 'currentColor' : 'none'} />
                  </button>
                </article>
              {:else}
                <div class="drawer-empty compact">No matching characters</div>
              {/each}
            </div>
          </section>

          {#if characterPanelMode === 'create'}
            <form class="character-editor character-editor-create" on:submit|preventDefault={createCharacter}>
              <header class="character-editor-hero">
                <div class="character-avatar-large placeholder-avatar" aria-hidden="true">
                  <Image size={28} />
                </div>

                <div class="character-hero-copy">
                  <div class="character-hero-title">
                    <div>
                      <strong>{newCharacterName.trim() || 'New Character'}</strong>
                      <span>NanKe native draft</span>
                    </div>
                    <button
                      class="favorite-button hero-favorite"
                      class:active={newCharacterFavorite}
                      type="button"
                      on:click={() => (newCharacterFavorite = !newCharacterFavorite)}
                      title={newCharacterFavorite ? 'Unfavorite' : 'Favorite'}
                      aria-label="Toggle favorite"
                    >
                      <Star size={16} fill={newCharacterFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div class="character-chips" aria-label="New character statistics">
                    <span>{createCharacterStats.tokens} tokens</span>
                    <span>{createCharacterStats.greetings} greetings</span>
                    <span>{createCharacterStats.tags} tags</span>
                    {#if createCharacterStats.overrides}
                      <span>{createCharacterStats.overrides} overrides</span>
                    {/if}
                  </div>
                </div>

                <div class="character-actions">
                  <button class="tool-button" type="button" on:click={openCharacterImport} title="Import character card" aria-label="Import character card">
                    <FileInput size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={resetNewCharacterDraft} title="Reset draft" aria-label="Reset draft">
                    <RotateCcw size={16} />
                  </button>
                  <button class="tool-button" type="submit" title="Create character" aria-label="Create character" disabled={!newCharacterName.trim()}>
                    <Save size={16} />
                  </button>
                </div>
              </header>

              <nav class="character-tabs" aria-label="New character sections">
                <button class:active={characterEditorTab === 'core'} type="button" on:click={() => (characterEditorTab = 'core')}>Core</button>
                <button class:active={characterEditorTab === 'prompt'} type="button" on:click={() => (characterEditorTab = 'prompt')}>Prompt</button>
                <button class:active={characterEditorTab === 'lore'} type="button" on:click={() => (characterEditorTab = 'lore')}>Lore</button>
                <button class:active={characterEditorTab === 'metadata'} type="button" on:click={() => (characterEditorTab = 'metadata')}>Metadata</button>
              </nav>

              {#if characterEditorTab === 'core'}
                <section class="character-editor-section">
                  <div class="character-field-grid">
                    <label>
                      <span>Name</span>
                      <input bind:value={newCharacterName} placeholder="Character name" />
                    </label>
                    <label>
                      <span>Tags</span>
                      <input bind:value={newCharacterTags} placeholder="Comma or newline separated" />
                    </label>
                    <label class="span-2">
                      <span>Description</span>
                      <textarea bind:value={newCharacterDescription} rows="8" placeholder="Physical and mental traits"></textarea>
                    </label>
                    <label>
                      <span>Personality</span>
                      <textarea bind:value={newCharacterPersonality} rows="5" placeholder="Personality notes"></textarea>
                    </label>
                    <label>
                      <span>Scenario</span>
                      <textarea bind:value={newCharacterScenario} rows="5" placeholder="Scene and relationship context"></textarea>
                    </label>
                    <label class="span-2">
                      <span>First Message</span>
                      <textarea bind:value={newCharacterFirstMessage} rows="6" placeholder="Opening message"></textarea>
                    </label>
                    <label class="span-2">
                      <span>Alternate Greetings</span>
                      <textarea bind:value={newCharacterAlternateGreetings} rows="5" placeholder="Separate greetings with a line containing ---"></textarea>
                    </label>
                  </div>
                </section>
              {:else if characterEditorTab === 'prompt'}
                <section class="character-editor-section">
                  <div class="character-field-grid">
                    <label class="span-2">
                      <span>System Prompt Override</span>
                      <textarea bind:value={newCharacterSystemPrompt} rows="7" placeholder="Character-level system prompt"></textarea>
                    </label>
                    <label class="span-2">
                      <span>Post-History Instructions</span>
                      <textarea bind:value={newCharacterPostHistoryInstructions} rows="7" placeholder="Instructions injected after chat history"></textarea>
                    </label>
                    <label class="span-2">
                      <span>Example Messages</span>
                      <textarea bind:value={newCharacterExampleMessages} rows="9" placeholder="Example dialogue"></textarea>
                    </label>
                  </div>
                </section>
              {:else if characterEditorTab === 'lore'}
                <section class="character-editor-section">
                  <div class="character-lore-header">
                    <div>
                      <strong>Character Lore</strong>
                      <span>0 bound world books</span>
                    </div>
                    <button class="secondary" type="button" on:click={openCharacterImport}>
                      <FileInput size={16} />Import
                    </button>
                  </div>

                  <label class="character-textarea-label">
                    <span>Creator Notes</span>
                    <textarea bind:value={newCharacterCreatorNotes} rows="8" placeholder="Private author notes and card usage notes"></textarea>
                  </label>
                </section>
              {:else}
                <section class="character-editor-section">
                  <div class="character-field-grid">
                    <label>
                      <span>Creator</span>
                      <input bind:value={newCharacterCreator} placeholder="Creator" />
                    </label>
                    <label>
                      <span>Version</span>
                      <input bind:value={newCharacterCharacterVersion} placeholder="Character version" />
                    </label>
                    <label>
                      <span>Talkativeness</span>
                      <input bind:value={newCharacterTalkativeness} inputmode="decimal" placeholder="Optional" />
                    </label>
                    <div class="character-source-panel">
                      <span>Card Source</span>
                      <strong>NanKe native draft</strong>
                      <small>New character</small>
                    </div>
                  </div>
                </section>
              {/if}
            </form>
          {:else if activeCharacter}
            <form class="character-editor" on:submit|preventDefault={saveActiveCharacter}>
              <header class="character-editor-hero">
                <button class="character-avatar-large" type="button" on:click={() => openCharacterAvatar(activeCharacter)} title="Open avatar preview" aria-label={`Open avatar for ${activeCharacter.name}`}>
                  {#if characterAvatarUrl(activeCharacter)}
                    <img src={characterAvatarUrl(activeCharacter)} alt={`${activeCharacter.name} avatar`} />
                  {:else}
                    <span>{characterInitials(activeCharacter)}</span>
                  {/if}
                </button>

                <div class="character-hero-copy">
                  <div class="character-hero-title">
                    <div>
                      <strong>{activeCharacter.name}</strong>
                      <span>{characterOrigin(activeCharacter)}</span>
                    </div>
                    <button
                      class="favorite-button hero-favorite"
                      class:active={characterDraftFavorite}
                      type="button"
                      on:click={() => (characterDraftFavorite = !characterDraftFavorite)}
                      title={characterDraftFavorite ? 'Unfavorite on save' : 'Favorite on save'}
                      aria-label="Toggle favorite in draft"
                    >
                      <Star size={16} fill={characterDraftFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div class="character-chips" aria-label="Character statistics">
                    <span>{activeCharacterStats.tokens} tokens</span>
                    <span>{activeCharacterStats.greetings} greetings</span>
                    <span>{activeCharacterStats.worldBooks} lorebooks</span>
                    <span>{activeCharacterStats.tags} tags</span>
                    {#if activeCharacterStats.overrides}
                      <span>{activeCharacterStats.overrides} overrides</span>
                    {/if}
                  </div>
                </div>

                <div class="character-actions">
                  <button class="tool-button" type="button" on:click={() => startChatWithCharacter(activeCharacter)} title="Start chat" aria-label="Start chat">
                    <MessageCircle size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={openCharacterImport} title="Import character card" aria-label="Import character card">
                    <FileInput size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={duplicateActiveCharacter} title="Duplicate character" aria-label="Duplicate character">
                    <Copy size={16} />
                  </button>
                  <button class="tool-button danger" type="button" on:click={deleteActiveCharacter} title="Delete character" aria-label="Delete character">
                    <Trash2 size={16} />
                  </button>
                  <button class="tool-button" type="submit" title="Save character" aria-label="Save character">
                    <Save size={16} />
                  </button>
                </div>
              </header>

              <nav class="character-tabs" aria-label="Character editor sections">
                <button class:active={characterEditorTab === 'core'} type="button" on:click={() => (characterEditorTab = 'core')}>Core</button>
                <button class:active={characterEditorTab === 'prompt'} type="button" on:click={() => (characterEditorTab = 'prompt')}>Prompt</button>
                <button class:active={characterEditorTab === 'lore'} type="button" on:click={() => (characterEditorTab = 'lore')}>Lore</button>
                <button class:active={characterEditorTab === 'metadata'} type="button" on:click={() => (characterEditorTab = 'metadata')}>Metadata</button>
              </nav>

              {#if characterEditorTab === 'core'}
                <section class="character-editor-section">
                  <div class="character-field-grid">
                    <label>
                      <span>Name</span>
                      <input bind:value={characterDraftName} placeholder="Character name" />
                    </label>
                    <label>
                      <span>Tags</span>
                      <input bind:value={characterDraftTags} placeholder="Comma or newline separated" />
                    </label>
                    <label class="span-2">
                      <span>Description</span>
                      <textarea bind:value={characterDraftDescription} rows="8" placeholder="Physical and mental traits"></textarea>
                    </label>
                    <label>
                      <span>Personality</span>
                      <textarea bind:value={characterDraftPersonality} rows="5" placeholder="Personality notes"></textarea>
                    </label>
                    <label>
                      <span>Scenario</span>
                      <textarea bind:value={characterDraftScenario} rows="5" placeholder="Scene and relationship context"></textarea>
                    </label>
                    <label class="span-2">
                      <span>First Message</span>
                      <textarea bind:value={characterDraftFirstMessage} rows="6" placeholder="Opening message"></textarea>
                    </label>
                    <label class="span-2">
                      <span>Alternate Greetings</span>
                      <textarea bind:value={characterDraftAlternateGreetings} rows="5" placeholder="Separate greetings with a line containing ---"></textarea>
                    </label>
                  </div>
                </section>
              {:else if characterEditorTab === 'prompt'}
                <section class="character-editor-section">
                  <div class="character-field-grid">
                    <label class="span-2">
                      <span>System Prompt Override</span>
                      <textarea bind:value={characterDraftSystemPrompt} rows="7" placeholder="Character-level system prompt"></textarea>
                    </label>
                    <label class="span-2">
                      <span>Post-History Instructions</span>
                      <textarea bind:value={characterDraftPostHistoryInstructions} rows="7" placeholder="Instructions injected after chat history"></textarea>
                    </label>
                    <label class="span-2">
                      <span>Example Messages</span>
                      <textarea bind:value={characterDraftExampleMessages} rows="9" placeholder="Example dialogue"></textarea>
                    </label>
                  </div>
                </section>
              {:else if characterEditorTab === 'lore'}
                <section class="character-editor-section">
                  <div class="character-lore-header">
                    <div>
                      <strong>Character Lore</strong>
                      <span>{activeCharacterWorldBooks.length} bound world book{activeCharacterWorldBooks.length === 1 ? '' : 's'}</span>
                    </div>
                    <button class="secondary" type="button" on:click={() => openCharacterWorldBooks(activeCharacter)}>
                      <BookOpen size={16} />Open
                    </button>
                  </div>
                  {#if activeCharacterWorldBooks.length}
                    <div class="character-lore-list">
                      {#each activeCharacterWorldBooks as worldBook}
                        <button type="button" on:click={() => { activeWorldBookId = worldBook.id; activeView = 'worldbooks'; activeDrawer = 'worldbooks'; }}>
                          <BookOpen size={16} />
                          <span>
                            <strong>{worldBook.name}</strong>
                            <small>{worldBook.entries.length} entries · {worldBook.metadata?.source ?? 'native'}</small>
                          </span>
                        </button>
                      {/each}
                    </div>
                  {:else}
                    <div class="drawer-empty compact">No character-bound world book</div>
                  {/if}

                  <label class="character-textarea-label">
                    <span>Creator Notes</span>
                    <textarea bind:value={characterDraftCreatorNotes} rows="8" placeholder="Private author notes and card usage notes"></textarea>
                  </label>
                </section>
              {:else}
                <section class="character-editor-section">
                  <div class="character-field-grid">
                    <label>
                      <span>Creator</span>
                      <input bind:value={characterDraftCreator} placeholder="Creator" />
                    </label>
                    <label>
                      <span>Version</span>
                      <input bind:value={characterDraftCharacterVersion} placeholder="Character version" />
                    </label>
                    <label>
                      <span>Talkativeness</span>
                      <input bind:value={characterDraftTalkativeness} inputmode="decimal" placeholder="Optional" />
                    </label>
                    <div class="character-source-panel">
                      <span>Card Source</span>
                      <strong>{characterOrigin(activeCharacter)}</strong>
                      <small>{activeCharacter.id}</small>
                    </div>
                  </div>
                </section>
              {/if}
            </form>
          {:else}
            <section class="character-editor empty">
              <Image size={28} />
              <strong>Select or create a character</strong>
            </section>
          {/if}
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
        <div class="worldbook-workspace">
          <section class="worldbook-library" aria-label="World book library">
            <form class="worldbook-create" on:submit|preventDefault={createWorldBook}>
              <input bind:value={newWorldBookName} placeholder="New lorebook name" />
              <button class="primary" type="submit"><BookOpen size={16} />Create</button>
            </form>

            <div class="worldbook-list">
              {#each worldBooks as worldBook}
                <button
                  class="worldbook-row"
                  class:active={worldBook.id === activeWorldBookId}
                  type="button"
                  on:click={() => (activeWorldBookId = worldBook.id)}
                >
                  <span>
                    <strong>{worldBook.name}</strong>
                    <small>{worldBookLine(worldBook)}</small>
                  </span>
                  {#if worldBook.metadata?.source === 'character-card'}
                    <em>bound</em>
                  {/if}
                </button>
              {:else}
                <div class="drawer-empty compact">No world books yet</div>
              {/each}
            </div>
          </section>

          {#if activeWorldBook}
            {@const worldStats = worldBookStats(worldBookDraftEntries)}
            <section class="worldbook-editor" aria-label="World book editor">
              <header class="worldbook-editor-header">
                <div>
                  <strong>World Editor</strong>
                  <span>{worldStats.enabled}/{worldStats.total} enabled · {worldStats.constant} constant · {worldStats.regex} regex</span>
                </div>
                <div class="preset-actions">
                  <button class="tool-button" type="button" on:click={addWorldBookEntry} title="New entry" aria-label="New entry">
                    <Plus size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={saveActiveWorldBook} title="Save world book" aria-label="Save world book">
                    <Save size={16} />
                  </button>
                </div>
              </header>

              <div class="worldbook-title-row">
                <label>
                  <span>Name</span>
                  <input bind:value={worldBookDraftName} placeholder="World book name" />
                </label>
                <div class="worldbook-source">
                  <span>Source</span>
                  <strong>{activeWorldBook.metadata?.source ?? 'native'}</strong>
                  {#if activeWorldBook.metadata?.characterName}
                    <small>{activeWorldBook.metadata.characterName}</small>
                  {/if}
                </div>
              </div>

              <div class="worldbook-entry-toolbar">
                <input class="profile-search" bind:value={worldBookEntryQuery} placeholder="Search entries" aria-label="Search world book entries" />
                <select bind:value={worldBookSortMode} aria-label="Sort world book entries">
                  {#each worldBookSortModes as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </div>

              <div class="worldbook-editor-grid">
                <div class="worldbook-entry-list" aria-label="Entries">
                  {#each filteredWorldBookEntries as entry}
                    <article class="worldbook-entry-row" class:active={entry.id === activeWorldBookEntryId}>
                      <button class="worldbook-entry-main" type="button" on:click={() => (activeWorldBookEntryId = entry.id)}>
                        <span class="entry-state" data-state={entryStatus(entry)}>{entryStatus(entry) === 'constant' ? 'C' : entryStatus(entry) === 'disabled' ? 'X' : 'N'}</span>
                        <span>
                          <strong>{entryTitle(entry)}</strong>
                          <small>{entryMetaLine(entry)}</small>
                        </span>
                      </button>
                      <div class="worldbook-entry-actions">
                        <button type="button" on:click={() => moveWorldBookEntryOrder(entry, 1)} title="Raise order" aria-label={`Raise ${entryTitle(entry)} order`}>
                          <ArrowUp size={14} />
                        </button>
                        <button type="button" on:click={() => moveWorldBookEntryOrder(entry, -1)} title="Lower order" aria-label={`Lower ${entryTitle(entry)} order`}>
                          <ArrowDown size={14} />
                        </button>
                        <button type="button" on:click={() => duplicateWorldBookEntry(entry)} title="Duplicate entry" aria-label={`Duplicate ${entryTitle(entry)}`}>
                          <Copy size={14} />
                        </button>
                        <button type="button" on:click={() => removeWorldBookEntry(entry)} title="Delete entry" aria-label={`Delete ${entryTitle(entry)}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </article>
                  {:else}
                    <div class="drawer-empty compact">No matching entries</div>
                  {/each}
                </div>

                {#if activeWorldBookEntry}
                  <section class="worldbook-entry-editor" aria-label="Entry editor">
                    <div class="worldbook-entry-editor-head">
                      <div>
                        <strong>{entryTitle(activeWorldBookEntry)}</strong>
                        <span>{entryTokenEstimate(activeWorldBookEntry)} tokens · {entryStatusLabel(activeWorldBookEntry)}</span>
                      </div>
                      <div class="preset-actions">
                        <button class="tool-button" type="button" on:click={() => duplicateWorldBookEntry(activeWorldBookEntry)} title="Duplicate entry" aria-label="Duplicate entry">
                          <Copy size={16} />
                        </button>
                        <button class="tool-button" type="button" on:click={() => removeWorldBookEntry(activeWorldBookEntry)} title="Delete entry" aria-label="Delete entry">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div class="worldbook-entry-fields">
                      <label class="span-2">
                        <span>Memo / Title</span>
                        <input value={activeWorldBookEntry.comment} on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { comment: (event.currentTarget as HTMLInputElement).value })} />
                      </label>

                      <div class="segmented-field">
                        <span>Status</span>
                        <div class="mini-segment three" aria-label="Entry status">
                          <button class:active={entryStatus(activeWorldBookEntry) === 'normal'} type="button" on:click={() => setWorldBookEntryState(activeWorldBookEntry, 'normal')}>Normal</button>
                          <button class:active={entryStatus(activeWorldBookEntry) === 'constant'} type="button" on:click={() => setWorldBookEntryState(activeWorldBookEntry, 'constant')}>Constant</button>
                          <button class:active={entryStatus(activeWorldBookEntry) === 'disabled'} type="button" on:click={() => setWorldBookEntryState(activeWorldBookEntry, 'disabled')}>Off</button>
                        </div>
                      </div>

                      <div class="segmented-field">
                        <span>Position</span>
                        <div class="mini-segment three" aria-label="World info position">
                          {#each worldBookPositions as position}
                            <button class:active={activeWorldBookEntry.position === position.value} type="button" on:click={() => updateWorldBookEntry(activeWorldBookEntry.id, { position: position.value })}>
                              {position.label}
                            </button>
                          {/each}
                        </div>
                      </div>

                      <label>
                        <span>Depth</span>
                        <input
                          value={activeWorldBookEntry.depth}
                          inputmode="numeric"
                          on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { depth: optionalInteger((event.currentTarget as HTMLInputElement).value) ?? 0 })}
                        />
                      </label>
                      <label>
                        <span>Order</span>
                        <input
                          value={activeWorldBookEntry.order}
                          inputmode="numeric"
                          on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { order: optionalNumber((event.currentTarget as HTMLInputElement).value) ?? 0 })}
                        />
                      </label>
                      <label>
                        <span>Trigger %</span>
                        <input
                          value={activeWorldBookEntry.probability}
                          inputmode="numeric"
                          on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { probability: Math.min(100, Math.max(0, optionalNumber((event.currentTarget as HTMLInputElement).value) ?? 100)) })}
                        />
                      </label>

                      <div class="segmented-field">
                        <span>Role @ Depth</span>
                        <div class="mini-segment three" aria-label="Entry role">
                          {#each promptRoles as role}
                            <button class:active={activeWorldBookEntry.role === role} type="button" on:click={() => updateWorldBookEntry(activeWorldBookEntry.id, { role })}>{role}</button>
                          {/each}
                        </div>
                      </div>

                      <label class="span-2">
                        <span>Primary Keywords</span>
                        <textarea
                          rows="2"
                          value={keywordText(activeWorldBookEntry.keys)}
                          placeholder="Comma or newline separated"
                          on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { keys: parseKeywordText((event.currentTarget as HTMLTextAreaElement).value) })}
                        ></textarea>
                      </label>
                      <label class="span-2">
                        <span>Optional Filter</span>
                        <textarea
                          rows="2"
                          value={keywordText(activeWorldBookEntry.secondaryKeys)}
                          placeholder="Secondary keys, comma or newline separated"
                          on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { secondaryKeys: parseKeywordText((event.currentTarget as HTMLTextAreaElement).value) })}
                        ></textarea>
                      </label>
                      <label class="span-2 content-field">
                        <span>Content</span>
                        <textarea
                          rows="10"
                          value={activeWorldBookEntry.content}
                          placeholder="Text injected when this entry activates"
                          on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { content: (event.currentTarget as HTMLTextAreaElement).value })}
                        ></textarea>
                      </label>
                    </div>

                    <div class="worldbook-toggle-grid">
                      <button class="toggle-pill" class:active={activeWorldBookEntry.selective} type="button" on:click={() => updateWorldBookEntry(activeWorldBookEntry.id, { selective: !activeWorldBookEntry.selective })}>Selective</button>
                      <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.useProbability !== false} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'useProbability', activeWorldBookEntry.extensions.useProbability === false)}>Use Probability</button>
                      <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.use_regex === true} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'use_regex', activeWorldBookEntry.extensions.use_regex !== true)}>Regex Keys</button>
                      <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.case_sensitive === true} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'case_sensitive', activeWorldBookEntry.extensions.case_sensitive !== true)}>Case Sensitive</button>
                      <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.match_whole_words === true} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'match_whole_words', activeWorldBookEntry.extensions.match_whole_words !== true)}>Whole Words</button>
                      <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.ignore_budget === true} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'ignore_budget', activeWorldBookEntry.extensions.ignore_budget !== true)}>Ignore Budget</button>
                    </div>
                  </section>
                {:else}
                  <section class="worldbook-entry-editor empty">
                    <BookOpen size={28} />
                    <strong>No entry selected</strong>
                    <button class="primary" type="button" on:click={addWorldBookEntry}><Plus size={16} />New Entry</button>
                  </section>
                {/if}
              </div>
            </section>
          {:else}
            <section class="worldbook-editor empty">
              <BookOpen size={28} />
              <strong>Select or create a world book</strong>
            </section>
          {/if}
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
                  <strong>{samplerPanelHeading}</strong>
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

                <div class="thinking-panel" aria-label="Thinking request controls">
                  <div class="thinking-panel-header">
                    <div>
                      <strong>Thinking Request</strong>
                      <span>{profileDraftProviderType === 'gemini' ? (profileDraftGeminiIncludeThoughts ? 'Gemini thought summaries requested' : 'Gemini summaries not requested') : profileDraftOpenAIReasoningEffort === 'default' ? 'Default endpoint effort' : `${profileDraftOpenAIReasoningEffort} effort`}</span>
                    </div>
                  </div>

                  {#if profileDraftProviderType === 'openai-compatible'}
                    <div class="thinking-field">
                      <span>Reasoning effort</span>
                      <div class="mini-segment seven" aria-label="OpenAI reasoning effort">
                        <button class:active={profileDraftOpenAIReasoningEffort === 'default'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'default')}>Auto</button>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'none'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'none')}>None</button>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'minimal'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'minimal')}>Minimal</button>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'low'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'low')}>Low</button>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'medium'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'medium')}>Medium</button>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'high'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'high')}>High</button>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'xhigh'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'xhigh')}>XHigh</button>
                      </div>
                    </div>
                  {:else}
                    <div class="thinking-field">
                      <span>Visible thoughts</span>
                      <button class="toggle-pill profile-toggle" class:active={profileDraftGeminiIncludeThoughts} type="button" on:click={() => (profileDraftGeminiIncludeThoughts = !profileDraftGeminiIncludeThoughts)}>
                        {profileDraftGeminiIncludeThoughts ? 'Request thought summaries' : 'Do not request summaries'}
                      </button>
                    </div>

                    {#if draftModelUsesGeminiThinkingLevel}
                      <div class="thinking-field">
                        <span>Thinking level</span>
                        <div class="mini-segment five" aria-label="Gemini thinking level">
                          <button class:active={profileDraftGeminiThinkingMode === 'default'} type="button" on:click={() => (profileDraftGeminiThinkingMode = 'default')}>Auto</button>
                          <button class:active={profileDraftGeminiThinkingMode === 'level' && profileDraftGeminiThinkingLevel === 'minimal'} type="button" on:click={() => { profileDraftGeminiThinkingMode = 'level'; profileDraftGeminiThinkingLevel = 'minimal'; }}>Minimal</button>
                          <button class:active={profileDraftGeminiThinkingMode === 'level' && profileDraftGeminiThinkingLevel === 'low'} type="button" on:click={() => { profileDraftGeminiThinkingMode = 'level'; profileDraftGeminiThinkingLevel = 'low'; }}>Low</button>
                          <button class:active={profileDraftGeminiThinkingMode === 'level' && profileDraftGeminiThinkingLevel === 'medium'} type="button" on:click={() => { profileDraftGeminiThinkingMode = 'level'; profileDraftGeminiThinkingLevel = 'medium'; }}>Medium</button>
                          <button class:active={profileDraftGeminiThinkingMode === 'level' && profileDraftGeminiThinkingLevel === 'high'} type="button" on:click={() => { profileDraftGeminiThinkingMode = 'level'; profileDraftGeminiThinkingLevel = 'high'; }}>High</button>
                        </div>
                      </div>
                    {:else}
                      <div class="thinking-field">
                        <span>Thinking budget</span>
                        <div class="mini-segment three" aria-label="Gemini thinking budget mode">
                          <button class:active={profileDraftGeminiThinkingMode === 'default'} type="button" on:click={() => (profileDraftGeminiThinkingMode = 'default')}>Auto</button>
                          <button class:active={profileDraftGeminiThinkingMode === 'off'} type="button" on:click={() => (profileDraftGeminiThinkingMode = 'off')}>Off</button>
                          <button class:active={profileDraftGeminiThinkingMode === 'budget'} type="button" on:click={() => (profileDraftGeminiThinkingMode = 'budget')}>Budget</button>
                        </div>
                        {#if profileDraftGeminiThinkingMode === 'budget'}
                          <span class="sampler-control-body">
                            <input class="sampler-range" type="range" min="0" max="32768" step="128" value={profileDraftGeminiThinkingBudget || '1024'} on:input={(event) => (profileDraftGeminiThinkingBudget = (event.currentTarget as HTMLInputElement).value)} />
                            <input class="sampler-number" value={profileDraftGeminiThinkingBudget} inputmode="numeric" placeholder="1024" on:input={(event) => (profileDraftGeminiThinkingBudget = (event.currentTarget as HTMLInputElement).value)} />
                          </span>
                        {/if}
                      </div>
                    {/if}
                  {/if}
                </div>

                <div class="sampler-control-list">
                  {#if samplerVisible.temperature}
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
                  {/if}

                  {#if samplerVisible.topP}
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
                  {/if}

                  {#if samplerVisible.topK}
                    <label class="sampler-control">
                      <span class="sampler-control-head">
                        <span>Top K</span>
                        <output>{profileDraftTopK || 'auto'}</output>
                      </span>
                      <span class="sampler-control-body">
                        <input class="sampler-range" type="range" min="1" max="200" step="1" value={profileDraftTopK || '40'} on:input={(event) => (profileDraftTopK = (event.currentTarget as HTMLInputElement).value)} />
                        <input class="sampler-number" value={profileDraftTopK} inputmode="numeric" placeholder="auto" on:input={(event) => (profileDraftTopK = (event.currentTarget as HTMLInputElement).value)} />
                      </span>
                    </label>
                  {/if}

                  {#if samplerVisible.maxTokens}
                    <label class="sampler-control">
                      <span class="sampler-control-head">
                        <span>{maxTokensFieldLabel}</span>
                        <output>{profileDraftMaxTokens || '512'}</output>
                      </span>
                      <span class="sampler-control-body">
                        <input class="sampler-range" type="range" min="16" max={maxOutputTokenRange} step="16" value={profileDraftMaxTokens || '512'} on:input={(event) => (profileDraftMaxTokens = (event.currentTarget as HTMLInputElement).value)} />
                        <input class="sampler-number" value={profileDraftMaxTokens} inputmode="numeric" placeholder="512" on:input={(event) => (profileDraftMaxTokens = (event.currentTarget as HTMLInputElement).value)} />
                      </span>
                    </label>
                  {/if}

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

                {#if showAdvancedSampler}
                  <details class="advanced-sampler">
                    <summary>Advanced</summary>
                    <div class="advanced-sampler-grid">
                      {#if samplerVisible.topA}
                        <label>
                          <span>Top A</span>
                          <input bind:value={profileDraftTopA} inputmode="decimal" />
                        </label>
                      {/if}
                      {#if samplerVisible.minP}
                        <label>
                          <span>Min P</span>
                          <input bind:value={profileDraftMinP} inputmode="decimal" />
                        </label>
                      {/if}
                      {#if samplerVisible.frequencyPenalty}
                        <label>
                          <span>Freq Penalty</span>
                          <input bind:value={profileDraftFrequencyPenalty} inputmode="decimal" />
                        </label>
                      {/if}
                      {#if samplerVisible.presencePenalty}
                        <label>
                          <span>Presence</span>
                          <input bind:value={profileDraftPresencePenalty} inputmode="decimal" />
                        </label>
                      {/if}
                      {#if samplerVisible.repetitionPenalty}
                        <label>
                          <span>Rep Penalty</span>
                          <input bind:value={profileDraftRepetitionPenalty} inputmode="decimal" />
                        </label>
                      {/if}
                      {#if samplerVisible.seed}
                        <label>
                          <span>Seed</span>
                          <input bind:value={profileDraftSeed} inputmode="numeric" />
                        </label>
                      {/if}
                      {#if samplerVisible.n}
                        <label>
                          <span>{candidateCountFieldLabel}</span>
                          <input bind:value={profileDraftN} inputmode="numeric" />
                        </label>
                      {/if}
                    </div>
                  </details>
                {/if}

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

  .tool-button.danger {
    border-color: #e4c3bd;
    color: #9b2f24;
  }

  .tool-button.danger:hover {
    border-color: #d89a91;
    background: #fff1ef;
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

  .thinking-block {
    overflow: hidden;
    margin: 2px 0 10px;
    border: 1px solid #d9e1db;
    border-radius: 8px;
    background: #f6f8f5;
  }

  .thinking-block[open] {
    background: #fbfcfa;
  }

  .thinking-block summary {
    display: flex;
    min-height: 36px;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 11px;
    color: #314039;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    list-style: none;
  }

  .thinking-block summary::-webkit-details-marker {
    display: none;
  }

  .thinking-block-content {
    border-top: 1px solid #e2e6e0;
    padding: 10px 12px 12px;
    color: #4b5a51;
    font-size: 13px;
    line-height: 1.65;
  }

  .thinking-block-content.rich :global(p) {
    margin: 0 0 0.6em;
  }

  .thinking-block-content.rich :global(p:last-child) {
    margin-bottom: 0;
  }

  .thinking-block-content.rich :global(ul),
  .thinking-block-content.rich :global(ol) {
    margin: 0.35em 0 0.65em;
    padding-left: 1.25em;
  }

  .message-content {
    margin: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .message-content.rich {
    line-height: 1.72;
    white-space: normal;
  }

  .message-content.rich :global(*) {
    max-width: 100%;
  }

  .message-content.rich :global(p) {
    margin: 0 0 0.72em;
  }

  .message-content.rich :global(p:last-child) {
    margin-bottom: 0;
  }

  .branch-controls {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 10px;
    min-height: 28px;
    border: 1px solid #d9dfd8;
    border-radius: 8px;
    background: #f7f9f6;
    padding: 2px;
    color: #53615a;
    font-size: 12px;
  }

  .message-row.user .branch-controls {
    background: #eef8f1;
  }

  .branch-controls button {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    padding: 0;
  }

  .branch-controls button:not(:disabled):hover {
    background: #e3ebe4;
    color: #1f3b2b;
  }

  .branch-controls button:disabled {
    cursor: default;
    opacity: 0.36;
  }

  .branch-controls span {
    min-width: 38px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .message-content.rich :global(ul),
  .message-content.rich :global(ol) {
    margin: 0.45em 0 0.8em;
    padding-left: 1.35em;
  }

  .message-content.rich :global(li) {
    margin: 0.18em 0;
  }

  .message-content.rich :global(li > p) {
    margin: 0.2em 0;
  }

  .message-content.rich :global(blockquote) {
    margin: 0.75em 0;
    border-left: 3px solid #c4d9cb;
    padding: 0.2em 0 0.2em 0.85em;
    color: #4f5d55;
  }

  .message-content.rich :global(em) {
    color: #39473f;
  }

  .message-content.rich :global(code) {
    border: 1px solid #dfe4de;
    border-radius: 5px;
    background: #f4f6f3;
    padding: 0.08em 0.34em;
    font-size: 0.92em;
  }

  .message-content.rich :global(pre) {
    min-height: 0;
    max-height: 42vh;
    margin: 0.8em 0;
    white-space: pre;
  }

  .message-content.rich :global(pre code) {
    border: 0;
    background: transparent;
    padding: 0;
  }

  .message-content.rich :global(details) {
    margin: 0.45em 0 0.85em;
  }

  .message-content.rich :global(details:not([open])) {
    margin-bottom: 0.6em;
  }

  .message-content.rich :global(details:not([open]) > :not(summary)) {
    display: none !important;
  }

  .message-content.rich :global(summary) {
    cursor: pointer;
  }

  .message-content.rich :global(.konata-thinking-wrapper) {
    display: block;
    margin: 10px 0 12px;
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      sans-serif;
  }

  .message-content.rich :global(.konata-thinking-details) {
    overflow: hidden;
    border: 1px solid rgb(139 92 246 / 28%);
    border-radius: 12px;
    background: rgb(15 23 42 / 72%);
    box-shadow: 0 8px 20px rgb(15 23 42 / 14%);
    color: #cbd5e1;
  }

  .message-content.rich :global(.konata-thinking-details[open]) {
    border-color: rgb(139 92 246 / 52%);
    background: rgb(2 6 23 / 88%);
    box-shadow: 0 12px 26px rgb(15 23 42 / 22%);
  }

  .message-content.rich :global(.konata-thinking-summary) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 42px;
    padding: 10px 14px;
    color: #dbeafe;
    font-size: 13px;
    font-weight: 700;
    list-style: none;
    user-select: none;
  }

  .message-content.rich :global(.konata-thinking-summary::-webkit-details-marker) {
    display: none;
  }

  .message-content.rich :global(.konata-title-content) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .message-content.rich :global(.konata-icon) {
    display: inline-block;
    color: #a78bfa;
    filter: drop-shadow(0 0 5px rgb(167 139 250 / 28%));
    transition: transform 0.2s ease;
  }

  .message-content.rich :global(.konata-thinking-details[open] .konata-icon) {
    transform: rotate(90deg);
  }

  .message-content.rich :global(.konata-arrow) {
    position: relative;
    display: inline-flex;
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
    align-items: center;
    justify-content: center;
    opacity: 0.82;
    transition: transform 0.2s ease;
  }

  .message-content.rich :global(.konata-arrow::after) {
    width: 7px;
    height: 7px;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    content: '';
    transform: rotate(45deg) translate(-1px, -1px);
  }

  .message-content.rich :global(.konata-thinking-details[open] .konata-arrow) {
    transform: rotate(180deg);
  }

  .message-content.rich :global(.konata-thinking-content) {
    border-top: 1px solid rgb(255 255 255 / 8%);
    padding: 12px 16px 14px;
    color: #e2e8f0;
  }

  .message-content.rich :global(.konata-thinking-content p),
  .message-content.rich :global(.konata-thinking-content ul),
  .message-content.rich :global(.konata-thinking-content ol) {
    margin-top: 0;
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

  .composer-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
    width: 52px;
    min-height: 52px;
    border: 1px solid #1c6b43;
    border-radius: 8px;
    background: #1c6b43;
    color: #fff;
  }

  .composer-action:hover,
  .composer-action:focus-visible {
    background: #155437;
    outline: 0;
  }

  .composer-action.stopping {
    border-color: #bb3f33;
    background: #bb3f33;
  }

  .composer-action.stopping:hover,
  .composer-action.stopping:focus-visible {
    background: #9b2f24;
  }

  .composer-action:disabled {
    cursor: not-allowed;
    border-color: #cfd4cd;
    background: #eef0ec;
    color: #8b968f;
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

  .drawer.characters {
    width: min(1040px, calc(100vw - 64px));
  }

  .drawer.worldbooks {
    width: min(1040px, calc(100vw - 64px));
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

  .checkbox-row.compact {
    min-height: 28px;
    font-size: 12px;
  }

  .search-field {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    border: 1px solid #d7ddd6;
    border-radius: 8px;
    background: #fff;
    color: #64706a;
    padding: 0 10px;
  }

  .search-field input {
    min-height: 38px;
    border: 0;
    background: transparent;
    padding: 0;
  }

  .search-field input:focus {
    outline: 0;
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

  .conversation-list {
    display: grid;
    align-content: start;
    gap: 12px;
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 0 16px 16px;
  }

  .conversation-group {
    display: grid;
    gap: 8px;
  }

  .conversation-group > header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    color: #3b463f;
    font-size: 13px;
  }

  .conversation-group > header strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .conversation-group > header small {
    color: #78817b;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .conversation-group-avatar {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    overflow: hidden;
    border: 1px solid #d9ddd7;
    border-radius: 7px;
    background: #f2f4f0;
    color: #4e5d55;
  }

  .conversation-group-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .conversation-group-items {
    display: grid;
    gap: 7px;
  }

  .conversation-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    border: 1px solid #dfe3dc;
    border-radius: 8px;
    background: #fff;
    padding: 8px;
  }

  .conversation-row.active,
  .conversation-row:hover {
    border-color: #9dc7ad;
    background: #edf6f0;
  }

  .conversation-row.archived {
    background: #fafafa;
    color: #59625d;
  }

  .conversation-row-main {
    display: grid;
    min-width: 0;
    gap: 4px;
    border: 0;
    background: transparent;
    color: inherit;
    padding: 0;
    text-align: left;
  }

  .conversation-title-line {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 8px;
  }

  .conversation-title-line strong,
  .conversation-row-main span,
  .conversation-row-main small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .conversation-title-line small,
  .conversation-row-main small,
  .conversation-row-main > span:not(.conversation-title-line) {
    color: #6a756e;
    font-size: 12px;
  }

  .conversation-row-actions {
    display: flex;
    align-items: flex-start;
    gap: 3px;
  }

  .conversation-row-actions button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: #64706a;
    padding: 0;
  }

  .conversation-row-actions button:hover {
    border-color: #cbd8ce;
    background: #fff;
    color: #214433;
  }

  .conversation-row-actions button.danger:hover {
    border-color: #e6b8b4;
    background: #fff5f4;
    color: #9b2d25;
  }

  .drawer-empty.compact {
    border: 1px dashed #d9ddd6;
    border-radius: 7px;
    background: #fff;
    padding: 9px 10px;
    text-align: center;
  }

  .character-workspace {
    display: grid;
    grid-template-columns: minmax(260px, 310px) minmax(0, 1fr);
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    background: #fff;
  }

  .character-library {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 10px;
    min-height: 0;
    border-right: 1px solid #e1e4df;
    background: #fbfcfa;
    padding: 14px;
  }

  .character-library-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .character-toolbar input,
  .character-toolbar select,
  .character-field-grid input,
  .character-field-grid textarea,
  .character-textarea-label textarea {
    min-height: 36px;
    border-radius: 7px;
    padding: 8px 10px;
    font-size: 13px;
  }

  .character-library-actions button {
    min-height: 36px;
    padding: 0 12px;
  }

  .character-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(118px, auto);
    align-items: center;
    gap: 8px;
  }

  .character-list {
    display: grid;
    align-content: start;
    gap: 7px;
    min-height: 0;
    overflow: auto;
    scrollbar-width: thin;
  }

  .character-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
    border: 1px solid #dfe3dc;
    border-radius: 8px;
    background: #fff;
    padding: 7px;
  }

  .character-row.active,
  .character-row:hover {
    border-color: #9dc7ad;
    background: #edf6f0;
  }

  .character-row-main {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    border: 0;
    background: transparent;
    color: #202823;
    padding: 0;
    text-align: left;
  }

  .character-avatar-small,
  .character-avatar-large {
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid #d9ddd7;
    border-radius: 8px;
    background: #203229;
    color: #fff;
    font-weight: 800;
  }

  .character-avatar-small {
    width: 46px;
    height: 56px;
    font-size: 16px;
  }

  .character-avatar-small img,
  .character-avatar-large img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .character-row-copy {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .character-row-copy strong,
  .character-hero-title strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .character-row-copy small,
  .character-hero-title span,
  .character-field-grid span,
  .character-textarea-label span,
  .character-lore-header span,
  .character-lore-list small,
  .character-source-panel span,
  .character-source-panel small {
    color: #66716a;
    font-size: 12px;
  }

  .favorite-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid #d6d8d3;
    border-radius: 7px;
    background: #fff;
    color: #7a827d;
    padding: 0;
  }

  .favorite-button.active {
    border-color: #e5c36a;
    background: #fff8df;
    color: #9a6a0a;
  }

  .character-editor {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
    overflow: auto;
    padding: 14px;
  }

  .character-editor.empty {
    place-content: center;
    justify-items: center;
    color: #66716a;
  }

  .character-editor-hero {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 12px;
    border: 1px solid #e0e4df;
    border-radius: 8px;
    background: #fbfcfa;
    padding: 12px;
  }

  .character-avatar-large {
    width: 104px;
    height: 136px;
    padding: 0;
    cursor: zoom-in;
  }

  .character-avatar-large:hover,
  .character-avatar-large:focus-visible {
    border-color: #92bfa4;
    box-shadow: 0 0 0 3px rgb(146 191 164 / 22%);
    outline: 0;
  }

  .character-avatar-large.placeholder-avatar {
    cursor: default;
  }

  .character-avatar-large.placeholder-avatar:hover,
  .character-avatar-large.placeholder-avatar:focus-visible {
    border-color: #d9ddd7;
    box-shadow: none;
  }

  .character-hero-copy,
  .character-hero-title > div {
    display: grid;
    min-width: 0;
    gap: 5px;
  }

  .character-hero-title {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .character-hero-title strong {
    font-size: 20px;
  }

  .hero-favorite {
    flex: 0 0 auto;
  }

  .character-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .character-chips span {
    border: 1px solid #e0e4df;
    border-radius: 999px;
    background: #fff;
    color: #2f3a34;
    padding: 4px 8px;
    font-size: 12px;
    line-height: 1.1;
  }

  .character-actions {
    display: flex;
    gap: 6px;
  }

  .character-tabs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    border: 1px solid #dfe3dc;
    border-radius: 8px;
    background: #f1f3ef;
    padding: 4px;
  }

  .character-tabs button {
    min-height: 36px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: #314039;
  }

  .character-tabs button.active {
    border-color: #a9c8b3;
    background: #fff;
    color: #174b32;
    box-shadow: 0 1px 3px rgb(29 39 33 / 8%);
  }

  .character-editor-section {
    display: grid;
    align-content: start;
    gap: 12px;
    min-height: 0;
  }

  .character-field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .character-field-grid label,
  .character-textarea-label {
    display: grid;
    min-width: 0;
    gap: 5px;
  }

  .character-field-grid .span-2 {
    grid-column: 1 / -1;
  }

  .character-field-grid textarea,
  .character-textarea-label textarea {
    resize: vertical;
    line-height: 1.45;
  }

  .character-lore-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid #e0e4df;
    border-radius: 8px;
    background: #fbfcfa;
    padding: 10px 12px;
  }

  .character-lore-header > div {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .character-lore-list {
    display: grid;
    gap: 8px;
  }

  .character-lore-list button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    border: 1px solid #dfe3dc;
    border-radius: 8px;
    background: #fff;
    color: #202823;
    padding: 10px;
    text-align: left;
  }

  .character-lore-list button:hover {
    border-color: #9dc7ad;
    background: #edf6f0;
  }

  .character-lore-list button span {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .character-source-panel {
    display: grid;
    align-content: center;
    gap: 3px;
    border: 1px solid #e0e4df;
    border-radius: 8px;
    background: #fbfcfa;
    padding: 8px 10px;
  }

  .worldbook-workspace {
    display: grid;
    grid-template-columns: minmax(210px, 260px) minmax(0, 1fr);
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    background: #fff;
  }

  .worldbook-library {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
    border-right: 1px solid #e1e4df;
    background: #fbfcfa;
    padding: 14px;
  }

  .worldbook-create {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .worldbook-create input,
  .worldbook-title-row input,
  .worldbook-entry-toolbar input,
  .worldbook-entry-toolbar select,
  .worldbook-entry-fields input,
  .worldbook-entry-fields textarea {
    min-height: 36px;
    border-radius: 7px;
    padding: 8px 10px;
    font-size: 13px;
  }

  .worldbook-create button {
    min-height: 36px;
    padding: 0 12px;
  }

  .worldbook-list,
  .worldbook-entry-list,
  .regex-script-list {
    scrollbar-width: thin;
  }

  .worldbook-list {
    display: grid;
    align-content: start;
    gap: 7px;
    min-height: 0;
    overflow: auto;
  }

  .worldbook-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border: 1px solid #dfe3dc;
    border-radius: 8px;
    background: #fff;
    color: #202823;
    padding: 10px;
    text-align: left;
  }

  .worldbook-row.active,
  .worldbook-row:hover {
    border-color: #9dc7ad;
    background: #edf6f0;
  }

  .worldbook-row span {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .worldbook-row strong,
  .worldbook-entry-row strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .worldbook-row small,
  .worldbook-row em,
  .worldbook-editor-header span,
  .worldbook-source span,
  .worldbook-source small,
  .worldbook-entry-row small,
  .worldbook-entry-editor-head span,
  .worldbook-entry-fields span {
    color: #66716a;
    font-size: 12px;
  }

  .worldbook-row em {
    border: 1px solid #bfd5c7;
    border-radius: 999px;
    background: #edf6f0;
    color: #22533b;
    padding: 2px 6px;
    font-style: normal;
  }

  .worldbook-editor {
    display: grid;
    grid-template-rows: auto auto auto minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
    overflow: hidden;
    padding: 14px;
  }

  .worldbook-editor.empty,
  .worldbook-entry-editor.empty {
    place-content: center;
    justify-items: center;
    color: #66716a;
  }

  .worldbook-editor-header,
  .worldbook-entry-editor-head,
  .worldbook-title-row,
  .worldbook-entry-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .worldbook-editor-header > div:first-child,
  .worldbook-entry-editor-head > div:first-child {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .worldbook-title-row {
    align-items: stretch;
  }

  .worldbook-title-row label {
    display: grid;
    flex: 1 1 auto;
    min-width: 0;
    gap: 5px;
  }

  .worldbook-title-row label span {
    color: #66716a;
    font-size: 12px;
  }

  .worldbook-source {
    display: grid;
    align-content: center;
    min-width: 150px;
    border: 1px solid #e0e4df;
    border-radius: 8px;
    background: #fbfcfa;
    padding: 8px 10px;
  }

  .worldbook-entry-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(150px, auto);
  }

  .worldbook-editor-grid {
    display: grid;
    grid-template-columns: minmax(236px, 0.68fr) minmax(0, 1.32fr);
    gap: 12px;
    min-height: 0;
  }

  .worldbook-entry-list {
    display: grid;
    align-content: start;
    gap: 7px;
    min-height: 0;
    overflow: auto;
    border: 1px solid #e0e4df;
    border-radius: 8px;
    background: #fbfcfa;
    padding: 8px;
  }

  .worldbook-entry-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
    border: 1px solid #dfe3dc;
    border-radius: 8px;
    background: #fff;
    padding: 6px;
  }

  .worldbook-entry-row.active {
    border-color: #9dc7ad;
    background: #edf6f0;
  }

  .worldbook-entry-main {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    color: #202823;
    padding: 4px;
    text-align: left;
  }

  .worldbook-entry-main > span {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .entry-state {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: #dfeee5;
    color: #155a36;
    font-size: 11px;
    font-weight: 800;
  }

  .entry-state[data-state='constant'] {
    background: #dbeafe;
    color: #1e4e8c;
  }

  .entry-state[data-state='disabled'] {
    background: #f1f2ef;
    color: #828b85;
  }

  .worldbook-entry-actions {
    display: grid;
    grid-template-columns: repeat(2, 28px);
    gap: 4px;
  }

  .worldbook-entry-actions button {
    width: 28px;
    height: 28px;
    border: 1px solid #d6d8d3;
    border-radius: 6px;
    background: #fff;
    color: #4b5650;
    padding: 0;
  }

  .worldbook-entry-actions button:hover,
  .worldbook-entry-actions button:focus-visible {
    border-color: #9dc7ad;
    background: #edf6f0;
    outline: 0;
  }

  .worldbook-entry-editor {
    display: grid;
    align-content: start;
    gap: 12px;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    border: 1px solid #e0e4df;
    border-radius: 8px;
    background: #fff;
    padding: 12px;
  }

  .worldbook-entry-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .worldbook-entry-fields label,
  .content-field {
    display: grid;
    min-width: 0;
    gap: 5px;
  }

  .worldbook-entry-fields .span-2,
  .worldbook-entry-fields > .segmented-field,
  .content-field {
    grid-column: 1 / -1;
  }

  .worldbook-entry-fields textarea {
    resize: vertical;
  }

  .worldbook-entry-fields .mini-segment button,
  .worldbook-toggle-grid .toggle-pill {
    min-width: 0;
    padding: 0 6px;
    line-height: 1.15;
  }

  .content-field textarea {
    min-height: 190px;
    font-family: inherit;
    line-height: 1.45;
  }

  .worldbook-toggle-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
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

  .thinking-panel {
    display: grid;
    gap: 10px;
    border: 1px solid #e1e6df;
    border-radius: 8px;
    background: #fff;
    padding: 10px;
  }

  .thinking-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .thinking-panel-header div,
  .thinking-field {
    display: grid;
    min-width: 0;
    gap: 5px;
  }

  .thinking-panel-header strong {
    color: #26302a;
    font-size: 13px;
  }

  .thinking-field {
    gap: 7px;
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

  .mini-segment.five {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .mini-segment.seven {
    grid-template-columns: repeat(auto-fit, minmax(62px, 1fr));
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

    .drawer.characters {
      width: calc(100vw - 56px);
    }

    .drawer.worldbooks {
      width: calc(100vw - 56px);
    }

    .drawer.right {
      width: calc(100vw - 56px);
    }

    .character-workspace {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
      overflow: auto;
    }

    .character-library {
      border-right: 0;
      border-bottom: 1px solid #e1e4df;
    }

    .character-list {
      grid-auto-flow: column;
      grid-auto-columns: minmax(230px, 1fr);
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 2px;
    }

    .character-editor-hero {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .character-actions {
      grid-column: 1 / -1;
      justify-content: flex-end;
    }

    .character-field-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .character-tabs {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .worldbook-workspace,
    .worldbook-editor-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .worldbook-workspace {
      grid-template-rows: auto minmax(0, 1fr);
      overflow: auto;
    }

    .worldbook-library {
      border-right: 0;
      border-bottom: 1px solid #e1e4df;
    }

    .worldbook-list {
      grid-auto-flow: column;
      grid-auto-columns: minmax(190px, 1fr);
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 2px;
    }

    .worldbook-entry-list,
    .worldbook-entry-editor {
      max-height: none;
    }

    .worldbook-title-row,
    .worldbook-entry-editor-head {
      align-items: stretch;
      flex-direction: column;
    }

    .worldbook-entry-fields,
    .worldbook-toggle-grid {
      grid-template-columns: minmax(0, 1fr);
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
