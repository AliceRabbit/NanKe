<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowDown, ArrowUp, ChevronDown, ClipboardList, Copy, Download, GripHorizontal, Minus, Pencil, Plus, RotateCcw, Save, Trash2, Upload, X } from '@lucide/svelte';
  import RangeField from '$lib/ui/components/form/RangeField.svelte';
  import SecretField from '$lib/ui/components/form/SecretField.svelte';
  import TextareaField from '$lib/ui/components/form/TextareaField.svelte';
  import TextField from '$lib/ui/components/form/TextField.svelte';
  import RegexScriptsEditor from '$lib/ui/components/RegexScriptsEditor.svelte';
  import { t } from '$lib/i18n';
  import type { GenerationProfile, PromptSlot } from '$lib/schemas/profile';
  import type { RegexScript } from '$lib/schemas/regex';

  type Profile = GenerationProfile;
  type ProviderType = Profile['provider']['type'];
  type OpenAICompatibility = Extract<Profile['provider'], { type: 'openai-compatible' }>['compatibility'];
  type VertexMode = NonNullable<Extract<Profile['provider'], { type: 'gemini' }>['vertex']>['mode'];
  type OpenAIReasoningEffort = NonNullable<Profile['thinking']>['openai']['effort'];
  type GeminiThinkingMode = NonNullable<Profile['thinking']>['gemini']['mode'];
  type GeminiThinkingLevel = NonNullable<Profile['thinking']>['gemini']['level'];
  type PromptRole = PromptSlot['role'];
  type PromptSlotSource = PromptSlot['source'];
  type SamplerField = Exclude<keyof NonNullable<Profile['sampler']>, 'stop'>;
  type SamplerVisibility = Record<SamplerField, boolean>;
  type ModelOptions = Record<ProviderType, string[]>;
  type PromptStats = { total: number; ordered: number; enabled: number; inactive?: number; injected?: number };
  type UpdateDraftSlotInjection = NonNullable<PromptSlot['injection']> | undefined;
  type PromptDropPlacement = 'before' | 'after';
  const modelOptionsStorageKey = 'nanke.profile-model-options.v1';
  const defaultModelOptions: ModelOptions = {
    'openai-compatible': ['gpt-4o-mini'],
    gemini: ['gemini-2.5-pro']
  };

  export let profiles: Profile[] = [];
  export let activeProfile: Profile | undefined = undefined;
  export let activeProfileId = '';
  export let activeProfileStats: PromptStats = { total: 0, ordered: 0, enabled: 0 };
  export let draftPromptStats: PromptStats = { total: 0, ordered: 0, enabled: 0, injected: 0 };
  export let filteredPromptSlots: PromptSlot[] = [];
  export let activePromptSlot: PromptSlot | undefined = undefined;
  export let promptEditorSlot: PromptSlot | undefined = undefined;
  export let activePromptSlotId = '';
  export let promptSlotQuery = '';
  export let profileDraftName = '';
  export let profileDraftProviderType: ProviderType = 'openai-compatible';
  export let profileDraftProviderModel = '';
  export let profileDraftProviderEndpoint = '';
  export let profileDraftApiKey = '';
  export let profileDraftOpenAICompatibility: OpenAICompatibility = 'strict-openai';
  export let profileDraftVertexEnabled = false;
  export let profileDraftVertexMode: VertexMode = 'express';
  export let profileDraftVertexProjectId = '';
  export let profileDraftVertexLocation = '';
  export let profileDraftVertexApiKey = '';
  export let profileDraftVertexAccessToken = '';
  export let profileDraftTemperature = '';
  export let profileDraftTopP = '';
  export let profileDraftTopK = '';
  export let profileDraftTopA = '';
  export let profileDraftMinP = '';
  export let profileDraftFrequencyPenalty = '';
  export let profileDraftPresencePenalty = '';
  export let profileDraftRepetitionPenalty = '';
  export let profileDraftMaxTokens = '';
  export let profileDraftContextTokens = '';
  export let profileDraftSeed = '';
  export let profileDraftN = '';
  export let profileDraftStop = '';
  export let profileDraftStream = true;
  export let profileDraftOpenAIReasoningEffort: OpenAIReasoningEffort = 'default';
  export let profileDraftGeminiIncludeThoughts = false;
  export let profileDraftGeminiThinkingMode: GeminiThinkingMode = 'default';
  export let profileDraftGeminiThinkingBudget = '';
  export let profileDraftGeminiThinkingLevel: GeminiThinkingLevel = 'medium';
  export let profileDraftSquashSystemMessages = false;
  export let profileDraftRegexEnabled = true;
  export let profileDraftRegexScripts: RegexScript[] = [];
  export let samplerVisible: SamplerVisibility;
  export let samplerPanelHeading = '';
  export let maxTokensFieldLabel = '';
  export let candidateCountFieldLabel = '';
  export let draftModelUsesGeminiThinkingLevel = false;
  export let showAdvancedSampler = false;
  export let maxContextTokens = 2_000_000;
  export let maxOutputTokenRange = 65_536;
  export let promptRoles: PromptRole[] = [];
  export let promptSources: PromptSlotSource[] = [];
  export let promptTriggerOptions: string[] = [];

  export let openPresetImport: () => void;
  export let saveActiveProfile: () => void | Promise<Profile | undefined>;
  export let duplicateActiveProfile: () => void | Promise<void>;
  export let deleteActiveProfile: () => void | Promise<void>;
  export let exportActiveProfile: () => void;
  export let inspectCurrentPrompt: () => void;
  export let changeProfileProviderType: (type: ProviderType) => void;
  export let reasoningEffortLabel: (value: OpenAIReasoningEffort) => string;
  export let geminiThinkingModeLabel: (value: GeminiThinkingMode | GeminiThinkingLevel) => string;
  export let regexScriptSurface: (script: RegexScript) => string;
  export let profileOrigin: (profile: Profile) => string;
  export let profileSamplerLine: (profile: Profile) => string;
  export let profileStats: (profile?: Profile) => PromptStats;
  export let slotMeta: (slot: PromptSlot) => string;
  export let slotKind: (slot: PromptSlot) => string;
  export let slotTokenEstimate: (slot: PromptSlot) => string;
  export let updateDraftSlot: (id: string, patch: Partial<PromptSlot>) => void;
  export let updateDraftSlotLegacy: (id: string, patch: Partial<NonNullable<PromptSlot['legacy']>>) => void;
  export let updateDraftSlotInjection: (id: string, patch: UpdateDraftSlotInjection) => void;
  export let setPromptInjectionPosition: (slot: PromptSlot, position: 'none' | 'relative' | 'absolute') => void;
  export let togglePromptTrigger: (slot: PromptSlot, trigger: string) => void;
  export let roleLabel: (role: string) => string;
  export let promptSourceLabel: (source: PromptSlotSource) => string;
  export let triggerLabel: (trigger: string) => string;
  export let optionalInteger: (value: string) => number | undefined;
  export let optionalNumber: (value: string) => number | undefined;
  export let addDraftPromptSlot: () => void;
  export let openPromptEditor: (slot?: PromptSlot) => void;
  export let duplicateDraftPromptSlot: (slot?: PromptSlot) => void;
  export let moveDraftPromptSlot: (slot: PromptSlot | undefined, direction: -1 | 1) => void;
  export let moveDraftPromptSlotTo: (sourceId: string, targetId: string, placement: PromptDropPlacement) => void;
  export let isFirstPromptSlot: (slot: PromptSlot) => boolean;
  export let isLastPromptSlot: (slot: PromptSlot) => boolean;
  export let canRemovePromptSlot: (slot: PromptSlot) => boolean;
  export let removeDraftPromptSlot: (slot?: PromptSlot) => void;
  export let resetPromptEditor: () => void;
  export let savePromptEditor: () => void | Promise<void>;
  export let closePromptEditor: () => void;

  let profilePickerOpen = false;
  let modelPickerOpen = false;
  let modelPickerInput = '';
  let modelOptions: ModelOptions = {
    'openai-compatible': [...defaultModelOptions['openai-compatible']],
    gemini: [...defaultModelOptions.gemini]
  };
  let currentModelOptionsList: string[] = [];
  let draggedPromptSlotId = '';
  let promptSlotDropTargetId = '';
  let promptSlotDropPlacement: PromptDropPlacement = 'before';

  $: currentModelOptionsList = modelOptions[profileDraftProviderType] ?? [];

  onMount(() => {
    modelOptions = loadModelOptions();
  });

  function cleanModelIds(values: unknown[]) {
    return [...new Set(values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean))];
  }

  function seedModelOptions(): ModelOptions {
    return {
      'openai-compatible': cleanModelIds([...defaultModelOptions['openai-compatible'], ...profiles.filter((profile) => profile.provider.type === 'openai-compatible').map((profile) => profile.provider.model)]),
      gemini: cleanModelIds([...defaultModelOptions.gemini, ...profiles.filter((profile) => profile.provider.type === 'gemini').map((profile) => profile.provider.model)])
    };
  }

  function loadModelOptions(): ModelOptions {
    if (typeof localStorage === 'undefined') return seedModelOptions();
    const raw = localStorage.getItem(modelOptionsStorageKey);
    if (!raw) return seedModelOptions();
    try {
      const parsed = JSON.parse(raw) as Partial<ModelOptions>;
      return {
        'openai-compatible': cleanModelIds(parsed['openai-compatible'] ?? []),
        gemini: cleanModelIds(parsed.gemini ?? [])
      };
    } catch {
      return seedModelOptions();
    }
  }

  function saveModelOptions() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(modelOptionsStorageKey, JSON.stringify(modelOptions));
  }

  function addModelOption() {
    const value = modelPickerInput.trim();
    if (!value) return;
    const list = cleanModelIds([...currentModelOptionsList, value]);
    modelOptions = { ...modelOptions, [profileDraftProviderType]: list };
    profileDraftProviderModel = value;
    modelPickerInput = '';
    saveModelOptions();
  }

  function removeModelOption(value: string) {
    modelOptions = {
      ...modelOptions,
      [profileDraftProviderType]: currentModelOptionsList.filter((model) => model !== value)
    };
    saveModelOptions();
  }

  function selectModelOption(value: string) {
    profileDraftProviderModel = value;
    modelPickerOpen = false;
  }

  function selectProfile(id: string) {
    activeProfileId = id;
    profilePickerOpen = false;
  }

  function handleModelInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addModelOption();
    }
    if (event.key === 'Escape') modelPickerOpen = false;
  }

  function clearPromptSlotDrag() {
    draggedPromptSlotId = '';
    promptSlotDropTargetId = '';
    promptSlotDropPlacement = 'before';
  }

  function startPromptSlotDrag(event: DragEvent, slot: PromptSlot) {
    draggedPromptSlotId = slot.id;
    activePromptSlotId = slot.id;
    event.dataTransfer?.setData('text/plain', slot.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function dragOverPromptSlot(event: DragEvent, slot: PromptSlot) {
    const sourceId = draggedPromptSlotId || event.dataTransfer?.getData('text/plain') || '';
    if (!sourceId) return;
    if (sourceId === slot.id) {
      promptSlotDropTargetId = '';
      return;
    }
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    promptSlotDropTargetId = slot.id;
    promptSlotDropPlacement = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  function dropPromptSlot(event: DragEvent, slot: PromptSlot) {
    event.preventDefault();
    const sourceId = draggedPromptSlotId || event.dataTransfer?.getData('text/plain') || '';
    if (sourceId && sourceId !== slot.id) moveDraftPromptSlotTo(sourceId, slot.id, promptSlotDropPlacement);
    clearPromptSlotDrag();
  }

</script>
<div class="profile-workspace">
  <div class="profile-panel">
    <div class="preset-toolbar" aria-label={t('profile.presetTools')}>
      <div class="preset-picker">
        <button class="preset-picker-trigger" type="button" aria-label={t('profile.selectedProfile')} aria-expanded={profilePickerOpen} on:click={() => (profilePickerOpen = !profilePickerOpen)}>
          <span>
            <strong>{activeProfile?.name ?? t('profile.selectedProfile')}</strong>
            {#if activeProfile}
              <small>{activeProfile.provider.type} · {activeProfile.provider.model}</small>
            {/if}
          </span>
          <ChevronDown size={16} />
        </button>
        {#if profilePickerOpen}
          <div class="preset-picker-menu" aria-label={t('nav.profiles')}>
            {#each profiles as profile}
              {@const stats = profileStats(profile)}
              <button class:active={profile.id === activeProfileId} type="button" on:click={() => selectProfile(profile.id)}>
                <span>
                  <strong>{profile.name}</strong>
                  <small>{profile.provider.type} · {profile.provider.model}</small>
                </span>
                <small>{stats.enabled}/{stats.total}</small>
              </button>
            {/each}
          </div>
        {/if}
      </div>
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
        <button class="tool-button danger" type="button" on:click={deleteActiveProfile} title={t('profile.delete')} aria-label={t('profile.delete')} disabled={!activeProfile || profiles.length <= 1}>
          <Trash2 size={16} />
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
          <div class="model-picker">
            <span>{t('profile.model')}</span>
            <button class="model-picker-trigger" type="button" on:click={() => (modelPickerOpen = !modelPickerOpen)} aria-label={t('profile.model')} aria-expanded={modelPickerOpen}>
              <span class="model-picker-value">{profileDraftProviderModel || (profileDraftProviderType === 'gemini' ? 'gemini-2.5-pro' : 'gpt-4o-mini')}</span>
              <ChevronDown size={16} />
            </button>
            {#if modelPickerOpen}
              <div class="model-picker-menu">
                <div class="model-picker-add">
                  <input bind:value={modelPickerInput} placeholder={t('profile.modelPickerPlaceholder')} on:keydown={handleModelInputKeydown} />
                  <button type="button" on:click={addModelOption} aria-label={t('profile.addModel')}>
                    <Plus size={16} />
                  </button>
                </div>
                <div class="model-picker-list" aria-label={t('profile.addedModels')}>
                  {#each currentModelOptionsList as model}
                    <div class="model-option-row">
                      <button class="model-option-select" class:active={model === profileDraftProviderModel} type="button" on:click={() => selectModelOption(model)}>
                        {model}
                      </button>
                      <button class="model-option-delete" type="button" on:click={() => removeModelOption(model)} aria-label={t('profile.removeModel', { model })}>
                        <Minus size={15} />
                      </button>
                    </div>
                  {:else}
                    <div class="model-picker-empty">{t('profile.noModels')}</div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
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
          </button>
          <button class:active={!profileDraftStream} type="button" on:click={() => (profileDraftStream = false)}>
            <strong>{t('profile.singleResponse')}</strong>
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
        <button
          class="toggle-pill stateful"
          class:active={profileDraftSquashSystemMessages}
          type="button"
          aria-pressed={profileDraftSquashSystemMessages}
          on:click={() => (profileDraftSquashSystemMessages = !profileDraftSquashSystemMessages)}
        >
          <span>{t('profile.squashSystem')}</span>
          <strong>{profileDraftSquashSystemMessages ? t('common.enabled') : t('common.disabled')}</strong>
        </button>
      </div>

      <RegexScriptsEditor
        title={t('profile.regexScripts')}
        statsLabel={t('profile.regexStats', { active: profileDraftRegexScripts.filter((script) => !script.disabled).length, total: profileDraftRegexScripts.length })}
        emptyLabel={t('profile.noRegexScripts')}
        bind:enabled={profileDraftRegexEnabled}
        bind:scripts={profileDraftRegexScripts}
        {regexScriptSurface}
      />
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
          <span></span>
          <span>{t('common.prompt')}</span>
          <span>{t('common.type')}</span>
          <span>{t('common.tokens')}</span>
          <span>{t('common.actions')}</span>
        </div>
        {#each filteredPromptSlots as slot}
          <article
            class="prompt-slot-row"
            class:active={slot.id === activePromptSlotId}
            class:dragging={slot.id === draggedPromptSlotId}
            class:drop-before={slot.id === promptSlotDropTargetId && promptSlotDropPlacement === 'before'}
            class:drop-after={slot.id === promptSlotDropTargetId && promptSlotDropPlacement === 'after'}
            on:dragover={(event) => dragOverPromptSlot(event, slot)}
            on:drop={(event) => dropPromptSlot(event, slot)}
            on:dragend={clearPromptSlotDrag}
          >
            <button
              class="prompt-slot-grip"
              type="button"
              draggable="true"
              title={t('profile.order')}
              aria-label={`${t('profile.order')} ${slot.label || slot.id}`}
              on:dragstart={(event) => startPromptSlotDrag(event, slot)}
              on:dragend={clearPromptSlotDrag}
            >
              <GripHorizontal size={14} />
            </button>
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
                      position: promptEditorSlot.injection?.position ?? 'relative',
                      depth: optionalInteger((event.currentTarget as HTMLInputElement).value) ?? 0,
                      order: promptEditorSlot.injection?.order ?? 100,
                      triggers: promptEditorSlot.injection?.triggers ?? []
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
                      position: promptEditorSlot.injection?.position ?? 'relative',
                      depth: promptEditorSlot.injection?.depth ?? 4,
                      order: optionalNumber((event.currentTarget as HTMLInputElement).value) ?? 100,
                      triggers: promptEditorSlot.injection?.triggers ?? []
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

</div>

<style>
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

.preset-picker {
  position: relative;
  min-width: 0;
}

.preset-picker-trigger {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--nanke-border);
  border-radius: 8px;
  background: var(--nanke-field);
  color: var(--nanke-ink);
  box-shadow: var(--nanke-shadow-field);
  padding: 7px 11px;
  text-align: left;
}

.preset-picker-trigger:hover,
.preset-picker-trigger:focus-visible {
  border-color: var(--nanke-border-strong);
  background: var(--nanke-field-hover);
  outline: 0;
}

.preset-picker-trigger span,
.preset-picker-menu button span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.preset-picker-trigger strong,
.preset-picker-menu strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-picker-trigger small,
.preset-picker-menu small {
  color: var(--nanke-ink-muted);
  font-size: var(--app-text-2xs);
}

.preset-picker-menu {
  position: absolute;
  z-index: 12;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  display: grid;
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--nanke-border);
  border-radius: 8px;
  background: var(--nanke-surface);
  box-shadow: var(--nanke-shadow-popover);
  padding: 6px;
}

.preset-picker-menu button {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  padding: 8px 9px;
  text-align: left;
}

.preset-picker-menu button:hover,
.preset-picker-menu button:focus-visible,
.preset-picker-menu button.active {
  border-color: var(--nanke-border);
  background: var(--nanke-surface-muted);
  outline: 0;
}

.preset-picker-menu button.active {
  box-shadow: inset 3px 0 0 var(--nanke-accent);
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

.preset-actions .tool-button.danger {
  color: var(--nanke-danger);
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
.preset-picker-trigger strong,
.preset-picker-menu strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-summary-heading span,
.profile-model,
.profile-sampler {
  color: inherit;
  font-size: var(--app-text-xs);
  overflow-wrap: anywhere;
}

.provider-pill {
  flex: 0 0 auto;
  border: 1px solid var(--nanke-border);
  border-radius: 999px;
  background: var(--nanke-surface-muted);
  color: inherit !important;
  padding: 3px 7px;
  font-size: var(--app-text-2xs) !important;
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
  font-size: var(--app-text-xs);
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
.profile-textarea-label span,
.profile-mode-strip span,
.prompt-slot-row span {
  color: inherit;
  font-size: var(--app-text-xs);
}

.provider-editor,
.request-panel {
  display: grid;
  gap: 12px;
  border: 1px solid var(--nanke-border);
  border-radius: 8px;
  background: var(--nanke-surface);
  padding: 12px;
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

.model-picker {
  position: relative;
  display: grid;
  min-width: 0;
  gap: 6px;
  color: var(--nanke-ink);
  font-size: var(--app-text-sm);
}

.model-picker > span {
  color: var(--nanke-ink-muted);
  font-size: var(--app-text-xs);
  font-weight: 600;
}

.model-picker-trigger,
.model-picker-add input {
  min-width: 0;
  height: 40px;
  border: 1px solid transparent;
  border-radius: var(--nanke-radius-md);
  background: var(--nanke-field);
  color: var(--nanke-ink);
  box-shadow: var(--nanke-shadow-field);
  outline: none;
}

.model-picker-trigger {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  text-align: left;
}

.model-picker-trigger:hover,
.model-picker-add input:hover {
  background: var(--nanke-field-hover);
}

.model-picker-trigger:focus-visible,
.model-picker-add input:focus {
  border-color: var(--nanke-accent);
  background: var(--nanke-field);
  box-shadow: var(--nanke-shadow-field-focus);
}

.model-picker-value,
.model-option-select {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}

.model-picker-menu {
  position: absolute;
  z-index: 10;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  display: grid;
  gap: 8px;
  border: 1px solid var(--nanke-border);
  border-radius: 8px;
  background: var(--nanke-surface);
  box-shadow: var(--nanke-shadow-popover);
  padding: 10px;
}

.model-picker-add {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px;
  gap: 7px;
}

.model-picker-add input {
  padding: 0 10px;
}

.model-picker-add button,
.model-option-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--nanke-border);
  border-radius: 7px;
  background: var(--nanke-surface);
  color: inherit;
}

.model-picker-list {
  display: grid;
  max-height: 170px;
  overflow: auto;
  gap: 6px;
}

.model-option-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 6px;
}

.model-option-select {
  min-width: 0;
  border: 1px solid var(--nanke-border);
  border-radius: 7px;
  background: var(--nanke-field);
  color: inherit;
  padding: 8px 10px;
  text-align: left;
}

.model-option-select.active {
  border-color: var(--nanke-accent);
  background: var(--nanke-accent-soft);
}

.model-option-delete {
  color: var(--nanke-danger);
}

.model-picker-empty {
  border: 1px dashed var(--nanke-border);
  border-radius: 7px;
  color: var(--nanke-ink-muted);
  padding: 10px;
  text-align: center;
  font-size: var(--app-text-xs);
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
  font-size: var(--app-text-sm);
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
  justify-self: start;
  gap: 6px;
  width: min(240px, 100%);
  border: 1px solid var(--nanke-border);
  border-radius: 999px;
  background: var(--nanke-field);
  padding: 4px;
}

.request-flow-strip button {
  display: inline-grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  padding: 6px 10px;
  text-align: center;
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
  font-size: var(--app-text-sm);
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
  font-size: var(--app-text-xs);
}

:global(.sampler-number) {
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
  font-size: var(--app-text-sm);
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

.toggle-pill.stateful {
  display: inline-grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border-color: var(--nanke-border);
  background: var(--nanke-field);
  text-align: left;
}

.toggle-pill.stateful.active {
  border-color: var(--nanke-accent);
  background: var(--nanke-accent-soft);
  color: var(--nanke-accent);
}

.toggle-pill.stateful strong {
  border-radius: 999px;
  background: var(--nanke-surface);
  color: var(--nanke-ink-muted);
  padding: 3px 7px;
  font-size: var(--app-text-2xs);
  line-height: 1;
  white-space: nowrap;
}

.toggle-pill.stateful.active strong {
  background: var(--nanke-surface);
  color: var(--nanke-accent);
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
  grid-template-columns: 28px 44px minmax(0, 1fr) 86px 62px 176px;
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
  font-size: var(--app-text-2xs);
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

.prompt-slot-row.dragging {
  opacity: 0.55;
}

.prompt-slot-row.drop-before {
  box-shadow: inset 0 2px 0 var(--nanke-accent);
}

.prompt-slot-row.drop-after {
  box-shadow: inset 0 -2px 0 var(--nanke-accent);
}

.prompt-slot-grip {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  cursor: grab;
}

.prompt-slot-grip:active {
  cursor: grabbing;
}

.prompt-slot-grip:hover,
.prompt-slot-grip:focus-visible {
  border-color: var(--nanke-border);
  background: var(--nanke-field);
  outline: 0;
}

.prompt-slot-toggle {
  position: relative;
  width: 38px;
  height: 22px;
  margin: 0 auto;
  border: 1px solid var(--nanke-border);
  border-radius: 999px;
  background: var(--nanke-field);
  box-shadow: inset 0 1px 2px rgb(29 39 33 / 10%);
  cursor: pointer;
  appearance: none;
  transition:
    background-color 140ms ease,
    border-color 140ms ease;
}

.prompt-slot-toggle::before {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--nanke-ink-muted);
  content: '';
  transition:
    transform 140ms ease,
    background-color 140ms ease;
}

.prompt-slot-toggle:checked {
  border-color: var(--nanke-accent);
  background: var(--nanke-accent-soft);
}

.prompt-slot-toggle:checked::before {
  background: var(--nanke-accent);
  transform: translateX(16px);
}

.prompt-slot-toggle:focus-visible {
  border-color: var(--nanke-accent);
  box-shadow: var(--nanke-shadow-field-focus);
  outline: 0;
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
  font-size: var(--app-text-2xs);
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
  font-size: var(--app-text-2xl);
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
  font-size: var(--app-text-sm);
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
  font-size: var(--app-text-xs);
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
  font-size: var(--app-text-xs);
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

.drawer-empty {
  color: inherit;
  padding: 18px 16px;
  font-size: var(--app-text-sm);
}

  @media (max-width: 860px) {
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
    grid-template-columns: 28px 44px minmax(0, 1fr);
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
  }
</style>
