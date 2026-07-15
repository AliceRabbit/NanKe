<script lang="ts">
  import Pencil from '@lucide/svelte/icons/pencil';

  import Plus from '@lucide/svelte/icons/plus';

  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { t } from '$lib/i18n';
  import type { RegexPlacement, RegexScript } from '$lib/schemas/regex';

  type RegexScope = 'normal' | 'display' | 'prompt';
  type RegexSubstitutionMode = RegexScript['substituteRegex'];

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

  export let title = t('profile.regexScripts');
  export let showTitle = true;
  export let statsLabel = '';
  export let emptyLabel = t('profile.noRegexScripts');
  export let enabled = true;
  export let scripts: RegexScript[] = [];
  export let regexScriptSurface: (script: RegexScript) => string;

  let activeRegexScriptId = '';

  $: activeRegexScript = scripts.find((script) => script.id === activeRegexScriptId);
  $: if (activeRegexScriptId && !scripts.some((script) => script.id === activeRegexScriptId)) {
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
    scripts = [...scripts, script];
    activeRegexScriptId = script.id;
  }

  function updateDraftRegexScript(id: string, patch: Partial<RegexScript>) {
    scripts = scripts.map((script) => (script.id === id ? { ...script, ...patch } : script));
  }

  function toggleRegexEditor(script: RegexScript) {
    activeRegexScriptId = activeRegexScriptId === script.id ? '' : script.id;
  }

  function removeDraftRegexScript(script: RegexScript) {
    scripts = scripts.filter((item) => item.id !== script.id);
    if (activeRegexScriptId === script.id) activeRegexScriptId = '';
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
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
</script>

<section class="regex-panel" aria-label={title}>
  <div class="regex-panel-header">
    <div>
      {#if showTitle}
        <strong>{title}</strong>
      {/if}
      {#if statsLabel}
        <span>{statsLabel}</span>
      {/if}
    </div>
    <div class="regex-actions">
      <button class="tool-button" type="button" on:click={addDraftRegexScript} title={t('profile.addRegexScript')} aria-label={t('profile.addRegexScript')}>
        <Plus size={16} />
      </button>
      <button class="toggle-pill" class:active={enabled} type="button" on:click={() => (enabled = !enabled)}>
        {enabled ? t('common.enabled') : t('common.disabled')}
      </button>
    </div>
  </div>

  {#if scripts.length}
    <div class="regex-script-list">
      {#each scripts as script}
        <article class="regex-script-row" class:active={script.id === activeRegexScriptId} class:disabled={script.disabled}>
          <button class="regex-script-main" type="button" on:click={() => toggleRegexEditor(script)}>
            <strong>{script.scriptName}</strong>
            <span>{regexScriptSurface(script)}</span>
          </button>
          <span class="regex-row-actions">
            <button class="mini-toggle" class:active={!script.disabled} type="button" on:click={() => updateDraftRegexScript(script.id, { disabled: !script.disabled })}>
              {script.disabled ? t('common.off') : t('common.on')}
            </button>
            <button type="button" on:click={() => toggleRegexEditor(script)} title={t('profile.editRegexScript')} aria-label={`${t('profile.editRegexScript')} ${script.scriptName}`}>
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
    <span class="drawer-empty compact">{emptyLabel}</span>
  {/if}

  {#if activeRegexScript}
    <div class="regex-editor" aria-label={t('profile.editRegexScript')}>
      <div class="regex-editor-grid">
        <label>
          <span>{t('common.name')}</span>
          <input value={activeRegexScript.scriptName} on:input={(event) => updateDraftRegexScript(activeRegexScript.id, { scriptName: event.currentTarget.value })} />
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
          <textarea rows="3" value={activeRegexScript.findRegex} on:input={(event) => updateDraftRegexScript(activeRegexScript.id, { findRegex: event.currentTarget.value })}></textarea>
        </label>
        <label class="wide">
          <span>{t('profile.regexReplace')}</span>
          <textarea rows="3" value={activeRegexScript.replaceString} on:input={(event) => updateDraftRegexScript(activeRegexScript.id, { replaceString: event.currentTarget.value })}></textarea>
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
          <textarea rows="3" value={activeRegexScript.trimStrings.join('\n')} on:input={(event) => updateDraftRegexScript(activeRegexScript.id, { trimStrings: regexTrimStrings(event.currentTarget.value) })}></textarea>
        </label>
        <label>
          <span>{t('profile.regexMinDepth')}</span>
          <input value={activeRegexScript.minDepth ?? ''} inputmode="numeric" on:input={(event) => updateDraftRegexScript(activeRegexScript.id, { minDepth: regexDepth(event.currentTarget.value) })} />
        </label>
        <label>
          <span>{t('profile.regexMaxDepth')}</span>
          <input value={activeRegexScript.maxDepth ?? ''} inputmode="numeric" on:input={(event) => updateDraftRegexScript(activeRegexScript.id, { maxDepth: regexDepth(event.currentTarget.value) })} />
        </label>
        <label class="regex-checkbox">
          <input type="checkbox" checked={activeRegexScript.runOnEdit} on:change={(event) => updateDraftRegexScript(activeRegexScript.id, { runOnEdit: event.currentTarget.checked })} />
          <span>{t('profile.regexRunOnEdit')}</span>
        </label>
      </div>
    </div>
  {/if}
</section>

<style>
  .regex-panel {
    display: grid;
    gap: 12px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    padding: 12px;
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
  .regex-script-row span,
  .regex-editor-grid label > span,
  .regex-option-group > span,
  .drawer-empty {
    color: inherit;
    font-size: var(--app-text-xs);
  }

  .regex-panel-header .regex-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tool-button {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: var(--nanke-ink);
    padding: 0;
  }

  .toggle-pill,
  .mini-toggle {
    min-height: 30px;
    border: 1px solid var(--nanke-border);
    border-radius: 999px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 0 10px;
    font-size: var(--app-text-xs);
    font-weight: 700;
  }

  .toggle-pill.active,
  .mini-toggle.active {
    background: var(--nanke-surface-muted);
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

  .mini-segment {
    display: grid;
    gap: 6px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
    padding: 4px;
  }

  .mini-segment.three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .mini-segment button {
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: inherit;
  }

  .mini-segment button.active {
    border-color: inherit;
    background: var(--nanke-surface);
    color: inherit;
    box-shadow: 0 1px 3px rgb(29 39 33 / 8%);
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
</style>
