<script lang="ts">
  import { ArrowDown, ArrowUp, ClipboardList, Copy, Download, GripHorizontal, Pencil, Plus, RotateCcw, Save, Trash2, Upload, X } from '@lucide/svelte';
  import RangeField from '$lib/ui/components/form/RangeField.svelte';
  import SecretField from '$lib/ui/components/form/SecretField.svelte';
  import SelectField from '$lib/ui/components/form/SelectField.svelte';
  import TextareaField from '$lib/ui/components/form/TextareaField.svelte';
  import TextField from '$lib/ui/components/form/TextField.svelte';
  import { t } from '$lib/i18n';
  import type { GenerationProfile, PromptSlot } from '$lib/schemas/profile';
  import type { RegexPlacement, RegexScript } from '$lib/schemas/regex';

  type Profile = GenerationProfile;
  type ProviderType = Profile['provider']['type'];
  type OpenAICompatibility = Extract<Profile['provider'], { type: 'openai-compatible' }>['compatibility'];
  type VertexMode = NonNullable<Extract<Profile['provider'], { type: 'gemini' }>['vertex']>['mode'];
  type OpenAIReasoningEffort = NonNullable<Profile['thinking']>['openai']['effort'];
  type GeminiThinkingMode = NonNullable<Profile['thinking']>['gemini']['mode'];
  type GeminiThinkingLevel = NonNullable<Profile['thinking']>['gemini']['level'];
  type PromptRole = PromptSlot['role'];
  type PromptSlotSource = PromptSlot['source'];
  type PromptMode = Profile['prompt']['mode'];
  type MacroMode = Profile['prompt']['macroMode'];
  type RegexSubstitutionMode = RegexScript['substituteRegex'];
  type SamplerField = Exclude<keyof NonNullable<Profile['sampler']>, 'stop'>;
  type SamplerVisibility = Record<SamplerField, boolean>;
  type PromptStats = { total: number; ordered: number; enabled: number; inactive?: number; injected?: number };
  type UpdateDraftSlotInjection = NonNullable<PromptSlot['injection']> | undefined;
  type RegexScope = 'normal' | 'display' | 'prompt';

  const regexPlacementOptions: Array<{ value: RegexPlacement; label: string }> = [
    { value: 0, label: t('profile.regexPlacement.display') },
    { value: 1, label: t('profile.regexPlacement.userInput') },
    { value: 2, label: t('profile.regexPlacement.aiOutput') },
    { value: 3, label: t('profile.regexPlacement.slashCommand') },
    { value: 5, label: t('profile.regexPlacement.worldInfo') },
    { value: 6, label: t('profile.regexPlacement.reasoning') }
  ];

  const regexSubstitutionOptions: Array<{ value: RegexSubstitutionMode; label: string }> = [
    { value: 0, label: t('profile.regexSubstitution.none') },
    { value: 1, label: t('profile.regexSubstitution.raw') },
    { value: 2, label: t('profile.regexSubstitution.escaped') }
  ];

  export let profiles: Profile[] = [];
  export let activeProfile: Profile | undefined = undefined;
  export let activeProfileId = '';
  export let activeProfileStats: PromptStats = { total: 0, ordered: 0, enabled: 0 };
  export let filteredProfiles: Profile[] = [];
  export let profileQuery = '';
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
  export let profileDraftMode: PromptMode = 'chat';
  export let profileDraftMacroMode: MacroMode = 'none';
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
  export let isFirstPromptSlot: (slot: PromptSlot) => boolean;
  export let isLastPromptSlot: (slot: PromptSlot) => boolean;
  export let canRemovePromptSlot: (slot: PromptSlot) => boolean;
  export let removeDraftPromptSlot: (slot?: PromptSlot) => void;
  export let resetPromptEditor: () => void;
  export let savePromptEditor: () => void | Promise<void>;
  export let closePromptEditor: () => void;

  let activeRegexScriptId = '';

  $: activeRegexScript = profileDraftRegexScripts.find((script) => script.id === activeRegexScriptId);
  $: if (profileDraftRegexScripts.length && !profileDraftRegexScripts.some((script) => script.id === activeRegexScriptId)) {
    activeRegexScriptId = profileDraftRegexScripts[0].id;
  }
  $: if (!profileDraftRegexScripts.length && activeRegexScriptId) {
    activeRegexScriptId = '';
  }

  function regexScope(script: RegexScript): RegexScope {
    if (script.promptOnly) return 'prompt';
    if (script.markdownOnly) return 'display';
    return 'normal';
  }

  function addDraftRegexScript() {
    const script: RegexScript = {
      id: `custom-regex-${crypto.randomUUID()}`,
      scriptName: t('profile.newRegexScript'),
      findRegex: '',
      replaceString: '',
      trimStrings: [],
      placement: [2],
      disabled: false,
      markdownOnly: false,
      promptOnly: false,
      runOnEdit: false,
      substituteRegex: 0,
      minDepth: null,
      maxDepth: null
    };
    profileDraftRegexScripts = [...profileDraftRegexScripts, script];
    activeRegexScriptId = script.id;
  }

  function updateDraftRegexScript(id: string, patch: Partial<RegexScript>) {
    profileDraftRegexScripts = profileDraftRegexScripts.map((script) => (script.id === id ? { ...script, ...patch } : script));
  }

  function removeDraftRegexScript(script: RegexScript) {
    const index = profileDraftRegexScripts.findIndex((item) => item.id === script.id);
    const nextScripts = profileDraftRegexScripts.filter((item) => item.id !== script.id);
    profileDraftRegexScripts = nextScripts;
    activeRegexScriptId = nextScripts[Math.min(index, nextScripts.length - 1)]?.id ?? '';
  }

  function setRegexScope(script: RegexScript, scope: RegexScope) {
    updateDraftRegexScript(script.id, {
      markdownOnly: scope === 'display',
      promptOnly: scope === 'prompt'
    });
  }

  function toggleRegexPlacement(script: RegexScript, placement: RegexPlacement) {
    const placements = new Set(script.placement);
    if (placements.has(placement)) placements.delete(placement);
    else placements.add(placement);
    updateDraftRegexScript(script.id, { placement: [...placements] });
  }

  function regexTrimStrings(value: string) {
    return value.split('\n').filter((item) => item.length > 0);
  }

  function regexDepth(value: string) {
    return value.trim() ? (optionalInteger(value) ?? null) : null;
  }
