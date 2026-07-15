<script lang="ts">
  import { onMount } from 'svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';

  import ClipboardList from '@lucide/svelte/icons/clipboard-list';

  import Copy from '@lucide/svelte/icons/copy';

  import Download from '@lucide/svelte/icons/download';

  import Minus from '@lucide/svelte/icons/minus';

  import Plus from '@lucide/svelte/icons/plus';

  import Save from '@lucide/svelte/icons/save';

  import Trash2 from '@lucide/svelte/icons/trash-2';

  import Upload from '@lucide/svelte/icons/upload';
  import RangeField from '$lib/ui/components/form/RangeField.svelte';
  import SecretField from '$lib/ui/components/form/SecretField.svelte';
  import TextareaField from '$lib/ui/components/form/TextareaField.svelte';
  import TextField from '$lib/ui/components/form/TextField.svelte';
  import RegexScriptsEditor from '$lib/ui/components/RegexScriptsEditor.svelte';
  import ProfilePromptManager from './ProfilePromptManager.svelte';
  import { t } from '$lib/i18n';
  import type { GenerationProfile, PromptSlot } from '$lib/schemas/profile';
  import type { RegexScript } from '$lib/schemas/regex';
  import './profile-drawer.css';

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
  export let saveActiveProfile: () => Promise<boolean>;
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

    <ProfilePromptManager
      {draftPromptStats}
      {filteredPromptSlots}
      {activePromptSlot}
      {promptEditorSlot}
      bind:activePromptSlotId
      bind:promptSlotQuery
      {promptRoles}
      {promptSources}
      {promptTriggerOptions}
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
  {/if}

</div>
