<script lang="ts">
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Copy from '@lucide/svelte/icons/copy';
  import GripHorizontal from '@lucide/svelte/icons/grip-horizontal';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Save from '@lucide/svelte/icons/save';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import X from '@lucide/svelte/icons/x';
  import { t } from '$lib/i18n';
  import type { PromptSlot } from '$lib/schemas/profile';

  type PromptRole = PromptSlot['role'];
  type PromptSlotSource = PromptSlot['source'];
  type PromptStats = { total: number; ordered: number; enabled: number; inactive?: number; injected?: number };
  type UpdateDraftSlotInjection = NonNullable<PromptSlot['injection']> | undefined;
  type PromptDropPlacement = 'before' | 'after';

  export let draftPromptStats: PromptStats;
  export let filteredPromptSlots: PromptSlot[];
  export let activePromptSlot: PromptSlot | undefined;
  export let promptEditorSlot: PromptSlot | undefined;
  export let activePromptSlotId: string;
  export let promptSlotQuery: string;
  export let promptRoles: PromptRole[];
  export let promptSources: PromptSlotSource[];
  export let promptTriggerOptions: string[];

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

  let draggedPromptSlotId = '';
  let promptSlotDropTargetId = '';
  let promptSlotDropPlacement: PromptDropPlacement = 'before';

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