</script>
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
          <div class="preset-actions">
            <button class="tool-button" type="button" on:click={addDraftRegexScript} title={t('profile.addRegexScript')} aria-label={t('profile.addRegexScript')}>
              <Plus size={16} />
            </button>
            <button class="toggle-pill" class:active={profileDraftRegexEnabled} type="button" on:click={() => (profileDraftRegexEnabled = !profileDraftRegexEnabled)}>
              {profileDraftRegexEnabled ? t('common.enabled') : t('common.disabled')}
            </button>
          </div>
        </div>
        {#if profileDraftRegexScripts.length}
          <div class="regex-script-list">
            {#each profileDraftRegexScripts as script}
              <article class="regex-script-row" class:active={script.id === activeRegexScriptId} class:disabled={script.disabled}>
                <button class="regex-script-main" type="button" on:click={() => (activeRegexScriptId = script.id)}>
                  <strong>{script.scriptName}</strong>
                  <span>{regexScriptSurface(script)}</span>
                </button>
                <span class="regex-row-actions">
                  <button class="mini-toggle" class:active={!script.disabled} type="button" on:click={() => updateDraftRegexScript(script.id, { disabled: !script.disabled })}>
                    {script.disabled ? t('common.off') : t('common.on')}
                  </button>
                  <button type="button" on:click={() => (activeRegexScriptId = script.id)} title={t('profile.editRegexScript')} aria-label={`${t('profile.editRegexScript')} ${script.scriptName}`}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" on:click={() => removeDraftRegexScript(script)} title={t('profile.removeRegexScript')} aria-label={`${t('profile.removeRegexScript')} ${script.scriptName}`}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </article>
            {/each}
          </div>
        {:else}
          <span class="drawer-empty compact">{t('profile.noRegexScripts')}</span>
        {/if}

        {#if activeRegexScript}
          <div class="regex-editor" aria-label={t('profile.editRegexScript')}>
            <div class="regex-editor-grid">
              <label>
                <span>{t('common.name')}</span>
                <input value={activeRegexScript.scriptName} on:input={(event) => updateDraftRegexScript(activeRegexScript.id, { scriptName: (event.currentTarget as HTMLInputElement).value })} />
              </label>
              <div class="regex-option-group">
                <span>{t('profile.regexSubstitution')}</span>
                <div class="mini-segment three" aria-label={t('profile.regexSubstitution')}>
                  {#each regexSubstitutionOptions as option}
                    <button class:active={activeRegexScript.substituteRegex === option.value} type="button" on:click={() => updateDraftRegexScript(activeRegexScript.id, { substituteRegex: option.value })}>
                      {option.label}
                    </button>
                  {/each}
                </div>
              </div>
              <label class="wide">
                <span>{t('profile.regexFind')}</span>
                <textarea
                  rows="3"
                  value={activeRegexScript.findRegex}
                  on:input={(event) => updateDraftRegexScript(activeRegexScript.id, { findRegex: (event.currentTarget as HTMLTextAreaElement).value })}
                ></textarea>
              </label>
              <label class="wide">
                <span>{t('profile.regexReplace')}</span>
                <textarea
                  rows="3"
                  value={activeRegexScript.replaceString}
                  on:input={(event) => updateDraftRegexScript(activeRegexScript.id, { replaceString: (event.currentTarget as HTMLTextAreaElement).value })}
                ></textarea>
              </label>
              <div class="regex-option-group wide">
                <span>{t('profile.regexPlacement')}</span>
                <div class="regex-pill-options" aria-label={t('profile.regexPlacement')}>
                  {#each regexPlacementOptions as option}
                    <button class:active={activeRegexScript.placement.includes(option.value)} type="button" on:click={() => toggleRegexPlacement(activeRegexScript, option.value)}>
                      {option.label}
                    </button>
                  {/each}
                </div>
              </div>
              <div class="regex-option-group">
                <span>{t('profile.regexScope')}</span>
                <div class="mini-segment three" aria-label={t('profile.regexScope')}>
                  <button class:active={regexScope(activeRegexScript) === 'normal'} type="button" on:click={() => setRegexScope(activeRegexScript, 'normal')}>{t('profile.regexScope.normal')}</button>
                  <button class:active={regexScope(activeRegexScript) === 'display'} type="button" on:click={() => setRegexScope(activeRegexScript, 'display')}>{t('profile.regexScope.display')}</button>
                  <button class:active={regexScope(activeRegexScript) === 'prompt'} type="button" on:click={() => setRegexScope(activeRegexScript, 'prompt')}>{t('profile.regexScope.prompt')}</button>
                </div>
              </div>
              <label>
                <span>{t('profile.regexTrimStrings')}</span>
                <textarea
                  rows="3"
                  value={activeRegexScript.trimStrings.join('\n')}
                  on:input={(event) => updateDraftRegexScript(activeRegexScript.id, { trimStrings: regexTrimStrings((event.currentTarget as HTMLTextAreaElement).value) })}
                ></textarea>
              </label>
              <label>
                <span>{t('profile.regexMinDepth')}</span>
                <input value={activeRegexScript.minDepth ?? ''} inputmode="numeric" on:input={(event) => updateDraftRegexScript(activeRegexScript.id, { minDepth: regexDepth((event.currentTarget as HTMLInputElement).value) })} />
              </label>
              <label>
                <span>{t('profile.regexMaxDepth')}</span>
                <input value={activeRegexScript.maxDepth ?? ''} inputmode="numeric" on:input={(event) => updateDraftRegexScript(activeRegexScript.id, { maxDepth: regexDepth((event.currentTarget as HTMLInputElement).value) })} />
              </label>
              <label class="regex-checkbox">
                <input type="checkbox" checked={activeRegexScript.runOnEdit} on:change={(event) => updateDraftRegexScript(activeRegexScript.id, { runOnEdit: (event.currentTarget as HTMLInputElement).checked })} />
                <span>{t('profile.regexRunOnEdit')}</span>
              </label>
            </div>
          </div>
        {:else if profileDraftRegexScripts.length}
          <span class="drawer-empty compact">{t('profile.noRegexSelected')}</span>
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
.request-panel,
.regex-panel {
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

.regex-panel-header,
.regex-script-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.regex-panel-header div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.regex-panel-header span,
.regex-script-row span {
  color: inherit;
  font-size: var(--app-text-xs);
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

.regex-script-row.active {
  background: var(--nanke-surface-muted);
  box-shadow: inset 3px 0 0 #1c6b43;
}

.regex-script-row.disabled {
  opacity: 0.62;
}

.regex-script-main {
  display: grid;
  min-width: 0;
  gap: 3px;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  text-align: left;
}

.regex-script-main strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.regex-row-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.regex-row-actions button:not(.mini-toggle) {
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

.regex-editor {
  display: grid;
  gap: 10px;
  border-top: 1px solid var(--nanke-border);
  padding-top: 10px;
}

.regex-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.regex-editor-grid label,
.regex-option-group {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.regex-editor-grid label > span,
.regex-option-group > span {
  color: inherit;
  font-size: var(--app-text-xs);
}

.regex-editor-grid input,
.regex-editor-grid textarea {
  min-width: 0;
  border: 1px solid var(--nanke-border);
  border-radius: 7px;
  background: var(--nanke-field);
  color: var(--nanke-ink);
  padding: 8px 10px;
  font: inherit;
  font-size: var(--app-text-sm);
}

.regex-editor-grid textarea {
  min-height: 76px;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  line-height: 1.45;
}

.regex-editor-grid .wide {
  grid-column: 1 / -1;
}

.regex-pill-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.regex-pill-options button {
  min-height: 30px;
  border: 1px solid var(--nanke-border);
  border-radius: 999px;
  background: var(--nanke-surface);
  color: inherit;
  padding: 0 10px;
  font-size: var(--app-text-xs);
}

.regex-pill-options button.active {
  border-color: inherit;
  background: var(--nanke-surface-muted);
}

.regex-checkbox {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  align-self: end;
}

.regex-checkbox input {
  width: 16px;
  height: 16px;
}

.mini-toggle {
  min-width: 44px;
  min-height: 30px;
  border: 1px solid var(--nanke-border);
  border-radius: 999px;
  background: var(--nanke-surface);
  color: inherit;
  padding: 0 10px;
  font-size: var(--app-text-xs);
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
  .prompt-editor-fields,
  .regex-editor-grid {
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
  }
</style>
