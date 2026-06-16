<script lang="ts">
  import { onMount } from 'svelte';
  import { applyRegexScripts, REGEX_PLACEMENT } from '$lib/core/regex';
  import { t } from '$lib/i18n';
  import { RangeField, SecretField, SelectField, TextareaField, TextField } from '$lib/ui/components';
  import { renderMessageMarkdown } from '$lib/ui/markdown';
  import type { Component } from 'svelte';
  import type { ConversationTreeNode, ConversationTreeSummary } from '$lib/ui/features/conversation-tree/types';
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
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    CircleStop,
    CornerDownRight,
    Copy,
    Download,
    Eraser,
    FileInput,
    GitBranch,
    GripHorizontal,
    House,
    Image,
    Link2,
    MessageCircle,
    MessageSquare,
    Pencil,
    Plus,
    Power,
    PowerOff,
    RefreshCw,
    RotateCcw,
    Search,
    Send,
    Save,
    Settings2,
    SlidersHorizontal,
    Star,
    Trash2,
    Type,
    Unlink,
    Upload,
    UserRound,
    Wrench,
    SquarePen,
    X,
    Sun,
  Moon,
  Monitor,
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
    title?: string;
    description: string;
    avatarAssetId?: string;
    isDefault: boolean;
    metadata?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
  };
  type PersonaCharacterBinding = {
    personaId: string;
    characterId: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
  };
  type UserPersonaDeleteResult = {
    deleted: boolean;
    id: string;
    affectedConversationIds: string[];
    affectedCharacterIds: string[];
    removedCharacterBindings: number;
    defaultCleared: boolean;
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
    speakerId?: string;
    name?: string;
    speakerAvatarAssetId?: string;
    content: string;
    thinking?: string;
    branch?: MessageBranch;
  };
  type ZoomedAvatar = { key: string; name: string; role: ChatMessage['role']; src: string; initials: string };
  type GenerationStreamEvent = { type: 'text' | 'thinking' | 'inspector' | 'done' | 'error'; text?: string; conversationId?: string; activeLeafId?: string };
  type ConversationGroup = { key: string; label: string; avatarUrl: string; count: number; latestUpdatedAt?: number; conversations: Conversation[] };
  type ImportKind = 'preset' | 'character-card-json' | 'character-card-png' | 'worldbook' | 'chat-jsonl' | 'conversation-snapshot';
  type ImportScope = 'character' | 'profile' | 'worldbook';
  type View = 'home' | 'chat';
  type Drawer = 'chats' | 'characters' | 'personas' | 'worldbooks' | 'profiles' | 'settings' | 'import' | 'inspector' | null;
  type WorldBookDeleteResult = {
    deleted: boolean;
    id: string;
    affectedCharacterIds: string[];
    removedCharacterBindings: number;
    removedEmbeddedCharacterBooks: number;
  };
  type AppFontFamily = 'system' | 'source-han-sans' | 'source-han-serif' | 'serif' | 'mono';
  type AppSettings = {
    fontFamily: AppFontFamily;
    uiFontSize: number;
    chatFontSize: number;
  };
  type MessageDeleteMode = 'node' | 'subtree';
  type PendingMessageDelete = {
    conversationId: string;
    nodeId: string;
    label: string;
  };
  type SamplerField = Exclude<keyof NonNullable<Profile['sampler']>, 'stop'>;
  type ConversationTreeDockProps = {
    summary: ConversationTreeSummary | null;
    loading?: boolean;
    actionStatus?: string;
    selectedNodeId?: string;
    onSelectNode?: (nodeId: string) => void;
    onClose?: () => void;
    onRefresh?: () => void;
    onFocusNode?: (node: ConversationTreeNode, restoreSubtree: boolean) => void | Promise<void>;
    onDeleteNode?: (node: ConversationTreeNode) => void | Promise<void>;
  };
  type ConversationTreeDockComponent = Component<ConversationTreeDockProps>;

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
    { value: 'before', label: t('worldbook.position.before') },
    { value: 'after', label: t('worldbook.position.after') },
    { value: 'depth', label: t('worldbook.position.depth') }
  ];
  const worldBookSortModes = [
    { value: 'order-desc', label: t('worldbook.sort.orderDesc') },
    { value: 'order-asc', label: t('worldbook.sort.orderAsc') },
    { value: 'title-asc', label: t('worldbook.sort.titleAsc') },
    { value: 'title-desc', label: t('worldbook.sort.titleDesc') },
    { value: 'depth-asc', label: t('worldbook.sort.depthAsc') },
    { value: 'probability-desc', label: t('worldbook.sort.triggerDesc') }
  ];
  const characterSortModes: Array<{ value: CharacterSortMode; label: string }> = [
    { value: 'favorite', label: t('sort.favorites') },
    { value: 'name-asc', label: t('sort.nameAsc') },
    { value: 'name-desc', label: t('sort.nameDesc') },
    { value: 'newest', label: t('sort.newest') },
    { value: 'oldest', label: t('sort.oldest') },
    { value: 'tokens-desc', label: t('sort.mostTokens') }
  ];
  const importKindsByScope: Record<ImportScope, ImportKind[]> = {
    character: ['character-card-png', 'character-card-json'],
    profile: ['preset'],
    worldbook: ['worldbook']
  };
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
  const appSettingsStorageKey = 'nanke.interface-settings.v1';
  const conversationGroupStateStorageKey = 'nanke.conversation-groups.v1';
  const appFontFamilies: Array<{ value: AppFontFamily; label: string; description: string; css: string }> = [
    {
      value: 'system',
      label: t('font.system'),
      description: t('font.systemDescription'),
      css: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    {
      value: 'source-han-sans',
      label: '思源黑体',
      description: t('font.sourceHanSansDescription'),
      css: '"Source Han Sans SC", "Source Han Sans CN", "Noto Sans CJK SC", "思源黑体", "Microsoft YaHei", sans-serif'
    },
    {
      value: 'source-han-serif',
      label: '思源宋体',
      description: t('font.sourceHanSerifDescription'),
      css: '"Source Han Serif SC", "Source Han Serif CN", "Noto Serif CJK SC", "思源宋体", "Songti SC", serif'
    },
    {
      value: 'serif',
      label: t('font.serif'),
      description: t('font.serifDescription'),
      css: 'Georgia, "Times New Roman", ui-serif, serif'
    },
    {
      value: 'mono',
      label: t('font.mono'),
      description: t('font.monoDescription'),
      css: '"Cascadia Code", "SFMono-Regular", Consolas, ui-monospace, monospace'
    }
  ];

  let profiles: Profile[] = [];
  let characters: Character[] = [];
  let personas: UserPersona[] = [];
  let personaCharacterBindings: PersonaCharacterBinding[] = [];
  let worldBooks: WorldBook[] = [];
  let conversations: Conversation[] = [];
  let conversationQuery = '';
  let conversationCursor: { updatedAt: number; id: string } | null = null;
  let conversationHasMore = false;
  let conversationSearchTimer: ReturnType<typeof setTimeout> | undefined;
  const conversationPageSize = 80;
  let showArchivedConversations = false;
  let conversationGroupExpanded: Record<string, boolean> = {};
  let activeView: View = 'home';
  let activeDrawer: Drawer = null;
  let appSettings: AppSettings = defaultAppSettings();
  let activeProfileId = '';
  let activeCharacterId = '';
  let activePersonaId = '';
  let activeConversationId = '';
  let activeConversationRecord: Conversation | null = null;
  let conversationTreeSummary: ConversationTreeSummary | null = null;
  let conversationTreeLoading = false;
  let conversationTreeSelectedNodeId = '';
  let conversationTreeActionStatus = '';
  let ConversationTreeDockComponent: ConversationTreeDockComponent | null = null;
  let messages: ChatMessage[] = [];
  let input = '';
  let composerToolsOpen = false;
  let status = t('status.ready');

  let theme: 'light' | 'dark' | 'system' = 'system';

  function applyTheme(t: 'light' | 'dark' | 'system') {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }

  function cycleTheme() {
    const order: ('light' | 'dark' | 'system')[] = ['system', 'light', 'dark'];
    const nextIndex = (order.indexOf(theme) + 1) % order.length;
    theme = order[nextIndex];
    localStorage.setItem('nanke-theme', theme);
    applyTheme(theme);
  }

  onMount(() => {
    const saved = localStorage.getItem('nanke-theme') as 'light' | 'dark' | 'system' | null;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      theme = saved;
    }
    applyTheme(theme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemePreferenceChange = () => {
      if (theme === 'system') applyTheme('system');
    };
    mediaQuery.addEventListener('change', handleThemePreferenceChange);
    return () => mediaQuery.removeEventListener('change', handleThemePreferenceChange);
  });

  let generationAbortController: AbortController | null = null;
  let isGenerating = false;
  let editingMessageNodeId = '';
  let editingMessageContent = '';
  let editingMessageSaving = false;
  let editingMessageStatus = '';
  let pendingMessageDelete: PendingMessageDelete | null = null;
  let deletingMessageNode = false;
  let messageDeleteStatus = '';
  let pendingConversationDelete: Conversation | null = null;
  let deletingConversation = false;
  let conversationDeleteStatus = '';
  let importKind: ImportKind = 'preset';
  let importScope: ImportScope = 'profile';
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
  let newPersonaTitle = '';
  let newPersonaDescription = '';
  let newPersonaDefault = false;
  let personaQuery = '';
  let personaDraftId = '';
  let personaDraftName = '';
  let personaDraftTitle = '';
  let personaDraftDescription = '';
  let personaDraftDefault = false;
  let personaAvatarUploading = false;
  let personaDeleting = false;
  let lastPersonaAutoCharacterId = '';
  let newWorldBookName = '';
  let activeWorldBookId = '';
  let worldBookDraftId = '';
  let worldBookDraftName = '';
  let worldBookDraftEntries: WorldBookEntry[] = [];
  let activeWorldBookEntryId = '';
  let worldBookEntryQuery = '';
  let worldBookSortMode = 'order-desc';
  let worldBookBindingCharacterId = '';
  let deletingWorldBook = false;
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
  let samplerPanelHeading = t('profile.openAIParams');
  let maxTokensFieldLabel = t('profile.maxCompletion');
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
      ? t('profile.geminiParams')
      : profileDraftOpenAICompatibility === 'extended'
        ? t('profile.extendedParams')
        : t('profile.openAIParams');
  $: maxTokensFieldLabel =
    profileDraftProviderType === 'gemini' ? t('profile.maxOutput') : profileDraftOpenAICompatibility === 'extended' ? t('profile.maxTokens') : t('profile.maxCompletion');
  $: candidateCountFieldLabel = profileDraftProviderType === 'gemini' ? t('profile.candidates') : 'N';
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
  $: worldBookBindingCharacter = characters.find((character) => character.id === worldBookBindingCharacterId);
  $: worldBookBoundCharacters = characters.filter((character) => (activeWorldBook ? isWorldBookBoundToCharacter(character, activeWorldBook.id) : false));
  $: worldBookEnabledCharacters = characters.filter((character) => (activeWorldBook ? isWorldBookEnabledForCharacter(character, activeWorldBook.id) : false));
  $: filteredWorldBookEntries = filterWorldBookEntries(worldBookDraftEntries, worldBookEntryQuery, worldBookSortMode);
  $: activeWorldBookEntry = worldBookDraftEntries.find((entry) => entry.id === activeWorldBookEntryId);
  $: activePersona = personas.find((persona) => persona.id === activePersonaId);
  $: filteredPersonas = filterPersonas(personas, personaQuery);
  $: activeCharacterPersonaBinding = activeCharacter
    ? personaCharacterBindings.find((binding) => binding.characterId === activeCharacter.id && binding.enabled)
    : undefined;
  $: activeCharacterPersona = activeCharacterPersonaBinding ? personas.find((persona) => persona.id === activeCharacterPersonaBinding.personaId) : undefined;
  $: activePersonaBoundToActiveCharacter = Boolean(
    activePersona && activeCharacter && personaCharacterBindings.some((binding) => binding.personaId === activePersona.id && binding.characterId === activeCharacter.id && binding.enabled)
  );
  $: activePersonaLockedToConversation = Boolean(activeConversationId && activeConversationRecord?.personaId === activePersonaId);
  $: activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? (activeConversationRecord?.id === activeConversationId ? activeConversationRecord : undefined);
  $: conversationGroups = groupConversations(conversations, showArchivedConversations);
  $: homeRecentConversations = conversations.filter((conversation) => !conversation.archivedAt).slice(0, 5);
  $: homeCharacters = filterCharacters(characters, '', 'favorite').slice(0, 5);
  $: isGenerating = generationAbortController !== null;
  $: activeLeafMessage = messages[messages.length - 1];
  $: canContinueActiveLeaf =
    Boolean(activeConversationId) &&
    activeLeafMessage?.role === 'assistant' &&
    Boolean(messageNodeId(activeLeafMessage)) &&
    !isGenerating &&
    !editingMessageSaving &&
    !deletingMessageNode;
  $: drawerTitle =
    activeDrawer === 'chats'
      ? t('drawer.chats')
      : activeDrawer === 'characters'
        ? t('drawer.characters')
        : activeDrawer === 'personas'
          ? t('drawer.personas')
          : activeDrawer === 'worldbooks'
            ? t('drawer.worldbooks')
            : activeDrawer === 'profiles'
              ? t('drawer.profiles')
              : activeDrawer === 'import'
                ? importScopeTitle(importScope)
                : activeDrawer === 'inspector'
                  ? t('drawer.inspector')
                  : activeDrawer === 'settings'
                    ? t('drawer.settings')
                    : '';
  $: drawerIsRight = activeDrawer === 'import' || activeDrawer === 'inspector' || activeDrawer === 'settings';
  $: importOptions = importKindsByScope[importScope];
  $: if (!importOptions.includes(importKind)) {
    importKind = importOptions[0];
  }
  $: appSettingsStyle = `--app-font-family: ${appFontFamilyCss(appSettings.fontFamily)}; --app-ui-font-size: ${appSettings.uiFontSize}px; --app-chat-font-size: ${appSettings.chatFontSize}px;`;
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
    personaDraftTitle = activePersona?.title ?? '';
    personaDraftDescription = activePersona?.description ?? '';
    personaDraftDefault = activePersona?.isDefault ?? false;
  }
  $: if (!activeConversationId && activeCharacterId && activeCharacterId !== lastPersonaAutoCharacterId) {
    lastPersonaAutoCharacterId = activeCharacterId;
    if (activeCharacterPersona) activePersonaId = activeCharacterPersona.id;
  }
  $: if (activeWorldBookId !== worldBookDraftId) {
    loadWorldBookDraft(activeWorldBook);
  }
  $: if (activeWorldBook && (!worldBookBindingCharacterId || !characters.some((character) => character.id === worldBookBindingCharacterId))) {
    worldBookBindingCharacterId = activeCharacterId || characters[0]?.id || '';
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
    loadAppSettings();
    loadConversationGroupState();
    void refreshAll();
  });

  function defaultAppSettings(): AppSettings {
    return {
      fontFamily: 'system',
      uiFontSize: 14,
      chatFontSize: 15
    };
  }

  function appFontFamilyCss(value: AppFontFamily) {
    return appFontFamilies.find((font) => font.value === value)?.css ?? appFontFamilies[0].css;
  }

  function clampSetting(value: unknown, min: number, max: number, fallback: number) {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function isAppFontFamily(value: unknown): value is AppFontFamily {
    return appFontFamilies.some((font) => font.value === value);
  }

  function normalizeAppSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
    const defaults = defaultAppSettings();
    const candidateFontFamily = value?.fontFamily;
    const fontFamily = isAppFontFamily(candidateFontFamily) ? candidateFontFamily : defaults.fontFamily;
    return {
      fontFamily,
      uiFontSize: clampSetting(value?.uiFontSize, 12, 18, defaults.uiFontSize),
      chatFontSize: clampSetting(value?.chatFontSize, 13, 24, defaults.chatFontSize)
    };
  }

  function loadAppSettings() {
    try {
      const raw = localStorage.getItem(appSettingsStorageKey);
      appSettings = raw ? normalizeAppSettings(JSON.parse(raw) as Partial<AppSettings>) : defaultAppSettings();
    } catch {
      appSettings = defaultAppSettings();
    }
  }

  function saveAppSettings(next: AppSettings) {
    appSettings = normalizeAppSettings(next);
    localStorage.setItem(appSettingsStorageKey, JSON.stringify(appSettings));
  }

  function updateAppSettings(patch: Partial<AppSettings>) {
    saveAppSettings({ ...appSettings, ...patch });
  }

  function resetAppSettings() {
    saveAppSettings(defaultAppSettings());
  }

  function normalizeConversationGroupState(value: unknown): Record<string, boolean> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[0] === 'string' && typeof entry[1] === 'boolean'));
  }

  function loadConversationGroupState() {
    try {
      const raw = localStorage.getItem(conversationGroupStateStorageKey);
      conversationGroupExpanded = raw ? normalizeConversationGroupState(JSON.parse(raw)) : {};
    } catch {
      conversationGroupExpanded = {};
    }
  }

  function saveConversationGroupState(next: Record<string, boolean>) {
    conversationGroupExpanded = normalizeConversationGroupState(next);
    try {
      localStorage.setItem(conversationGroupStateStorageKey, JSON.stringify(conversationGroupExpanded));
    } catch {
      // The current interaction should still work when browser storage is unavailable.
    }
  }

  function formatLocalTime(value: number) {
    return new Date(value).toLocaleString(t('date.locale'), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function roleLabel(role: string) {
    if (role === 'assistant') return t('role.assistant');
    if (role === 'user') return t('role.user');
    if (role === 'system') return t('role.system');
    if (role === 'root') return t('role.root');
    return role;
  }

  function promptSourceLabel(source: PromptSlotSource) {
    return t(`promptSource.${source}` as Parameters<typeof t>[0]);
  }

  function triggerLabel(trigger: string) {
    return t(`trigger.${trigger}` as Parameters<typeof t>[0]);
  }

  function reasoningEffortLabel(value: OpenAIReasoningEffort) {
    return t(`reasoning.${value}` as Parameters<typeof t>[0]);
  }

  function geminiThinkingModeLabel(value: GeminiThinkingMode | GeminiThinkingLevel) {
    return t(`thinking.${value}` as Parameters<typeof t>[0]);
  }

  function metadataSourceLabel(source?: string) {
    if (source === 'character-card') return t('source.characterCard');
    if (!source || source === 'native') return t('common.native');
    return source;
  }

  function importKindLabel(kind: ImportKind) {
    if (kind === 'preset') return t('import.kind.preset');
    if (kind === 'character-card-json') return t('import.kind.characterJson');
    if (kind === 'character-card-png') return t('import.kind.characterPng');
    if (kind === 'worldbook') return t('import.kind.worldbook');
    if (kind === 'chat-jsonl') return t('import.kind.chatJsonl');
    return t('import.kind.snapshot');
  }

  function importScopeTitle(scope: ImportScope) {
    if (scope === 'character') return t('import.title.character');
    if (scope === 'worldbook') return t('import.title.worldbook');
    return t('import.title.profile');
  }

  function openHome() {
    activeView = 'home';
    closeDrawer();
    closeConversationTree();
  }

  function openChatWorkspace() {
    activeView = 'chat';
    closeDrawer();
  }

  function openLibrary(drawer: Exclude<Drawer, 'chats' | 'settings' | 'import' | 'inspector' | null>) {
    activeDrawer = activeDrawer === drawer ? null : drawer;
  }

  function openDrawer(drawer: Exclude<Drawer, null>) {
    activeDrawer = activeDrawer === drawer ? null : drawer;
    if (activeDrawer === 'chats') {
      void refreshConversations({ reset: true });
    }
  }

  function openImport(scope: ImportScope, kind: ImportKind = importKindsByScope[scope][0]) {
    importScope = scope;
    importKind = importKindsByScope[scope].includes(kind) ? kind : importKindsByScope[scope][0];
    importName = '';
    importText = '';
    importFileName = '';
    importFileBase64 = '';
    activeDrawer = 'import';
  }

  function openPresetImport() {
    openImport('profile', 'preset');
  }

  function closeDrawer() {
    activeDrawer = null;
  }

  function startNewConversation() {
    activeConversationId = '';
    activeConversationRecord = null;
    openingPreviewCharacterId = '';
    messages = [];
    activePersonaId = activeCharacterPersona?.id ?? personas.find((persona) => persona.isDefault)?.id ?? personas[0]?.id ?? '';
    lastPersonaAutoCharacterId = activeCharacterId;
    activeView = 'chat';
    closeDrawer();
  }

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as T;
  }

  function rememberConversation(conversation: Conversation) {
    if (conversation.id === activeConversationId) activeConversationRecord = conversation;
    const shouldKeep = showArchivedConversations || !conversation.archivedAt || conversation.id === activeConversationId;
    conversations = [
      ...(shouldKeep ? [conversation] : []),
      ...conversations.filter((item) => item.id !== conversation.id)
    ].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }

  async function refreshConversationState(id: string, options: { close?: boolean } = {}) {
    const conversation = await fetchJson<Conversation>(`/api/conversations?id=${encodeURIComponent(id)}`);
    activeConversationId = conversation.id;
    activeConversationRecord = conversation;
    messages = conversation.messages ?? [];
    activeCharacterId = conversation.characterId ?? activeCharacterId;
    activePersonaId = conversation.personaId ?? activePersonaId;
    activeProfileId = conversation.profileId ?? activeProfileId;
    rememberConversation(conversation);
    if (options.close) closeDrawer();
    return conversation;
  }

  async function ensureConversationTreeDock() {
    if (!ConversationTreeDockComponent) {
      ConversationTreeDockComponent = (await import('$lib/ui/features/conversation-tree/ConversationTreeDock.svelte')).default as ConversationTreeDockComponent;
    }
  }

  async function loadConversationTree(id: string) {
    const summary = await fetchJson<ConversationTreeSummary>(`/api/conversations?id=${encodeURIComponent(id)}&tree=true`);
    conversationTreeSummary = summary;
    conversationTreeSelectedNodeId = summary.conversation.activeLeafId ?? summary.nodes.find((node) => node.isActiveLeaf)?.id ?? summary.nodes[0]?.id ?? '';
    rememberConversation(summary.conversation);
    return summary;
  }

  async function openConversationTree(event: MouseEvent, conversation: Conversation) {
    event.stopPropagation();
    conversationTreeLoading = true;
    conversationTreeSummary = {
      conversation,
      nodes: []
    };
    closeDrawer();
    try {
      await Promise.all([ensureConversationTreeDock(), loadConversationTree(conversation.id)]);
    } finally {
      conversationTreeLoading = false;
    }
  }

  async function refreshOpenConversationTree() {
    const id = conversationTreeSummary?.conversation.id ?? activeConversationId;
    if (!id) return;
    conversationTreeLoading = true;
    try {
      await Promise.all([ensureConversationTreeDock(), loadConversationTree(id)]);
    } finally {
      conversationTreeLoading = false;
    }
  }

  function closeConversationTree() {
    conversationTreeSummary = null;
    conversationTreeSelectedNodeId = '';
    conversationTreeActionStatus = '';
  }

  function conversationListUrl(cursor = conversationCursor) {
    const params = new URLSearchParams();
    if (showArchivedConversations) params.set('includeArchived', 'true');
    if (conversationQuery.trim()) params.set('q', conversationQuery.trim());
    params.set('limit', String(conversationPageSize));
    if (cursor) {
      params.set('beforeUpdatedAt', String(cursor.updatedAt));
      params.set('beforeId', cursor.id);
    }
    return `/api/conversations${params.size ? `?${params}` : ''}`;
  }

  async function refreshConversations(options: { reset?: boolean } = {}) {
    const cursor = options.reset ? null : conversationCursor;
    const page = await fetchJson<Conversation[]>(conversationListUrl(cursor));
    const next = options.reset ? page : [...conversations, ...page.filter((conversation) => !conversations.some((item) => item.id === conversation.id))];
    conversations = next;
    const last = page.at(-1);
    conversationCursor = typeof last?.updatedAt === 'number' && last.id ? { updatedAt: last.updatedAt, id: last.id } : cursor;
    conversationHasMore = page.length === conversationPageSize;
  }

  function queueConversationSearch() {
    if (conversationSearchTimer) clearTimeout(conversationSearchTimer);
    conversationSearchTimer = setTimeout(() => {
      void refreshConversations({ reset: true });
    }, 220);
  }

  async function loadMoreConversations() {
    await refreshConversations();
  }

  async function toggleArchivedConversations() {
    showArchivedConversations = !showArchivedConversations;
    await refreshConversations({ reset: true });
  }

  function groupConversations(items: Conversation[], includeArchived: boolean): ConversationGroup[] {
    const groups = new Map<string, ConversationGroup>();
    for (const conversation of items) {
      if (!includeArchived && conversation.archivedAt) continue;
      const character = conversation.characterId ? characters.find((item) => item.id === conversation.characterId) : undefined;

      const key = conversation.characterId ?? 'none';
      const group =
        groups.get(key) ??
        ({
          key,
          label: character?.name ?? t('chat.noCharacter'),
          avatarUrl: characterAvatarUrl(character),
          count: 0,
          latestUpdatedAt: undefined,
          conversations: []
        } satisfies ConversationGroup);
      group.count += 1;
      group.latestUpdatedAt = Math.max(group.latestUpdatedAt ?? 0, conversation.updatedAt ?? 0);
      group.conversations.push(conversation);
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  function isConversationGroupExpanded(group: ConversationGroup) {
    if (conversationQuery.trim()) return true;
    return conversationGroupExpanded[group.key] ?? false;
  }

  function setConversationGroupExpanded(group: ConversationGroup, expanded: boolean) {
    if (conversationQuery.trim()) return;
    saveConversationGroupState({
      ...conversationGroupExpanded,
      [group.key]: expanded
    });
  }

  function conversationGroupDomId(group: ConversationGroup) {
    return `conversation-group-${group.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  function conversationGroupSummary(group: ConversationGroup) {
    const latest = group.latestUpdatedAt ? formatLocalTime(group.latestUpdatedAt) : '';
    return latest ? t('chat.groupSummary', { count: group.count, time: latest }) : t('chat.groupCount', { count: group.count });
  }

  function conversationSummary(conversation: Conversation) {
    const parts = [
      t('chat.nodes', { count: conversation.nodeCount ?? 0 }),
      conversation.branchCount ? t('chat.branches', { count: conversation.branchCount }) : '',
      conversation.archivedAt ? t('chat.archived') : ''
    ].filter(Boolean);
    return parts.join(' · ') || t('chat.empty');
  }

  function conversationPreview(conversation: Conversation) {
    return conversation.lastPreview?.trim() || conversation.id;
  }

  function conversationUpdatedLabel(conversation: Conversation) {
    if (!conversation.updatedAt) return '';
    return formatLocalTime(conversation.updatedAt);
  }

  function homeConversationCharacter(conversation: Conversation) {
    return conversation.characterId ? characters.find((character) => character.id === conversation.characterId) : undefined;
  }

  function homeConversationAvatarUrl(conversation: Conversation) {
    return characterAvatarUrl(homeConversationCharacter(conversation));
  }

  function homeConversationCharacterName(conversation: Conversation) {
    return homeConversationCharacter(conversation)?.name ?? t('chat.noCharacter');
  }

  function homeConversationPreview(conversation: Conversation) {
    return conversation.lastPreview?.trim() || t('chat.empty');
  }

  async function refreshAll() {
    status = t('status.loading');
    const [nextProfiles, nextCharacters, nextPersonas, nextPersonaCharacterBindings, nextWorldBooks, nextConversations] = await Promise.all([
      fetchJson<Profile[]>('/api/profiles'),
      fetchJson<Character[]>('/api/characters'),
      fetchJson<UserPersona[]>('/api/personas'),
      fetchJson<PersonaCharacterBinding[]>('/api/personas/bindings'),
      fetchJson<WorldBook[]>('/api/worldbooks'),
      fetchJson<Conversation[]>(conversationListUrl(null))
    ]);
    profiles = nextProfiles;
    characters = nextCharacters;
    personas = nextPersonas;
    personaCharacterBindings = nextPersonaCharacterBindings;
    worldBooks = nextWorldBooks;
    conversations = nextConversations;
    const lastConversation = nextConversations.at(-1);
    conversationCursor = typeof lastConversation?.updatedAt === 'number' && lastConversation.id ? { updatedAt: lastConversation.updatedAt, id: lastConversation.id } : null;
    conversationHasMore = nextConversations.length === conversationPageSize;
    activeProfileId ||= profiles[0]?.id ?? '';
    activeCharacterId ||= characters[0]?.id ?? '';
    worldBookBindingCharacterId ||= activeCharacterId || characters[0]?.id || '';
    activePersonaId ||= personas.find((persona) => persona.isDefault)?.id ?? personas[0]?.id ?? '';
    if (!activeWorldBookId || !worldBooks.some((worldBook) => worldBook.id === activeWorldBookId)) {
      activeWorldBookId = worldBooks[0]?.id ?? '';
    }
    status = t('status.ready');
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
    return kind ? `SillyTavern ${kind}` : t('profile.nativeOrigin');
  }

  function profileSamplerLine(profile: Profile) {
    const sampler = profile.sampler ?? {};
    const parts = [
      sampler.temperature !== undefined ? t('profile.samplerTemp', { value: sampler.temperature }) : '',
      sampler.topP !== undefined ? t('profile.samplerTopP', { value: sampler.topP }) : '',
      sampler.maxTokens !== undefined ? t('profile.samplerOut', { value: sampler.maxTokens }) : '',
      sampler.contextTokens !== undefined ? t('profile.samplerCtx', { value: sampler.contextTokens }) : '',
      profile.request?.stream === false ? t('profile.nonStream') : t('profile.stream')
    ].filter(Boolean);
    return parts.join(' · ') || t('profile.noSamplerDetails');
  }

  function normalizedWorldBookBindingsForCharacter(character?: Character) {
    const bindings = new Map<string, { worldBookId: string; enabled: boolean; primary: boolean }>();
    for (const id of character?.worldBookIds ?? []) {
      if (!id || bindings.has(id)) continue;
      bindings.set(id, { worldBookId: id, enabled: true, primary: false });
    }
    for (const binding of character?.worldBookBindings ?? []) {
      if (!binding.worldBookId) continue;
      bindings.set(binding.worldBookId, {
        worldBookId: binding.worldBookId,
        enabled: binding.enabled !== false,
        primary: binding.primary === true
      });
    }
    if (character?.characterBook?.id && !bindings.has(character.characterBook.id) && character.worldBookBindings === undefined) {
      bindings.set(character.characterBook.id, {
        worldBookId: character.characterBook.id,
        enabled: true,
        primary: true
      });
    }
    return [...bindings.values()];
  }

  function worldBookBindingForCharacter(character: Character | undefined, worldBookId: string) {
    return normalizedWorldBookBindingsForCharacter(character).find((binding) => binding.worldBookId === worldBookId);
  }

  function isWorldBookBoundToCharacter(character: Character | undefined, worldBookId: string) {
    return Boolean(worldBookBindingForCharacter(character, worldBookId));
  }

  function isWorldBookEnabledForCharacter(character: Character | undefined, worldBookId: string) {
    const binding = worldBookBindingForCharacter(character, worldBookId);
    return Boolean(binding && binding.enabled !== false);
  }

  function boundWorldBooksForCharacter(character?: Character) {
    if (!character) return [];
    const ids = new Set(normalizedWorldBookBindingsForCharacter(character).map((binding) => binding.worldBookId));
    return worldBooks.filter((worldBook) => ids.has(worldBook.id) || (!character.worldBookBindings?.length && worldBook.metadata?.characterId === character.id));
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
    if (!character) return t('character.noCharacter');
    if (character.legacy?.source === 'sillytavern') return t('character.sillyTavernCard');
    return t('character.nankeNative');
  }

  function characterListLine(character: Character) {
    const stats = characterStats(character);
    const parts = [
      t('character.tokens', { count: stats.tokens }),
      stats.worldBooks ? t('character.loreCount', { count: stats.worldBooks }) : '',
      stats.tags ? t('character.tagsCount', { count: stats.tags }) : '',
      character.favorite ? t('common.favorite') : '',
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
    const bound = characters.filter((character) => isWorldBookBoundToCharacter(character, worldBook.id));
    const enabled = bound.filter((character) => isWorldBookEnabledForCharacter(character, worldBook.id));
    if (worldBook.metadata?.source === 'character-card') {
      const characterLabel = bound.length
        ? t('worldbook.boundCharacterSummary', { enabled: enabled.length, total: bound.length })
        : t('worldbook.boundToCharacter', { count: worldBook.entries.length, character: worldBook.metadata.characterName ?? t('common.character') });
      return `${t('worldbook.entries', { count: worldBook.entries.length })} · ${characterLabel}`;
    }
    if (bound.length) {
      return `${t('worldbook.entries', { count: worldBook.entries.length })} · ${t('worldbook.boundCharacterSummary', { enabled: enabled.length, total: bound.length })}`;
    }
    return t('worldbook.entries', { count: worldBook.entries.length });
  }

  function worldBookStats(entries: WorldBookEntry[]) {
    const enabled = entries.filter((entry) => entry.enabled !== false).length;
    const constant = entries.filter((entry) => entry.constant).length;
    const regex = entries.filter((entry) => entry.extensions.use_regex === true).length;
    return { total: entries.length, enabled, constant, regex };
  }

  function entryTitle(entry?: WorldBookEntry) {
    if (!entry) return t('worldbook.noEntry');
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
    if (status === 'disabled') return t('worldbook.status.disabled');
    if (status === 'constant') return t('worldbook.status.constant');
    return t('worldbook.status.normal');
  }

  function entryMetaLine(entry: WorldBookEntry) {
    const parts = [
      entry.position === 'depth' ? `@${entry.depth} ${roleLabel(entry.role)}` : worldBookPositions.find((position) => position.value === entry.position)?.label ?? entry.position,
      t('worldbook.orderMeta', { order: entry.order }),
      `${entry.probability}%`,
      entry.selective ? t('worldbook.selectiveMeta') : '',
      entry.extensions.use_regex === true ? t('common.regex') : ''
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

  async function saveCharacterWorldBookBindings(character: Character, bindings: Array<{ worldBookId: string; enabled: boolean; primary: boolean }>) {
    const unique = new Map<string, { worldBookId: string; enabled: boolean; primary: boolean }>();
    for (const binding of bindings) {
      if (!binding.worldBookId) continue;
      unique.set(binding.worldBookId, {
        worldBookId: binding.worldBookId,
        enabled: binding.enabled !== false,
        primary: binding.primary === true
      });
    }
    const nextBindings = [...unique.values()];
    status = t('status.saving');
    const saved = await fetchJson<Character>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...character,
        worldBookIds: nextBindings.map((binding) => binding.worldBookId),
        worldBookBindings: nextBindings,
        updatedAt: Date.now()
      })
    });
    characters = characters.map((item) => (item.id === saved.id ? saved : item));
    if (activeCharacterId === saved.id) {
      loadCharacterDraft(saved);
    }
    status = t('status.ready');
    return saved;
  }

  async function bindWorldBookToCharacter(character: Character | undefined = worldBookBindingCharacter, worldBook: WorldBook | undefined = activeWorldBook) {
    if (!character || !worldBook) return;
    const bindings = normalizedWorldBookBindingsForCharacter(character);
    const current = bindings.find((binding) => binding.worldBookId === worldBook.id);
    const next = current
      ? bindings.map((binding) => (binding.worldBookId === worldBook.id ? { ...binding, enabled: true } : binding))
      : [
          ...bindings,
          {
            worldBookId: worldBook.id,
            enabled: true,
            primary: character.characterBook?.id === worldBook.id
          }
        ];
    await saveCharacterWorldBookBindings(character, next);
  }

  async function setWorldBookBindingEnabled(character: Character | undefined, worldBook: WorldBook | undefined, enabled: boolean) {
    if (!character || !worldBook) return;
    const bindings = normalizedWorldBookBindingsForCharacter(character);
    const current = bindings.find((binding) => binding.worldBookId === worldBook.id);
    const next = current
      ? bindings.map((binding) => (binding.worldBookId === worldBook.id ? { ...binding, enabled } : binding))
      : [
          ...bindings,
          {
            worldBookId: worldBook.id,
            enabled,
            primary: character.characterBook?.id === worldBook.id
          }
        ];
    await saveCharacterWorldBookBindings(character, next);
  }

  async function unbindWorldBookFromCharacter(character: Character | undefined, worldBook: WorldBook | undefined) {
    if (!character || !worldBook) return;
    const bindings = normalizedWorldBookBindingsForCharacter(character).filter((binding) => binding.worldBookId !== worldBook.id);
    await saveCharacterWorldBookBindings(character, bindings);
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

  function filterPersonas(items: UserPersona[], query: string) {
    const text = query.trim().toLowerCase();
    const sorted = [...items].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    if (!text) return sorted;
    return sorted.filter((persona) => [persona.name, persona.title, persona.description].join(' ').toLowerCase().includes(text));
  }

  function personaAvatarUrl(persona?: UserPersona): string {
    return persona?.avatarAssetId ? `/api/assets/${persona.avatarAssetId}` : '';
  }

  function personaInitials(persona?: UserPersona): string {
    return Array.from(persona?.name?.trim() || t('role.user'))[0]?.toUpperCase() ?? '?';
  }

  function personaTokenEstimate(persona?: UserPersona): number {
    if (!persona?.description.trim()) return 0;
    return Math.ceil(persona.description.trim().length / 3.6);
  }

  function personaBindingLabel(persona: UserPersona): string {
    const labels = [
      persona.isDefault ? t('persona.default') : '',
      activeCharacter && personaCharacterBindings.some((binding) => binding.personaId === persona.id && binding.characterId === activeCharacter.id && binding.enabled)
        ? t('persona.boundToCurrentCharacter')
        : '',
      activeConversationRecord?.personaId === persona.id ? t('persona.lockedToCurrentChat') : ''
    ].filter(Boolean);
    return labels.join(' · ') || persona.title || persona.id;
  }

  function upsertPersona(persona: UserPersona) {
    personas = [
      persona,
      ...personas.filter((item) => item.id !== persona.id).map((item) => (persona.isDefault ? { ...item, isDefault: false } : item))
    ].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
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
      status = t('status.profileNameRequired');
      return false;
    }

    status = t('status.saving');
    try {
      const saved = await saveProfilePayload(buildProfileFromDraft(activeProfile));
      profiles = profiles.map((profile) => (profile.id === saved.id ? saved : profile));
      activeProfileId = saved.id;
      loadProfileDraft(saved);
      status = t('status.ready');
      return true;
    } catch (error) {
      console.error(error);
      status = t('status.profileSaveFailed');
      return false;
    }
  }

  async function duplicateActiveProfile() {
    if (!activeProfile) return;
    if (!profileDraftName.trim()) {
      status = t('status.profileNameRequired');
      return;
    }

    const now = Date.now();
    const copy = buildProfileFromDraft(activeProfile);
    const duplicate: Profile = {
      ...copy,
      id: crypto.randomUUID(),
      name: t('profile.copySuffix', { name: copy.name }),
      createdAt: now,
      updatedAt: now,
      metadata: structuredClone(copy.metadata ?? {}),
      legacy: copy.legacy ? structuredClone(copy.legacy) : undefined
    };

    status = t('status.saving');
    try {
      const saved = await saveProfilePayload(duplicate);
      profiles = [...profiles, saved].sort((a, b) => a.name.localeCompare(b.name));
      activeProfileId = saved.id;
      loadProfileDraft(saved);
      status = t('status.ready');
    } catch (error) {
      console.error(error);
      status = t('status.profileCopyFailed');
    }
  }

  function slotMeta(slot: PromptSlot) {
    const parts: string[] = [promptSourceLabel(slot.source), roleLabel(slot.role)];
    if (slot.legacy?.source === 'sillytavern') parts.push('ST');
    if (slot.legacy?.marker) parts.push(t('profile.slotKind.marker'));
    if (slot.injection?.position === 'absolute') parts.push(`@${slot.injection.depth ?? 4}`);
    if (slot.enabled === false) parts.push(t('common.off'));
    return parts.join(' · ');
  }

  function slotKind(slot: PromptSlot) {
    if (slot.injection?.position === 'absolute') return t('profile.slotKind.inChat');
    if (slot.legacy?.marker) return t('profile.slotKind.marker');
    if (slot.legacy?.systemPrompt && slot.legacy?.forbidOverrides) return t('profile.slotKind.important');
    if (slot.legacy?.systemPrompt) return t('profile.slotKind.system');
    if (slot.source === 'custom') return t('profile.slotKind.custom');
    return t('profile.slotKind.runtime');
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
      label: t('profile.customPrompt'),
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
      label: t('profile.copySuffix', { name: slot.label || slot.id }),
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
        title: input.slice(0, 40) || t('chat.newChat'),
        characterId: activeCharacterId || undefined,
        personaId: activePersonaId || undefined,
        profileId: activeProfileId || undefined
      })
    });
    activeConversationId = conversation.id;
    activeConversationRecord = conversation;
    rememberConversation(conversation);
    if (activeCharacter?.firstMessage && messages.length === 0) {
      messages = [
        {
          role: 'assistant',
          speakerId: activeCharacter.id,
          name: activeCharacter.name,
          speakerAvatarAssetId: activeCharacter.avatarAssetId,
          content: renderCharacterTemplate(activeCharacter.firstMessage)
        }
      ];
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
    const title = window.prompt(t('chat.renamePrompt'), conversation.title)?.trim();
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

  async function cloneConversation(event: MouseEvent, conversation: Conversation) {
    event.stopPropagation();
    status = t('status.cloning');
    const cloned = await fetchJson<Conversation>('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'clone',
        conversationId: conversation.id
      })
    });
    activeConversationId = cloned.id;
    messages = cloned.messages ?? [];
    rememberConversation(cloned);
    activeView = 'chat';
    status = t('status.ready');
  }

  function openConversationDeleteDialog(event: MouseEvent, conversation: Conversation) {
    event.stopPropagation();
    pendingConversationDelete = conversation;
    conversationDeleteStatus = '';
  }

  function closeConversationDeleteDialog() {
    if (deletingConversation) return;
    pendingConversationDelete = null;
    conversationDeleteStatus = '';
  }

  async function confirmConversationDelete() {
    const conversation = pendingConversationDelete;
    if (!conversation || deletingConversation) return;

    deletingConversation = true;
    conversationDeleteStatus = '';
    status = t('status.deleting');
    try {
      await fetchJson<{ deleted: boolean; id: string }>(`/api/conversations?id=${encodeURIComponent(conversation.id)}`, {
        method: 'DELETE'
      });
      conversations = conversations.filter((item) => item.id !== conversation.id);
      if (activeConversationId === conversation.id) {
        activeConversationId = '';
        activeConversationRecord = null;
        openingPreviewCharacterId = '';
        messages = [];
        activeView = 'chat';
      }
      if (conversationTreeSummary?.conversation.id === conversation.id) {
        closeConversationTree();
      }
      pendingConversationDelete = null;
      status = t('status.ready');
    } catch (error) {
      conversationDeleteStatus = error instanceof Error ? error.message : t('chat.deleteConversationFailed');
      status = conversationDeleteStatus;
    } finally {
      deletingConversation = false;
    }
  }

  async function exportConversation(event: MouseEvent, conversation: Conversation) {
    event.stopPropagation();
    status = t('status.exporting');
    try {
      const response = await fetch(`/api/conversations?id=${encodeURIComponent(conversation.id)}&export=true`);
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = conversationSnapshotFilename(conversation.title);
      link.click();
      URL.revokeObjectURL(url);
      status = t('status.ready');
    } catch {
      status = t('status.exportFailed');
    }
  }

  function conversationSnapshotFilename(title: string): string {
    const name =
      title
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, ' ')
      .slice(0, 80) || 'conversation';
    return `${name}.nanke-conversation.json`;
  }

  async function sendMessage() {
    if (isGenerating) {
      stopGeneration();
      return;
    }

    const content = input.trim();
    if (!content) return;
    input = '';
    composerToolsOpen = false;
    inspector = '';
    const conversationId = await ensureConversation();
    messages = [
      ...messages,
      {
        role: 'user',
        speakerId: activePersona?.id,
        name: activePersona?.name,
        speakerAvatarAssetId: activePersona?.avatarAssetId,
        content
      },
      {
        role: 'assistant',
        speakerId: activeCharacter?.id,
        name: activeCharacter?.name,
        speakerAvatarAssetId: activeCharacter?.avatarAssetId,
        content: ''
      }
    ];
    await streamGeneration({
      conversationId,
      profileId: activeProfileId || undefined,
      characterId: activeCharacterId || undefined,
      personaId: activePersonaId || undefined,
      message: content
    });
  }

  function clearComposerInput() {
    input = '';
    composerToolsOpen = false;
  }

  async function continueActiveLeaf() {
    const target = activeLeafMessage;
    const nodeId = target ? messageNodeId(target) : '';
    if (!target || !canContinueActiveLeaf || !nodeId || !activeConversationId) return;
    composerToolsOpen = false;
    inspector = '';
    status = t('status.continuing');
    await streamGeneration(
      {
        conversationId: activeConversationId,
        profileId: activeProfileId || undefined,
        characterId: activeCharacterId || undefined,
        personaId: activePersonaId || undefined,
        continueNodeId: nodeId
      },
      { preserveAssistantOnError: true }
    );
  }

  function showAssistantStreamError(content: string, preserveAssistantOnError = false) {
    if (!preserveAssistantOnError) replaceAssistantDraft(content);
  }

  async function streamGeneration(body: Record<string, unknown>, options: { preserveAssistantOnError?: boolean } = {}) {
    status = t('status.generating');
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
        showAssistantStreamError(`${t('status.providerError')}: ${errorMessage}`, options.preserveAssistantOnError);
        status = t('status.providerError');
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
          showAssistantStreamError(`${t('status.generationError')}: ${event.text ?? ''}`.trim(), options.preserveAssistantOnError);
          status = t('status.generationError');
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
      status = controller.signal.aborted ? t('status.stopped') : t('status.ready');
      if (!controller.signal.aborted && completedConversationId) {
        await refreshConversationState(completedConversationId);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        removeEmptyAssistantDraft();
        status = t('status.stopped');
      } else {
        showAssistantStreamError(`${t('status.generationError')}: ${error instanceof Error ? error.message : ''}`.trim(), options.preserveAssistantOnError);
        status = t('status.generationError');
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
    messages = [
      ...messages,
      {
        role: 'assistant',
        speakerId: activeCharacter?.id,
        name: activeCharacter?.name,
        speakerAvatarAssetId: activeCharacter?.avatarAssetId,
        content
      }
    ];
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
    messages = [
      ...messages,
      {
        role: 'assistant',
        speakerId: activeCharacter?.id,
        name: activeCharacter?.name,
        speakerAvatarAssetId: activeCharacter?.avatarAssetId,
        content: '',
        thinking
      }
    ];
  }

  function replaceAssistantDraft(content: string) {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      const next = [...messages];
      next[next.length - 1] = { ...last, content, thinking: '' };
      messages = next;
      return;
    }
    messages = [
      ...messages,
      {
        role: 'assistant',
        speakerId: activeCharacter?.id,
        name: activeCharacter?.name,
        speakerAvatarAssetId: activeCharacter?.avatarAssetId,
        content
      }
    ];
  }

  function removeEmptyAssistantDraft() {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && !last.content.trim() && !last.thinking?.trim()) {
      messages = messages.slice(0, -1);
    }
  }

  function stopGeneration() {
    generationAbortController?.abort();
    status = t('status.stopping');
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

  async function continueFromMessage(message: ChatMessage) {
    const nodeId = message.branch?.nodeId ?? message.id;
    const conversationId = message.conversationId ?? activeConversationId;
    if (!nodeId || !conversationId || isGenerating) return;
    const conversation = await fetchJson<Conversation>('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set-active-leaf',
        conversationId,
        leafId: nodeId,
        restoreSubtree: false
      })
    });
    activeConversationId = conversation.id;
    messages = conversation.messages ?? [];
    rememberConversation(conversation);
  }

  function messageNodeId(message: ChatMessage): string {
    return message.branch?.nodeId ?? message.id ?? '';
  }

  function messageEditableContent(message: ChatMessage): string {
    return typeof message.content === 'string' ? message.content : '';
  }

  function startEditingMessage(message: ChatMessage) {
    const nodeId = messageNodeId(message);
    if (!nodeId || isGenerating || editingMessageSaving) return;
    const content = messageEditableContent(message);
    editingMessageContent = content;
    editingMessageStatus = '';
    editingMessageNodeId = nodeId;
  }

  function cancelEditingMessage() {
    editingMessageNodeId = '';
    editingMessageContent = '';
    editingMessageStatus = '';
  }

  function editMessageRows(content: string): number {
    return Math.min(14, Math.max(4, content.split(/\r?\n/).length + 1));
  }

  async function saveMessageEdit(message: ChatMessage) {
    const nodeId = message.branch?.nodeId ?? message.id;
    const conversationId = message.conversationId ?? activeConversationId;
    const content = editingMessageContent.trim();
    if (!nodeId || !conversationId || isGenerating || editingMessageSaving) return;
    if (!content) {
      editingMessageStatus = t('chat.messageEmpty');
      return;
    }
    if (content === messageEditableContent(message).trim()) {
      cancelEditingMessage();
      return;
    }

    editingMessageSaving = true;
    editingMessageStatus = t('status.saving');
    try {
      const conversation = await fetchJson<Conversation>('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit-message',
          conversationId,
          nodeId,
          content
        })
      });
      activeConversationId = conversation.id;
      activeConversationRecord = conversation;
      messages = conversation.messages ?? [];
      rememberConversation(conversation);
      if (conversationTreeSummary?.conversation.id === conversation.id) await loadConversationTree(conversation.id);
      cancelEditingMessage();
    } catch (error) {
      editingMessageStatus = error instanceof Error ? error.message : t('chat.editFailed');
    } finally {
      editingMessageSaving = false;
    }
  }

  async function forkMessagePathToConversation(message: ChatMessage) {
    const nodeId = message.branch?.nodeId ?? message.id;
    const conversationId = message.conversationId ?? activeConversationId;
    if (!nodeId || !conversationId || isGenerating) return;
    status = t('status.forking');
    const conversation = await fetchJson<Conversation>('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'fork-path',
        conversationId,
        nodeId
      })
    });
    activeConversationId = conversation.id;
    messages = conversation.messages ?? [];
    rememberConversation(conversation);
    activeView = 'chat';
    status = t('status.ready');
  }

  async function focusConversationTreeNode(node: ConversationTreeNode, restoreSubtree = true) {
    const conversationId = conversationTreeSummary?.conversation.id ?? activeConversationId;
    if (!conversationId || isGenerating || conversationTreeActionStatus) return;
    conversationTreeActionStatus = restoreSubtree ? t('tree.focusingNode') : t('tree.continuingFromNode');
    try {
      const conversation = await fetchJson<Conversation>('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set-active-leaf',
          conversationId,
          leafId: node.id,
          restoreSubtree
        })
      });
      activeConversationId = conversation.id;
      activeConversationRecord = conversation;
      messages = conversation.messages ?? [];
      rememberConversation(conversation);
      await loadConversationTree(conversation.id);
    } finally {
      conversationTreeActionStatus = '';
    }
  }

  function deleteLabel(value: string): string {
    const compact = value.trim().replace(/\s+/g, ' ');
    return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
  }

  function openMessageDeleteDialog(message: ChatMessage) {
    const nodeId = messageNodeId(message);
    const conversationId = message.conversationId ?? activeConversationId;
    if (!nodeId || !conversationId || isGenerating || editingMessageSaving || deletingMessageNode) return;
    pendingMessageDelete = {
      conversationId,
      nodeId,
      label: deleteLabel(message.content || message.thinking || messageSpeaker(message))
    };
    messageDeleteStatus = '';
  }

  function deleteConversationTreeNode(node: ConversationTreeNode) {
    const conversationId = conversationTreeSummary?.conversation.id ?? activeConversationId;
    if (!conversationId || isGenerating || deletingMessageNode) return;
    pendingMessageDelete = {
      conversationId,
      nodeId: node.id,
      label: deleteLabel(node.preview || node.speakerName || node.role)
    };
    messageDeleteStatus = '';
  }

  function closeMessageDeleteDialog() {
    if (deletingMessageNode) return;
    pendingMessageDelete = null;
    messageDeleteStatus = '';
  }

  async function confirmMessageDelete(mode: MessageDeleteMode) {
    const target = pendingMessageDelete;
    if (!target || isGenerating || deletingMessageNode) return;
    deletingMessageNode = true;
    messageDeleteStatus = mode === 'node' ? t('chat.deletingNode') : t('chat.deletingSubtree');
    if (conversationTreeSummary?.conversation.id === target.conversationId) {
      conversationTreeActionStatus = messageDeleteStatus;
    }
    try {
      const conversation = await fetchJson<Conversation>('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode === 'node' ? 'delete-node' : 'delete-node-subtree',
          conversationId: target.conversationId,
          nodeId: target.nodeId
        })
      });
      activeConversationId = conversation.id;
      activeConversationRecord = conversation;
      messages = conversation.messages ?? [];
      rememberConversation(conversation);
      if (editingMessageNodeId === target.nodeId) cancelEditingMessage();
      if (conversationTreeSummary?.conversation.id === conversation.id) await loadConversationTree(conversation.id);
      pendingMessageDelete = null;
      messageDeleteStatus = '';
    } catch (error) {
      messageDeleteStatus = error instanceof Error ? error.message : t('chat.deleteFailed');
    } finally {
      deletingMessageNode = false;
      conversationTreeActionStatus = '';
    }
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
    const content = input.trim() || t('chat.inspectPromptFallback');
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
    const charName = activeCharacter?.name ?? t('role.assistant');
    const userName = activePersona?.name ?? t('role.user');
    return template.replaceAll('{{char}}', charName).replaceAll('{{charIfNotGroup}}', charName).replaceAll('{{user}}', userName);
  }

  function messageSpeaker(message: ChatMessage): string {
    if (message.name?.trim()) return message.name;
    if (message.role === 'assistant') return activeCharacter?.name ?? t('role.assistant');
    if (message.role === 'user') return activePersona?.name ?? t('role.user');
    return t('role.system');
  }

  function messageAvatarUrl(message: ChatMessage): string {
    if (message.speakerAvatarAssetId) return `/api/assets/${message.speakerAvatarAssetId}`;
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
    const charName = activeCharacter?.name ?? t('role.assistant');
    return {
      char: charName,
      charIfNotGroup: charName,
      user: activePersona?.name ?? t('role.user')
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
    openImport('character', 'character-card-png');
  }

  function openWorldBookImport() {
    openImport('worldbook', 'worldbook');
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
      reader.addEventListener('error', () => reject(reader.error ?? new Error('无法读取文件。')));
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
    status = t('status.importing');
    const scope = importScope;
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
      activeDrawer = 'characters';
    } else if (result.type === 'profile' && result.item?.id) {
      activeProfileId = result.item.id;
      activeDrawer = 'profiles';
    } else if (result.type === 'worldbook' && result.item?.id) {
      activeWorldBookId = result.item.id;
      activeDrawer = 'worldbooks';
    } else if (result.type === 'conversation' && result.item?.id) {
      activeConversationId = result.item.id;
      activeView = 'chat';
      closeDrawer();
      await refreshConversationState(result.item.id);
    } else {
      activeDrawer = scope === 'character' ? 'characters' : scope === 'worldbook' ? 'worldbooks' : 'profiles';
    }
    status = t('status.ready');
  }

  async function createCharacter() {
    const name = newCharacterName.trim();
    if (!name) return;
    status = t('status.saving');
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
    status = t('status.ready');
  }

  async function saveActiveCharacter() {
    if (!activeCharacter) return;
    const name = characterDraftName.trim();
    if (!name) return;
    status = t('status.saving');
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
    status = t('status.ready');
  }

  async function toggleCharacterFavorite(character: Character | undefined = activeCharacter) {
    if (!character) return;
    status = t('status.saving');
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
    status = t('status.ready');
  }

  async function duplicateActiveCharacter() {
    if (!activeCharacter) return;
    status = t('status.saving');
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, characterBook: _characterBook, ...rest } = structuredClone(activeCharacter);
    const worldBookBindings = normalizedWorldBookBindingsForCharacter(activeCharacter);
    const character = await fetchJson<Character>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...rest,
        name: t('profile.copySuffix', { name: activeCharacter.name }),
        favorite: false,
        worldBookIds: worldBookBindings.map((binding) => binding.worldBookId),
        worldBookBindings
      })
    });
    characters = [...characters, character];
    activeCharacterId = character.id;
    loadCharacterDraft(character);
    status = t('status.ready');
  }

  async function deleteActiveCharacter() {
    if (!activeCharacter) return;
    const character = activeCharacter;
    if (!confirm(t('character.deleteConfirm', { name: character.name }))) return;
    status = t('status.deleting');
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
    status = t('status.ready');
  }

  async function createPersona() {
    const name = newPersonaName.trim();
    if (!name) return;
    status = t('status.saving');
    const persona = await fetchJson<UserPersona>('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, title: newPersonaTitle.trim(), description: newPersonaDescription.trim(), isDefault: newPersonaDefault })
    });
    upsertPersona(persona);
    activePersonaId = persona.id;
    newPersonaName = '';
    newPersonaTitle = '';
    newPersonaDescription = '';
    newPersonaDefault = false;
    status = t('status.ready');
  }

  async function saveActivePersona() {
    if (!activePersona) return;
    const name = personaDraftName.trim();
    if (!name) return;
    status = t('status.saving');
    const persona = await fetchJson<UserPersona>('/api/personas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: activePersona.id,
        name,
        title: personaDraftTitle.trim(),
        description: personaDraftDescription.trim(),
        isDefault: personaDraftDefault
      })
    });
    upsertPersona(persona);
    personaDraftId = persona.id;
    personaDraftName = persona.name;
    personaDraftTitle = persona.title ?? '';
    personaDraftDescription = persona.description;
    personaDraftDefault = persona.isDefault;
    status = t('status.ready');
  }

  async function setActivePersonaDefault() {
    if (!activePersona) return;
    status = t('status.saving');
    const persona = await fetchJson<UserPersona>('/api/personas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activePersona.id, isDefault: true })
    });
    upsertPersona(persona);
    personaDraftDefault = true;
    status = t('status.ready');
  }

  async function uploadActivePersonaAvatar(event: Event) {
    if (!activePersona) return;
    const inputElement = event.currentTarget as HTMLInputElement;
    const file = inputElement.files?.[0];
    inputElement.value = '';
    if (!file) return;
    personaAvatarUploading = true;
    status = t('status.uploading');
    try {
      const form = new FormData();
      form.set('personaId', activePersona.id);
      form.set('avatar', file);
      const persona = await fetchJson<UserPersona>('/api/personas/avatar', {
        method: 'POST',
        body: form
      });
      upsertPersona(persona);
      status = t('status.ready');
    } finally {
      personaAvatarUploading = false;
    }
  }

  async function clearActivePersonaAvatar() {
    if (!activePersona?.avatarAssetId) return;
    status = t('status.saving');
    const persona = await fetchJson<UserPersona>(`/api/personas/avatar?personaId=${encodeURIComponent(activePersona.id)}`, {
      method: 'DELETE'
    });
    upsertPersona(persona);
    status = t('status.ready');
  }

  async function refreshPersonaBindings(characterId?: string) {
    const query = characterId ? `?characterId=${encodeURIComponent(characterId)}` : '';
    const bindings = await fetchJson<PersonaCharacterBinding[]>(`/api/personas/bindings${query}`);
    if (characterId) {
      personaCharacterBindings = [...personaCharacterBindings.filter((binding) => binding.characterId !== characterId), ...bindings];
    } else {
      personaCharacterBindings = bindings;
    }
  }

  async function toggleActivePersonaCharacterBinding() {
    if (!activePersona || !activeCharacter) return;
    status = t('status.saving');
    if (activePersonaBoundToActiveCharacter) {
      await fetchJson<{ deleted: boolean }>(
        `/api/personas/bindings?personaId=${encodeURIComponent(activePersona.id)}&characterId=${encodeURIComponent(activeCharacter.id)}`,
        { method: 'DELETE' }
      );
    } else {
      await fetchJson<PersonaCharacterBinding>('/api/personas/bindings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId: activePersona.id, characterId: activeCharacter.id, enabled: true })
      });
    }
    await refreshPersonaBindings(activeCharacter.id);
    status = t('status.ready');
  }

  async function lockActivePersonaToCurrentChat() {
    if (!activePersona || !activeConversationId) {
      status = t('persona.noActiveConversation');
      return;
    }
    status = t('status.saving');
    const conversation = await fetchJson<Conversation>('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-persona', conversationId: activeConversationId, personaId: activePersona.id })
    });
    activeConversationRecord = conversation;
    rememberConversation(conversation);
    status = t('status.ready');
  }

  async function duplicateActivePersona() {
    if (!activePersona) return;
    status = t('status.saving');
    const persona = await fetchJson<UserPersona>('/api/personas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'duplicate', id: activePersona.id })
    });
    upsertPersona(persona);
    activePersonaId = persona.id;
    status = t('status.ready');
  }

  async function deleteActivePersona() {
    if (!activePersona) return;
    if (!window.confirm(t('persona.deleteConfirm', { name: activePersona.name }))) return;
    personaDeleting = true;
    status = t('status.deleting');
    try {
      const result = await fetchJson<UserPersonaDeleteResult>(`/api/personas?id=${encodeURIComponent(activePersona.id)}`, {
        method: 'DELETE'
      });
      const remaining = personas.filter((persona) => persona.id !== result.id);
      personas = remaining;
      personaCharacterBindings = personaCharacterBindings.filter((binding) => binding.personaId !== result.id);
      if (activePersonaId === result.id) {
        activePersonaId = remaining.find((persona) => persona.isDefault)?.id ?? remaining[0]?.id ?? '';
      }
      if (activeConversationRecord?.personaId === result.id) {
        activeConversationRecord = { ...activeConversationRecord, personaId: undefined };
      }
      status = t('persona.deleteResult', {
        conversations: result.affectedConversationIds.length,
        bindings: result.removedCharacterBindings
      });
    } finally {
      personaDeleting = false;
    }
  }

  async function createWorldBook() {
    const name = newWorldBookName.trim();
    if (!name) return;
    status = t('status.saving');
    const worldBook = await fetchJson<WorldBook>('/api/worldbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, entries: [] })
    });
    worldBooks = [...worldBooks, worldBook];
    activeWorldBookId = worldBook.id;
    newWorldBookName = '';
    loadWorldBookDraft(worldBook);
    status = t('status.ready');
  }

  async function saveActiveWorldBook() {
    if (!activeWorldBook || !worldBookDraftName.trim()) return;
    status = t('status.saving');
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
    status = t('status.ready');
  }

  async function deleteActiveWorldBook() {
    const worldBook = activeWorldBook;
    if (!worldBook || deletingWorldBook) return;
    const boundCount = characters.filter((character) => isWorldBookBoundToCharacter(character, worldBook.id)).length;
    const confirmed = window.confirm(
      t('worldbook.deleteConfirm', {
        name: worldBook.name,
        entries: worldBook.entries.length,
        characters: boundCount
      })
    );
    if (!confirmed) return;

    deletingWorldBook = true;
    status = t('status.deleting');
    try {
      const result = await fetchJson<WorldBookDeleteResult>(`/api/worldbooks?id=${encodeURIComponent(worldBook.id)}`, {
        method: 'DELETE'
      });
      worldBooks = worldBooks.filter((item) => item.id !== result.id);
      characters = await fetchJson<Character[]>('/api/characters');
      activeWorldBookId = worldBooks[0]?.id ?? '';
      loadWorldBookDraft(worldBooks.find((item) => item.id === activeWorldBookId));
      status = t('worldbook.deleteDone', {
        characters: result.affectedCharacterIds.length,
        bindings: result.removedCharacterBindings
      });
    } catch (error) {
      status = error instanceof Error ? error.message : t('worldbook.deleteFailed');
    } finally {
      deletingWorldBook = false;
    }
  }
</script>

<svelte:head>
  <title>NanKe</title>
</svelte:head>

<main class="workspace" style={appSettingsStyle}>
  <aside class="rail" aria-label={t('nav.navigation')}>
    <div class="brand">NK</div>
    <button
      class="icon-button"
      class:active={activeView === 'home' && !activeDrawer}
      title={t('nav.home')}
      aria-label={t('nav.home')}
      aria-pressed={activeView === 'home' && !activeDrawer}
      on:click={openHome}
    >
      <House size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeView === 'chat' && activeDrawer !== 'chats'}
      title={t('nav.chat')}
      aria-label={t('nav.chat')}
      aria-pressed={activeView === 'chat' && activeDrawer !== 'chats'}
      on:click={openChatWorkspace}
    >
      <MessageCircle size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'chats'}
      title={t('nav.chatHistory')}
      aria-label={t('nav.chatHistory')}
      aria-pressed={activeDrawer === 'chats'}
      on:click={() => openDrawer('chats')}
    >
      <MessageSquare size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'characters'}
      title={t('nav.characters')}
      aria-label={t('nav.characters')}
      aria-pressed={activeDrawer === 'characters'}
      on:click={() => openLibrary('characters')}
    >
      <Bot size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'personas'}
      title={t('nav.personas')}
      aria-label={t('nav.personas')}
      aria-pressed={activeDrawer === 'personas'}
      on:click={() => openLibrary('personas')}
    >
      <UserRound size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'worldbooks'}
      title={t('nav.worldbooks')}
      aria-label={t('nav.worldbooks')}
      aria-pressed={activeDrawer === 'worldbooks'}
      on:click={() => openLibrary('worldbooks')}
    >
      <BookOpen size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'profiles'}
      title={t('nav.profiles')}
      aria-label={t('nav.profiles')}
      aria-pressed={activeDrawer === 'profiles'}
      on:click={() => openLibrary('profiles')}
    >
      <Settings2 size={20} />
    </button>

    <div class="rail-spacer"></div>
    <button
      class="icon-button"
      title={t('nav.theme')}
      aria-label={t('nav.theme')}
      on:click={cycleTheme}
    >
      {#if theme === 'light'}
        <Sun size={20} />
      {:else if theme === 'dark'}
        <Moon size={20} />
      {:else}
        <Monitor size={20} />
      {/if}
    </button>

    <button
      class="icon-button"
      class:active={activeDrawer === 'settings'}
      title={t('nav.settings')}
      aria-label={t('nav.settings')}
      aria-pressed={activeDrawer === 'settings'}
      on:click={() => openDrawer('settings')}
    >
      <SlidersHorizontal size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'inspector'}
      title={t('nav.inspector')}
      aria-label={t('nav.inspector')}
      aria-pressed={activeDrawer === 'inspector'}
      on:click={openInspector}
    >
      <ClipboardList size={20} />
    </button>
  </aside>

  {#if activeView === 'home'}
    <section class="stage home-stage" aria-label={t('home.workspace')}>
      <header class="homebar">
        <div class="home-title">
          <span>{t('home.kicker')}</span>
          <strong>NanKe</strong>
          <small>{t('home.subtitle')}</small>
        </div>
        <div class="homebar-actions">
          <button class="context-chip profile" type="button" on:click={() => openLibrary('profiles')}>
            <Settings2 size={15} />
            <span>{activeProfile ? `${activeProfile.name} · ${activeProfile.provider.model}` : t('chat.noProfile')}</span>
          </button>
          <span class="status-pill">{status}</span>
          <button class="tool-button" type="button" on:click={refreshAll} title={t('common.refresh')} aria-label={t('common.refresh')}>
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      <div class="home-workspace">
        <section class="home-overview" aria-label={t('home.overview')}>
          <div class="home-start">
            <span>{t('home.readyLabel')}</span>
            <h1>{activeCharacter ? t('home.readyWithCharacter', { name: activeCharacter.name }) : t('home.readyNoCharacter')}</h1>
            <p>{activePersona?.name ?? t('role.user')} · {activeProfile ? `${activeProfile.provider.type} · ${activeProfile.provider.model}` : t('chat.noProfileSelected')}</p>
            <div class="home-primary-actions">
              <button class="primary" type="button" disabled={!homeRecentConversations.length} on:click={() => loadConversation(homeRecentConversations[0].id)}>
                <MessageCircle size={16} />{t('home.continueRecent')}
              </button>
              <button class="secondary" type="button" on:click={startNewConversation}>
                <SquarePen size={16} />{t('chat.newChat')}
              </button>
              <button class="secondary" type="button" on:click={() => openLibrary('characters')}>
                <Bot size={16} />{activeCharacter ? t('home.changeCharacter') : t('home.pickCharacter')}
              </button>
            </div>
          </div>

          <div class="home-readiness" aria-label={t('home.currentSetup')}>
            <button type="button" on:click={() => openLibrary('characters')}>
              <Bot size={17} />
              <span>
                <small>{t('common.character')}</small>
                <strong>{activeCharacter?.name ?? t('chat.noCharacter')}</strong>
              </span>
            </button>
            <button type="button" on:click={() => openLibrary('personas')}>
              <UserRound size={17} />
              <span>
                <small>{t('nav.personas')}</small>
                <strong>{activePersona?.name ?? t('role.user')}</strong>
              </span>
            </button>
            <button type="button" on:click={() => openLibrary('profiles')}>
              <Settings2 size={17} />
              <span>
                <small>{t('nav.profiles')}</small>
                <strong>{activeProfile?.name ?? t('chat.noProfile')}</strong>
              </span>
            </button>
            <button type="button" on:click={() => openLibrary('worldbooks')}>
              <BookOpen size={17} />
              <span>
                <small>{t('nav.worldbooks')}</small>
                <strong>{t('home.worldBookCount', { count: worldBooks.length })}</strong>
              </span>
            </button>
          </div>
        </section>

        <div class="home-grid">
          <section class="home-section" aria-label={t('home.recentChats')}>
            <header>
              <div>
                <strong>{t('home.recentChats')}</strong>
                <small>{t('home.recentChatsCount', { count: homeRecentConversations.length })}</small>
              </div>
              <button class="secondary" type="button" on:click={() => openDrawer('chats')}>
                <MessageSquare size={15} />{t('nav.chatHistory')}
              </button>
            </header>

            <div class="home-recent-list">
              {#each homeRecentConversations as conversation}
                <button class="home-recent-row" type="button" on:click={() => loadConversation(conversation.id)}>
                  <span class="home-avatar">
                    {#if homeConversationAvatarUrl(conversation)}
                      <img src={homeConversationAvatarUrl(conversation)} alt={t('chat.avatarAlt', { name: homeConversationCharacterName(conversation) })} />
                    {:else}
                      <MessageCircle size={16} />
                    {/if}
                  </span>
                  <span class="home-recent-copy">
                    <span>
                      <strong>{conversation.title}</strong>
                      <small>{conversationUpdatedLabel(conversation)}</small>
                    </span>
                    <small>{homeConversationCharacterName(conversation)} · {homeConversationPreview(conversation)}</small>
                  </span>
                </button>
              {:else}
                <div class="home-empty">
                  <MessageCircle size={20} />
                  <span>{t('home.noRecentChats')}</span>
                </div>
              {/each}
            </div>
          </section>

          <section class="home-section" aria-label={t('home.characters')}>
            <header>
              <div>
                <strong>{t('home.characters')}</strong>
                <small>{t('home.characterCount', { count: characters.length })}</small>
              </div>
              <button class="secondary" type="button" on:click={openCharacterImport}>
                <FileInput size={15} />{t('common.import')}
              </button>
            </header>

            <div class="home-character-list">
              {#each homeCharacters as character}
                <button class="home-character-row" class:active={character.id === activeCharacterId} type="button" on:click={() => startChatWithCharacter(character)}>
                  <span class="home-avatar">
                    {#if characterAvatarUrl(character)}
                      <img src={characterAvatarUrl(character)} alt={t('chat.avatarAlt', { name: character.name })} />
                    {:else}
                      <span>{characterInitials(character)}</span>
                    {/if}
                  </span>
                  <span>
                    <strong>{character.name}</strong>
                    <small>{characterListLine(character)}</small>
                  </span>
                </button>
              {:else}
                <div class="home-empty">
                  <Bot size={20} />
                  <span>{t('home.noCharacters')}</span>
                </div>
              {/each}
            </div>
          </section>
        </div>
      </div>
    </section>
  {:else}
  <section class="stage" class:tree-open={conversationTreeLoading || Boolean(conversationTreeSummary)} aria-label={t('chat.workspace')}>
    <header class="chatbar">
      <div class="scene">
        <div class="conversation-title-card" aria-label={t('chat.currentConversation')}>
          <MessageCircle size={16} />
          <span>{activeConversation?.title ?? t('chat.unsavedChat')}</span>
        </div>
      </div>

      <div class="context-strip" aria-label={t('chat.currentContext')}>
        <button class="context-chip" type="button" on:click={() => openLibrary('characters')}>
          <Bot size={15} />
          <span>{activeCharacter?.name ?? t('chat.noCharacter')}</span>
        </button>
        <button class="context-chip" type="button" on:click={() => openLibrary('personas')}>
          <UserRound size={15} />
          <span>{activePersona?.name ?? t('role.user')}</span>
        </button>
        <button class="context-chip profile" type="button" on:click={() => openLibrary('profiles')}>
          <Settings2 size={15} />
          <span>{activeProfile ? `${activeProfile.name} · ${activeProfile.provider.model}` : t('chat.noProfile')}</span>
        </button>
        <span class="status-pill">{status}</span>
      </div>

      <div class="toolbar" aria-label={t('chat.actions')}>
        <button class="tool-button" type="button" on:click={startNewConversation} title={t('chat.newChat')} aria-label={t('chat.newChat')}>
          <SquarePen size={17} />
        </button>
        <button class="tool-button" type="button" on:click={refreshAll} title={t('common.refresh')} aria-label={t('common.refresh')}>
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
              {activePersona?.name ?? t('role.user')} · {activeProfile ? `${activeProfile.provider.type} · ${activeProfile.provider.model}` : t('chat.noProfileSelected')}
            </p>
          </div>
        {/if}
        {#each messages as message, index}
          <article class="message-row {message.role}">
            <button class="message-avatar" type="button" aria-label={t('chat.openAvatar', { name: messageSpeaker(message) })} on:click={() => openZoomedAvatar(message)}>
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
                    <span>{t('chat.thinking')}</span>
                  </summary>
                  <div class="thinking-block-content rich">{@html thinkingDisplayContent(message, index)}</div>
                </details>
              {/if}
              {#if editingMessageNodeId && editingMessageNodeId === messageNodeId(message)}
                <div class="message-editor" aria-label={t('chat.editMessage')}>
                  {#key editingMessageNodeId}
                    <textarea
                      bind:value={editingMessageContent}
                      rows={editMessageRows(editingMessageContent)}
                      disabled={editingMessageSaving}
                      aria-label={t('chat.editedContent')}
                    ></textarea>
                  {/key}
                  <div class="message-editor-actions">
                    <button type="button" disabled={editingMessageSaving} on:click={cancelEditingMessage}>
                      <X size={14} /> {t('common.cancel')}
                    </button>
                    <button class="primary" type="button" disabled={editingMessageSaving || !editingMessageContent.trim()} on:click={() => saveMessageEdit(message)}>
                      <Save size={14} /> {editingMessageSaving ? t('common.saving') : t('common.save')}
                    </button>
                  </div>
                  {#if editingMessageStatus}
                    <small>{editingMessageStatus}</small>
                  {/if}
                </div>
              {:else}
                {#if message.content.trim() || !message.thinking?.trim()}
                  <div class="message-content rich">{@html messageDisplayContent(message, index)}</div>
                {/if}
                {#if message.branch}
                  <div class="branch-controls" aria-label={t('chat.messageBranches')}>
                    <button
                      type="button"
                      title={t('chat.editMessage')}
                      aria-label={t('chat.editMessage')}
                      disabled={isGenerating || editingMessageSaving || Boolean(editingMessageNodeId)}
                      on:click={() => startEditingMessage(message)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      class="danger"
                      type="button"
                      title={t('chat.deleteMessage')}
                      aria-label={t('chat.deleteMessage')}
                      disabled={isGenerating || editingMessageSaving || Boolean(editingMessageNodeId) || deletingMessageNode}
                      on:click={() => openMessageDeleteDialog(message)}
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      type="button"
                      title={t('chat.savePathAsChat')}
                      aria-label={t('chat.savePathAsChat')}
                      disabled={isGenerating || editingMessageSaving || Boolean(editingMessageNodeId) || deletingMessageNode}
                      on:click={() => forkMessagePathToConversation(message)}
                    >
                      <MessageSquare size={14} />
                    </button>
                    {#if !message.branch.isLatest}
                      <button
                        type="button"
                        title={t('chat.continueFromHere')}
                        aria-label={t('chat.continueFromHere')}
                        disabled={isGenerating || editingMessageSaving || Boolean(editingMessageNodeId) || deletingMessageNode}
                        on:click={() => continueFromMessage(message)}
                      >
                        <GitBranch size={15} />
                      </button>
                    {/if}
                    {#if message.branch.total > 1 || (message.role === 'assistant' && message.branch.isLatest)}
                      <button
                        type="button"
                        title={t('chat.previousBranch')}
                        aria-label={t('chat.previousBranch')}
                        disabled={isGenerating || editingMessageSaving || Boolean(editingMessageNodeId) || deletingMessageNode || message.branch.current <= 1}
                        on:click={() => switchMessageSibling(message, 'left')}
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <span>{message.branch.current}/{message.branch.total}</span>
                      <button
                        type="button"
                        title={message.branch.current < message.branch.total ? t('chat.nextBranch') : t('chat.regenerateBranch')}
                        aria-label={message.branch.current < message.branch.total ? t('chat.nextBranch') : t('chat.regenerateBranch')}
                        disabled={isGenerating || editingMessageSaving || Boolean(editingMessageNodeId) || deletingMessageNode || (message.branch.current >= message.branch.total && !(message.role === 'assistant' && message.branch.isLatest))}
                        on:click={() => nextMessageBranch(message)}
                      >
                        <ChevronRight size={15} />
                      </button>
                    {/if}
                  </div>
                {/if}
              {/if}
            </div>
          </article>
        {/each}
      </div>
    </div>

    <form class="composer" on:submit|preventDefault={sendMessage}>
      <div class="composer-dock">
        <div class="composer-toolbox">
          <button
            class="composer-toolbox-trigger"
            class:active={composerToolsOpen}
            type="button"
            title={t('chat.tools')}
            aria-label={t('chat.tools')}
            aria-expanded={composerToolsOpen}
            on:click={() => (composerToolsOpen = !composerToolsOpen)}
          >
            <Wrench size={18} />
          </button>
          {#if composerToolsOpen}
            <div class="composer-menu" role="menu" aria-label={t('chat.composerTools')}>
              <button type="button" role="menuitem" disabled={!canContinueActiveLeaf} on:click={continueActiveLeaf}>
                <CornerDownRight size={16} />
                <span>
                  <strong>{t('common.continue')}</strong>
                  <small>{t('chat.extendLastReply')}</small>
                </span>
              </button>
              <button type="button" role="menuitem" disabled={!input.trim()} on:click={clearComposerInput}>
                <Eraser size={16} />
                <span>
                  <strong>{t('chat.clear')}</strong>
                  <small>{t('chat.discardDraft')}</small>
                </span>
              </button>
            </div>
          {/if}
        </div>
        <textarea class="composer-input" bind:value={input} rows="1" placeholder={t('chat.messagePlaceholder')} aria-label={t('chat.messagePlaceholder')}></textarea>
        <button
          class="composer-action"
          class:stopping={isGenerating}
          type={isGenerating ? 'button' : 'submit'}
          title={isGenerating ? t('chat.stopGeneration') : t('chat.sendMessage')}
          aria-label={isGenerating ? t('chat.stopGeneration') : t('chat.sendMessage')}
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
      </div>
    </form>

    {#if conversationTreeLoading || conversationTreeSummary}
      {#if ConversationTreeDockComponent}
        <ConversationTreeDockComponent
          summary={conversationTreeSummary}
          loading={conversationTreeLoading}
          actionStatus={conversationTreeActionStatus}
          selectedNodeId={conversationTreeSelectedNodeId}
          onSelectNode={(nodeId) => (conversationTreeSelectedNodeId = nodeId)}
          onClose={closeConversationTree}
          onRefresh={refreshOpenConversationTree}
          onFocusNode={focusConversationTreeNode}
          onDeleteNode={deleteConversationTreeNode}
        />
      {:else}
        <aside class="tree-dock-loading" aria-label={t('tree.title')}>
          <RefreshCw size={20} />
          <span>{t('tree.loading')}</span>
        </aside>
      {/if}
    {/if}
  </section>
  {/if}

  {#if zoomedAvatar}
    <section class="avatar-viewer" aria-label={t('chat.avatarPreview')} title={zoomedAvatar.name}>
      <div class="avatar-viewer-controls">
        <span aria-hidden="true"><GripHorizontal size={18} /></span>
        <button type="button" title={t('chat.closeAvatar')} aria-label={t('chat.closeAvatar')} on:click={() => (zoomedAvatar = null)}>
          <X size={18} />
        </button>
      </div>
      <div class="avatar-viewer-image" class:user={zoomedAvatar.role === 'user'}>
        {#if zoomedAvatar.src}
          <img src={zoomedAvatar.src} alt={t('chat.avatarAlt', { name: zoomedAvatar.name })} />
        {:else}
          <span>{zoomedAvatar.initials}</span>
        {/if}
      </div>
    </section>
  {/if}

  {#if pendingMessageDelete}
    <section class="delete-dialog-backdrop" role="presentation">
      <div class="delete-dialog" role="dialog" aria-modal="true" aria-label={t('chat.deleteMessage')}>
        <header>
          <Trash2 size={17} />
          <strong>{t('chat.deleteDialogTitle')}</strong>
        </header>
        <p>{pendingMessageDelete.label || t('chat.deleteEmpty')}</p>
        <div class="delete-dialog-actions">
          <button type="button" disabled={deletingMessageNode} on:click={closeMessageDeleteDialog}>
            {t('common.cancel')}
          </button>
          <button type="button" disabled={deletingMessageNode} on:click={() => confirmMessageDelete('node')}>
            {t('chat.deleteNodeOnly')}
          </button>
          <button class="danger" type="button" disabled={deletingMessageNode} on:click={() => confirmMessageDelete('subtree')}>
            {t('chat.deleteWithDescendants')}
          </button>
        </div>
        {#if messageDeleteStatus}
          <small>{messageDeleteStatus}</small>
        {/if}
      </div>
    </section>
  {/if}

  {#if pendingConversationDelete}
    <section class="delete-dialog-backdrop" role="presentation">
      <div class="delete-dialog" role="dialog" aria-modal="true" aria-label={t('chat.delete')}>
        <header>
          <Trash2 size={17} />
          <strong>{t('chat.deleteConversationTitle')}</strong>
        </header>
        <p>
          <strong>{pendingConversationDelete.title}</strong>
          <span>{t('chat.deleteConversationBody')}</span>
        </p>
        <div class="delete-dialog-actions conversation-delete-actions">
          <button type="button" disabled={deletingConversation} on:click={closeConversationDeleteDialog}>
            {t('common.cancel')}
          </button>
          <button class="danger" type="button" disabled={deletingConversation} on:click={confirmConversationDelete}>
            {deletingConversation ? t('status.deleting') : t('chat.delete')}
          </button>
        </div>
        {#if conversationDeleteStatus}
          <small>{conversationDeleteStatus}</small>
        {/if}
      </div>
    </section>
  {/if}

  {#if activeDrawer}
    <button class="scrim" type="button" aria-label={t('common.close')} on:click={closeDrawer}></button>
    <aside
      class="drawer"
      class:right={drawerIsRight}
      class:characters={activeDrawer === 'characters'}
      class:personas={activeDrawer === 'personas'}
      class:profiles={activeDrawer === 'profiles'}
      class:worldbooks={activeDrawer === 'worldbooks'}
      aria-label={drawerTitle}
    >
      <header class="drawer-header">
        <h2>{drawerTitle}</h2>
        <button class="tool-button" type="button" title={t('common.close')} aria-label={t('common.close')} on:click={closeDrawer}>
          <X size={18} />
        </button>
      </header>

      {#if activeDrawer === 'chats'}
        <div class="drawer-actions">
          <button class="secondary full" type="button" on:click={startNewConversation}>
            <MessageSquare size={16} />{t('chat.newChat')}
          </button>
          <label class="search-field">
            <Search size={15} />
            <input bind:value={conversationQuery} placeholder={t('chat.search')} aria-label={t('chat.search')} on:input={queueConversationSearch} />
          </label>
          <label class="checkbox-row compact">
            <input type="checkbox" checked={showArchivedConversations} on:change={toggleArchivedConversations} />
            <span>{t('chat.showArchived')}</span>
          </label>
        </div>
        <div class="conversation-list">
          {#if conversationGroups.length === 0}
            <div class="drawer-empty compact">{t('chat.noChats')}</div>
          {/if}
          {#each conversationGroups as group}
            <details
              class="conversation-group"
              aria-label={group.label}
              open={isConversationGroupExpanded(group)}
              on:toggle={(event) => setConversationGroupExpanded(group, event.currentTarget.open)}
            >
              <summary class="conversation-group-toggle" aria-controls={conversationGroupDomId(group)}>
                <span class="conversation-group-avatar">
                  {#if group.avatarUrl}
                    <img src={group.avatarUrl} alt="" />
                  {:else}
                    <Bot size={15} />
                  {/if}
                </span>
                <span class="conversation-group-copy">
                  <strong>{group.label}</strong>
                  <small>{conversationGroupSummary(group)}</small>
                </span>
                <span class="conversation-group-chevron">
                  <ChevronDown size={16} />
                </span>
              </summary>
              <div class="conversation-group-items" id={conversationGroupDomId(group)}>
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
                      <button type="button" title={t('chat.rename')} aria-label={t('chat.rename')} on:click={(event) => renameConversation(event, conversation)}>
                        <Pencil size={14} />
                      </button>
                      <button type="button" title={t('chat.duplicate')} aria-label={t('chat.duplicate')} on:click={(event) => cloneConversation(event, conversation)}>
                        <Copy size={14} />
                      </button>
                      <button type="button" title={t('chat.openTree')} aria-label={t('chat.openTree')} on:click={(event) => openConversationTree(event, conversation)}>
                        <GitBranch size={14} />
                      </button>
                      <button type="button" title={t('chat.export')} aria-label={t('chat.export')} on:click={(event) => exportConversation(event, conversation)}>
                        <Download size={14} />
                      </button>
                      <button
                        type="button"
                        title={conversation.archivedAt ? t('chat.restore') : t('chat.archive')}
                        aria-label={conversation.archivedAt ? t('chat.restore') : t('chat.archive')}
                        on:click={(event) => archiveConversation(event, conversation)}
                      >
                        {#if conversation.archivedAt}
                          <ArchiveRestore size={14} />
                        {:else}
                          <Archive size={14} />
                        {/if}
                      </button>
                      <button class="danger" type="button" title={t('chat.delete')} aria-label={t('chat.delete')} on:click={(event) => openConversationDeleteDialog(event, conversation)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                {/each}
              </div>
            </details>
          {/each}
          {#if conversationHasMore}
            <button class="secondary full" type="button" on:click={loadMoreConversations}>
              <ArrowDown size={16} />{t('chat.loadMore')}
            </button>
          {/if}
        </div>
      {:else if activeDrawer === 'characters'}
        <div class="character-workspace">
          <section class="character-library" aria-label={t('character.library')}>
            <div class="character-library-actions">
              <button class="primary" type="button" on:click={startCharacterCreate}>
                <Plus size={16} />{t('common.new')}
              </button>
              <button class="secondary" type="button" on:click={openCharacterImport}>
                <FileInput size={16} />{t('common.import')}
              </button>
            </div>

            <div class="character-toolbar">
              <input class="profile-search" bind:value={characterQuery} placeholder={t('character.search')} aria-label={t('character.search')} />
              <select bind:value={characterSortMode} aria-label={t('character.sort')}>
                {#each characterSortModes as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>

            <div class="character-list" aria-label={t('nav.characters')}>
              {#each filteredCharacters as character}
                <article class="character-row" class:active={character.id === activeCharacterId}>
                  <button class="character-row-main" type="button" on:click={() => selectCharacter(character)}>
                    <span class="character-avatar-small">
                      {#if characterAvatarUrl(character)}
                        <img src={characterAvatarUrl(character)} alt={t('chat.avatarAlt', { name: character.name })} />
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
                    title={character.favorite ? t('character.unfavorite') : t('common.favorite')}
                    aria-label={`${character.favorite ? t('character.unfavorite') : t('common.favorite')} ${character.name}`}
                  >
                    <Star size={15} fill={character.favorite ? 'currentColor' : 'none'} />
                  </button>
                </article>
              {:else}
                <div class="drawer-empty compact">{t('character.noMatching')}</div>
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
                      <strong>{newCharacterName.trim() || t('character.newCharacter')}</strong>
                      <span>{t('character.newDraft')}</span>
                    </div>
                    <button
                      class="favorite-button hero-favorite"
                      class:active={newCharacterFavorite}
                      type="button"
                      on:click={() => (newCharacterFavorite = !newCharacterFavorite)}
                      title={newCharacterFavorite ? t('character.unfavorite') : t('common.favorite')}
                      aria-label={t('character.toggleFavorite')}
                    >
                      <Star size={16} fill={newCharacterFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div class="character-chips" aria-label={t('character.statsNew')}>
                    <span>{t('character.tokens', { count: createCharacterStats.tokens })}</span>
                    <span>{t('character.greetings', { count: createCharacterStats.greetings })}</span>
                    <span>{t('character.tagsCount', { count: createCharacterStats.tags })}</span>
                    {#if createCharacterStats.overrides}
                      <span>{t('character.overrides', { count: createCharacterStats.overrides })}</span>
                    {/if}
                  </div>
                </div>

                <div class="character-actions">
                  <button class="tool-button" type="button" on:click={openCharacterImport} title={t('character.importCard')} aria-label={t('character.importCard')}>
                    <FileInput size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={resetNewCharacterDraft} title={t('character.resetDraft')} aria-label={t('character.resetDraft')}>
                    <RotateCcw size={16} />
                  </button>
                  <button class="tool-button" type="submit" title={t('character.create')} aria-label={t('character.create')} disabled={!newCharacterName.trim()}>
                    <Save size={16} />
                  </button>
                </div>
              </header>

              <nav class="character-tabs" aria-label={t('character.newSections')}>
                <button class:active={characterEditorTab === 'core'} type="button" on:click={() => (characterEditorTab = 'core')}>{t('character.tab.core')}</button>
                <button class:active={characterEditorTab === 'prompt'} type="button" on:click={() => (characterEditorTab = 'prompt')}>{t('character.tab.prompt')}</button>
                <button class:active={characterEditorTab === 'lore'} type="button" on:click={() => (characterEditorTab = 'lore')}>{t('character.tab.lore')}</button>
                <button class:active={characterEditorTab === 'metadata'} type="button" on:click={() => (characterEditorTab = 'metadata')}>{t('character.tab.metadata')}</button>
              </nav>

              {#if characterEditorTab === 'core'}
                <section class="character-editor-section">
                  <div class="character-field-grid">
                    <label>
                      <span>{t('common.name')}</span>
                      <input bind:value={newCharacterName} placeholder={t('character.placeholder.name')} />
                    </label>
                    <label>
                      <span>{t('common.tags')}</span>
                      <input bind:value={newCharacterTags} placeholder={t('character.placeholder.tags')} />
                    </label>
                    <label class="span-2">
                      <span>{t('character.description')}</span>
                      <textarea bind:value={newCharacterDescription} rows="8" placeholder={t('character.placeholder.description')}></textarea>
                    </label>
                    <label>
                      <span>{t('character.personality')}</span>
                      <textarea bind:value={newCharacterPersonality} rows="5" placeholder={t('character.placeholder.personality')}></textarea>
                    </label>
                    <label>
                      <span>{t('character.scenario')}</span>
                      <textarea bind:value={newCharacterScenario} rows="5" placeholder={t('character.placeholder.scenario')}></textarea>
                    </label>
                    <label class="span-2">
                      <span>{t('character.firstMessage')}</span>
                      <textarea bind:value={newCharacterFirstMessage} rows="6" placeholder={t('character.placeholder.firstMessage')}></textarea>
                    </label>
                    <label class="span-2">
                      <span>{t('character.alternateGreetings')}</span>
                      <textarea bind:value={newCharacterAlternateGreetings} rows="5" placeholder={t('character.placeholder.alternateGreetings')}></textarea>
                    </label>
                  </div>
                </section>
              {:else if characterEditorTab === 'prompt'}
                <section class="character-editor-section">
                  <div class="character-field-grid">
                    <label class="span-2">
                      <span>{t('character.systemPromptOverride')}</span>
                      <textarea bind:value={newCharacterSystemPrompt} rows="7" placeholder={t('character.placeholder.systemPrompt')}></textarea>
                    </label>
                    <label class="span-2">
                      <span>{t('character.postHistoryInstructions')}</span>
                      <textarea bind:value={newCharacterPostHistoryInstructions} rows="7" placeholder={t('character.placeholder.postHistory')}></textarea>
                    </label>
                    <label class="span-2">
                      <span>{t('character.exampleMessages')}</span>
                      <textarea bind:value={newCharacterExampleMessages} rows="9" placeholder={t('character.placeholder.exampleMessages')}></textarea>
                    </label>
                  </div>
                </section>
              {:else if characterEditorTab === 'lore'}
                <section class="character-editor-section">
                  <div class="character-lore-header">
                    <div>
                      <strong>{t('character.lore')}</strong>
                      <span>{t('character.boundWorldBooks', { count: 0 })}</span>
                    </div>
                    <button class="secondary" type="button" on:click={openCharacterImport}>
                      <FileInput size={16} />{t('common.import')}
                    </button>
                  </div>

                  <label class="character-textarea-label">
                    <span>{t('character.creatorNotes')}</span>
                    <textarea bind:value={newCharacterCreatorNotes} rows="8" placeholder={t('character.placeholder.creatorNotes')}></textarea>
                  </label>
                </section>
              {:else}
                <section class="character-editor-section">
                  <div class="character-field-grid">
                    <label>
                      <span>{t('character.creator')}</span>
                      <input bind:value={newCharacterCreator} placeholder={t('character.creator')} />
                    </label>
                    <label>
                      <span>{t('common.version')}</span>
                      <input bind:value={newCharacterCharacterVersion} placeholder={t('character.characterVersion')} />
                    </label>
                    <label>
                      <span>{t('character.talkativeness')}</span>
                      <input bind:value={newCharacterTalkativeness} inputmode="decimal" placeholder={t('common.optional')} />
                    </label>
                    <div class="character-source-panel">
                      <span>{t('character.cardSource')}</span>
                      <strong>{t('character.nativeDraft')}</strong>
                      <small>{t('character.newCharacter')}</small>
                    </div>
                  </div>
                </section>
              {/if}
            </form>
          {:else if activeCharacter}
            <form class="character-editor" on:submit|preventDefault={saveActiveCharacter}>
              <header class="character-editor-hero">
                <button class="character-avatar-large" type="button" on:click={() => openCharacterAvatar(activeCharacter)} title={t('character.openAvatarPreview')} aria-label={t('chat.openAvatar', { name: activeCharacter.name })}>
                  {#if characterAvatarUrl(activeCharacter)}
                    <img src={characterAvatarUrl(activeCharacter)} alt={t('chat.avatarAlt', { name: activeCharacter.name })} />
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
                      title={characterDraftFavorite ? t('character.unfavoriteOnSave') : t('character.favoriteOnSave')}
                      aria-label={t('character.toggleFavorite')}
                    >
                      <Star size={16} fill={characterDraftFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div class="character-chips" aria-label={t('character.stats')}>
                    <span>{t('character.tokens', { count: activeCharacterStats.tokens })}</span>
                    <span>{t('character.greetings', { count: activeCharacterStats.greetings })}</span>
                    <span>{t('character.loreCount', { count: activeCharacterStats.worldBooks })}</span>
                    <span>{t('character.tagsCount', { count: activeCharacterStats.tags })}</span>
                    {#if activeCharacterStats.overrides}
                      <span>{t('character.overrides', { count: activeCharacterStats.overrides })}</span>
                    {/if}
                  </div>
                </div>

                <div class="character-actions">
                  <button class="tool-button" type="button" on:click={() => startChatWithCharacter(activeCharacter)} title={t('character.startChat')} aria-label={t('character.startChat')}>
                    <MessageCircle size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={openCharacterImport} title={t('character.importCard')} aria-label={t('character.importCard')}>
                    <FileInput size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={duplicateActiveCharacter} title={t('character.duplicate')} aria-label={t('character.duplicate')}>
                    <Copy size={16} />
                  </button>
                  <button class="tool-button danger" type="button" on:click={deleteActiveCharacter} title={t('character.delete')} aria-label={t('character.delete')}>
                    <Trash2 size={16} />
                  </button>
                  <button class="tool-button" type="submit" title={t('character.save')} aria-label={t('character.save')}>
                    <Save size={16} />
                  </button>
                </div>
              </header>

              <nav class="character-tabs" aria-label={t('character.editorSections')}>
                <button class:active={characterEditorTab === 'core'} type="button" on:click={() => (characterEditorTab = 'core')}>{t('character.tab.core')}</button>
                <button class:active={characterEditorTab === 'prompt'} type="button" on:click={() => (characterEditorTab = 'prompt')}>{t('character.tab.prompt')}</button>
                <button class:active={characterEditorTab === 'lore'} type="button" on:click={() => (characterEditorTab = 'lore')}>{t('character.tab.lore')}</button>
                <button class:active={characterEditorTab === 'metadata'} type="button" on:click={() => (characterEditorTab = 'metadata')}>{t('character.tab.metadata')}</button>
              </nav>

              {#if characterEditorTab === 'core'}
                <section class="character-editor-section">
                  <div class="character-field-grid">
                    <label>
                      <span>{t('common.name')}</span>
                      <input bind:value={characterDraftName} placeholder={t('character.placeholder.name')} />
                    </label>
                    <label>
                      <span>{t('common.tags')}</span>
                      <input bind:value={characterDraftTags} placeholder={t('character.placeholder.tags')} />
                    </label>
                    <label class="span-2">
                      <span>{t('character.description')}</span>
                      <textarea bind:value={characterDraftDescription} rows="8" placeholder={t('character.placeholder.description')}></textarea>
                    </label>
                    <label>
                      <span>{t('character.personality')}</span>
                      <textarea bind:value={characterDraftPersonality} rows="5" placeholder={t('character.placeholder.personality')}></textarea>
                    </label>
                    <label>
                      <span>{t('character.scenario')}</span>
                      <textarea bind:value={characterDraftScenario} rows="5" placeholder={t('character.placeholder.scenario')}></textarea>
                    </label>
                    <label class="span-2">
                      <span>{t('character.firstMessage')}</span>
                      <textarea bind:value={characterDraftFirstMessage} rows="6" placeholder={t('character.placeholder.firstMessage')}></textarea>
                    </label>
                    <label class="span-2">
                      <span>{t('character.alternateGreetings')}</span>
                      <textarea bind:value={characterDraftAlternateGreetings} rows="5" placeholder={t('character.placeholder.alternateGreetings')}></textarea>
                    </label>
                  </div>
                </section>
              {:else if characterEditorTab === 'prompt'}
                <section class="character-editor-section">
                  <div class="character-field-grid">
                    <label class="span-2">
                      <span>{t('character.systemPromptOverride')}</span>
                      <textarea bind:value={characterDraftSystemPrompt} rows="7" placeholder={t('character.placeholder.systemPrompt')}></textarea>
                    </label>
                    <label class="span-2">
                      <span>{t('character.postHistoryInstructions')}</span>
                      <textarea bind:value={characterDraftPostHistoryInstructions} rows="7" placeholder={t('character.placeholder.postHistory')}></textarea>
                    </label>
                    <label class="span-2">
                      <span>{t('character.exampleMessages')}</span>
                      <textarea bind:value={characterDraftExampleMessages} rows="9" placeholder={t('character.placeholder.exampleMessages')}></textarea>
                    </label>
                  </div>
                </section>
              {:else if characterEditorTab === 'lore'}
                <section class="character-editor-section">
                  <div class="character-lore-header">
                    <div>
                      <strong>{t('character.lore')}</strong>
                      <span>{t('character.boundWorldBooks', { count: activeCharacterWorldBooks.length })}</span>
                    </div>
                    <button class="secondary" type="button" on:click={() => openCharacterWorldBooks(activeCharacter)}>
                      <BookOpen size={16} />{t('character.openWorldBook')}
                    </button>
                  </div>
                  {#if activeCharacterWorldBooks.length}
                    <div class="character-lore-list">
                      {#each activeCharacterWorldBooks as worldBook}
                        {@const binding = worldBookBindingForCharacter(activeCharacter, worldBook.id)}
                        <article class:disabled={binding?.enabled === false}>
                          <button type="button" on:click={() => { activeWorldBookId = worldBook.id; activeDrawer = 'worldbooks'; worldBookBindingCharacterId = activeCharacter?.id ?? ''; }}>
                            <BookOpen size={16} />
                            <span>
                              <strong>{worldBook.name}</strong>
                              <small>
                                {t('worldbook.entries', { count: worldBook.entries.length })} · {metadataSourceLabel(worldBook.metadata?.source)} · {binding?.enabled === false ? t('worldbook.bindingDisabled') : t('worldbook.bindingEnabled')}
                              </small>
                            </span>
                          </button>
                          <div class="character-lore-actions">
                            <button
                              type="button"
                              title={binding?.enabled === false ? t('worldbook.enableForCharacter') : t('worldbook.disableForCharacter')}
                              aria-label={binding?.enabled === false ? t('worldbook.enableForCharacter') : t('worldbook.disableForCharacter')}
                              on:click={() => setWorldBookBindingEnabled(activeCharacter, worldBook, binding?.enabled === false)}
                            >
                              {#if binding?.enabled === false}
                                <PowerOff size={14} />
                              {:else}
                                <Power size={14} />
                              {/if}
                            </button>
                            <button type="button" title={t('worldbook.unbind')} aria-label={t('worldbook.unbind')} on:click={() => unbindWorldBookFromCharacter(activeCharacter, worldBook)}>
                              <Unlink size={14} />
                            </button>
                          </div>
                        </article>
                      {/each}
                    </div>
                  {:else}
                    <div class="drawer-empty compact">{t('character.noBoundWorldBook')}</div>
                  {/if}

                  <label class="character-textarea-label">
                    <span>{t('character.creatorNotes')}</span>
                    <textarea bind:value={characterDraftCreatorNotes} rows="8" placeholder={t('character.placeholder.creatorNotes')}></textarea>
                  </label>
                </section>
              {:else}
                <section class="character-editor-section">
                  <div class="character-field-grid">
                    <label>
                      <span>{t('character.creator')}</span>
                      <input bind:value={characterDraftCreator} placeholder={t('character.creator')} />
                    </label>
                    <label>
                      <span>{t('common.version')}</span>
                      <input bind:value={characterDraftCharacterVersion} placeholder={t('character.characterVersion')} />
                    </label>
                    <label>
                      <span>{t('character.talkativeness')}</span>
                      <input bind:value={characterDraftTalkativeness} inputmode="decimal" placeholder={t('common.optional')} />
                    </label>
                    <div class="character-source-panel">
                      <span>{t('character.cardSource')}</span>
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
              <strong>{t('character.selectOrCreate')}</strong>
            </section>
          {/if}
        </div>
      {:else if activeDrawer === 'personas'}
        <div class="persona-workspace">
          <section class="persona-library" aria-label={t('persona.library')}>
            <form class="persona-create" on:submit|preventDefault={createPersona}>
              <div class="persona-section-head">
                <strong>{t('persona.create')}</strong>
                <small>{t('persona.createHint')}</small>
              </div>
              <TextField bind:value={newPersonaName} label={t('common.name')} placeholder={t('persona.namePlaceholder')} />
              <TextField bind:value={newPersonaTitle} label={t('persona.title')} placeholder={t('persona.titlePlaceholder')} />
              <TextareaField bind:value={newPersonaDescription} label={t('persona.description')} rows={4} placeholder={t('persona.descriptionPlaceholder')} />
              <label class="checkbox-row compact">
                <input type="checkbox" bind:checked={newPersonaDefault} />
                <span>{t('persona.default')}</span>
              </label>
              <button class="primary full" type="submit"><UserRound size={16} />{t('common.create')}</button>
            </form>

            <label class="search-field persona-search">
              <Search size={15} />
              <input bind:value={personaQuery} placeholder={t('persona.search')} aria-label={t('persona.search')} />
            </label>

            <div class="persona-list">
              {#each filteredPersonas as persona}
                <button
                  class="persona-row"
                  class:active={persona.id === activePersonaId}
                  type="button"
                  on:click={() => (activePersonaId = persona.id)}
                >
                  <span class="persona-row-avatar">
                    {#if personaAvatarUrl(persona)}
                      <img src={personaAvatarUrl(persona)} alt="" />
                    {:else}
                      <span>{personaInitials(persona)}</span>
                    {/if}
                  </span>
                  <span class="persona-row-copy">
                    <strong>{persona.name}</strong>
                    <small>{personaBindingLabel(persona)}</small>
                  </span>
                </button>
              {/each}
            </div>
          </section>

          <section class="persona-detail" aria-label={t('persona.current')}>
            {#if activePersona}
              <div class="persona-identity">
                <label class="persona-avatar-uploader" title={t('persona.changeAvatar')}>
                  {#if personaAvatarUrl(activePersona)}
                    <img src={personaAvatarUrl(activePersona)} alt="" />
                  {:else}
                    <span>{personaInitials(activePersona)}</span>
                  {/if}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={personaAvatarUploading} on:change={uploadActivePersonaAvatar} />
                </label>
                <div>
                  <span>{t('persona.current')}</span>
                  <h3>{activePersona.name}</h3>
                  <p>{activePersona.title || personaBindingLabel(activePersona)}</p>
                </div>
              </div>

              <div class="persona-action-grid">
                <button class:active={activePersona.isDefault} type="button" on:click={setActivePersonaDefault}>
                  <Star size={15} />{t('persona.setDefault')}
                </button>
                <button class:active={activePersonaBoundToActiveCharacter} type="button" disabled={!activeCharacter} on:click={toggleActivePersonaCharacterBinding}>
                  {#if activePersonaBoundToActiveCharacter}
                    <Unlink size={15} />{t('persona.unbindCharacter')}
                  {:else}
                    <Link2 size={15} />{t('persona.bindCharacter')}
                  {/if}
                </button>
                <button class:active={activePersonaLockedToConversation} type="button" disabled={!activeConversationId} on:click={lockActivePersonaToCurrentChat}>
                  <Link2 size={15} />{t('persona.lockChat')}
                </button>
                <button type="button" on:click={duplicateActivePersona}>
                  <Copy size={15} />{t('persona.duplicate')}
                </button>
                <button type="button" disabled={!activePersona.avatarAssetId || personaAvatarUploading} on:click={clearActivePersonaAvatar}>
                  <Image size={15} />{t('persona.clearAvatar')}
                </button>
                <button class="danger" type="button" disabled={personaDeleting} on:click={deleteActivePersona}>
                  <Trash2 size={15} />{t('common.delete')}
                </button>
              </div>

              <form class="persona-editor" on:submit|preventDefault={saveActivePersona}>
                <TextField bind:value={personaDraftName} label={t('common.name')} placeholder={t('persona.namePlaceholder')} />
                <TextField bind:value={personaDraftTitle} label={t('persona.title')} placeholder={t('persona.titlePlaceholder')} />
                <TextareaField bind:value={personaDraftDescription} label={t('persona.description')} rows={9} placeholder={t('persona.descriptionPlaceholder')} />
                <div class="persona-editor-meta">
                  <span>{t('persona.tokenEstimate', { count: personaTokenEstimate(activePersona) })}</span>
                  <label class="checkbox-row compact">
                    <input type="checkbox" bind:checked={personaDraftDefault} />
                    <span>{t('persona.default')}</span>
                  </label>
                </div>
                <button class="primary full" type="submit"><Save size={16} />{t('common.save')}</button>
              </form>

              <section class="persona-connections">
                <div class="persona-section-head">
                  <strong>{t('persona.connections')}</strong>
                  <small>{activeCharacter ? t('persona.currentCharacter', { name: activeCharacter.name }) : t('character.noCharacter')}</small>
                </div>
                <div class="persona-connection-row">
                  <span>{t('persona.characterBinding')}</span>
                  <strong>{activeCharacterPersona?.name ?? t('persona.noCharacterBinding')}</strong>
                </div>
                <div class="persona-connection-row">
                  <span>{t('persona.chatLock')}</span>
                  <strong>{activeConversationRecord?.personaId ? personas.find((persona) => persona.id === activeConversationRecord?.personaId)?.name ?? t('persona.missingPersona') : t('persona.noChatLock')}</strong>
                </div>
              </section>
            {:else}
              <div class="persona-empty">
                <UserRound size={30} />
                <strong>{t('persona.selectOrCreate')}</strong>
              </div>
            {/if}
          </section>
        </div>
      {:else if activeDrawer === 'worldbooks'}
        <div class="worldbook-workspace">
          <section class="worldbook-library" aria-label={t('worldbook.library')}>
            <div class="worldbook-library-actions">
              <form class="worldbook-create" on:submit|preventDefault={createWorldBook}>
                <input bind:value={newWorldBookName} placeholder={t('worldbook.namePlaceholder')} />
                <button class="primary" type="submit"><BookOpen size={16} />{t('common.create')}</button>
              </form>
              <button class="secondary full" type="button" on:click={openWorldBookImport}>
                <FileInput size={16} />{t('worldbook.import')}
              </button>
            </div>

            <div class="worldbook-list">
              {#each worldBooks as worldBook}
                {@const boundCount = characters.filter((character) => isWorldBookBoundToCharacter(character, worldBook.id)).length}
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
                  {#if boundCount}
                    <em>{t('worldbook.boundCount', { count: boundCount })}</em>
                  {/if}
                </button>
              {:else}
                <div class="drawer-empty compact">{t('worldbook.noWorldBooks')}</div>
              {/each}
            </div>
          </section>

          {#if activeWorldBook}
            {@const worldStats = worldBookStats(worldBookDraftEntries)}
            <section class="worldbook-editor" aria-label={t('worldbook.editor')}>
              <header class="worldbook-editor-header">
                <div>
                  <strong>{t('worldbook.editor')}</strong>
                  <span>{t('worldbook.enabledStats', { enabled: worldStats.enabled, total: worldStats.total, constant: worldStats.constant, regex: worldStats.regex })}</span>
                </div>
                <div class="preset-actions">
                  <button class="tool-button" type="button" on:click={addWorldBookEntry} title={t('worldbook.newEntry')} aria-label={t('worldbook.newEntry')}>
                    <Plus size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={saveActiveWorldBook} title={t('worldbook.save')} aria-label={t('worldbook.save')}>
                    <Save size={16} />
                  </button>
                  <button class="tool-button danger" type="button" on:click={deleteActiveWorldBook} disabled={deletingWorldBook} title={t('worldbook.delete')} aria-label={t('worldbook.delete')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </header>

              <div class="worldbook-title-row">
                <label>
                  <span>{t('common.name')}</span>
                  <input bind:value={worldBookDraftName} placeholder={t('worldbook.name')} />
                </label>
                <div class="worldbook-source">
                  <span>{t('common.source')}</span>
                  <strong>{metadataSourceLabel(activeWorldBook.metadata?.source)}</strong>
                  {#if activeWorldBook.metadata?.characterName}
                    <small>{activeWorldBook.metadata.characterName}</small>
                  {/if}
                </div>
              </div>

              <section class="worldbook-binding-panel" aria-label={t('worldbook.binding')}>
                <header>
                  <div>
                    <strong>{t('worldbook.binding')}</strong>
                    <span>{t('worldbook.bindingStats', { enabled: worldBookEnabledCharacters.length, total: worldBookBoundCharacters.length })}</span>
                  </div>
                  <select bind:value={worldBookBindingCharacterId} aria-label={t('worldbook.selectCharacter')}>
                    {#each characters as character}
                      <option value={character.id}>{character.name}</option>
                    {/each}
                  </select>
                </header>
                {#if worldBookBindingCharacter}
                  {@const selectedBinding = worldBookBindingForCharacter(worldBookBindingCharacter, activeWorldBook.id)}
                  <div class="worldbook-binding-selected">
                    <span class="character-avatar-small compact">
                      {#if characterAvatarUrl(worldBookBindingCharacter)}
                        <img src={characterAvatarUrl(worldBookBindingCharacter)} alt={t('chat.avatarAlt', { name: worldBookBindingCharacter.name })} />
                      {:else}
                        <span>{characterInitials(worldBookBindingCharacter)}</span>
                      {/if}
                    </span>
                    <div>
                      <strong>{worldBookBindingCharacter.name}</strong>
                      <small>
                        {selectedBinding
                          ? selectedBinding.enabled !== false
                            ? t('worldbook.bindingEnabled')
                            : t('worldbook.bindingDisabled')
                          : t('worldbook.notBound')}
                      </small>
                    </div>
                    <div class="worldbook-binding-actions">
                      {#if selectedBinding}
                        <button
                          class="tool-button"
                          type="button"
                          on:click={() => setWorldBookBindingEnabled(worldBookBindingCharacter, activeWorldBook, selectedBinding.enabled === false)}
                          title={selectedBinding.enabled !== false ? t('worldbook.disableForCharacter') : t('worldbook.enableForCharacter')}
                          aria-label={selectedBinding.enabled !== false ? t('worldbook.disableForCharacter') : t('worldbook.enableForCharacter')}
                        >
                          {#if selectedBinding.enabled !== false}
                            <Power size={16} />
                          {:else}
                            <PowerOff size={16} />
                          {/if}
                        </button>
                        <button class="tool-button danger" type="button" on:click={() => unbindWorldBookFromCharacter(worldBookBindingCharacter, activeWorldBook)} title={t('worldbook.unbind')} aria-label={t('worldbook.unbind')}>
                          <Unlink size={16} />
                        </button>
                      {:else}
                        <button class="secondary" type="button" on:click={() => bindWorldBookToCharacter(worldBookBindingCharacter, activeWorldBook)}>
                          <Link2 size={16} />{t('worldbook.bindToCharacter')}
                        </button>
                      {/if}
                    </div>
                  </div>
                  <div class="worldbook-binding-list" aria-label={t('worldbook.boundCharacters')}>
                    {#each characters as character}
                      {@const binding = worldBookBindingForCharacter(character, activeWorldBook.id)}
                      <button
                        type="button"
                        class:active={character.id === worldBookBindingCharacterId}
                        class:enabled={binding?.enabled !== false && Boolean(binding)}
                        class:disabled={binding?.enabled === false}
                        on:click={() => (worldBookBindingCharacterId = character.id)}
                      >
                        <span>{character.name}</span>
                        <small>{binding ? (binding.enabled !== false ? t('common.on') : t('common.off')) : t('worldbook.notBound')}</small>
                      </button>
                    {/each}
                  </div>
                {:else}
                  <div class="drawer-empty compact">{t('worldbook.noCharacters')}</div>
                {/if}
              </section>

              <div class="worldbook-entry-toolbar">
                <input class="profile-search" bind:value={worldBookEntryQuery} placeholder={t('worldbook.searchEntries')} aria-label={t('worldbook.searchEntries')} />
                <select bind:value={worldBookSortMode} aria-label={t('worldbook.sortEntries')}>
                  {#each worldBookSortModes as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </div>

              <div class="worldbook-editor-grid">
                <div class="worldbook-entry-list" aria-label={t('worldbook.entriesLabel')}>
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
                        <button type="button" on:click={() => moveWorldBookEntryOrder(entry, 1)} title={t('worldbook.raiseOrder', { title: entryTitle(entry) })} aria-label={t('worldbook.raiseOrder', { title: entryTitle(entry) })}>
                          <ArrowUp size={14} />
                        </button>
                        <button type="button" on:click={() => moveWorldBookEntryOrder(entry, -1)} title={t('worldbook.lowerOrder', { title: entryTitle(entry) })} aria-label={t('worldbook.lowerOrder', { title: entryTitle(entry) })}>
                          <ArrowDown size={14} />
                        </button>
                        <button type="button" on:click={() => duplicateWorldBookEntry(entry)} title={t('worldbook.duplicateEntry')} aria-label={`${t('worldbook.duplicateEntry')} ${entryTitle(entry)}`}>
                          <Copy size={14} />
                        </button>
                        <button type="button" on:click={() => removeWorldBookEntry(entry)} title={t('worldbook.deleteEntry')} aria-label={`${t('worldbook.deleteEntry')} ${entryTitle(entry)}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </article>
                  {:else}
                    <div class="drawer-empty compact">{t('worldbook.noMatchingEntries')}</div>
                  {/each}
                </div>

                {#if activeWorldBookEntry}
                  <section class="worldbook-entry-editor" aria-label={t('worldbook.entryEditor')}>
                    <div class="worldbook-entry-editor-head">
                      <div>
                        <strong>{entryTitle(activeWorldBookEntry)}</strong>
                        <span>{entryTokenEstimate(activeWorldBookEntry)} {t('common.tokenUnit')} · {entryStatusLabel(activeWorldBookEntry)}</span>
                      </div>
                      <div class="preset-actions">
                        <button class="tool-button" type="button" on:click={() => duplicateWorldBookEntry(activeWorldBookEntry)} title={t('worldbook.duplicateEntry')} aria-label={t('worldbook.duplicateEntry')}>
                          <Copy size={16} />
                        </button>
                        <button class="tool-button" type="button" on:click={() => removeWorldBookEntry(activeWorldBookEntry)} title={t('worldbook.deleteEntry')} aria-label={t('worldbook.deleteEntry')}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div class="worldbook-entry-fields">
                      <label class="span-2">
                        <span>{t('worldbook.memoTitle')}</span>
                        <input value={activeWorldBookEntry.comment} on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { comment: (event.currentTarget as HTMLInputElement).value })} />
                      </label>

                      <div class="segmented-field">
                        <span>{t('common.status')}</span>
                        <div class="mini-segment three" aria-label={t('worldbook.entryStatus')}>
                          <button class:active={entryStatus(activeWorldBookEntry) === 'normal'} type="button" on:click={() => setWorldBookEntryState(activeWorldBookEntry, 'normal')}>{t('worldbook.status.normal')}</button>
                          <button class:active={entryStatus(activeWorldBookEntry) === 'constant'} type="button" on:click={() => setWorldBookEntryState(activeWorldBookEntry, 'constant')}>{t('worldbook.status.constant')}</button>
                          <button class:active={entryStatus(activeWorldBookEntry) === 'disabled'} type="button" on:click={() => setWorldBookEntryState(activeWorldBookEntry, 'disabled')}>{t('common.off')}</button>
                        </div>
                      </div>

                      <div class="segmented-field">
                        <span>{t('worldbook.position')}</span>
                        <div class="mini-segment three" aria-label={t('worldbook.position')}>
                          {#each worldBookPositions as position}
                            <button class:active={activeWorldBookEntry.position === position.value} type="button" on:click={() => updateWorldBookEntry(activeWorldBookEntry.id, { position: position.value })}>
                              {position.label}
                            </button>
                          {/each}
                        </div>
                      </div>

                      <label>
                        <span>{t('worldbook.depth')}</span>
                        <input
                          value={activeWorldBookEntry.depth}
                          inputmode="numeric"
                          on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { depth: optionalInteger((event.currentTarget as HTMLInputElement).value) ?? 0 })}
                        />
                      </label>
                      <label>
                        <span>{t('worldbook.order')}</span>
                        <input
                          value={activeWorldBookEntry.order}
                          inputmode="numeric"
                          on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { order: optionalNumber((event.currentTarget as HTMLInputElement).value) ?? 0 })}
                        />
                      </label>
                      <label>
                        <span>{t('worldbook.triggerPercent')}</span>
                        <input
                          value={activeWorldBookEntry.probability}
                          inputmode="numeric"
                          on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { probability: Math.min(100, Math.max(0, optionalNumber((event.currentTarget as HTMLInputElement).value) ?? 100)) })}
                        />
                      </label>

                      <div class="segmented-field">
                        <span>{t('worldbook.roleAtDepth')}</span>
                        <div class="mini-segment three" aria-label={t('worldbook.roleAtDepth')}>
                          {#each promptRoles as role}
                            <button class:active={activeWorldBookEntry.role === role} type="button" on:click={() => updateWorldBookEntry(activeWorldBookEntry.id, { role })}>{roleLabel(role)}</button>
                          {/each}
                        </div>
                      </div>

                      <label class="span-2">
                        <span>{t('worldbook.primaryKeywords')}</span>
                        <textarea
                          rows="2"
                          value={keywordText(activeWorldBookEntry.keys)}
                          placeholder={t('character.placeholder.tags')}
                          on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { keys: parseKeywordText((event.currentTarget as HTMLTextAreaElement).value) })}
                        ></textarea>
                      </label>
                      <label class="span-2">
                        <span>{t('worldbook.optionalFilter')}</span>
                        <textarea
                          rows="2"
                          value={keywordText(activeWorldBookEntry.secondaryKeys)}
                          placeholder={t('worldbook.placeholder.secondaryKeys')}
                          on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { secondaryKeys: parseKeywordText((event.currentTarget as HTMLTextAreaElement).value) })}
                        ></textarea>
                      </label>
                      <label class="span-2 content-field">
                        <span>{t('common.content')}</span>
                        <textarea
                          rows="10"
                          value={activeWorldBookEntry.content}
                          placeholder={t('worldbook.placeholder.content')}
                          on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { content: (event.currentTarget as HTMLTextAreaElement).value })}
                        ></textarea>
                      </label>
                    </div>

                    <div class="worldbook-toggle-grid">
                      <button class="toggle-pill" class:active={activeWorldBookEntry.selective} type="button" on:click={() => updateWorldBookEntry(activeWorldBookEntry.id, { selective: !activeWorldBookEntry.selective })}>{t('worldbook.selective')}</button>
                      <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.useProbability !== false} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'useProbability', activeWorldBookEntry.extensions.useProbability === false)}>{t('worldbook.useProbability')}</button>
                      <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.use_regex === true} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'use_regex', activeWorldBookEntry.extensions.use_regex !== true)}>{t('worldbook.regexKeys')}</button>
                      <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.case_sensitive === true} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'case_sensitive', activeWorldBookEntry.extensions.case_sensitive !== true)}>{t('worldbook.caseSensitive')}</button>
                      <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.match_whole_words === true} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'match_whole_words', activeWorldBookEntry.extensions.match_whole_words !== true)}>{t('worldbook.wholeWords')}</button>
                      <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.ignore_budget === true} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'ignore_budget', activeWorldBookEntry.extensions.ignore_budget !== true)}>{t('worldbook.ignoreBudget')}</button>
                    </div>
                  </section>
                {:else}
                  <section class="worldbook-entry-editor empty">
                    <BookOpen size={28} />
                    <strong>{t('worldbook.noEntry')}</strong>
                    <button class="primary" type="button" on:click={addWorldBookEntry}><Plus size={16} />{t('worldbook.newEntry')}</button>
                  </section>
                {/if}
              </div>
            </section>
          {:else}
            <section class="worldbook-editor empty">
              <BookOpen size={28} />
              <strong>{t('worldbook.selectOrCreate')}</strong>
            </section>
          {/if}
        </div>
      {:else if activeDrawer === 'profiles'}
        <div class="profile-workspace">
          <div class="profile-panel">
            <div class="preset-toolbar" aria-label={t('profile.presetTools')}>
              <SelectField aria-label={t('profile.selectedProfile')} bind:value={activeProfileId}>
                {#each profiles as profile}
                  <option value={profile.id}>{profile.name}</option>
                {/each}
              </SelectField>
              <div class="preset-actions">
                <button class="tool-button" type="button" on:click={openPresetImport} title={t('profile.importPreset')} aria-label={t('profile.importPreset')}>
                  <Upload size={16} />
                </button>
                <button class="tool-button" type="button" on:click={saveActiveProfile} title={t('profile.updateCurrent')} aria-label={t('profile.updateCurrent')} disabled={!activeProfile}>
                  <Save size={16} />
                </button>
                <button class="tool-button" type="button" on:click={duplicateActiveProfile} title={t('profile.saveAs')} aria-label={t('profile.saveAs')} disabled={!activeProfile}>
                  <Copy size={16} />
                </button>
                <button class="tool-button" type="button" on:click={exportActiveProfile} title={t('profile.export')} aria-label={t('profile.export')} disabled={!activeProfile}>
                  <Download size={16} />
                </button>
                <button class="tool-button" type="button" on:click={inspectCurrentPrompt} title={t('nav.inspector')} aria-label={t('nav.inspector')} disabled={!activeProfile}>
                  <ClipboardList size={16} />
                </button>
              </div>
            </div>

            {#if activeProfile}
              <section class="profile-summary" aria-label={t('profile.summary')}>
                <div class="profile-summary-heading">
                  <div>
                    <strong>{activeProfile.name}</strong>
                    <span>{profileOrigin(activeProfile)}</span>
                  </div>
                  <span class="provider-pill">{activeProfile.provider.type}</span>
                </div>
                <div class="profile-model">{activeProfile.provider.model}</div>
                <div class="profile-chips" aria-label={t('profile.promptStats')}>
                  <span>{t('profile.enabledCount', { count: activeProfileStats.enabled })}</span>
                  <span>{t('profile.orderedCount', { count: activeProfileStats.ordered })}</span>
                  <span>{t('profile.totalCount', { count: activeProfileStats.total })}</span>
                  {#if activeProfile.prompt?.macroMode === 'sillytavern'}
                    <span>{t('profile.stMacros')}</span>
                  {/if}
                  {#if activeProfile.prompt?.squashSystemMessages}
                    <span>{t('profile.squashSystemChip')}</span>
                  {/if}
                  <span>{activeProfile.request?.stream === false ? t('profile.nonStream') : t('profile.stream')}</span>
                  {#if activeProfile.regex?.scripts?.length}
                    <span>{t('profile.regexCount', { count: activeProfile.regex.scripts.length })}</span>
                  {/if}
                </div>
                <div class="profile-sampler">{profileSamplerLine(activeProfile)}</div>
              </section>
            {/if}

            <TextField class="profile-search" bind:value={profileQuery} placeholder={t('profile.search')} aria-label={t('profile.search')} />
          </div>

          {#if activeProfile}
            <form class="profile-editor" on:submit|preventDefault={saveActiveProfile}>
              <div class="profile-editor-header">
                <div>
                  <strong>{t('profile.editor')}</strong>
                  <span>{t('profile.promptsInjections', { prompts: draftPromptStats.total, injections: draftPromptStats.injected })}</span>
                </div>
                <div class="preset-actions">
                  <button class="tool-button" type="submit" title={t('profile.saveChanges')} aria-label={t('profile.saveChanges')}>
                    <Save size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={duplicateActiveProfile} title={t('profile.saveAsCopy')} aria-label={t('profile.saveAsCopy')}>
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <section class="provider-editor" aria-label={t('profile.providerSettings')}>
                <TextField class="profile-name-field" label={t('common.name')} bind:value={profileDraftName} placeholder={t('profile.presetName')} />

                <div class="provider-segment" aria-label={t('profile.providerType')}>
                  <button class:active={profileDraftProviderType === 'openai-compatible'} type="button" on:click={() => changeProfileProviderType('openai-compatible')}>
                    <strong>{t('profile.openAICompatible')}</strong>
                    <span>{t('profile.customEndpoint')}</span>
                  </button>
                  <button class:active={profileDraftProviderType === 'gemini'} type="button" on:click={() => changeProfileProviderType('gemini')}>
                    <strong>Gemini</strong>
                    <span>{t('profile.aiStudioVertex')}</span>
                  </button>
                </div>

                <div class="provider-config">
                  <TextField label={t('profile.model')} bind:value={profileDraftProviderModel} placeholder={profileDraftProviderType === 'gemini' ? 'gemini-2.5-pro' : 'gpt-4o-mini'} />
                  <TextField
                    label={t('profile.endpoint')}
                    bind:value={profileDraftProviderEndpoint}
                    placeholder={profileDraftProviderType === 'gemini' ? t('profile.optionalStreamUrl') : 'https://api.openai.com/v1'}
                  />
                </div>

                {#if profileDraftProviderType === 'gemini'}
                  <div class="vertex-strip">
                    <button class:active={profileDraftVertexEnabled} type="button" on:click={() => (profileDraftVertexEnabled = !profileDraftVertexEnabled)}>
                      Vertex
                    </button>
                    {#if profileDraftVertexEnabled}
                      <div class="mini-segment vertex-mode-selector" aria-label={t('profile.vertexMode')}>
                        <button class:active={profileDraftVertexMode === 'express'} type="button" on:click={() => (profileDraftVertexMode = 'express')}>Express</button>
                        <button class:active={profileDraftVertexMode === 'oauth'} type="button" on:click={() => (profileDraftVertexMode = 'oauth')}>OAuth</button>
                      </div>
                    {/if}
                  </div>
                  {#if profileDraftVertexEnabled}
                    <div class="provider-config">
                      <TextField label={profileDraftVertexMode === 'oauth' ? t('profile.project') : t('profile.projectOptional')} bind:value={profileDraftVertexProjectId} placeholder="project-id" />
                      <TextField label={t('profile.location')} bind:value={profileDraftVertexLocation} placeholder="us-central1" />
                    </div>
                  {/if}
                {/if}

                {#if profileDraftProviderType === 'openai-compatible'}
                  <div class="credential-panel">
                    <div class="credential-panel-head">
                      <strong>{t('profile.authentication')}</strong>
                      <span>{t('profile.bearerApiKey')}</span>
                    </div>
                    <div class="credential-grid single">
                      <SecretField label={t('profile.apiKey')} bind:value={profileDraftApiKey} autocomplete="off" placeholder="sk-..." />
                    </div>
                    <div class="compatibility-strip" aria-label={t('profile.requestMode')}>
                      <button class:active={profileDraftOpenAICompatibility === 'strict-openai'} type="button" on:click={() => (profileDraftOpenAICompatibility = 'strict-openai')}>
                        <strong>{t('profile.openAIStrict')}</strong>
                        <span>{t('profile.officialFields')}</span>
                      </button>
                      <button class:active={profileDraftOpenAICompatibility === 'extended'} type="button" on:click={() => (profileDraftOpenAICompatibility = 'extended')}>
                        <strong>{t('profile.extended')}</strong>
                        <span>top_k, min_p, max_tokens</span>
                      </button>
                    </div>
                  </div>
                {:else if !profileDraftVertexEnabled}
                  <div class="credential-panel">
                    <div class="credential-panel-head">
                      <strong>{t('profile.authentication')}</strong>
                      <span>{t('profile.aiStudioKeyHint')}</span>
                    </div>
                    <div class="credential-grid single">
                      <SecretField label={t('profile.apiKey')} bind:value={profileDraftApiKey} autocomplete="off" placeholder="AIza..." />
                    </div>
                  </div>
                {:else}
                  <div class="credential-panel">
                    <div class="credential-panel-head">
                      <strong>{profileDraftVertexMode === 'express' ? t('profile.vertexExpress') : t('profile.vertexOAuth')}</strong>
                      <span>{profileDraftVertexMode === 'express' ? t('profile.expressApiKey') : t('profile.cloudAccessToken')}</span>
                    </div>
                    <div class="credential-grid single">
                      {#if profileDraftVertexMode === 'express'}
                        <SecretField label={t('profile.apiKey')} bind:value={profileDraftVertexApiKey} autocomplete="off" placeholder="AIza..." />
                      {:else}
                        <SecretField label={t('profile.accessToken')} bind:value={profileDraftVertexAccessToken} autocomplete="off" placeholder="ya29..." />
                      {/if}
                    </div>
                  </div>
                {/if}
              </section>

              <section class="request-panel" aria-label={t('profile.requestParameters')}>
                <div class="request-panel-header">
                  <strong>{samplerPanelHeading}</strong>
                  <span>{profileDraftMaxTokens || '512'} 输出 · {profileDraftContextTokens || '8192'} 上下文 · {profileDraftStream ? t('profile.stream') : t('profile.singleResponse')}</span>
                </div>

                <div class="request-flow-strip" aria-label={t('profile.responseMode')}>
                  <button class:active={profileDraftStream} type="button" on:click={() => (profileDraftStream = true)}>
                    <strong>{t('profile.streaming')}</strong>
                    <span>{t('profile.streamingHint')}</span>
                  </button>
                  <button class:active={!profileDraftStream} type="button" on:click={() => (profileDraftStream = false)}>
                    <strong>{t('profile.singleResponse')}</strong>
                    <span>{t('profile.singleResponseHint')}</span>
                  </button>
                </div>

                <div class="thinking-panel" aria-label={t('profile.thinkingControls')}>
                  <div class="thinking-panel-header">
                    <div>
                      <strong>{t('profile.thinkingRequest')}</strong>
                      <span>{profileDraftProviderType === 'gemini' ? (profileDraftGeminiIncludeThoughts ? t('profile.geminiThoughtsRequested') : t('profile.geminiThoughtsNotRequested')) : profileDraftOpenAIReasoningEffort === 'default' ? t('profile.defaultEndpointEffort') : t('profile.effort', { effort: reasoningEffortLabel(profileDraftOpenAIReasoningEffort) })}</span>
                    </div>
                  </div>

                  {#if profileDraftProviderType === 'openai-compatible'}
                    <div class="thinking-field">
                      <span>{t('profile.reasoningEffort')}</span>
                      <div class="mini-segment seven" aria-label={t('profile.openAIReasoningEffort')}>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'default'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'default')}>{reasoningEffortLabel('default')}</button>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'none'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'none')}>{reasoningEffortLabel('none')}</button>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'minimal'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'minimal')}>{reasoningEffortLabel('minimal')}</button>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'low'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'low')}>{reasoningEffortLabel('low')}</button>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'medium'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'medium')}>{reasoningEffortLabel('medium')}</button>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'high'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'high')}>{reasoningEffortLabel('high')}</button>
                        <button class:active={profileDraftOpenAIReasoningEffort === 'xhigh'} type="button" on:click={() => (profileDraftOpenAIReasoningEffort = 'xhigh')}>{reasoningEffortLabel('xhigh')}</button>
                      </div>
                    </div>
                  {:else}
                    <div class="thinking-field">
                      <span>{t('profile.visibleThoughts')}</span>
                      <button class="toggle-pill profile-toggle" class:active={profileDraftGeminiIncludeThoughts} type="button" on:click={() => (profileDraftGeminiIncludeThoughts = !profileDraftGeminiIncludeThoughts)}>
                        {profileDraftGeminiIncludeThoughts ? t('profile.requestThoughtSummaries') : t('profile.doNotRequestSummaries')}
                      </button>
                    </div>

                    {#if draftModelUsesGeminiThinkingLevel}
                      <div class="thinking-field">
                        <span>{t('profile.thinkingLevel')}</span>
                        <div class="mini-segment five" aria-label={t('profile.thinkingLevel')}>
                          <button class:active={profileDraftGeminiThinkingMode === 'default'} type="button" on:click={() => (profileDraftGeminiThinkingMode = 'default')}>{geminiThinkingModeLabel('default')}</button>
                          <button class:active={profileDraftGeminiThinkingMode === 'level' && profileDraftGeminiThinkingLevel === 'minimal'} type="button" on:click={() => { profileDraftGeminiThinkingMode = 'level'; profileDraftGeminiThinkingLevel = 'minimal'; }}>{geminiThinkingModeLabel('minimal')}</button>
                          <button class:active={profileDraftGeminiThinkingMode === 'level' && profileDraftGeminiThinkingLevel === 'low'} type="button" on:click={() => { profileDraftGeminiThinkingMode = 'level'; profileDraftGeminiThinkingLevel = 'low'; }}>{geminiThinkingModeLabel('low')}</button>
                          <button class:active={profileDraftGeminiThinkingMode === 'level' && profileDraftGeminiThinkingLevel === 'medium'} type="button" on:click={() => { profileDraftGeminiThinkingMode = 'level'; profileDraftGeminiThinkingLevel = 'medium'; }}>{geminiThinkingModeLabel('medium')}</button>
                          <button class:active={profileDraftGeminiThinkingMode === 'level' && profileDraftGeminiThinkingLevel === 'high'} type="button" on:click={() => { profileDraftGeminiThinkingMode = 'level'; profileDraftGeminiThinkingLevel = 'high'; }}>{geminiThinkingModeLabel('high')}</button>
                        </div>
                      </div>
                    {:else}
                      <div class="thinking-field">
                        <span>{t('profile.thinkingBudget')}</span>
                        <div class="mini-segment three" aria-label={t('profile.thinkingBudget')}>
                          <button class:active={profileDraftGeminiThinkingMode === 'default'} type="button" on:click={() => (profileDraftGeminiThinkingMode = 'default')}>{geminiThinkingModeLabel('default')}</button>
                          <button class:active={profileDraftGeminiThinkingMode === 'off'} type="button" on:click={() => (profileDraftGeminiThinkingMode = 'off')}>{geminiThinkingModeLabel('off')}</button>
                          <button class:active={profileDraftGeminiThinkingMode === 'budget'} type="button" on:click={() => (profileDraftGeminiThinkingMode = 'budget')}>{geminiThinkingModeLabel('budget')}</button>
                        </div>
                        {#if profileDraftGeminiThinkingMode === 'budget'}
                          <span class="sampler-control-body">
                            <RangeField min="0" max="32768" step="128" value={profileDraftGeminiThinkingBudget || '1024'} oninput={(event) => (profileDraftGeminiThinkingBudget = (event.currentTarget as HTMLInputElement).value)} />
                            <TextField controlClass="sampler-number" value={profileDraftGeminiThinkingBudget} inputmode="numeric" placeholder="1024" oninput={(event) => (profileDraftGeminiThinkingBudget = (event.currentTarget as HTMLInputElement).value)} />
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
                        <span>{t('profile.temperature')}</span>
                        <output>{profileDraftTemperature || '1'}</output>
                      </span>
                      <span class="sampler-control-body">
                        <RangeField min="0" max="2" step="0.01" value={profileDraftTemperature || '1'} oninput={(event) => (profileDraftTemperature = (event.currentTarget as HTMLInputElement).value)} />
                        <TextField controlClass="sampler-number" value={profileDraftTemperature} inputmode="decimal" placeholder="1" oninput={(event) => (profileDraftTemperature = (event.currentTarget as HTMLInputElement).value)} />
                      </span>
                    </label>
                  {/if}

                  {#if samplerVisible.topP}
                    <label class="sampler-control">
                      <span class="sampler-control-head">
                        <span>{t('profile.topP')}</span>
                        <output>{profileDraftTopP || '1'}</output>
                      </span>
                      <span class="sampler-control-body">
                        <RangeField min="0" max="1" step="0.01" value={profileDraftTopP || '1'} oninput={(event) => (profileDraftTopP = (event.currentTarget as HTMLInputElement).value)} />
                        <TextField controlClass="sampler-number" value={profileDraftTopP} inputmode="decimal" placeholder="1" oninput={(event) => (profileDraftTopP = (event.currentTarget as HTMLInputElement).value)} />
                      </span>
                    </label>
                  {/if}

                  {#if samplerVisible.topK}
                    <label class="sampler-control">
                      <span class="sampler-control-head">
                        <span>{t('profile.topK')}</span>
                        <output>{profileDraftTopK || t('reasoning.default')}</output>
                      </span>
                      <span class="sampler-control-body">
                        <RangeField min="1" max="200" step="1" value={profileDraftTopK || '40'} oninput={(event) => (profileDraftTopK = (event.currentTarget as HTMLInputElement).value)} />
                        <TextField controlClass="sampler-number" value={profileDraftTopK} inputmode="numeric" placeholder={t('reasoning.default')} oninput={(event) => (profileDraftTopK = (event.currentTarget as HTMLInputElement).value)} />
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
                        <RangeField min="16" max={maxOutputTokenRange} step="16" value={profileDraftMaxTokens || '512'} oninput={(event) => (profileDraftMaxTokens = (event.currentTarget as HTMLInputElement).value)} />
                        <TextField controlClass="sampler-number" value={profileDraftMaxTokens} inputmode="numeric" placeholder="512" oninput={(event) => (profileDraftMaxTokens = (event.currentTarget as HTMLInputElement).value)} />
                      </span>
                    </label>
                  {/if}

                  <label class="sampler-control">
                    <span class="sampler-control-head">
                      <span>{t('profile.context')}</span>
                      <output>{profileDraftContextTokens || '8192'}</output>
                    </span>
                    <span class="sampler-control-body">
                      <RangeField min="1024" max={maxContextTokens} step="1024" value={profileDraftContextTokens || '8192'} oninput={(event) => (profileDraftContextTokens = (event.currentTarget as HTMLInputElement).value)} />
                      <TextField
                        controlClass="sampler-number"
                        value={profileDraftContextTokens}
                        inputmode="numeric"
                        min="1024"
                        max={maxContextTokens}
                        placeholder="8192"
                        oninput={(event) => (profileDraftContextTokens = (event.currentTarget as HTMLInputElement).value)}
                      />
                    </span>
                  </label>
                </div>

                {#if showAdvancedSampler}
                  <details class="advanced-sampler">
                    <summary>{t('common.advanced')}</summary>
                    <div class="advanced-sampler-grid">
                      {#if samplerVisible.topA}
                        <TextField label={t('profile.topA')} bind:value={profileDraftTopA} inputmode="decimal" />
                      {/if}
                      {#if samplerVisible.minP}
                        <TextField label={t('profile.minP')} bind:value={profileDraftMinP} inputmode="decimal" />
                      {/if}
                      {#if samplerVisible.frequencyPenalty}
                        <TextField label={t('profile.freqPenalty')} bind:value={profileDraftFrequencyPenalty} inputmode="decimal" />
                      {/if}
                      {#if samplerVisible.presencePenalty}
                        <TextField label={t('profile.presencePenalty')} bind:value={profileDraftPresencePenalty} inputmode="decimal" />
                      {/if}
                      {#if samplerVisible.repetitionPenalty}
                        <TextField label={t('profile.repPenalty')} bind:value={profileDraftRepetitionPenalty} inputmode="decimal" />
                      {/if}
                      {#if samplerVisible.seed}
                        <TextField label={t('profile.seed')} bind:value={profileDraftSeed} inputmode="numeric" />
                      {/if}
                      {#if samplerVisible.n}
                        <TextField label={candidateCountFieldLabel} bind:value={profileDraftN} inputmode="numeric" />
                      {/if}
                    </div>
                  </details>
                {/if}

                <TextareaField class="profile-textarea-label" label={t('profile.stopStrings')} bind:value={profileDraftStop} rows={3} placeholder={t('profile.stopPlaceholder')} />
              </section>

              <div class="profile-mode-strip">
                <div class="segmented-field">
                  <span>{t('profile.mode')}</span>
                  <div class="mini-segment" aria-label={t('profile.mode')}>
                    <button class:active={profileDraftMode === 'chat'} type="button" on:click={() => (profileDraftMode = 'chat')}>{t('profile.mode.chat')}</button>
                    <button class:active={profileDraftMode === 'text'} type="button" on:click={() => (profileDraftMode = 'text')}>{t('profile.mode.text')}</button>
                  </div>
                </div>
                <div class="segmented-field">
                  <span>{t('profile.macros')}</span>
                  <div class="mini-segment" aria-label={t('profile.macros')}>
                    <button class:active={profileDraftMacroMode === 'none'} type="button" on:click={() => (profileDraftMacroMode = 'none')}>{t('profile.none')}</button>
                    <button class:active={profileDraftMacroMode === 'sillytavern'} type="button" on:click={() => (profileDraftMacroMode = 'sillytavern')}>ST</button>
                  </div>
                </div>
                <button class="toggle-pill" class:active={profileDraftSquashSystemMessages} type="button" on:click={() => (profileDraftSquashSystemMessages = !profileDraftSquashSystemMessages)}>
                  {t('profile.squashSystem')}
                </button>
              </div>

              <section class="regex-panel" aria-label={t('profile.regexScripts')}>
                <div class="regex-panel-header">
                  <div>
                    <strong>{t('profile.regexScripts')}</strong>
                    <span>{t('profile.regexStats', { active: profileDraftRegexScripts.filter((script) => !script.disabled).length, total: profileDraftRegexScripts.length })}</span>
                  </div>
                  <button class="toggle-pill" class:active={profileDraftRegexEnabled} type="button" on:click={() => (profileDraftRegexEnabled = !profileDraftRegexEnabled)}>
                    {profileDraftRegexEnabled ? t('common.enabled') : t('common.disabled')}
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
                          {script.disabled ? t('common.off') : t('common.on')}
                        </button>
                      </article>
                    {/each}
                  </div>
                {:else}
                  <span class="drawer-empty compact">{t('profile.noRegexScripts')}</span>
                {/if}
              </section>
            </form>

            <section class="prompt-manager-panel" aria-label={t('profile.promptManager')}>
              <div class="prompt-manager-header">
                <div>
                  <strong>{t('profile.promptManager')}</strong>
                  <span>{t('profile.promptManagerStats', { enabled: draftPromptStats.enabled, ordered: draftPromptStats.ordered, total: draftPromptStats.total })}</span>
                </div>
                <div class="preset-actions">
                  <button class="tool-button" type="button" on:click={addDraftPromptSlot} title={t('profile.addPrompt')} aria-label={t('profile.addPrompt')}>
                    <Plus size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={() => openPromptEditor(activePromptSlot)} title={t('profile.editSelectedPrompt')} aria-label={t('profile.editSelectedPrompt')} disabled={!activePromptSlot}>
                    <Pencil size={16} />
                  </button>
                  <button class="tool-button" type="button" on:click={() => duplicateDraftPromptSlot(activePromptSlot)} title={t('profile.duplicateSelectedPrompt')} aria-label={t('profile.duplicateSelectedPrompt')} disabled={!activePromptSlot}>
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div class="prompt-manager-toolbar">
                <input class="profile-search" bind:value={promptSlotQuery} placeholder={t('profile.searchPrompts')} aria-label={t('profile.searchPrompts')} />
                {#if activePromptSlot}
                  <div class="prompt-selection-summary">
                    <strong>{activePromptSlot.label || activePromptSlot.id}</strong>
                    <span>{slotMeta(activePromptSlot)} · {slotTokenEstimate(activePromptSlot)} {t('common.tokenUnit')}</span>
                  </div>
                {/if}
              </div>

              <div class="prompt-slot-list" aria-label={t('profile.promptSlots')}>
                <div class="prompt-slot-list-header" aria-hidden="true">
                  <span></span>
                  <span>{t('common.prompt')}</span>
                  <span>{t('common.type')}</span>
                  <span>{t('common.tokens')}</span>
                  <span>{t('common.actions')}</span>
                </div>
                {#each filteredPromptSlots as slot}
                  <article class="prompt-slot-row" class:active={slot.id === activePromptSlotId}>
                    <span class="prompt-slot-grip" title={t('profile.order')}>
                      <GripHorizontal size={14} />
                    </span>
                    <input
                      class="prompt-slot-toggle"
                      type="checkbox"
                      checked={slot.enabled !== false}
                      title={t('profile.togglePrompt')}
                      aria-label={`${t('profile.togglePrompt')} ${slot.label || slot.id}`}
                      on:change={(event) => updateDraftSlot(slot.id, { enabled: (event.currentTarget as HTMLInputElement).checked })}
                    />
                    <button class="prompt-slot-main" type="button" on:click={() => (activePromptSlotId = slot.id)}>
                      <strong>{slot.label || slot.id}</strong>
                      <span>{slotMeta(slot)}</span>
                    </button>
                    <span class="prompt-kind-badge">{slotKind(slot)}</span>
                    <span class="prompt-token-count">{slotTokenEstimate(slot)}</span>
                    <span class="prompt-row-actions">
                      <button type="button" on:click={() => moveDraftPromptSlot(slot, -1)} title={t('profile.moveUp')} aria-label={`${t('profile.moveUp')} ${slot.label || slot.id}`} disabled={isFirstPromptSlot(slot)}>
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" on:click={() => moveDraftPromptSlot(slot, 1)} title={t('profile.moveDown')} aria-label={`${t('profile.moveDown')} ${slot.label || slot.id}`} disabled={isLastPromptSlot(slot)}>
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" on:click={() => openPromptEditor(slot)} title={t('profile.editPrompt')} aria-label={`${t('profile.editPrompt')} ${slot.label || slot.id}`}>
                        <Pencil size={14} />
                      </button>
                      <button type="button" on:click={() => duplicateDraftPromptSlot(slot)} title={t('profile.duplicatePrompt')} aria-label={`${t('profile.duplicatePrompt')} ${slot.label || slot.id}`}>
                        <Copy size={14} />
                      </button>
                      <button type="button" on:click={() => removeDraftPromptSlot(slot)} title={t('profile.removePrompt')} aria-label={`${t('profile.removePrompt')} ${slot.label || slot.id}`} disabled={!canRemovePromptSlot(slot)}>
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </article>
                {:else}
                  <div class="drawer-empty">{t('profile.noMatchingPrompts')}</div>
                {/each}
              </div>
            </section>

            {#if promptEditorSlot}
              <div class="prompt-editor-overlay" role="dialog" aria-modal="true" aria-label={t('profile.editPrompt')}>
                <form class="prompt-editor-window" on:submit|preventDefault={savePromptEditor}>
                  <header class="prompt-editor-titlebar">
                    <div>
                      <h3>{t('profile.editPromptTitle')}</h3>
                      <span>{promptEditorSlot.legacy?.identifier ?? promptEditorSlot.id} · {slotKind(promptEditorSlot)} · {slotTokenEstimate(promptEditorSlot)} {t('common.tokenUnit')}</span>
                    </div>
                    <div class="preset-actions">
                      <button class="tool-button" type="button" on:click={resetPromptEditor} title={t('profile.resetPrompt')} aria-label={t('profile.resetPrompt')}>
                        <RotateCcw size={16} />
                      </button>
                      <button class="tool-button" type="submit" title={t('profile.savePrompt')} aria-label={t('profile.savePrompt')}>
                        <Save size={16} />
                      </button>
                      <button class="tool-button" type="button" on:click={closePromptEditor} title={t('profile.closePromptEditor')} aria-label={t('profile.closePromptEditor')}>
                        <X size={16} />
                      </button>
                    </div>
                  </header>

                  <div class="prompt-editor-fields">
                    <label>
                      <span>{t('common.name')}</span>
                      <input value={promptEditorSlot.label ?? ''} on:input={(event) => updateDraftSlot(promptEditorSlot.id, { label: (event.currentTarget as HTMLInputElement).value })} />
                    </label>
                    <div class="segmented-field">
                      <span>{t('profile.promptRole')}</span>
                      <div class="mini-segment three" aria-label={t('profile.promptRole')}>
                        {#each promptRoles as role}
                          <button class:active={promptEditorSlot.role === role} type="button" on:click={() => updateDraftSlot(promptEditorSlot.id, { role })}>
                            {roleLabel(role)}
                          </button>
                        {/each}
                      </div>
                    </div>
                    <label>
                      <span>{t('common.source')}</span>
                      <select value={promptEditorSlot.source} on:change={(event) => updateDraftSlot(promptEditorSlot.id, { source: (event.currentTarget as HTMLSelectElement).value as PromptSlotSource })}>
                        {#each promptSources as source}
                          <option value={source}>{promptSourceLabel(source)}</option>
                        {/each}
                      </select>
                    </label>
                    <div class="segmented-field">
                      <span>{t('profile.promptPosition')}</span>
                      <div class="mini-segment three" aria-label={t('profile.promptPosition')}>
                        <button class:active={!promptEditorSlot.injection} type="button" on:click={() => setPromptInjectionPosition(promptEditorSlot, 'none')}>{t('profile.position.none')}</button>
                        <button class:active={promptEditorSlot.injection?.position === 'relative'} type="button" on:click={() => setPromptInjectionPosition(promptEditorSlot, 'relative')}>{t('profile.position.relative')}</button>
                        <button class:active={promptEditorSlot.injection?.position === 'absolute'} type="button" on:click={() => setPromptInjectionPosition(promptEditorSlot, 'absolute')}>{t('profile.position.inChat')}</button>
                      </div>
                    </div>
                  </div>

                  {#if promptEditorSlot.injection}
                    <div class="prompt-editor-fields compact">
                      <label>
                        <span>{t('worldbook.depth')}</span>
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
                        <span>{t('worldbook.order')}</span>
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
                    <span>{t('profile.triggers')}</span>
                    <div class="prompt-trigger-options" aria-label={t('profile.generationTriggers')}>
                      {#each promptTriggerOptions as trigger}
                        <button class:active={(promptEditorSlot.injection?.triggers ?? []).includes(trigger)} type="button" on:click={() => togglePromptTrigger(promptEditorSlot, trigger)}>
                          {triggerLabel(trigger)}
                        </button>
                      {/each}
                    </div>
                  </div>

                  <div class="prompt-editor-source">
                    <span><strong>{t('profile.sourceLabel')}</strong> {promptEditorSlot.legacy?.source === 'sillytavern' ? t('profile.sillyTavernPreset') : t('profile.nankeProfile')}</span>
                    <label class="checkbox-row">
                      <input
                        type="checkbox"
                        checked={promptEditorSlot.legacy?.forbidOverrides ?? false}
                        disabled={!promptEditorSlot.legacy}
                        on:change={(event) => updateDraftSlotLegacy(promptEditorSlot.id, { forbidOverrides: (event.currentTarget as HTMLInputElement).checked })}
                      />
                      <span>{t('profile.forbidOverrides')}</span>
                    </label>
                  </div>

                  <label class="profile-textarea-label prompt-content-label">
                    <span>{t('common.prompt')}</span>
                    <textarea
                      rows="14"
                      value={promptEditorSlot.content ?? ''}
                      placeholder={t('profile.promptContentPlaceholder')}
                      on:input={(event) => updateDraftSlot(promptEditorSlot.id, { content: (event.currentTarget as HTMLTextAreaElement).value })}
                    ></textarea>
                  </label>

                  <footer class="prompt-editor-footer">
                    <button class="secondary" type="button" on:click={closePromptEditor}><X size={16} />{t('common.close')}</button>
                    <button class="secondary" type="button" on:click={resetPromptEditor}><RotateCcw size={16} />{t('common.reset')}</button>
                    <button class="primary" type="submit"><Save size={16} />{t('common.save')}</button>
                  </footer>
                </form>
              </div>
            {/if}
          {/if}

          <section class="profile-list-section" aria-label={t('nav.profiles')}>
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
                <div class="drawer-empty">{t('profile.noMatchingProfiles')}</div>
              {/each}
            </div>
          </section>
        </div>
      {:else if activeDrawer === 'settings'}
        <div class="settings-panel">
          <section class="settings-section" aria-label={t('settings.interfaceTypography')}>
            <div class="settings-section-head">
              <div>
                <strong>{t('settings.typography')}</strong>
                <span>{t('settings.localOnly')}</span>
              </div>
              <Type size={18} />
            </div>

            <div class="font-choice-grid" aria-label={t('settings.fontFamily')}>
              {#each appFontFamilies as font}
                <button
                  class:active={appSettings.fontFamily === font.value}
                  type="button"
                  on:click={() => updateAppSettings({ fontFamily: font.value })}
                >
                  <strong>{font.label}</strong>
                  <span>{font.description}</span>
                </button>
              {/each}
            </div>

            <RangeField
              class="settings-range"
              label={t('settings.interfaceSize')}
              valueLabel={`${appSettings.uiFontSize}px`}
              min="12"
              max="18"
              step="1"
              value={appSettings.uiFontSize}
              oninput={(event) => updateAppSettings({ uiFontSize: (event.currentTarget as HTMLInputElement).valueAsNumber })}
            />

            <RangeField
              class="settings-range"
              label={t('settings.chatTextSize')}
              valueLabel={`${appSettings.chatFontSize}px`}
              min="13"
              max="24"
              step="1"
              value={appSettings.chatFontSize}
              oninput={(event) => updateAppSettings({ chatFontSize: (event.currentTarget as HTMLInputElement).valueAsNumber })}
            />

            <div class="settings-preview">
              <strong>{t('settings.preview')}</strong>
              <p>{t('settings.previewText')}</p>
            </div>
          </section>

          <button class="secondary full" type="button" on:click={resetAppSettings}>
            <RotateCcw size={16} />{t('settings.resetInterface')}
          </button>
        </div>
      {:else if activeDrawer === 'import'}
        <div class="import-panel">
          {#if importOptions.length > 1}
            <select aria-label={t('import.kind')} bind:value={importKind}>
              {#each importOptions as option}
                <option value={option}>{importKindLabel(option)}</option>
              {/each}
            </select>
          {:else}
            <div class="import-kind-note">
              <span>{t('import.kind')}</span>
              <strong>{importKindLabel(importKind)}</strong>
            </div>
          {/if}
          <input bind:value={importName} placeholder={t('import.namePlaceholder')} />
          <label class="file-picker">
            <Upload size={16} />
            <span>{importFileName || (importKind === 'character-card-png' ? t('import.choosePng') : t('import.chooseFile'))}</span>
            <input
              type="file"
              accept={importKind === 'character-card-png' ? 'image/png,.png' : importKind === 'chat-jsonl' ? '.jsonl,.ndjson,.txt' : '.json,application/json,.txt'}
              on:change={readImportFile}
            />
          </label>
          <textarea
            bind:value={importText}
            rows="10"
            placeholder={importKind === 'character-card-png' ? t('import.placeholderPng') : t('import.placeholderText')}
          ></textarea>
          <button class="secondary full" type="button" on:click={runImport}><Download size={16} />{t('common.import')}</button>
        </div>
      {:else if activeDrawer === 'inspector'}
        <div class="inspector-panel">
          <button class="secondary full" type="button" on:click={inspectCurrentPrompt}><ClipboardList size={16} />{t('inspector.inspect')}</button>
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
    background: var(--nanke-surface);
    color: var(--nanke-ink);
    font-family: var(--app-font-family);
    font-size: var(--app-ui-font-size);
  }

  .rail {
    border-right: 1px solid var(--nanke-border-soft);
    box-shadow: inset -1px 0 0 rgba(255,255,255,0.02);
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    height: 100vh;
    padding: 14px 10px;
    background: var(--nanke-surface-acrylic);
    backdrop-filter: blur(20px) saturate(180%);
    color: var(--nanke-ink);
  }

  .brand {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 1px solid var(--nanke-border-strong);
    border-radius: 8px;
    color: var(--nanke-ink);
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
    border: 1px solid var(--nanke-border);
    background: var(--nanke-surface);
    color: var(--nanke-ink);
  }

  .icon-button.active,
  .icon-button:hover {
    background: var(--nanke-surface-muted);
    color: inherit;
  }

  .tool-button:hover {
    border-color: inherit;
    background: var(--nanke-surface-muted);
  }

  .tool-button.danger {
    border-color: inherit;
    color: var(--nanke-danger);
  }

  .tool-button.danger:hover {
    border-color: inherit;
    background: var(--nanke-surface);
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

  .stage.tree-open {
    grid-template-columns: minmax(0, 1fr) minmax(340px, 38vw);
  }

  .stage.tree-open .chatbar {
    backdrop-filter: blur(20px) saturate(180%);
    background: var(--nanke-surface-acrylic);
    grid-column: 1 / -1;
  }

  .stage.tree-open .messages,
  .stage.tree-open .composer {
    grid-column: 1;
  }

  .stage.tree-open :global(.tree-dock),
  .stage.tree-open .tree-dock-loading {
    grid-column: 2;
    grid-row: 2 / 4;
  }

  .tree-dock-loading {
    display: grid;
    place-items: center;
    gap: 8px;
    min-height: 0;
    border-left: 1px solid var(--nanke-border);
    background: var(--nanke-surface);
    color: var(--nanke-ink-muted);
    font-size: 13px;
  }

  .chatbar {
    backdrop-filter: blur(20px) saturate(180%);
    background: var(--nanke-surface-acrylic);
    display: grid;
    grid-template-columns: minmax(180px, 0.75fr) minmax(280px, 1.45fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 72px;
    border-bottom: 1px solid var(--nanke-border);
    padding: 12px 20px;
    background: var(--nanke-surface);
  }

  .scene {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .conversation-title-card {
    box-shadow: var(--nanke-shadow-field);
    backdrop-filter: blur(20px) saturate(180%);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    padding: 9px 10px;
    background: var(--nanke-surface-acrylic);
    color: var(--nanke-ink);
    font-weight: 700;
  }

  .conversation-title-card span,
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: var(--nanke-ink);
    padding: 8px 10px;
    font-size: 13px;
    text-align: left;
  }

  .context-chip:hover,
  .context-chip:focus-visible {
    border-color: var(--nanke-border-strong);
    background: var(--nanke-surface-muted);
    outline: 0;
  }

  .context-chip.profile {
    color: var(--nanke-accent);
  }

  .status-pill {
    justify-content: center;
    min-width: 78px;
    border-color: var(--nanke-border);
    background: var(--nanke-surface-muted);
    color: var(--nanke-accent);
    font-weight: 700;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
  }

  .home-stage {
    grid-template-rows: auto minmax(0, 1fr);
    background: var(--nanke-surface);
  }

  .homebar {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) auto;
    align-items: center;
    gap: 16px;
    min-height: 72px;
    border-bottom: 1px solid var(--nanke-border);
    padding: 12px 24px;
    background: var(--nanke-surface);
  }

  .home-title {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .home-title span {
    color: inherit;
    font-size: 11px;
    font-weight: 800;
  }

  .home-title strong {
    color: inherit;
    font-size: 22px;
    line-height: 1.15;
  }

  .home-title small {
    color: inherit;
    font-size: 13px;
  }

  .homebar-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
  }

  .home-workspace {
    min-height: 0;
    overflow: auto;
    padding: 24px;
  }

  .home-workspace > * {
    width: min(1120px, 100%);
    margin-inline: auto;
  }

  .home-overview {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
    gap: 24px;
    border-bottom: 1px solid var(--nanke-border);
    padding: 10px 0 24px;
  }

  .home-start {
    display: grid;
    align-content: center;
    gap: 12px;
    min-width: 0;
  }

  .home-start > span {
    color: inherit;
    font-size: 12px;
    font-weight: 900;
  }

  .home-start h1 {
    margin: 0;
    color: inherit;
    font-size: 28px;
    line-height: 1.18;
    letter-spacing: 0;
    overflow-wrap: anywhere;
  }

  .home-start p {
    margin: 0;
    color: inherit;
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .home-primary-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }

  .home-readiness {
    display: grid;
    gap: 8px;
    align-content: start;
    min-width: 0;
  }

  .home-readiness button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 48px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 8px 10px;
    text-align: left;
  }

  .home-readiness button:hover,
  .home-readiness button:focus-visible {
    border-color: var(--nanke-border-strong);
    background: var(--nanke-surface-muted);
    outline: 0;
  }

  .home-readiness button span {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .home-readiness small,
  .home-readiness strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .home-readiness small {
    color: inherit;
    font-size: 11px;
  }

  .home-readiness strong {
    font-size: 13px;
  }

  .home-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
    gap: 24px;
    padding-top: 22px;
  }

  .home-section {
    display: grid;
    align-content: start;
    gap: 12px;
    min-width: 0;
  }

  .home-section > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
    border-bottom: 1px solid var(--nanke-border);
    padding-bottom: 10px;
  }

  .home-section > header div {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .home-section > header strong {
    color: inherit;
    font-size: 15px;
  }

  .home-section > header small {
    color: inherit;
    font-size: 12px;
  }

  .home-recent-list,
  .home-character-list {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .home-recent-row,
  .home-character-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-width: 0;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 9px;
    text-align: left;
  }

  .home-recent-row:hover,
  .home-recent-row:focus-visible,
  .home-character-row:hover,
  .home-character-row:focus-visible,
  .home-character-row.active {
    border-color: var(--nanke-border-strong);
    background: var(--nanke-surface-muted);
    outline: 0;
  }

  .home-avatar {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    overflow: hidden;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
    color: inherit;
    font-weight: 800;
  }

  .home-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .home-recent-copy,
  .home-character-row > span:last-child {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .home-recent-copy > span {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }

  .home-recent-copy strong,
  .home-recent-copy small,
  .home-character-row strong,
  .home-character-row small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .home-recent-copy strong,
  .home-character-row strong {
    color: inherit;
    font-size: 13px;
  }

  .home-recent-copy small,
  .home-character-row small {
    color: inherit;
    font-size: 12px;
  }

  .home-empty {
    display: grid;
    place-items: center;
    gap: 8px;
    min-height: 116px;
    border: 1px dashed var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
    font-size: 13px;
    text-align: center;
  }

  button,
  select,
  input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']),
  textarea {
    font: inherit;
  }

  select,
  input,
  textarea {
    width: 100%;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-md);
    background: var(--nanke-field);
    color: var(--nanke-ink);
    box-shadow: var(--nanke-shadow-field);
    padding: 10px 12px;
    outline: 0;
    transition:
      border-color 120ms ease,
      background-color 120ms ease,
      box-shadow 120ms ease;
  }

  select:hover,
  input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']):hover,
  textarea:hover {
    border-color: var(--nanke-border-strong);
    background: var(--nanke-field-hover);
  }

  select:focus,
  input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']):focus,
  textarea:focus {
    border-color: var(--nanke-accent);
    box-shadow:
      var(--nanke-shadow-field-focus),
      0 0 0 4px var(--nanke-focus);
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
    color: inherit;
    text-align: center;
  }

  .empty-state h1 {
    margin: 0;
    color: var(--nanke-ink);
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
    color: inherit;
    cursor: zoom-in;
  }

  .message-avatar:hover,
  .message-avatar:focus-visible {
    border-color: inherit;
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
    background: var(--nanke-surface-raised);
    color: var(--nanke-ink);
    font-weight: 800;
  }

  .message-row.user .message-avatar span {
    background: var(--nanke-field);
  }

  .message {
    min-width: 0;
    flex: 1 1 auto;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 12px 14px;
    box-shadow: 0 1px 0 rgb(31 36 33 / 4%);
  }

  .message.user {
    border-color: inherit;
    background: var(--nanke-field);
  }

  .message.assistant {
    background: var(--nanke-surface);
  }

  .message strong {
    display: block;
    margin-bottom: 6px;
    color: var(--nanke-ink-muted);
    font-size: 12px;
    text-transform: none;
  }

  .thinking-block {
    overflow: hidden;
    margin: 2px 0 10px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
  }

  .thinking-block[open] {
    background: var(--nanke-surface);
  }

  .thinking-block summary {
    display: flex;
    min-height: 36px;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 11px;
    color: inherit;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    list-style: none;
  }

  .thinking-block summary::-webkit-details-marker {
    display: none;
  }

  .thinking-block-content {
    border-top: 1px solid var(--nanke-border);
    padding: 10px 12px 12px;
    color: inherit;
    font-size: calc(var(--app-chat-font-size) * 0.92);
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
    font-size: var(--app-chat-font-size);
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

  .message-editor {
    display: grid;
    gap: 8px;
  }

  .message-editor textarea {
    width: 100%;
    min-height: 118px;
    resize: vertical;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
    font: inherit;
    line-height: 1.58;
    padding: 10px 11px;
  }

  .message-editor textarea:focus {
    border-color: inherit;
    box-shadow: 0 0 0 3px rgb(127 178 141 / 20%);
    outline: 0;
  }

  .message-editor-actions {
    background: var(--nanke-surface-muted);
    display: flex;
    justify-content: flex-end;
    gap: 7px;
  }

  .message-editor-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 30px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
    font-size: 12px;
    font-weight: 700;
    padding: 0 10px;
  }

  .message-editor-actions button.primary {
    border-color: inherit;
    background: var(--nanke-accent);
    color: var(--nanke-ink);
  }

  .message-editor-actions button:not(:disabled):hover {
    border-color: inherit;
    background: var(--nanke-field);
  }

  .message-editor-actions button.primary:not(:disabled):hover {
    border-color: inherit;
    background: var(--nanke-field);
  }

  .message-editor-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.56;
  }

  .message-editor small {
    color: inherit;
    font-size: 11px;
  }

  .branch-controls {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 10px;
    min-height: 28px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
    padding: 2px;
    color: inherit;
    font-size: 12px;
  }

  .message-row.user .branch-controls {
    background: var(--nanke-field);
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
    background: var(--nanke-field);
    color: inherit;
  }

  .branch-controls button.danger:not(:disabled):hover {
    background: var(--nanke-field);
    color: inherit;
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
    border-left: 3px solid var(--nanke-border-strong);
    padding: 0.2em 0 0.2em 0.85em;
    color: inherit;
  }

  .message-content.rich :global(em) {
    color: inherit;
  }

  .message-content.rich :global(code) {
    border: 1px solid var(--nanke-border);
    border-radius: 5px;
    background: var(--nanke-field);
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
    border: 1px solid var(--nanke-border-strong);
    border-radius: 12px;
    background: var(--nanke-surface-muted);
    box-shadow: 0 8px 20px rgb(15 23 42 / 14%);
    color: inherit;
  }

  .message-content.rich :global(.konata-thinking-details[open]) {
    border-color: rgb(139 92 246 / 52%);
    background: var(--nanke-surface-muted);
    box-shadow: 0 12px 26px rgb(15 23 42 / 22%);
  }

  .message-content.rich :global(.konata-thinking-summary) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 42px;
    padding: 10px 14px;
    color: inherit;
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
    color: inherit;
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
    color: inherit;
  }

  .message-content.rich :global(.konata-thinking-content p),
  .message-content.rich :global(.konata-thinking-content ul),
  .message-content.rich :global(.konata-thinking-content ol) {
    margin-top: 0;
  }

  .composer {
    display: flex;
    justify-content: center;
    border-top: 1px solid var(--nanke-border);
    padding: 12px 20px 18px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--nanke-page) 72%, transparent), var(--nanke-page) 34%);
  }

  .composer-dock {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: end;
    gap: 8px;
    width: min(100%, 880px);
    border: 1px solid var(--nanke-border);
    border-radius: 12px;
    background: var(--nanke-surface);
    box-shadow:
      0 12px 30px rgb(31 36 33 / 10%),
      0 1px 0 rgb(31 36 33 / 4%);
    padding: 8px;
  }

  .composer-toolbox {
    position: relative;
    display: grid;
  }

  .composer-toolbox-trigger,
  .composer-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 10px;
  }

  .composer-toolbox-trigger {
    border: 1px solid var(--nanke-border);
    background: var(--nanke-field);
    color: inherit;
  }

  .composer-toolbox-trigger:hover,
  .composer-toolbox-trigger:focus-visible,
  .composer-toolbox-trigger.active {
    border-color: inherit;
    background: var(--nanke-field);
    color: inherit;
    outline: 0;
  }

  .composer-menu {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 0;
    z-index: 20;
    display: grid;
    width: 210px;
    border: 1px solid var(--nanke-border);
    border-radius: 10px;
    background: var(--nanke-surface);
    box-shadow: 0 16px 36px rgb(25 33 28 / 18%);
    padding: 6px;
  }

  .composer-menu button {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    min-height: 46px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    padding: 7px 9px;
    text-align: left;
  }

  .composer-menu button:not(:disabled):hover,
  .composer-menu button:not(:disabled):focus-visible {
    background: var(--nanke-surface-muted);
    color: inherit;
    outline: 0;
  }

  .composer-menu button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .composer-menu span {
    display: grid;
    min-width: 0;
    gap: 2px;
  }

  .composer-menu strong {
    font-size: 13px;
  }

  .composer-menu small {
    overflow: hidden;
    color: inherit;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .composer-input {
    appearance: none;
    min-height: 42px;
    max-height: 38vh;
    border: 0 !important;
    border-radius: 8px;
    background: transparent;
    box-shadow: none !important;
    field-sizing: content;
    font-size: var(--app-chat-font-size);
    line-height: 1.55;
    overflow: auto;
    padding: 9px 6px;
    resize: none;
  }

  .composer-input:focus,
  .composer-input:focus-visible {
    outline: 0 !important;
    box-shadow: none !important;
  }

  .composer-dock:focus-within {
    border-color: var(--nanke-border-strong);
    box-shadow:
      0 0 0 2px var(--nanke-focus),
      var(--nanke-shadow-popover);
  }

  .composer-action {
    border: 1px solid var(--nanke-border);
    background: var(--nanke-field);
    color: var(--nanke-ink);
  }

  .composer-action:hover,
  .composer-action:focus-visible {
    background: var(--nanke-field);
    outline: 0;
  }

  .composer-action.stopping {
    border-color: inherit;
    background: var(--nanke-field);
  }

  .composer-action.stopping:hover,
  .composer-action.stopping:focus-visible {
    background: var(--nanke-field);
  }

  .composer-action:disabled {
    cursor: not-allowed;
    border-color: inherit;
    background: var(--nanke-field);
    color: inherit;
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
    background: var(--nanke-surface-raised);
    box-shadow: 0 18px 46px rgb(20 24 22 / 22%);
    color: var(--nanke-ink);
    font-size: 96px;
    font-weight: 800;
  }

  .avatar-viewer-image.user span {
    background: var(--nanke-field);
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
    border: 1px solid var(--nanke-border-strong);
    border-radius: 8px;
    background: var(--nanke-surface-muted);
    color: var(--nanke-ink);
    pointer-events: auto;
    backdrop-filter: blur(20px) saturate(180%);
  }

  .avatar-viewer-controls button {
    cursor: pointer;
  }

  .avatar-viewer-controls button:hover,
  .avatar-viewer-controls button:focus-visible {
    background: var(--nanke-surface-muted);
    outline: 0;
  }

  .delete-dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 58;
    display: grid;
    place-items: center;
    background: var(--nanke-surface-muted);
    padding: 24px;
  }

  .delete-dialog {
    display: grid;
    gap: 13px;
    width: min(460px, 100%);
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    box-shadow: 0 24px 70px rgb(28 32 29 / 22%);
    color: inherit;
    padding: 16px;
  }

  .delete-dialog header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: inherit;
  }

  .delete-dialog p {
    max-height: 24vh;
    overflow: auto;
    margin: 0;
    color: inherit;
    font-size: 13px;
    line-height: 1.55;
  }

  .delete-dialog p strong,
  .delete-dialog p span {
    display: block;
  }

  .delete-dialog p strong {
    margin-bottom: 4px;
    color: inherit;
    font-size: 14px;
  }

  .delete-dialog-actions {
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    gap: 8px;
  }

  .delete-dialog-actions.conversation-delete-actions {
    grid-template-columns: auto minmax(120px, 1fr);
  }

  .delete-dialog-actions button {
    min-height: 34px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
    font-size: 12px;
    font-weight: 800;
    padding: 0 11px;
  }

  .delete-dialog-actions button:not(:disabled):hover {
    border-color: inherit;
    background: var(--nanke-field);
  }

  .delete-dialog-actions button.danger {
    border-color: inherit;
    background: var(--nanke-field);
    color: var(--nanke-ink);
  }

  .delete-dialog-actions button.danger:not(:disabled):hover {
    border-color: inherit;
    background: var(--nanke-field);
  }

  .delete-dialog-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.58;
  }

  .delete-dialog small {
    color: inherit;
    font-size: 11px;
  }

  @media (max-width: 620px) {
    .delete-dialog-actions {
      grid-template-columns: 1fr;
    }
  }

  .primary,
  .secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 8px;
    border: 1px solid var(--nanke-border);
    padding: 10px 14px;
    background: var(--nanke-field);
    color: var(--nanke-ink);
    min-height: 42px;
  }

  .secondary {
    border-color: var(--nanke-border);
    background: var(--nanke-surface);
    color: inherit;
  }

  .secondary:hover,
  .secondary:focus-visible {
    border-color: var(--nanke-border-strong);
    outline: 0;
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
    background: var(--nanke-surface-muted);
  }

  .drawer {
    position: fixed;
    inset: 0 auto 0 64px;
    z-index: 30;
    display: flex;
    flex-direction: column;
    width: min(390px, calc(100vw - 64px));
    border-right: 1px solid var(--nanke-border);
    background: var(--nanke-surface);
    box-shadow: 16px 0 36px rgb(28 36 31 / 14%);
  }

  .drawer.right {
    inset: 0 0 0 auto;
    width: min(440px, calc(100vw - 64px));
    border-right: 0;
    border-left: 1px solid var(--nanke-border);
    box-shadow: -16px 0 36px rgb(28 36 31 / 14%);
  }

  .drawer.profiles {
    width: min(720px, calc(100vw - 64px));
  }

  .drawer.characters {
    width: min(1040px, calc(100vw - 64px));
  }

  .drawer.personas {
    width: min(920px, calc(100vw - 64px));
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
    border-bottom: 1px solid var(--nanke-border);
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
  .inspector-panel,
  .settings-panel {
    display: grid;
    gap: 10px;
    padding: 16px;
  }

  .settings-panel {
    align-content: start;
    overflow: auto;
  }

  .settings-section {
    display: grid;
    gap: 14px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 14px;
  }

  .settings-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: inherit;
  }

  .settings-section-head > div {
    display: grid;
    gap: 2px;
  }

  .settings-section-head strong {
    font-size: 14px;
  }

  .settings-section-head span {
    color: inherit;
    font-size: 12px;
  }

  .font-choice-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 6px;
  }

  .font-choice-grid button {
    display: grid;
    gap: 3px;
    min-width: 0;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 9px 8px;
    text-align: left;
  }

  .font-choice-grid button.active {
    border-color: inherit;
    background: var(--nanke-field);
    color: inherit;
  }

  .font-choice-grid strong {
    font-size: 13px;
  }

  .font-choice-grid span {
    overflow: hidden;
    color: inherit;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .settings-range {
    display: grid;
    gap: 8px;
  }

  .settings-preview {
    display: grid;
    gap: 6px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 12px;
  }

  .settings-preview strong {
    color: inherit;
    font-size: 12px;
  }

  .settings-preview p {
    margin: 0;
    color: inherit;
    font-size: var(--app-chat-font-size);
    line-height: 1.58;
  }

  .compact-editor {
    border-top: 1px solid var(--nanke-border);
    border-bottom: 1px solid var(--nanke-border);
    background: var(--nanke-field);
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: inherit;
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
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

  .import-kind-note {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 40px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 8px 10px;
    color: inherit;
    font-size: 13px;
  }

  .import-kind-note strong {
    color: inherit;
    font-weight: 700;
  }

  .file-picker {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    border: 1px dashed var(--nanke-border-strong);
    border-radius: 8px;
    background: var(--nanke-field);
    color: inherit;
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 11px 12px;
    color: inherit;
    text-align: left;
  }

  .drawer-item.active,
  .drawer-item:hover {
    border-color: inherit;
    background: var(--nanke-surface-muted);
  }

  .drawer-item span,
  .drawer-card span {
    color: inherit;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .persona-workspace {
    display: grid;
    grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.35fr);
    min-height: 0;
    flex: 1 1 auto;
  }

  .persona-library,
  .persona-detail {
    display: grid;
    align-content: start;
    gap: 12px;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    padding: 16px;
  }

  .persona-library {
    border-right: 1px solid var(--nanke-border);
    background: var(--nanke-surface);
  }

  .persona-create,
  .persona-editor,
  .persona-connections {
    display: grid;
    gap: 12px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 14px;
  }

  .persona-section-head {
    display: grid;
    gap: 2px;
  }

  .persona-section-head strong {
    color: inherit;
    font-size: 14px;
  }

  .persona-section-head small {
    color: inherit;
    font-size: 12px;
    line-height: 1.45;
  }

  .persona-search {
    background: var(--nanke-surface);
  }

  .persona-list {
    display: grid;
    align-content: start;
    gap: 8px;
    min-height: 0;
  }

  .persona-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 9px;
    text-align: left;
  }

  .persona-row.active,
  .persona-row:hover {
    border-color: inherit;
    background: var(--nanke-surface-muted);
  }

  .persona-row-avatar,
  .persona-avatar-uploader {
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--nanke-border);
    background: var(--nanke-field);
    color: inherit;
    font-weight: 800;
  }

  .persona-row-avatar {
    width: 42px;
    height: 42px;
    border-radius: 8px;
    font-size: 15px;
  }

  .persona-row-avatar img,
  .persona-avatar-uploader img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .persona-row-copy {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .persona-row-copy strong,
  .persona-row-copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .persona-row-copy strong {
    font-size: 13px;
  }

  .persona-row-copy small {
    color: inherit;
    font-size: 11px;
  }

  .persona-detail {
    background: var(--nanke-surface);
  }

  .persona-identity {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 14px;
  }

  .persona-avatar-uploader {
    position: relative;
    width: 96px;
    height: 112px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 28px;
  }

  .persona-avatar-uploader input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .persona-avatar-uploader:hover {
    border-color: inherit;
    box-shadow: 0 0 0 4px rgb(28 107 67 / 10%);
  }

  .persona-identity span {
    color: inherit;
    font-size: 12px;
    font-weight: 700;
  }

  .persona-identity h3 {
    margin: 2px 0;
    color: inherit;
    font-size: 22px;
    letter-spacing: 0;
  }

  .persona-identity p {
    margin: 0;
    color: inherit;
    font-size: 13px;
    line-height: 1.45;
  }

  .persona-action-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .persona-action-grid button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-width: 0;
    min-height: 38px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
    color: inherit;
    font-size: 12px;
    font-weight: 800;
    padding: 0 10px;
  }

  .persona-action-grid button.active {
    border-color: inherit;
    background: var(--nanke-field);
    color: inherit;
  }

  .persona-action-grid button.danger {
    border-color: inherit;
    background: var(--nanke-surface);
    color: inherit;
  }

  .persona-action-grid button:not(:disabled):hover {
    border-color: inherit;
    background: var(--nanke-field);
  }

  .persona-action-grid button:disabled {
    cursor: not-allowed;
    opacity: 0.52;
  }

  .persona-editor-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: inherit;
    font-size: 12px;
  }

  .persona-connections {
    background: var(--nanke-surface);
  }

  .persona-connection-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 34px;
    border-top: 1px solid var(--nanke-border);
    color: inherit;
    font-size: 12px;
  }

  .persona-connection-row strong {
    color: inherit;
    font-size: 13px;
  }

  .persona-empty {
    display: grid;
    place-items: center;
    gap: 8px;
    min-height: 280px;
    color: inherit;
    text-align: center;
  }

  @media (max-width: 820px) {
    .persona-workspace {
      grid-template-columns: 1fr;
    }

    .persona-library {
      border-right: 0;
      border-bottom: 1px solid var(--nanke-border);
    }

    .persona-action-grid {
      grid-template-columns: 1fr 1fr;
    }
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

  .conversation-group-toggle {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    width: 100%;
    gap: 9px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    list-style: none;
    padding: 5px 6px;
  }

  .conversation-group-toggle::-webkit-details-marker {
    display: none;
  }

  .conversation-group-toggle:hover,
  .conversation-group-toggle:focus-visible {
    border-color: inherit;
    background: var(--nanke-field);
    outline: 0;
  }

  .conversation-group-copy {
    display: grid;
    gap: 1px;
    min-width: 0;
    text-align: left;
  }

  .conversation-group-copy strong,
  .conversation-group-copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .conversation-group-copy strong {
    font-size: 13px;
  }

  .conversation-group-copy small {
    color: inherit;
    font-size: 12px;
  }

  .conversation-group-chevron {
    display: grid;
    place-items: center;
    color: inherit;
    transition: transform 140ms ease;
  }

  .conversation-group:not([open]) .conversation-group-chevron {
    transform: rotate(-90deg);
  }

  .conversation-group-avatar {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    overflow: hidden;
    border: 1px solid var(--nanke-border);
    border-radius: 7px;
    background: var(--nanke-field);
    color: inherit;
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

  .conversation-group:not([open]) .conversation-group-items {
    display: none;
  }

  .conversation-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 8px;
  }

  .conversation-row.active,
  .conversation-row:hover {
    border-color: inherit;
    background: var(--nanke-surface-muted);
  }

  .conversation-row.archived {
    background: var(--nanke-field);
    color: inherit;
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
    color: inherit;
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
    color: inherit;
    padding: 0;
  }

  .conversation-row-actions button:hover {
    border-color: inherit;
    background: var(--nanke-surface);
    color: inherit;
  }

  .conversation-row-actions button.danger:hover {
    border-color: inherit;
    background: var(--nanke-surface);
    color: inherit;
  }

  .drawer-empty.compact {
    border: 1px dashed var(--nanke-border);
    border-radius: 7px;
    background: var(--nanke-surface);
    padding: 9px 10px;
    text-align: center;
  }

  .character-workspace {
    display: grid;
    grid-template-columns: minmax(260px, 310px) minmax(0, 1fr);
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    background: var(--nanke-surface);
  }

  .character-library {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 10px;
    min-height: 0;
    border-right: 1px solid var(--nanke-border);
    background: var(--nanke-surface);
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 7px;
  }

  .character-row.active,
  .character-row:hover {
    border-color: inherit;
    background: var(--nanke-surface-muted);
  }

  .character-row-main {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    border: 0;
    background: transparent;
    color: inherit;
    padding: 0;
    text-align: left;
  }

  .character-avatar-small,
  .character-avatar-large {
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface-raised);
    color: var(--nanke-ink);
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
    color: inherit;
    font-size: 12px;
  }

  .favorite-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--nanke-border);
    border-radius: 7px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 0;
  }

  .favorite-button.active {
    border-color: inherit;
    background: var(--nanke-surface);
    color: inherit;
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
    color: inherit;
  }

  .character-editor-hero {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 12px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
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
    border-color: inherit;
    box-shadow: 0 0 0 3px rgb(146 191 164 / 22%);
    outline: 0;
  }

  .character-avatar-large.placeholder-avatar {
    cursor: default;
  }

  .character-avatar-large.placeholder-avatar:hover,
  .character-avatar-large.placeholder-avatar:focus-visible {
    border-color: inherit;
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
    border: 1px solid var(--nanke-border);
    border-radius: 999px;
    background: var(--nanke-surface);
    color: inherit;
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
    padding: 4px;
  }

  .character-tabs button {
    min-height: 36px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: inherit;
  }

  .character-tabs button.active {
    border-color: inherit;
    background: var(--nanke-surface);
    color: inherit;
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
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

  .character-lore-list article {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 6px;
  }

  .character-lore-list article.disabled {
    background: var(--nanke-field);
    opacity: 0.74;
  }

  .character-lore-list article > button:first-child {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    min-height: 46px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: inherit;
    padding: 8px;
    text-align: left;
  }

  .character-lore-list article:hover {
    border-color: inherit;
    background: var(--nanke-surface-muted);
  }

  .character-lore-list article > button:first-child span {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .character-lore-actions {
    display: flex;
    gap: 4px;
  }

  .character-lore-actions button {
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--nanke-border);
    border-radius: 7px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 0;
  }

  .character-source-panel {
    display: grid;
    align-content: center;
    gap: 3px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 8px 10px;
  }

  .worldbook-workspace {
    display: grid;
    grid-template-columns: minmax(210px, 260px) minmax(0, 1fr);
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    background: var(--nanke-surface);
  }

  .worldbook-library {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
    border-right: 1px solid var(--nanke-border);
    background: var(--nanke-surface);
    padding: 14px;
  }

  .worldbook-library-actions {
    display: grid;
    gap: 8px;
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 10px;
    text-align: left;
  }

  .worldbook-row.active,
  .worldbook-row:hover {
    border-color: inherit;
    background: var(--nanke-surface-muted);
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
  .worldbook-binding-panel span,
  .worldbook-binding-panel small,
  .worldbook-binding-list small,
  .worldbook-entry-row small,
  .worldbook-entry-editor-head span,
  .worldbook-entry-fields span {
    color: inherit;
    font-size: 12px;
  }

  .worldbook-row em {
    border: 1px solid var(--nanke-border);
    border-radius: 999px;
    background: var(--nanke-surface-muted);
    color: inherit;
    padding: 2px 6px;
    font-style: normal;
  }

  .worldbook-editor {
    display: grid;
    grid-template-rows: auto auto auto auto minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
    overflow: hidden;
    padding: 14px;
  }

  .worldbook-editor.empty,
  .worldbook-entry-editor.empty {
    place-content: center;
    justify-items: center;
    color: inherit;
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
    color: inherit;
    font-size: 12px;
  }

  .worldbook-source {
    display: grid;
    align-content: center;
    min-width: 150px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 8px 10px;
  }

  .worldbook-binding-panel {
    display: grid;
    gap: 10px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 10px;
  }

  .worldbook-binding-panel header,
  .worldbook-binding-selected {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .worldbook-binding-panel header > div,
  .worldbook-binding-selected > div {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .worldbook-binding-panel select {
    min-width: 180px;
    min-height: 36px;
    border-radius: 7px;
    padding: 7px 9px;
    font-size: 13px;
  }

  .worldbook-binding-selected {
    justify-content: flex-start;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 8px;
  }

  .character-avatar-small.compact {
    flex: 0 0 auto;
    width: 34px;
    height: 42px;
    border-radius: 7px;
    font-size: 13px;
  }

  .worldbook-binding-actions {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }

  .worldbook-binding-actions .secondary {
    min-height: 34px;
    padding: 0 10px;
  }

  .tool-button.danger,
  .character-lore-actions button:last-child {
    border-color: inherit;
    color: inherit;
  }

  .worldbook-binding-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
    gap: 6px;
  }

  .worldbook-binding-list button {
    display: grid;
    min-width: 0;
    gap: 2px;
    border: 1px solid var(--nanke-border);
    border-radius: 7px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 7px 8px;
    text-align: left;
  }

  .worldbook-binding-list button.active {
    border-color: inherit;
    box-shadow: 0 0 0 2px rgb(143 190 162 / 18%);
  }

  .worldbook-binding-list button.enabled {
    background: var(--nanke-surface-muted);
  }

  .worldbook-binding-list button.disabled {
    background: var(--nanke-field);
  }

  .worldbook-binding-list span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 8px;
  }

  .worldbook-entry-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 6px;
  }

  .worldbook-entry-row.active {
    border-color: inherit;
    background: var(--nanke-surface-muted);
  }

  .worldbook-entry-main {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    color: inherit;
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
    background: var(--nanke-field);
    color: inherit;
    font-size: 11px;
    font-weight: 800;
  }

  .entry-state[data-state='constant'] {
    background: var(--nanke-field);
    color: inherit;
  }

  .entry-state[data-state='disabled'] {
    background: var(--nanke-field);
    color: inherit;
  }

  .worldbook-entry-actions {
    display: grid;
    grid-template-columns: repeat(2, 28px);
    gap: 4px;
  }

  .worldbook-entry-actions button {
    width: 28px;
    height: 28px;
    border: 1px solid var(--nanke-border);
    border-radius: 6px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 0;
  }

  .worldbook-entry-actions button:hover,
  .worldbook-entry-actions button:focus-visible {
    border-color: inherit;
    background: var(--nanke-surface-muted);
    outline: 0;
  }

  .worldbook-entry-editor {
    display: grid;
    align-content: start;
    gap: 12px;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
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
    border-bottom: 1px solid var(--nanke-border);
    padding: 14px 16px 16px;
    background: var(--nanke-surface);
  }

  .profile-workspace {
    display: grid;
    align-content: start;
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    background: var(--nanke-surface);
  }

  .preset-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
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
    color: inherit;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .provider-pill {
    flex: 0 0 auto;
    border: 1px solid var(--nanke-border);
    border-radius: 999px;
    background: var(--nanke-surface-muted);
    color: inherit !important;
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
    border: 1px solid var(--nanke-border);
    border-radius: 999px;
    background: var(--nanke-field);
    color: inherit;
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
    border-bottom: 1px solid var(--nanke-border);
    padding: 14px 16px 16px;
    background: var(--nanke-surface);
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
    color: inherit;
    font-size: 12px;
  }

  .provider-editor,
  .request-panel,
  .regex-panel {
    display: grid;
    gap: 12px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
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
    color: inherit;
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
    border-color: inherit;
    background: var(--nanke-surface);
    color: inherit;
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

  .vertex-strip > button {
    min-height: 36px;
    border-color: inherit;
    background: var(--nanke-surface);
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
    border-top: 1px solid var(--nanke-border);
    padding-top: 10px;
  }

  .credential-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .credential-panel-head strong {
    color: var(--nanke-ink);
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
    padding: 4px;
  }

  .request-flow-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
    padding: 4px;
  }

  .request-flow-strip button {
    display: grid;
    gap: 2px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: inherit;
    padding: 8px 10px;
    text-align: left;
  }

  .request-flow-strip button.active {
    border-color: inherit;
    background: var(--nanke-surface);
    color: inherit;
    box-shadow: 0 1px 3px rgb(29 39 33 / 8%);
  }

  .thinking-panel {
    display: grid;
    gap: 10px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
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
    color: var(--nanke-ink);
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
    color: inherit;
    padding: 8px 10px;
    text-align: left;
  }

  .compatibility-strip button.active {
    border-color: inherit;
    background: var(--nanke-surface);
    color: inherit;
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
    border: 1px solid var(--nanke-border);
    border-radius: 999px;
    background: var(--nanke-surface);
    color: var(--nanke-ink);
    padding: 3px 8px;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 12px;
  }

  .sampler-range {
    height: 30px;
    min-height: 30px !important;
    padding: 0 !important;
    accent-color: inherit;
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
    border-top: 1px solid var(--nanke-border);
    padding-top: 8px;
  }

  .advanced-sampler summary {
    cursor: pointer;
    color: inherit;
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
  .segmented-field {
    display: grid;
    min-width: 0;
    gap: 5px;
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
    color: inherit;
    font-size: 12px;
  }

  .regex-script-list {
    display: grid;
    gap: 6px;
    max-height: 260px;
    overflow: auto;
  }

  .regex-script-row {
    border: 1px solid var(--nanke-border);
    border-radius: 7px;
    background: var(--nanke-surface);
    padding: 8px 10px;
  }

  .regex-script-row.disabled {
    opacity: 0.62;
  }

  .mini-toggle {
    min-width: 44px;
    min-height: 30px;
    border: 1px solid var(--nanke-border);
    border-radius: 999px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 700;
  }

  .mini-toggle.active {
    border-color: inherit;
    background: var(--nanke-surface-muted);
    color: inherit;
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
    border-color: inherit;
    background: var(--nanke-surface);
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
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
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
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
    border-bottom: 1px solid var(--nanke-border);
    background: var(--nanke-field);
    color: inherit;
    padding: 8px 10px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .prompt-slot-row {
    border-bottom: 1px solid var(--nanke-border);
    background: var(--nanke-surface);
    padding: 8px 10px;
  }

  .prompt-slot-row:last-child {
    border-bottom: 0;
  }

  .prompt-slot-row.active {
    background: var(--nanke-surface-muted);
    box-shadow: inset 3px 0 0 #1c6b43;
  }

  .prompt-slot-grip {
    display: grid;
    place-items: center;
    color: inherit;
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
    color: inherit;
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
    border: 1px solid var(--nanke-border);
    border-radius: 999px;
    background: var(--nanke-field);
    color: inherit;
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
    border: 1px solid var(--nanke-border);
    border-radius: 6px;
    background: var(--nanke-surface);
    color: var(--nanke-ink);
  }

  .prompt-row-actions button:hover {
    border-color: inherit;
    background: var(--nanke-surface-muted);
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
    border-right: 1px solid var(--nanke-border);
    background: var(--nanke-surface-muted);
    box-shadow: 16px 0 36px rgb(28 36 31 / 14%);
    backdrop-filter: blur(20px) saturate(180%);
    padding: 16px;
  }

  .prompt-editor-window {
    display: grid;
    gap: 12px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 14px;
  }

  .prompt-editor-titlebar {
    border-bottom: 1px solid var(--nanke-border);
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
    border: 1px solid var(--nanke-border);
    border-radius: 999px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 0 10px;
    font-size: 12px;
  }

  .prompt-trigger-options button.active {
    border-color: inherit;
    background: var(--nanke-surface-muted);
    color: inherit;
  }

  .prompt-editor-source {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 9px 10px;
    color: inherit;
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
    border-top: 1px solid var(--nanke-border);
    padding-top: 12px;
  }

  .profile-list-section {
    display: grid;
    border-bottom: 1px solid var(--nanke-border);
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
    border-bottom: 1px solid var(--nanke-border);
    background: var(--nanke-surface);
    color: inherit;
    padding: 10px 16px;
    text-align: left;
  }

  .profile-row:hover,
  .profile-row.active {
    background: var(--nanke-surface-muted);
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
    color: inherit;
    padding: 18px 16px;
    font-size: 13px;
  }

  pre {
    min-height: 260px;
    max-height: 62vh;
    margin: 0;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
    color: inherit;
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
    border-right: 1px solid var(--nanke-border-soft);
    box-shadow: inset -1px 0 0 rgba(255,255,255,0.02);
      padding: 10px 8px;
    }

    .brand,
    .icon-button,
    .tool-button {
      width: 40px;
      height: 40px;
    }

    .chatbar {
    backdrop-filter: blur(20px) saturate(180%);
    background: var(--nanke-surface-acrylic);
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
    }

    .homebar {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      padding: 12px;
    }

    .homebar-actions {
      justify-content: stretch;
      flex-wrap: wrap;
    }

    .homebar-actions .context-chip {
      flex: 1 1 220px;
    }

    .home-workspace {
      padding: 16px 12px;
    }

    .home-overview,
    .home-grid {
      grid-template-columns: 1fr;
      gap: 18px;
    }

    .home-start h1 {
      font-size: 24px;
    }

    .home-section > header {
      align-items: stretch;
      flex-direction: column;
    }

    .home-section > header .secondary {
      width: 100%;
    }

    .conversation-title-card {
    box-shadow: var(--nanke-shadow-field);
    backdrop-filter: blur(20px) saturate(180%);
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
      padding: 10px;
    }

    .composer-dock {
      border-radius: 10px;
      gap: 6px;
      padding: 6px;
    }

    .composer-menu {
      width: min(210px, calc(100vw - 84px));
    }

    .stage.tree-open {
      grid-template-columns: 1fr;
      grid-template-rows: auto minmax(0, 1fr) auto minmax(42vh, 52vh);
    }

    .stage.tree-open :global(.tree-dock),
    .stage.tree-open .tree-dock-loading {
      grid-column: 1;
      grid-row: 4;
      border-top: 1px solid var(--nanke-border);
      border-left: 0;
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
      border-bottom: 1px solid var(--nanke-border);
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
      border-bottom: 1px solid var(--nanke-border);
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
