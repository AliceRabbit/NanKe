<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { applyRegexScripts, REGEX_PLACEMENT } from '$lib/core/regex';
  import { t } from '$lib/i18n';
  import HomeStage from '$lib/ui/features/home/HomeStage.svelte';
  import ConfirmDialog from '$lib/ui/components/ConfirmDialog.svelte';
  import DrawerShell from '$lib/ui/components/DrawerShell.svelte';
  import RenameDialog from '$lib/ui/components/RenameDialog.svelte';
  import StatusBadge from '$lib/ui/components/StatusBadge.svelte';
  import ToastRegion from '$lib/ui/components/ToastRegion.svelte';
  import ChatComposer from '$lib/ui/features/chat/ChatComposer.svelte';
  import NavigationRail from '$lib/ui/components/NavigationRail.svelte';
  import { renderMessageMarkdown } from '$lib/ui/markdown';
  import { appStatus, statusToToast, type AppStatus, type AppToast, type StatusKind } from '$lib/ui/state/status';
  import {
    applyAppSettingsToDocument,
    defaultAppSettings,
    persistAppSettings,
    readAppSettings,
    serializeAppSettingsVariables,
    settingsPreviewAvatarUrl,
    type AppSettings
  } from '$lib/ui/features/settings/app-settings';
  import '$lib/ui/styles/app-shell.css';
  import type { Component } from 'svelte';
  import type { ConversationTreeNode, ConversationTreeSummary } from '$lib/ui/features/conversation-tree/types';
  import type { Character } from '$lib/schemas/character';
  import type { Conversation as SchemaConversation } from '$lib/schemas/conversation';
  import type { NankeMessage } from '$lib/schemas/message';
  import type { GenerationProfile, PromptSlot } from '$lib/schemas/profile';
  import type { RegexProfile, RegexScript } from '$lib/schemas/regex';
  import type { UserPersona } from '$lib/schemas/user-persona';
  import type { WorldBook, WorldBookEntry } from '$lib/schemas/worldbook';
  import type { PageData } from './$types';
  import Archive from '@lucide/svelte/icons/archive';

  import ArchiveRestore from '@lucide/svelte/icons/archive-restore';

  import ArrowDown from '@lucide/svelte/icons/arrow-down';

  import Bot from '@lucide/svelte/icons/bot';

  import ChevronDown from '@lucide/svelte/icons/chevron-down';

  import ChevronLeft from '@lucide/svelte/icons/chevron-left';

  import ChevronRight from '@lucide/svelte/icons/chevron-right';

  import CircleStop from '@lucide/svelte/icons/circle-stop';

  import Copy from '@lucide/svelte/icons/copy';

  import Download from '@lucide/svelte/icons/download';

  import GitBranch from '@lucide/svelte/icons/git-branch';

  import GripHorizontal from '@lucide/svelte/icons/grip-horizontal';

  import MessageCircle from '@lucide/svelte/icons/message-circle';

  import MessageSquare from '@lucide/svelte/icons/message-square';

  import Minus from '@lucide/svelte/icons/minus';

  import Pencil from '@lucide/svelte/icons/pencil';

  import Plus from '@lucide/svelte/icons/plus';

  import RefreshCw from '@lucide/svelte/icons/refresh-cw';

  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';

  import Search from '@lucide/svelte/icons/search';

  import Save from '@lucide/svelte/icons/save';

  import Settings2 from '@lucide/svelte/icons/settings-2';

  import Trash2 from '@lucide/svelte/icons/trash-2';

  import UserRound from '@lucide/svelte/icons/user-round';

  import SquarePen from '@lucide/svelte/icons/square-pen';

  import X from '@lucide/svelte/icons/x';

  export let data: PageData;

  type SillyTavernProfileMetadata = {
    kind?: string;
    promptManager?: {
      promptCount?: number;
      orderedPromptCount?: number;
      enabledPromptCount?: number;
      inactivePromptCount?: number;
    };
  };
  type Profile = Omit<GenerationProfile, 'metadata'> & {
    metadata: GenerationProfile['metadata'] & {
      sillyTavern?: SillyTavernProfileMetadata;
    };
  };
  type ProviderType = Profile['provider']['type'];
  type OpenAICompatibility = Extract<Profile['provider'], { type: 'openai-compatible' }>['compatibility'];
  type VertexMode = NonNullable<Extract<Profile['provider'], { type: 'gemini' }>['vertex']>['mode'];
  type OpenAIReasoningEffort = Profile['thinking']['openai']['effort'];
  type GeminiThinkingMode = Profile['thinking']['gemini']['mode'];
  type GeminiThinkingLevel = Profile['thinking']['gemini']['level'];
  type PromptRole = PromptSlot['role'];
  type PromptSlotSource = PromptSlot['source'];
  type CharacterSortMode = 'favorite' | 'name-asc' | 'name-desc' | 'newest' | 'oldest' | 'tokens-desc';
  type CharacterEditorTab = 'core' | 'prompt' | 'lore' | 'metadata';
  type CharacterPanelMode = 'edit' | 'create';
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
  type MessageBranch = NonNullable<NankeMessage['branch']>;
  type Conversation = Pick<SchemaConversation, 'id' | 'title'> & Partial<Omit<SchemaConversation, 'id' | 'title'>> & { messages?: ChatMessage[] };
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
  type GenerationSnapshot = {
    activeConversationId: string;
    activeConversationRecord: Conversation | null;
    conversations: Conversation[];
    messages: ChatMessage[];
    input: string;
    status: AppStatus;
    conversationTreeSummary: ConversationTreeSummary | null;
    conversationTreeSelectedNodeId: string;
  };
  type ZoomedAvatar = { key: string; name: string; role: ChatMessage['role']; src: string; initials: string };
  type AvatarViewerFrame = { x: number; y: number; scale: number };
  type AvatarViewerDrag = { pointerId: number; startX: number; startY: number; originX: number; originY: number };
  type GenerationStreamEvent = { type: 'text' | 'thinking' | 'inspector' | 'done' | 'error'; text?: string; conversationId?: string; activeLeafId?: string };
  type ConversationGroup = { key: string; label: string; avatarUrl: string; count: number; latestUpdatedAt?: number; conversations: Conversation[] };
  type ImportKind = 'preset' | 'character-card-json' | 'character-card-png' | 'worldbook' | 'chat-jsonl' | 'conversation-snapshot';
  type ImportScope = 'character' | 'profile' | 'worldbook';
  type View = 'home' | 'chat';
  type Drawer = 'chats' | 'characters' | 'personas' | 'worldbooks' | 'profiles' | 'toolbox' | 'settings' | 'import' | 'inspector' | null;
  type WorldBookDeleteResult = {
    deleted: boolean;
    id: string;
    affectedCharacterIds: string[];
    removedCharacterBindings: number;
    removedEmbeddedCharacterBooks: number;
  };
  type MessageDeleteMode = 'node' | 'subtree';
  type PendingMessageDelete = {
    conversationId: string;
    nodeId: string;
    label: string;
  };
  type PendingWorldBookDelete = {
    worldBook: WorldBook;
    boundCount: number;
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
  type CharacterDrawerComponent = (typeof import('$lib/ui/features/characters/CharacterDrawer.svelte'))['default'];
  type WorldBookDrawerComponent = (typeof import('$lib/ui/features/worldbooks/WorldBookDrawer.svelte'))['default'];
  type ProfileDrawerComponent = (typeof import('$lib/ui/features/profiles/ProfileDrawer.svelte'))['default'];
  type PersonaDrawerComponent = (typeof import('$lib/ui/features/personas/PersonaDrawer.svelte'))['default'];
  type SettingsDrawerComponent = (typeof import('$lib/ui/features/settings/SettingsDrawer.svelte'))['default'];
  type ToolboxDrawerComponent = (typeof import('$lib/ui/features/toolbox/ToolboxDrawer.svelte'))['default'];
  type ImportDrawerComponent = (typeof import('$lib/ui/features/import/ImportDrawer.svelte'))['default'];
  type InspectorDrawerComponent = (typeof import('$lib/ui/features/inspector/InspectorDrawer.svelte'))['default'];

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
  const importKindsByScope: Record<ImportScope, ImportKind[]> = {
    character: ['character-card-png', 'character-card-json'],
    profile: ['preset'],
    worldbook: ['worldbook']
  };
  const maxContextTokens = 2_000_000;
  const maxOutputTokenRange = 65_536;
  const avatarViewerMinScale = 0.1;
  const avatarViewerMaxScale = 2.6;
  const avatarViewerScaleStep = 0.12;
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
  const conversationGroupStateStorageKey = 'nanke.conversation-groups.v1';

  const initialData = data.initial;

  let profiles: Profile[] = initialData.profiles;
  let profilesHydrated = initialData.profilesHydrated;
  let profilesLoadPromise: Promise<void> | null = null;
  let characters: Character[] = initialData.characters;
  let charactersHydrated = initialData.charactersHydrated;
  let charactersLoadPromise: Promise<void> | null = null;
  let personas: UserPersona[] = initialData.personas;
  let personaCharacterBindings: PersonaCharacterBinding[] = initialData.personaCharacterBindings;
  let worldBooks: WorldBook[] = initialData.worldBooks;
  let worldBooksHydrated = initialData.worldBooksHydrated;
  let worldBooksLoadPromise: Promise<void> | null = null;
  let globalRegex: RegexProfile = initialData.globalRegex;
  let conversations: Conversation[] = initialData.conversations;
  let conversationQuery = '';
  let conversationCursor: { updatedAt: number; id: string } | null = initialData.conversationCursor;
  let conversationHasMore = initialData.conversationHasMore;
  let conversationSearchTimer: ReturnType<typeof setTimeout> | undefined;
  const conversationPageSize = initialData.conversationPageSize;
  let showArchivedConversations = false;
  let conversationGroupExpanded: Record<string, boolean> = {};
  let activeView: View = 'home';
  let activeDrawer: Drawer = null;
  let appSettings: AppSettings = defaultAppSettings();
  let activeProfileId = profiles[0]?.id ?? '';
  let activeCharacterId = characters[0]?.id ?? '';
  let activePersonaId = personas.find((persona) => persona.isDefault)?.id ?? personas[0]?.id ?? '';
  let activeConversationId = '';
  let activeConversationRecord: Conversation | null = null;
  let conversationTreeSummary: ConversationTreeSummary | null = null;
  let conversationTreeLoading = false;
  let conversationTreeSelectedNodeId = '';
  let conversationTreeActionStatus = '';
  let ConversationTreeDockComponent: ConversationTreeDockComponent | null = null;
  let CharacterDrawerComponent: CharacterDrawerComponent | null = null;
  let WorldBookDrawerComponent: WorldBookDrawerComponent | null = null;
  let ProfileDrawerComponent: ProfileDrawerComponent | null = null;
  let PersonaDrawerComponent: PersonaDrawerComponent | null = null;
  let SettingsDrawerComponent: SettingsDrawerComponent | null = null;
  let ToolboxDrawerComponent: ToolboxDrawerComponent | null = null;
  let ImportDrawerComponent: ImportDrawerComponent | null = null;
  let InspectorDrawerComponent: InspectorDrawerComponent | null = null;
  let messages: ChatMessage[] = [];
  let messagesContainer: HTMLDivElement | null = null;
  let messagesScrollFrame: number | null = null;
  let input = '';
  let status: AppStatus = appStatus.idle(t('status.ready'));
  let toasts: AppToast[] = [];

  function setStatus(kind: StatusKind, message: string, notify = kind === 'error' || kind === 'warning' || kind === 'success') {
    const next = appStatus[kind](message);
    status = next;
    if (notify) {
      toasts = [...toasts, statusToToast(next)].slice(-4);
    }
  }

  function dismissToast(id: string) {
    toasts = toasts.filter((toast) => toast.id !== id);
  }

  let theme: 'light' | 'dark' | 'system' = 'system';
  let mobileNavOpen = false;
  let appHydrated = false;

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
    appHydrated = true;
    const saved = localStorage.getItem('nanke-theme') as 'light' | 'dark' | 'system' | null;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      theme = saved;
    }
    applyTheme(theme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemePreferenceChange = () => {
      if (theme === 'system') applyTheme('system');
    };
    const handleAvatarViewerResize = () => {
      if (zoomedAvatar) clampCurrentAvatarViewer();
    };
    mediaQuery.addEventListener('change', handleThemePreferenceChange);
    window.addEventListener('resize', handleAvatarViewerResize);
    return () => {
      mediaQuery.removeEventListener('change', handleThemePreferenceChange);
      window.removeEventListener('resize', handleAvatarViewerResize);
      if (messagesScrollFrame !== null) cancelAnimationFrame(messagesScrollFrame);
    };
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
  let pendingConversationRename: Conversation | null = null;
  let renamingConversation = false;
  let conversationRenameStatus = '';
  let pendingCharacterDelete: Character | null = null;
  let deletingCharacter = false;
  let characterDeleteStatus = '';
  let pendingProfileDelete: Profile | null = null;
  let deletingProfile = false;
  let profileDeleteStatus = '';
  let generationErrorMessage = '';
  let pendingPersonaDelete: UserPersona | null = null;
  let personaDeleteStatus = '';
  let pendingWorldBookDelete: PendingWorldBookDelete | null = null;
  let worldBookDeleteStatus = '';
  let importKind: ImportKind = 'preset';
  let importScope: ImportScope = 'profile';
  let importName = '';
  let importText = '';
  let importFileName = '';
  let importFileBase64 = '';
  let hasImportPayload = false;
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
  let activeWorldBookId = worldBooks[0]?.id ?? '';
  let worldBookDraftId = '';
  let worldBookDraftName = '';
  let worldBookDraftEntries: WorldBookEntry[] = [];
  let filteredWorldBookEntries: WorldBookEntry[] = [];
  let activeWorldBookEntry: WorldBookEntry | undefined = undefined;
  let activeWorldBookEntryId = '';
  let worldBookEntryQuery = '';
  let worldBookSortMode = 'order-desc';
  let worldBookBindingCharacterId = activeCharacterId || characters[0]?.id || '';
  let deletingWorldBook = false;
  let openingPreviewCharacterId = '';
  let zoomedAvatar: ZoomedAvatar | null = null;
  let avatarViewerElement: HTMLElement | null = null;
  let avatarViewerFrame: AvatarViewerFrame = defaultAvatarViewerFrame();
  let avatarViewerDrag: AvatarViewerDrag | null = null;
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
  let profileDraftSquashSystemMessages = false;
  let activeSamplerFields = openAIStrictSamplerFields;
  let samplerVisible = samplerVisibility(activeSamplerFields);
  let samplerPanelHeading = t('profile.chatParams');
  let maxTokensFieldLabel = t('profile.maxCompletion');
  let candidateCountFieldLabel = 'N';
  let profileDraftRegexEnabled = true;
  let profileDraftRegexScripts: RegexScript[] = [];
  let globalRegexDraftEnabled = globalRegex.enabled !== false;
  let globalRegexDraftScripts: RegexScript[] = structuredClone(globalRegex.scripts);
  let globalRegexSaving = false;
  let globalRegexStatus = '';
  let profileDraftSlots: PromptSlot[] = [];
  let promptSlotQuery = '';
  let activePromptSlotId = '';
  let promptEditorSlotId = '';
  let promptEditorInitialSlot: PromptSlot | null = null;

  $: activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  $: activeProfileStats = profileStats(activeProfile);
  $: globalRegexStats = { active: globalRegexDraftScripts.filter((script) => !script.disabled).length, total: globalRegexDraftScripts.length };
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
  $: samplerPanelHeading = t('profile.chatParams');
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
  $: {
    if (activeWorldBookId !== worldBookDraftId) loadWorldBookDraft(activeWorldBook);
    if (worldBookDraftEntries.length && !worldBookDraftEntries.some((entry) => entry.id === activeWorldBookEntryId)) {
      activeWorldBookEntryId = worldBookDraftEntries[0].id;
    }
    filteredWorldBookEntries = filterWorldBookEntries(worldBookDraftEntries, worldBookEntryQuery, worldBookSortMode);
    activeWorldBookEntry = worldBookDraftEntries.find((entry) => entry.id === activeWorldBookEntryId);
  }
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
              : activeDrawer === 'toolbox'
                ? t('drawer.toolbox')
                : activeDrawer === 'import'
                  ? importScopeTitle(importScope)
                  : activeDrawer === 'inspector'
                    ? t('drawer.inspector')
                    : activeDrawer === 'settings'
                      ? t('drawer.settings')
                      : '';
  $: if (activeDrawer === 'characters') void Promise.all([ensureCharactersLoaded(), ensureCharacterDrawer()]);
  $: if (activeDrawer === 'worldbooks') void Promise.all([ensureCharactersLoaded(), ensureWorldBooksLoaded(), ensureWorldBookDrawer()]);
  $: importOptions = importKindsByScope[importScope];
  $: if (!importOptions.includes(importKind)) {
    importKind = importOptions[0];
  }
  $: hasImportPayload = importKind === 'character-card-png' ? Boolean(importFileBase64) : Boolean(importText.trim());
  $: appSettingsStyle = serializeAppSettingsVariables(appSettings);
  $: applyAppSettingsToDocument(appSettings);
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
  $: if (activeWorldBook && (!worldBookBindingCharacterId || !characters.some((character) => character.id === worldBookBindingCharacterId))) {
    worldBookBindingCharacterId = activeCharacterId || characters[0]?.id || '';
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
  });

  function loadAppSettings() {
    appSettings = readAppSettings(localStorage);
  }

  function saveAppSettings(next: AppSettings) {
    appSettings = persistAppSettings(localStorage, next);
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
    mobileNavOpen = false;
    closeDrawer();
    closeConversationTree();
  }

  async function openChatWorkspace() {
    await ensureProfilesLoaded();
    activeView = 'chat';
    mobileNavOpen = false;
    closeDrawer();
  }

  function openLibrary(drawer: Exclude<Drawer, 'chats' | 'settings' | 'import' | 'inspector' | null>) {
    mobileNavOpen = false;
    activeDrawer = activeDrawer === drawer ? null : drawer;
    if (activeDrawer === 'profiles') {
      void ensureProfilesLoaded();
      void ensureProfileDrawer();
    }
    if (activeDrawer === 'personas') void ensurePersonaDrawer();
  }

  function loadGlobalRegexDraft() {
    globalRegexDraftEnabled = globalRegex.enabled !== false;
    globalRegexDraftScripts = structuredClone(globalRegex.scripts);
    globalRegexStatus = '';
  }

  function openToolbox() {
    mobileNavOpen = false;
    activeDrawer = activeDrawer === 'toolbox' ? null : 'toolbox';
    if (activeDrawer === 'toolbox') {
      loadGlobalRegexDraft();
      void ensureToolboxDrawer();
    }
  }

  function openDrawer(drawer: Exclude<Drawer, null>) {
    mobileNavOpen = false;
    activeDrawer = activeDrawer === drawer ? null : drawer;
    if (activeDrawer === 'chats') {
      void refreshConversations({ reset: true });
    }
    if (activeDrawer === 'settings') void ensureSettingsDrawer();
  }

  function openImport(scope: ImportScope, kind: ImportKind = importKindsByScope[scope][0]) {
    importScope = scope;
    importKind = importKindsByScope[scope].includes(kind) ? kind : importKindsByScope[scope][0];
    importName = '';
    importText = '';
    importFileName = '';
    importFileBase64 = '';
    activeDrawer = 'import';
    void ensureImportDrawer();
  }

  function openPresetImport() {
    openImport('profile', 'preset');
  }

  function closeDrawer() {
    activeDrawer = null;
  }

  function drawerSide(drawer: Drawer): 'left' | 'right' {
    return drawer === 'import' || drawer === 'inspector' || drawer === 'settings' ? 'right' : 'left';
  }

  function drawerSize(drawer: Drawer): 'compact' | 'medium' | 'wide' | 'large' | 'full' {
    if (drawer === 'characters' || drawer === 'worldbooks') return 'full';
    if (drawer === 'personas') return 'large';
    if (drawer === 'profiles') return 'wide';
    return 'medium';
  }

  async function startNewConversation() {
    await ensureProfilesLoaded();
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

  function ensureProfilesLoaded(): Promise<void> {
    if (profilesHydrated) return Promise.resolve();
    if (!profilesLoadPromise) {
      profilesLoadPromise = (async () => {
        setStatus('loading', t('status.loading'), false);
        try {
          const nextProfiles = await fetchJson<Profile[]>('/api/profiles');
          profiles = nextProfiles;
          profilesHydrated = true;
          activeProfileId ||= profiles[0]?.id ?? '';
          loadProfileDraft(profiles.find((profile) => profile.id === activeProfileId));
        } finally {
          setStatus('idle', t('status.ready'), false);
        }
      })().finally(() => {
        profilesLoadPromise = null;
      });
    }
    return profilesLoadPromise;
  }

  function ensureCharactersLoaded(): Promise<void> {
    if (charactersHydrated) return Promise.resolve();
    if (!charactersLoadPromise) {
      charactersLoadPromise = (async () => {
        setStatus('loading', t('status.loading'), false);
        try {
          characters = await fetchJson<Character[]>('/api/characters');
          charactersHydrated = true;
          activeCharacterId ||= characters[0]?.id ?? '';
          loadCharacterDraft(characters.find((character) => character.id === activeCharacterId));
        } finally {
          setStatus('idle', t('status.ready'), false);
        }
      })().finally(() => {
        charactersLoadPromise = null;
      });
    }
    return charactersLoadPromise;
  }

  function ensureWorldBooksLoaded(): Promise<void> {
    if (worldBooksHydrated) return Promise.resolve();
    if (!worldBooksLoadPromise) {
      worldBooksLoadPromise = (async () => {
        setStatus('loading', t('status.loading'), false);
        try {
          worldBooks = await fetchJson<WorldBook[]>('/api/worldbooks');
          worldBooksHydrated = true;
          activeWorldBookId ||= worldBooks[0]?.id ?? '';
          loadWorldBookDraft(worldBooks.find((worldBook) => worldBook.id === activeWorldBookId));
        } finally {
          setStatus('idle', t('status.ready'), false);
        }
      })().finally(() => {
        worldBooksLoadPromise = null;
      });
    }
    return worldBooksLoadPromise;
  }

  function scrollMessagesToBottom() {
    if (!messagesContainer) return;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function queueMessagesScrollToBottom() {
    if (typeof window === 'undefined') return;
    await tick();
    if (messagesScrollFrame !== null) cancelAnimationFrame(messagesScrollFrame);
    messagesScrollFrame = requestAnimationFrame(() => {
      messagesScrollFrame = null;
      scrollMessagesToBottom();
    });
  }

  function clampNumber(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function defaultAvatarViewerFrame(): AvatarViewerFrame {
    if (typeof window === 'undefined') return { x: 84, y: 78, scale: 1 };

    const compact = window.matchMedia('(max-width: 760px)').matches;
    const railWidth = compact ? 56 : 64;
    const viewerWidth = Math.min(420, Math.max(260, Math.min(window.innerWidth * 0.34, window.innerHeight * 0.58)));
    const stageWidth = Math.max(0, window.innerWidth - railWidth);
    const chatWidth = Math.min(880, stageWidth);
    const chatLeft = railWidth + (stageWidth - chatWidth) / 2;
    const leftGapWidth = Math.max(0, chatLeft - railWidth);
    const x = leftGapWidth >= viewerWidth + 24 ? railWidth + (leftGapWidth - viewerWidth) / 2 : railWidth + (compact ? 10 : 16);

    return {
      x: clampNumber(x, 8, Math.max(8, window.innerWidth - viewerWidth - 8)),
      y: compact ? 72 : 82,
      scale: 1
    };
  }

  function avatarViewerVisualSize(scale = avatarViewerFrame.scale) {
    const fallbackWidth = typeof window === 'undefined' ? 360 : Math.min(420, Math.max(260, Math.min(window.innerWidth * 0.34, window.innerHeight * 0.58)));
    const fallbackHeight = fallbackWidth * 1.5;
    const rect = avatarViewerElement?.getBoundingClientRect();
    if (!rect || avatarViewerFrame.scale <= 0) return { width: fallbackWidth * scale, height: fallbackHeight * scale };

    return {
      width: (rect.width / avatarViewerFrame.scale) * scale,
      height: (rect.height / avatarViewerFrame.scale) * scale
    };
  }

  function clampAvatarViewerAxis(value: number, viewportSize: number, contentSize: number, margin: number) {
    if (contentSize > viewportSize - margin * 2) {
      return clampNumber(value, viewportSize - contentSize - margin, margin);
    }
    return clampNumber(value, margin, viewportSize - contentSize - margin);
  }

  function clampAvatarViewerFrame(frame: AvatarViewerFrame): AvatarViewerFrame {
    if (typeof window === 'undefined') return frame;
    const scale = clampNumber(frame.scale, avatarViewerMinScale, avatarViewerMaxScale);
    const { width, height } = avatarViewerVisualSize(scale);
    const margin = 8;
    return {
      x: clampAvatarViewerAxis(frame.x, window.innerWidth, width, margin),
      y: clampAvatarViewerAxis(frame.y, window.innerHeight, height, margin),
      scale
    };
  }

  async function resetAvatarViewerFrame() {
    avatarViewerDrag = null;
    avatarViewerFrame = defaultAvatarViewerFrame();
    await tick();
    avatarViewerFrame = clampAvatarViewerFrame(avatarViewerFrame);
  }

  function closeZoomedAvatar() {
    zoomedAvatar = null;
    avatarViewerDrag = null;
  }

  function showZoomedAvatar(avatar: ZoomedAvatar) {
    zoomedAvatar = avatar;
    void resetAvatarViewerFrame();
  }

  function setAvatarViewerScale(nextScale: number) {
    const scale = clampNumber(Number(nextScale.toFixed(2)), avatarViewerMinScale, avatarViewerMaxScale);
    const rect = avatarViewerElement?.getBoundingClientRect();
    if (!rect || avatarViewerFrame.scale <= 0) {
      avatarViewerFrame = clampAvatarViewerFrame({ ...avatarViewerFrame, scale });
      return;
    }

    const baseWidth = rect.width / avatarViewerFrame.scale;
    const baseHeight = rect.height / avatarViewerFrame.scale;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    avatarViewerFrame = clampAvatarViewerFrame({
      x: centerX - (baseWidth * scale) / 2,
      y: centerY - (baseHeight * scale) / 2,
      scale
    });
  }

  function zoomAvatarViewer(delta: number) {
    setAvatarViewerScale(avatarViewerFrame.scale + delta);
  }

  function zoomAvatarViewerWheel(event: WheelEvent) {
    const direction = event.deltaY < 0 ? 1 : -1;
    zoomAvatarViewer(direction * avatarViewerScaleStep);
  }

  function startAvatarViewerDrag(event: PointerEvent) {
    if (event.button !== 0) return;
    avatarViewerDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: avatarViewerFrame.x,
      originY: avatarViewerFrame.y
    };
    avatarViewerElement?.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function dragAvatarViewer(event: PointerEvent) {
    if (!avatarViewerDrag || avatarViewerDrag.pointerId !== event.pointerId) return;
    avatarViewerFrame = clampAvatarViewerFrame({
      ...avatarViewerFrame,
      x: avatarViewerDrag.originX + event.clientX - avatarViewerDrag.startX,
      y: avatarViewerDrag.originY + event.clientY - avatarViewerDrag.startY
    });
  }

  function stopAvatarViewerDrag(event: PointerEvent) {
    if (!avatarViewerDrag || avatarViewerDrag.pointerId !== event.pointerId) return;
    if (avatarViewerElement?.hasPointerCapture(event.pointerId)) {
      avatarViewerElement.releasePointerCapture(event.pointerId);
    }
    avatarViewerDrag = null;
  }

  function clampCurrentAvatarViewer() {
    avatarViewerFrame = clampAvatarViewerFrame(avatarViewerFrame);
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

  async function ensureProfileDrawer() {
    if (!ProfileDrawerComponent) {
      ProfileDrawerComponent = (await import('$lib/ui/features/profiles/ProfileDrawer.svelte')).default as unknown as ProfileDrawerComponent;
    }
  }

  async function ensureCharacterDrawer() {
    if (!CharacterDrawerComponent) {
      CharacterDrawerComponent = (await import('$lib/ui/features/characters/CharacterDrawer.svelte')).default as unknown as CharacterDrawerComponent;
    }
  }

  async function ensureWorldBookDrawer() {
    if (!WorldBookDrawerComponent) {
      WorldBookDrawerComponent = (await import('$lib/ui/features/worldbooks/WorldBookDrawer.svelte')).default as unknown as WorldBookDrawerComponent;
    }
  }

  async function ensurePersonaDrawer() {
    if (!PersonaDrawerComponent) {
      PersonaDrawerComponent = (await import('$lib/ui/features/personas/PersonaDrawer.svelte')).default as unknown as PersonaDrawerComponent;
    }
  }

  async function ensureSettingsDrawer() {
    if (!SettingsDrawerComponent) {
      SettingsDrawerComponent = (await import('$lib/ui/features/settings/SettingsDrawer.svelte')).default as unknown as SettingsDrawerComponent;
    }
  }

  async function ensureToolboxDrawer() {
    if (!ToolboxDrawerComponent) {
      ToolboxDrawerComponent = (await import('$lib/ui/features/toolbox/ToolboxDrawer.svelte')).default as unknown as ToolboxDrawerComponent;
    }
  }

  async function ensureImportDrawer() {
    if (!ImportDrawerComponent) {
      ImportDrawerComponent = (await import('$lib/ui/features/import/ImportDrawer.svelte')).default as unknown as ImportDrawerComponent;
    }
  }

  async function ensureInspectorDrawer() {
    if (!InspectorDrawerComponent) {
      InspectorDrawerComponent = (await import('$lib/ui/features/inspector/InspectorDrawer.svelte')).default as unknown as InspectorDrawerComponent;
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
    setStatus('loading', t('status.loading'), false);
    const [nextProfiles, nextCharacters, nextPersonas, nextPersonaCharacterBindings, nextWorldBooks, nextConversations] = await Promise.all([
      fetchJson<Profile[]>(profilesHydrated ? '/api/profiles' : '/api/profiles?summary=true'),
      fetchJson<Character[]>(charactersHydrated ? '/api/characters' : '/api/characters?summary=true'),
      fetchJson<UserPersona[]>('/api/personas'),
      fetchJson<PersonaCharacterBinding[]>('/api/personas/bindings'),
      fetchJson<WorldBook[]>(worldBooksHydrated ? '/api/worldbooks' : '/api/worldbooks?summary=true'),
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
    setStatus('idle', t('status.ready'), false);
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
    setStatus('loading', t('status.saving'), false);
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
    setStatus('idle', t('status.ready'), false);
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
        mode: 'chat',
        macroMode: 'sillytavern',
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

  async function saveGlobalRegex() {
    globalRegexSaving = true;
    globalRegexStatus = t('common.saving');
    try {
      const saved = await fetchJson<RegexProfile>('/api/toolbox/global-regex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: globalRegexDraftEnabled,
          scripts: structuredClone(globalRegexDraftScripts)
        })
      });
      globalRegex = saved;
      loadGlobalRegexDraft();
      globalRegexStatus = t('toolbox.saved');
    } catch (error) {
      console.error(error);
      globalRegexStatus = t('toolbox.saveFailed');
    } finally {
      globalRegexSaving = false;
    }
  }

  async function saveActiveProfile() {
    if (!activeProfile) return false;
    if (!profileDraftName.trim()) {
      setStatus('warning', t('status.profileNameRequired'));
      return false;
    }

    setStatus('loading', t('status.saving'), false);
    try {
      const saved = await saveProfilePayload(buildProfileFromDraft(activeProfile));
      profiles = profiles.map((profile) => (profile.id === saved.id ? saved : profile));
      activeProfileId = saved.id;
      loadProfileDraft(saved);
      setStatus('idle', t('status.ready'), false);
      return true;
    } catch (error) {
      console.error(error);
      setStatus('error', t('status.profileSaveFailed'));
      return false;
    }
  }

  async function duplicateActiveProfile() {
    if (!activeProfile) return;
    if (!profileDraftName.trim()) {
      setStatus('warning', t('status.profileNameRequired'));
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

    setStatus('loading', t('status.saving'), false);
    try {
      const saved = await saveProfilePayload(duplicate);
      profiles = [...profiles, saved].sort((a, b) => a.name.localeCompare(b.name));
      activeProfileId = saved.id;
      loadProfileDraft(saved);
      setStatus('idle', t('status.ready'), false);
    } catch (error) {
      console.error(error);
      setStatus('error', t('status.profileCopyFailed'));
    }
  }

  function deleteActiveProfile() {
    if (!activeProfile) return;
    if (profiles.length <= 1) {
      setStatus('warning', t('profile.deleteLast'));
      return;
    }
    pendingProfileDelete = activeProfile;
    profileDeleteStatus = '';
  }

  function closeProfileDeleteDialog() {
    if (deletingProfile) return;
    pendingProfileDelete = null;
    profileDeleteStatus = '';
  }

  async function confirmProfileDelete() {
    const profile = pendingProfileDelete;
    if (!profile) return;
    deletingProfile = true;
    setStatus('loading', t('status.deleting'), false);
    try {
      await fetchJson<{ deleted: boolean; id: string }>(`/api/profiles?id=${encodeURIComponent(profile.id)}`, {
        method: 'DELETE'
      });
      const nextProfiles = profiles.filter((item) => item.id !== profile.id);
      profiles = nextProfiles;
      activeProfileId = nextProfiles[0]?.id ?? '';
      loadProfileDraft(nextProfiles[0]);
      pendingProfileDelete = null;
      setStatus('idle', t('status.ready'), false);
    } catch (error) {
      console.error(error);
      profileDeleteStatus = error instanceof Error ? error.message : t('profile.deleteFailed');
      setStatus('error', profileDeleteStatus);
    } finally {
      deletingProfile = false;
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

  function moveDraftPromptSlotTo(sourceId: string, targetId: string, placement: 'before' | 'after') {
    if (sourceId === targetId) return;
    const sourceIndex = profileDraftSlots.findIndex((item) => item.id === sourceId);
    const targetIndex = profileDraftSlots.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...profileDraftSlots];
    const [item] = next.splice(sourceIndex, 1);
    let insertIndex = targetIndex + (placement === 'after' ? 1 : 0);
    if (sourceIndex < insertIndex) insertIndex -= 1;
    next.splice(insertIndex, 0, item);
    profileDraftSlots = next;
    activePromptSlotId = sourceId;
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
    await ensureProfilesLoaded();
    openingPreviewCharacterId = '';
    activeView = 'chat';
    await refreshConversationState(id, { close: true });
  }

  function renameConversation(event: MouseEvent, conversation: Conversation) {
    event.stopPropagation();
    pendingConversationRename = conversation;
    conversationRenameStatus = '';
  }

  function closeConversationRenameDialog() {
    if (renamingConversation) return;
    pendingConversationRename = null;
    conversationRenameStatus = '';
  }

  async function confirmConversationRename(title: string) {
    const conversation = pendingConversationRename;
    const nextTitle = title.trim();
    if (!conversation || !nextTitle || renamingConversation) return;
    if (nextTitle === conversation.title) {
      closeConversationRenameDialog();
      return;
    }

    renamingConversation = true;
    conversationRenameStatus = '';
    try {
      const updated = await fetchJson<Conversation>('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          conversationId: conversation.id,
          title: nextTitle
        })
      });
      rememberConversation(updated);
      pendingConversationRename = null;
    } catch (error) {
      conversationRenameStatus = error instanceof Error && error.message ? error.message : t('chat.renameFailed');
    } finally {
      renamingConversation = false;
    }
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
    setStatus('loading', t('status.cloning'), false);
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
    setStatus('idle', t('status.ready'), false);
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
    setStatus('loading', t('status.deleting'), false);
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
      setStatus('idle', t('status.ready'), false);
    } catch (error) {
      conversationDeleteStatus = error instanceof Error ? error.message : t('chat.deleteConversationFailed');
      setStatus('error', conversationDeleteStatus);
    } finally {
      deletingConversation = false;
    }
  }

  async function exportConversation(event: MouseEvent, conversation: Conversation) {
    event.stopPropagation();
    setStatus('loading', t('status.exporting'), false);
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
      setStatus('idle', t('status.ready'), false);
    } catch {
      setStatus('error', t('status.exportFailed'));
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

  function captureGenerationSnapshot(): GenerationSnapshot {
    return {
      activeConversationId,
      activeConversationRecord: structuredClone(activeConversationRecord),
      conversations: structuredClone(conversations),
      messages: structuredClone(messages),
      input,
      status: structuredClone(status),
      conversationTreeSummary: structuredClone(conversationTreeSummary),
      conversationTreeSelectedNodeId
    };
  }

  function restoreGenerationSnapshot(snapshot: GenerationSnapshot) {
    activeConversationId = snapshot.activeConversationId;
    activeConversationRecord = structuredClone(snapshot.activeConversationRecord);
    conversations = structuredClone(snapshot.conversations);
    messages = structuredClone(snapshot.messages);
    input = snapshot.input;
    status = structuredClone(snapshot.status);
    conversationTreeSummary = structuredClone(snapshot.conversationTreeSummary);
    conversationTreeSelectedNodeId = snapshot.conversationTreeSelectedNodeId;
    conversationTreeActionStatus = '';
  }

  function showGenerationError(message: string, snapshot?: GenerationSnapshot) {
    if (snapshot) restoreGenerationSnapshot(snapshot);
    generationErrorMessage = message.trim() || t('status.generationError');
  }

  function closeGenerationError() {
    generationErrorMessage = '';
  }

  async function sendMessage() {
    if (isGenerating) {
      stopGeneration();
      return;
    }

    const content = input.trim();
    if (!content) return;
    const snapshot = captureGenerationSnapshot();
    input = '';
    inspector = '';
    const openingPreview =
      !activeConversationId && activeCharacter?.firstMessage && messages.length === 0
        ? [
            {
              role: 'assistant' as const,
              speakerId: activeCharacter.id,
              name: activeCharacter.name,
              speakerAvatarAssetId: activeCharacter.avatarAssetId,
              content: renderCharacterTemplate(activeCharacter.firstMessage)
            }
          ]
        : [];
    messages = [
      ...messages,
      ...openingPreview,
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
    void queueMessagesScrollToBottom();
    await streamGeneration(
      {
        conversationId: activeConversationId || undefined,
        profileId: activeProfileId || undefined,
        characterId: activeCharacterId || undefined,
        personaId: activePersonaId || undefined,
        message: content
      },
      { snapshot }
    );
  }

  function clearComposerInput() {
    input = '';
  }

  async function continueActiveLeaf() {
    const target = activeLeafMessage;
    const nodeId = target ? messageNodeId(target) : '';
    if (!target || !canContinueActiveLeaf || !nodeId || !activeConversationId) return;
    inspector = '';
    setStatus('loading', t('status.continuing'), false);
    const snapshot = captureGenerationSnapshot();
    await streamGeneration(
      {
        conversationId: activeConversationId,
        profileId: activeProfileId || undefined,
        characterId: activeCharacterId || undefined,
        personaId: activePersonaId || undefined,
        continueNodeId: nodeId
      },
      { snapshot }
    );
  }

  async function streamGeneration(body: Record<string, unknown>, options: { snapshot?: GenerationSnapshot } = {}) {
    generationErrorMessage = '';
    setStatus('loading', t('status.generating'), false);
    const controller = new AbortController();
    generationAbortController = controller;
    let completedConversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
    let failed = false;
    const failGeneration = (message: string) => {
      failed = true;
      showGenerationError(message, options.snapshot);
    };

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.body || !response.ok) {
        const errorMessage = await responseErrorMessage(response);
        failGeneration(errorMessage);
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
          failGeneration(event.text ?? '');
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
          if (failed) break;
        }
        if (failed) break;
      }
      if (failed) return;
      buffer += decoder.decode();
      if (buffer.trim()) {
        consumeLine(buffer);
      }
      if (failed) return;
      if (controller.signal.aborted) setStatus('warning', t('status.stopped'), false);
      else setStatus('idle', t('status.ready'), false);
      if (!controller.signal.aborted && completedConversationId) {
        await refreshConversationState(completedConversationId);
        void queueMessagesScrollToBottom();
      }
    } catch (error) {
      if (controller.signal.aborted) {
        removeEmptyAssistantDraft();
        setStatus('warning', t('status.stopped'), false);
      } else {
        failGeneration(error instanceof Error ? error.message : '');
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
      void queueMessagesScrollToBottom();
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
    void queueMessagesScrollToBottom();
  }

  function appendAssistantDraftThinking(thinking: string) {
    if (!thinking) return;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      const next = [...messages];
      next[next.length - 1] = { ...last, thinking: `${last.thinking ?? ''}${thinking}` };
      messages = next;
      void queueMessagesScrollToBottom();
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
    void queueMessagesScrollToBottom();
  }

  function removeEmptyAssistantDraft() {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && !last.content.trim() && !last.thinking?.trim()) {
      messages = messages.slice(0, -1);
    }
  }

  function stopGeneration() {
    generationAbortController?.abort();
    setStatus('loading', t('status.stopping'), false);
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
    setStatus('loading', t('status.forking'), false);
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
    setStatus('idle', t('status.ready'), false);
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
    const snapshot = captureGenerationSnapshot();
    const lastIndex = messages.findIndex((item) => (item.branch?.nodeId ?? item.id) === nodeId);
    if (lastIndex >= 0) {
      messages = [...messages.slice(0, lastIndex), { role: 'assistant', name: activeCharacter?.name, content: '' }];
    }
    await streamGeneration(
      {
        conversationId: activeConversationId,
        profileId: activeProfileId || undefined,
        characterId: activeCharacterId || undefined,
        personaId: activePersonaId || undefined,
        regenerateNodeId: nodeId
      },
      { snapshot }
    );
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
    mobileNavOpen = false;
    activeDrawer = 'inspector';
    await Promise.all([inspectCurrentPrompt(), ensureInspectorDrawer()]);
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
    return [...(globalRegex.enabled === false ? [] : globalRegex.scripts), ...(activeProfile?.regex?.enabled === false ? [] : (activeProfile?.regex?.scripts ?? []))];
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
      closeZoomedAvatar();
      return;
    }

    showZoomedAvatar({
      key,
      name,
      role: message.role,
      src,
      initials: messageInitials(message)
    });
  }

  function openCharacterAvatar(character: Character | undefined = activeCharacter) {
    if (!character) return;
    const src = characterAvatarUrl(character);
    const key = `character:${character.id}:${src}`;
    if (zoomedAvatar?.key === key) {
      closeZoomedAvatar();
      return;
    }
    showZoomedAvatar({
      key,
      name: character.name,
      role: 'assistant',
      src,
      initials: characterInitials(character)
    });
  }

  function openCharacterImport() {
    openImport('character', 'character-card-png');
  }

  function openWorldBookImport() {
    openImport('worldbook', 'worldbook');
  }

  async function startChatWithCharacter(character: Character | undefined = activeCharacter) {
    if (!character) return;
    await ensureProfilesLoaded();
    activeCharacterId = character.id;
    activeConversationId = '';
    openingPreviewCharacterId = '';
    messages = [];
    activeView = 'chat';
    closeDrawer();
  }

  async function openCharacterWorldBooks(character: Character | undefined = activeCharacter) {
    await ensureWorldBooksLoaded();
    character = characters.find((item) => item.id === character?.id) ?? character;
    const firstWorldBook = boundWorldBooksForCharacter(character)[0];
    if (firstWorldBook) {
      activeWorldBookId = firstWorldBook.id;
    }
    activeDrawer = 'worldbooks';
  }

  function resetImportFile() {
    importText = '';
    importFileName = '';
    importFileBase64 = '';
  }

  async function readImportFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      resetImportFile();
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
    if (!hasImportPayload) {
      setStatus('warning', t('status.importFileRequired'));
      return;
    }
    setStatus('loading', t('status.importing'), false);
    const scope = importScope;
    const data =
      importKind === 'chat-jsonl'
        ? importText
        : importKind === 'character-card-png'
          ? importFileBase64
          : JSON.parse(importText);
    const result = await fetchJson<{ type: string; item?: { id: string } }>('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: importKind, name: importName || undefined, data })
    });
    resetImportFile();
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
    setStatus('idle', t('status.ready'), false);
  }

  async function createCharacter() {
    const name = newCharacterName.trim();
    if (!name) return;
    setStatus('loading', t('status.saving'), false);
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
    setStatus('idle', t('status.ready'), false);
  }

  async function saveActiveCharacter() {
    if (!activeCharacter) return;
    const name = characterDraftName.trim();
    if (!name) return;
    setStatus('loading', t('status.saving'), false);
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
    setStatus('idle', t('status.ready'), false);
  }

  async function toggleCharacterFavorite(character: Character | undefined = activeCharacter) {
    if (!character) return;
    setStatus('loading', t('status.saving'), false);
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
    setStatus('idle', t('status.ready'), false);
  }

  async function duplicateActiveCharacter() {
    if (!activeCharacter) return;
    setStatus('loading', t('status.saving'), false);
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
    setStatus('idle', t('status.ready'), false);
  }

  function deleteActiveCharacter() {
    if (!activeCharacter) return;
    pendingCharacterDelete = activeCharacter;
    characterDeleteStatus = '';
  }

  function closeCharacterDeleteDialog() {
    if (deletingCharacter) return;
    pendingCharacterDelete = null;
    characterDeleteStatus = '';
  }

  async function confirmCharacterDelete() {
    const character = pendingCharacterDelete;
    if (!character) return;
    deletingCharacter = true;
    setStatus('loading', t('status.deleting'), false);
    try {
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
        closeZoomedAvatar();
      }
      loadCharacterDraft(characters.find((item) => item.id === activeCharacterId));
      pendingCharacterDelete = null;
      setStatus('idle', t('status.ready'), false);
    } catch (error) {
      console.error(error);
      characterDeleteStatus = error instanceof Error ? error.message : t('character.deleteFailed');
      setStatus('error', characterDeleteStatus);
    } finally {
      deletingCharacter = false;
    }
  }

  async function createPersona() {
    const name = newPersonaName.trim();
    if (!name) return;
    setStatus('loading', t('status.saving'), false);
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
    setStatus('idle', t('status.ready'), false);
  }

  async function saveActivePersona() {
    if (!activePersona) return;
    const name = personaDraftName.trim();
    if (!name) return;
    setStatus('loading', t('status.saving'), false);
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
    setStatus('idle', t('status.ready'), false);
  }

  async function setActivePersonaDefault() {
    if (!activePersona) return;
    setStatus('loading', t('status.saving'), false);
    const persona = await fetchJson<UserPersona>('/api/personas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activePersona.id, isDefault: true })
    });
    upsertPersona(persona);
    personaDraftDefault = true;
    setStatus('idle', t('status.ready'), false);
  }

  async function uploadActivePersonaAvatar(event: Event) {
    if (!activePersona) return;
    const inputElement = event.currentTarget as HTMLInputElement;
    const file = inputElement.files?.[0];
    inputElement.value = '';
    if (!file) return;
    personaAvatarUploading = true;
    setStatus('loading', t('status.uploading'), false);
    try {
      const form = new FormData();
      form.set('personaId', activePersona.id);
      form.set('avatar', file);
      const persona = await fetchJson<UserPersona>('/api/personas/avatar', {
        method: 'POST',
        body: form
      });
      upsertPersona(persona);
      setStatus('idle', t('status.ready'), false);
    } finally {
      personaAvatarUploading = false;
    }
  }

  async function clearActivePersonaAvatar() {
    if (!activePersona?.avatarAssetId) return;
    setStatus('loading', t('status.saving'), false);
    const persona = await fetchJson<UserPersona>(`/api/personas/avatar?personaId=${encodeURIComponent(activePersona.id)}`, {
      method: 'DELETE'
    });
    upsertPersona(persona);
    setStatus('idle', t('status.ready'), false);
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
    setStatus('loading', t('status.saving'), false);
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
    setStatus('idle', t('status.ready'), false);
  }

  async function lockActivePersonaToCurrentChat() {
    if (!activePersona || !activeConversationId) {
      setStatus('warning', t('persona.noActiveConversation'));
      return;
    }
    setStatus('loading', t('status.saving'), false);
    const conversation = await fetchJson<Conversation>('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-persona', conversationId: activeConversationId, personaId: activePersona.id })
    });
    activeConversationRecord = conversation;
    rememberConversation(conversation);
    setStatus('idle', t('status.ready'), false);
  }

  async function duplicateActivePersona() {
    if (!activePersona) return;
    setStatus('loading', t('status.saving'), false);
    const persona = await fetchJson<UserPersona>('/api/personas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'duplicate', id: activePersona.id })
    });
    upsertPersona(persona);
    activePersonaId = persona.id;
    setStatus('idle', t('status.ready'), false);
  }

  function deleteActivePersona() {
    if (!activePersona || personaDeleting) return;
    pendingPersonaDelete = activePersona;
    personaDeleteStatus = '';
  }

  function closePersonaDeleteDialog() {
    if (personaDeleting) return;
    pendingPersonaDelete = null;
    personaDeleteStatus = '';
  }

  async function confirmPersonaDelete() {
    const personaToDelete = pendingPersonaDelete;
    if (!personaToDelete || personaDeleting) return;
    personaDeleting = true;
    personaDeleteStatus = '';
    setStatus('loading', t('status.deleting'), false);
    try {
      const result = await fetchJson<UserPersonaDeleteResult>(`/api/personas?id=${encodeURIComponent(personaToDelete.id)}`, {
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
      setStatus(
        'success',
        t('persona.deleteResult', {
          conversations: result.affectedConversationIds.length,
          bindings: result.removedCharacterBindings
        })
      );
      pendingPersonaDelete = null;
    } catch (error) {
      personaDeleteStatus = error instanceof Error && error.message ? error.message : t('persona.deleteFailed');
      setStatus('error', personaDeleteStatus);
    } finally {
      personaDeleting = false;
    }
  }

  async function createWorldBook() {
    const name = newWorldBookName.trim();
    if (!name) return;
    setStatus('loading', t('status.saving'), false);
    const worldBook = await fetchJson<WorldBook>('/api/worldbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, entries: [] })
    });
    worldBooks = [...worldBooks, worldBook];
    activeWorldBookId = worldBook.id;
    newWorldBookName = '';
    loadWorldBookDraft(worldBook);
    setStatus('idle', t('status.ready'), false);
  }

  async function saveActiveWorldBook() {
    if (!activeWorldBook || !worldBookDraftName.trim()) return;
    setStatus('loading', t('status.saving'), false);
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
    setStatus('idle', t('status.ready'), false);
  }

  function deleteActiveWorldBook() {
    const worldBook = activeWorldBook;
    if (!worldBook || deletingWorldBook) return;
    const boundCount = characters.filter((character) => isWorldBookBoundToCharacter(character, worldBook.id)).length;
    pendingWorldBookDelete = { worldBook, boundCount };
    worldBookDeleteStatus = '';
  }

  function closeWorldBookDeleteDialog() {
    if (deletingWorldBook) return;
    pendingWorldBookDelete = null;
    worldBookDeleteStatus = '';
  }

  async function confirmWorldBookDelete() {
    const pending = pendingWorldBookDelete;
    if (!pending || deletingWorldBook) return;
    const { worldBook } = pending;
    deletingWorldBook = true;
    worldBookDeleteStatus = '';
    setStatus('loading', t('status.deleting'), false);
    try {
      const result = await fetchJson<WorldBookDeleteResult>(`/api/worldbooks?id=${encodeURIComponent(worldBook.id)}`, {
        method: 'DELETE'
      });
      worldBooks = worldBooks.filter((item) => item.id !== result.id);
      characters = await fetchJson<Character[]>('/api/characters');
      activeWorldBookId = worldBooks[0]?.id ?? '';
      loadWorldBookDraft(worldBooks.find((item) => item.id === activeWorldBookId));
      setStatus(
        'success',
        t('worldbook.deleteDone', {
          characters: result.affectedCharacterIds.length,
          bindings: result.removedCharacterBindings
        })
      );
      pendingWorldBookDelete = null;
    } catch (error) {
      worldBookDeleteStatus = error instanceof Error && error.message ? error.message : t('worldbook.deleteFailed');
      setStatus('error', worldBookDeleteStatus);
    } finally {
      deletingWorldBook = false;
    }
  }
</script>

<svelte:head>
  <title>NanKe</title>
</svelte:head>

<main class="nanke-app-scope workspace" style={appSettingsStyle} data-app-ready={appHydrated}>
  <NavigationRail
    bind:mobileOpen={mobileNavOpen}
    {activeView}
    {activeDrawer}
    {theme}
    onHome={openHome}
    onChat={openChatWorkspace}
    onChats={() => openDrawer('chats')}
    onCharacters={() => openLibrary('characters')}
    onPersonas={() => openLibrary('personas')}
    onWorldBooks={() => openLibrary('worldbooks')}
    onProfiles={() => openLibrary('profiles')}
    onToolbox={openToolbox}
    onTheme={cycleTheme}
    onSettings={() => openDrawer('settings')}
    onInspector={openInspector}
  />

  {#if activeDrawer === 'settings'}
    <section class="stage settings-preview-stage" aria-label={t('settings.preview')}>
      <header class="chatbar">
        <div class="scene">
          <div class="conversation-title-card" aria-label={t('chat.currentConversation')}>
            <MessageCircle size={16} />
            <span>{t('settings.previewConversation')}</span>
          </div>
        </div>

        <div class="context-strip" aria-label={t('chat.currentContext')}>
          <span class="context-chip">
            <Bot size={15} />
            <span>{t('settings.previewSpeaker')}</span>
          </span>
          <span class="context-chip">
            <UserRound size={15} />
            <span>{t('settings.previewUser')}</span>
          </span>
          <span class="context-chip profile">
            <Settings2 size={15} />
            <span>{t('settings.previewProfile')}</span>
          </span>
          <span class="status-pill">{t('settings.preview')}</span>
        </div>
      </header>

      <div class="messages settings-preview-messages" aria-hidden="true">
        <div class="message-stack">
          <article class="message-row assistant">
            <div class="message-avatar settings-preview-avatar">
              <img src={settingsPreviewAvatarUrl} alt="" />
            </div>
            <div class="message assistant">
              <strong>{t('settings.previewSpeaker')}</strong>
              <div class="message-content rich">{t('settings.previewAssistantMessage')}</div>
            </div>
          </article>

          <article class="message-row user">
            <div class="message-avatar settings-preview-avatar">
              <span>{t('settings.previewUserInitial')}</span>
            </div>
            <div class="message user">
              <strong>{t('settings.previewUser')}</strong>
              <div class="message-content rich">{t('settings.previewUserMessage')}</div>
            </div>
          </article>
        </div>
      </div>
    </section>
  {:else if activeView === 'home'}
    <HomeStage
      status={status.message}
      {activeProfile}
      {activeCharacter}
      {activePersona}
      {activeCharacterId}
      worldBookCount={worldBooks.length}
      charactersCount={characters.length}
      recentConversations={homeRecentConversations}
      characters={homeCharacters}
      onOpenProfiles={() => openLibrary('profiles')}
      onRefresh={refreshAll}
      onContinueConversation={loadConversation}
      onStartNewConversation={startNewConversation}
      onOpenCharacters={() => openLibrary('characters')}
      onOpenPersonas={() => openLibrary('personas')}
      onOpenWorldBooks={() => openLibrary('worldbooks')}
      onOpenChats={() => openDrawer('chats')}
      onOpenCharacterImport={openCharacterImport}
      onStartChatWithCharacter={(character) => startChatWithCharacter(character as Character)}
      conversationAvatarUrl={(conversation) => homeConversationAvatarUrl(conversation as Conversation)}
      conversationCharacterName={(conversation) => homeConversationCharacterName(conversation as Conversation)}
      conversationPreview={(conversation) => homeConversationPreview(conversation as Conversation)}
      conversationUpdatedLabel={(conversation) => conversationUpdatedLabel(conversation as Conversation)}
      characterAvatarUrl={(character) => characterAvatarUrl(character as Character)}
      characterInitials={(character) => characterInitials(character as Character)}
      characterListLine={(character) => characterListLine(character as Character)}
    />
  {:else}
  <section class="stage" class:tree-open={conversationTreeLoading || Boolean(conversationTreeSummary)} aria-label={t('chat.workspace')}>
    <header class="chatbar">
      <div class="scene">
        <div class="conversation-title-card" aria-label={t('chat.currentConversation')}>
          <MessageCircle size={16} />
          <span>{activeConversation?.title ?? t('chat.unsavedChat')}</span>
          {#if activeConversation}
            <button class="title-edit-button" type="button" title={t('chat.rename')} aria-label={t('chat.rename')} on:click={(event) => renameConversation(event, activeConversation)}>
              <Pencil size={14} />
            </button>
          {/if}
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
        <StatusBadge {status} />
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

    <div class="messages" aria-live="polite" bind:this={messagesContainer}>
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

    <ChatComposer
      bind:input
      {isGenerating}
      canContinue={canContinueActiveLeaf}
      onSend={sendMessage}
      onStop={stopGeneration}
      onContinue={continueActiveLeaf}
      onClear={clearComposerInput}
    />

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
    <section
      class="avatar-viewer"
      class:dragging={Boolean(avatarViewerDrag)}
      aria-label={t('chat.avatarPreview')}
      title={zoomedAvatar.name}
      bind:this={avatarViewerElement}
      style={`--avatar-viewer-x: ${avatarViewerFrame.x}px; --avatar-viewer-y: ${avatarViewerFrame.y}px; --avatar-viewer-scale: ${avatarViewerFrame.scale};`}
      on:pointermove={dragAvatarViewer}
      on:pointerup={stopAvatarViewerDrag}
      on:pointercancel={stopAvatarViewerDrag}
      on:wheel|preventDefault={zoomAvatarViewerWheel}
    >
      <div class="avatar-viewer-controls">
        <button class="avatar-viewer-drag" type="button" title={t('chat.dragAvatar')} aria-label={t('chat.dragAvatar')} on:pointerdown={startAvatarViewerDrag}>
          <GripHorizontal size={18} />
          <span>{zoomedAvatar.name}</span>
        </button>
        <div class="avatar-viewer-tools">
          <button type="button" title={t('chat.avatarZoomOut')} aria-label={t('chat.avatarZoomOut')} on:click={() => zoomAvatarViewer(-avatarViewerScaleStep)}>
            <Minus size={17} />
          </button>
          <span class="avatar-viewer-scale" aria-hidden="true">{Math.round(avatarViewerFrame.scale * 100)}%</span>
          <button type="button" title={t('chat.avatarZoomIn')} aria-label={t('chat.avatarZoomIn')} on:click={() => zoomAvatarViewer(avatarViewerScaleStep)}>
            <Plus size={17} />
          </button>
          <button type="button" title={t('chat.avatarZoomReset')} aria-label={t('chat.avatarZoomReset')} on:click={resetAvatarViewerFrame}>
            <RotateCcw size={16} />
          </button>
          <button type="button" title={t('chat.closeAvatar')} aria-label={t('chat.closeAvatar')} on:click={closeZoomedAvatar}>
            <X size={18} />
          </button>
        </div>
      </div>
      <div class="avatar-viewer-image" class:user={zoomedAvatar.role === 'user'}>
        {#if zoomedAvatar.src}
          <img src={zoomedAvatar.src} alt={t('chat.avatarAlt', { name: zoomedAvatar.name })} draggable="false" on:load={clampCurrentAvatarViewer} />
        {:else}
          <span>{zoomedAvatar.initials}</span>
        {/if}
      </div>
    </section>
  {/if}

  {#if generationErrorMessage}
    <section class="generation-error-backdrop" role="presentation">
      <div
        class="generation-error-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="generation-error-title"
        aria-describedby="generation-error-content"
      >
        <header>
          <CircleStop size={18} />
          <strong id="generation-error-title">{t('chat.generationErrorTitle')}</strong>
        </header>
        <pre id="generation-error-content" class="generation-error-content">{generationErrorMessage}</pre>
        <div class="generation-error-actions">
          <button type="button" on:click={closeGenerationError}>{t('common.close')}</button>
        </div>
      </div>
    </section>
  {/if}

  {#if pendingMessageDelete}
    <ConfirmDialog
      title={t('chat.deleteDialogTitle')}
      description={pendingMessageDelete.label || t('chat.deleteEmpty')}
      cancelLabel={t('common.cancel')}
      secondaryLabel={t('chat.deleteNodeOnly')}
      confirmLabel={t('chat.deleteWithDescendants')}
      busy={deletingMessageNode}
      status={messageDeleteStatus}
      onCancel={closeMessageDeleteDialog}
      onSecondary={() => confirmMessageDelete('node')}
      onConfirm={() => confirmMessageDelete('subtree')}
    />
  {/if}

  {#if pendingConversationDelete}
    <ConfirmDialog
      title={t('chat.deleteConversationTitle')}
      subject={pendingConversationDelete.title}
      description={t('chat.deleteConversationBody')}
      cancelLabel={t('common.cancel')}
      confirmLabel={deletingConversation ? t('status.deleting') : t('chat.delete')}
      busy={deletingConversation}
      status={conversationDeleteStatus}
      onCancel={closeConversationDeleteDialog}
      onConfirm={confirmConversationDelete}
    />
  {/if}

  {#if pendingCharacterDelete}
    <ConfirmDialog
      title={t('character.delete')}
      subject={pendingCharacterDelete.name}
      description={t('character.deleteConfirm', { name: pendingCharacterDelete.name })}
      cancelLabel={t('common.cancel')}
      confirmLabel={deletingCharacter ? t('status.deleting') : t('character.delete')}
      busy={deletingCharacter}
      status={characterDeleteStatus}
      onCancel={closeCharacterDeleteDialog}
      onConfirm={confirmCharacterDelete}
    />
  {/if}

  {#if pendingProfileDelete}
    <ConfirmDialog
      title={t('profile.delete')}
      subject={pendingProfileDelete.name}
      description={t('profile.deleteConfirm', { name: pendingProfileDelete.name })}
      cancelLabel={t('common.cancel')}
      confirmLabel={deletingProfile ? t('status.deleting') : t('profile.delete')}
      busy={deletingProfile}
      status={profileDeleteStatus}
      onCancel={closeProfileDeleteDialog}
      onConfirm={confirmProfileDelete}
    />
  {/if}

  {#if pendingConversationRename}
    <RenameDialog
      title={t('chat.rename')}
      description={t('chat.renameDescription')}
      label={t('chat.renameField')}
      initialValue={pendingConversationRename.title}
      cancelLabel={t('common.cancel')}
      confirmLabel={renamingConversation ? t('status.saving') : t('common.save')}
      busy={renamingConversation}
      status={conversationRenameStatus}
      onCancel={closeConversationRenameDialog}
      onConfirm={confirmConversationRename}
    />
  {/if}

  {#if pendingPersonaDelete}
    <ConfirmDialog
      title={t('persona.deleteTitle')}
      subject={pendingPersonaDelete.name}
      description={t('persona.deleteConfirm', { name: pendingPersonaDelete.name })}
      cancelLabel={t('common.cancel')}
      confirmLabel={personaDeleting ? t('status.deleting') : t('common.delete')}
      busy={personaDeleting}
      status={personaDeleteStatus}
      onCancel={closePersonaDeleteDialog}
      onConfirm={confirmPersonaDelete}
    />
  {/if}

  {#if pendingWorldBookDelete}
    <ConfirmDialog
      title={t('worldbook.delete')}
      subject={pendingWorldBookDelete.worldBook.name}
      description={t('worldbook.deleteConfirm', {
        name: pendingWorldBookDelete.worldBook.name,
        entries: pendingWorldBookDelete.worldBook.entries.length,
        characters: pendingWorldBookDelete.boundCount
      })}
      cancelLabel={t('common.cancel')}
      confirmLabel={deletingWorldBook ? t('status.deleting') : t('common.delete')}
      busy={deletingWorldBook}
      status={worldBookDeleteStatus}
      onCancel={closeWorldBookDeleteDialog}
      onConfirm={confirmWorldBookDelete}
    />
  {/if}

  <ToastRegion
    {toasts}
    ariaLabel={t('toast.region')}
    dismissLabel={t('toast.dismiss')}
    onDismiss={dismissToast}
  />

  {#if activeDrawer}
    <DrawerShell
      title={drawerTitle}
      closeLabel={t('common.close')}
      side={drawerSide(activeDrawer)}
      size={drawerSize(activeDrawer)}
      showOverlay={activeDrawer !== 'settings'}
      trapFocus={activeDrawer !== 'settings'}
      preventScroll={activeDrawer !== 'settings'}
      onClose={closeDrawer}
    >
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
        {#if CharacterDrawerComponent && charactersHydrated}
        <CharacterDrawerComponent
          bind:newCharacterName
          bind:newCharacterDescription
          bind:newCharacterPersonality
          bind:newCharacterScenario
          bind:newCharacterFirstMessage
          bind:newCharacterAlternateGreetings
          bind:newCharacterExampleMessages
          bind:newCharacterSystemPrompt
          bind:newCharacterPostHistoryInstructions
          bind:newCharacterCreatorNotes
          bind:newCharacterTags
          bind:newCharacterCreator
          bind:newCharacterCharacterVersion
          bind:newCharacterTalkativeness
          bind:newCharacterFavorite
          bind:characterQuery
          bind:characterSortMode
          bind:characterPanelMode
          bind:characterEditorTab
          bind:characterDraftName
          bind:characterDraftDescription
          bind:characterDraftPersonality
          bind:characterDraftScenario
          bind:characterDraftFirstMessage
          bind:characterDraftAlternateGreetings
          bind:characterDraftExampleMessages
          bind:characterDraftSystemPrompt
          bind:characterDraftPostHistoryInstructions
          bind:characterDraftCreatorNotes
          bind:characterDraftTags
          bind:characterDraftCreator
          bind:characterDraftCharacterVersion
          bind:characterDraftTalkativeness
          bind:characterDraftFavorite
          bind:activeCharacterId
          bind:activeWorldBookId
          bind:activeDrawer
          bind:worldBookBindingCharacterId
          {filteredCharacters}
          {activeCharacter}
          {activeCharacterWorldBooks}
          {activeCharacterStats}
          {createCharacterStats}
          {startCharacterCreate}
          {openCharacterImport}
          {characterAvatarUrl}
          {characterInitials}
          {characterListLine}
          {selectCharacter}
          {toggleCharacterFavorite}
          {createCharacter}
          {resetNewCharacterDraft}
          {saveActiveCharacter}
          {openCharacterAvatar}
          {characterOrigin}
          {startChatWithCharacter}
          {duplicateActiveCharacter}
          {deleteActiveCharacter}
          {openCharacterWorldBooks}
          {worldBookBindingForCharacter}
          {metadataSourceLabel}
          {setWorldBookBindingEnabled}
          {unbindWorldBookFromCharacter}
        />
        {:else}
          <div class="drawer-empty">{t('status.loading')}</div>
        {/if}
      {:else if activeDrawer === 'personas'}
        {#if PersonaDrawerComponent}
        <PersonaDrawerComponent
          bind:newPersonaName
          bind:newPersonaTitle
          bind:newPersonaDescription
          bind:newPersonaDefault
          bind:personaQuery
          bind:activePersonaId
          bind:personaDraftName
          bind:personaDraftTitle
          bind:personaDraftDescription
          bind:personaDraftDefault
          {personas}
          {filteredPersonas}
          {activePersona}
          {activeCharacter}
          {activeCharacterPersona}
          {activeConversationRecord}
          {activeConversationId}
          {activePersonaBoundToActiveCharacter}
          {activePersonaLockedToConversation}
          {personaAvatarUploading}
          {personaDeleting}
          {createPersona}
          {saveActivePersona}
          {setActivePersonaDefault}
          {toggleActivePersonaCharacterBinding}
          {lockActivePersonaToCurrentChat}
          {duplicateActivePersona}
          {clearActivePersonaAvatar}
          {deleteActivePersona}
          {uploadActivePersonaAvatar}
          {personaAvatarUrl}
          {personaInitials}
          {personaBindingLabel}
          {personaTokenEstimate}
        />
        {:else}
          <div class="drawer-empty">{t('status.loading')}</div>
        {/if}
      {:else if activeDrawer === 'worldbooks'}
        {#if WorldBookDrawerComponent && charactersHydrated && worldBooksHydrated}
        <WorldBookDrawerComponent
          {worldBooks}
          {characters}
          {activeWorldBook}
          bind:activeWorldBookId
          bind:worldBookDraftName
          {worldBookDraftEntries}
          {activeWorldBookEntry}
          bind:activeWorldBookEntryId
          {filteredWorldBookEntries}
          bind:newWorldBookName
          bind:worldBookBindingCharacterId
          {worldBookBindingCharacter}
          {worldBookBoundCharacters}
          {worldBookEnabledCharacters}
          bind:worldBookEntryQuery
          bind:worldBookSortMode
          {deletingWorldBook}
          {worldBookPositions}
          {worldBookSortModes}
          {promptRoles}
          {createWorldBook}
          {openWorldBookImport}
          {isWorldBookBoundToCharacter}
          {worldBookLine}
          {worldBookStats}
          {addWorldBookEntry}
          {saveActiveWorldBook}
          {deleteActiveWorldBook}
          {metadataSourceLabel}
          {worldBookBindingForCharacter}
          {characterAvatarUrl}
          {characterInitials}
          {setWorldBookBindingEnabled}
          {unbindWorldBookFromCharacter}
          {bindWorldBookToCharacter}
          {entryStatus}
          {entryTitle}
          {entryMetaLine}
          {moveWorldBookEntryOrder}
          {duplicateWorldBookEntry}
          {removeWorldBookEntry}
          {entryTokenEstimate}
          {entryStatusLabel}
          {updateWorldBookEntry}
          {setWorldBookEntryState}
          {optionalInteger}
          {optionalNumber}
          {roleLabel}
          {keywordText}
          {parseKeywordText}
          {updateWorldBookEntryExtension}
        />
        {:else}
          <div class="drawer-empty">{t('status.loading')}</div>
        {/if}
      {:else if activeDrawer === 'profiles'}
        {#if ProfileDrawerComponent}
          <ProfileDrawerComponent
            {profiles}
            {activeProfile}
            bind:activeProfileId
            {activeProfileStats}
            {draftPromptStats}
            {filteredPromptSlots}
            {activePromptSlot}
            {promptEditorSlot}
            bind:activePromptSlotId
            bind:promptSlotQuery
            bind:profileDraftName
            bind:profileDraftProviderType
            bind:profileDraftProviderModel
            bind:profileDraftProviderEndpoint
            bind:profileDraftApiKey
            bind:profileDraftOpenAICompatibility
            bind:profileDraftVertexEnabled
            bind:profileDraftVertexMode
            bind:profileDraftVertexProjectId
            bind:profileDraftVertexLocation
            bind:profileDraftVertexApiKey
            bind:profileDraftVertexAccessToken
            bind:profileDraftTemperature
            bind:profileDraftTopP
            bind:profileDraftTopK
            bind:profileDraftTopA
            bind:profileDraftMinP
            bind:profileDraftFrequencyPenalty
            bind:profileDraftPresencePenalty
            bind:profileDraftRepetitionPenalty
            bind:profileDraftMaxTokens
            bind:profileDraftContextTokens
            bind:profileDraftSeed
            bind:profileDraftN
            bind:profileDraftStop
            bind:profileDraftStream
            bind:profileDraftOpenAIReasoningEffort
            bind:profileDraftGeminiIncludeThoughts
            bind:profileDraftGeminiThinkingMode
            bind:profileDraftGeminiThinkingBudget
            bind:profileDraftGeminiThinkingLevel
            bind:profileDraftSquashSystemMessages
            bind:profileDraftRegexEnabled
            bind:profileDraftRegexScripts
            {samplerVisible}
            {samplerPanelHeading}
            {maxTokensFieldLabel}
            {candidateCountFieldLabel}
            {draftModelUsesGeminiThinkingLevel}
            {showAdvancedSampler}
            {maxContextTokens}
            {maxOutputTokenRange}
            {promptRoles}
            {promptSources}
            {promptTriggerOptions}
            {openPresetImport}
            {saveActiveProfile}
            {duplicateActiveProfile}
            {deleteActiveProfile}
            {exportActiveProfile}
            {inspectCurrentPrompt}
            {changeProfileProviderType}
            {reasoningEffortLabel}
            {geminiThinkingModeLabel}
            {regexScriptSurface}
            {profileOrigin}
            {profileSamplerLine}
            {profileStats}
            {slotMeta}
            {slotKind}
            {slotTokenEstimate}
            {updateDraftSlot}
            {updateDraftSlotLegacy}
            {updateDraftSlotInjection}
            {setPromptInjectionPosition}
            {togglePromptTrigger}
            {roleLabel}
            {promptSourceLabel}
            {triggerLabel}
            {optionalInteger}
            {optionalNumber}
            {addDraftPromptSlot}
            {openPromptEditor}
            {duplicateDraftPromptSlot}
            {moveDraftPromptSlot}
            {moveDraftPromptSlotTo}
            {isFirstPromptSlot}
            {isLastPromptSlot}
            {canRemovePromptSlot}
            {removeDraftPromptSlot}
            {resetPromptEditor}
            {savePromptEditor}
            {closePromptEditor}
          />
        {:else}
          <div class="drawer-empty">{t('status.loading')}</div>
        {/if}
      {:else if activeDrawer === 'toolbox'}
        {#if ToolboxDrawerComponent}
        <ToolboxDrawerComponent
          bind:enabled={globalRegexDraftEnabled}
          bind:scripts={globalRegexDraftScripts}
          saving={globalRegexSaving}
          status={globalRegexStatus}
          stats={globalRegexStats}
          {regexScriptSurface}
          onSave={saveGlobalRegex}
        />
        {:else}
          <div class="drawer-empty">{t('status.loading')}</div>
        {/if}
      {:else if activeDrawer === 'settings'}
        {#if SettingsDrawerComponent}
          <SettingsDrawerComponent settings={appSettings} onUpdate={updateAppSettings} onReset={resetAppSettings} />
        {:else}
          <div class="drawer-empty">{t('status.loading')}</div>
        {/if}
      {:else if activeDrawer === 'import'}
        {#if ImportDrawerComponent}
        <ImportDrawerComponent
          bind:kind={importKind}
          bind:name={importName}
          options={importOptions}
          fileName={importFileName}
          hasPayload={hasImportPayload}
          kindLabel={importKindLabel}
          onKindChange={resetImportFile}
          onFileChange={readImportFile}
          onImport={runImport}
        />
        {:else}
          <div class="drawer-empty">{t('status.loading')}</div>
        {/if}
      {:else if activeDrawer === 'inspector'}
        {#if InspectorDrawerComponent}
          <InspectorDrawerComponent content={inspector} onInspect={inspectCurrentPrompt} />
        {:else}
          <div class="drawer-empty">{t('status.loading')}</div>
        {/if}
      {/if}
    </DrawerShell>
  {/if}
</main>
