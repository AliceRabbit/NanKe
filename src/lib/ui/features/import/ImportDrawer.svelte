<script lang="ts">
  import Download from '@lucide/svelte/icons/download';
  import Upload from '@lucide/svelte/icons/upload';
  import { t } from '$lib/i18n';

  type ImportKind = 'preset' | 'character-card-json' | 'character-card-png' | 'worldbook' | 'chat-jsonl' | 'conversation-snapshot';

  export let kind: ImportKind;
  export let name = '';
  export let options: ImportKind[] = [];
  export let fileName = '';
  export let hasPayload = false;
  export let kindLabel: (kind: ImportKind) => string;
  export let onKindChange: () => void;
  export let onFileChange: (event: Event) => void | Promise<void>;
  export let onImport: () => void | Promise<void>;
</script>

<div class="import-panel">
  {#if options.length > 1}
    <select aria-label={t('import.kind')} bind:value={kind} on:change={onKindChange}>
      {#each options as option}
        <option value={option}>{kindLabel(option)}</option>
      {/each}
    </select>
  {:else}
    <div class="import-kind-note">
      <span>{t('import.kind')}</span>
      <strong>{kindLabel(kind)}</strong>
    </div>
  {/if}
  <input bind:value={name} placeholder={t('import.namePlaceholder')} />
  <label class="file-picker">
    <Upload size={16} />
    <span>{fileName || (kind === 'character-card-png' ? t('import.choosePng') : t('import.chooseFile'))}</span>
    <input
      type="file"
      accept={kind === 'character-card-png' ? 'image/png,.png' : kind === 'chat-jsonl' ? '.jsonl,.ndjson,.txt' : '.json,application/json,.txt'}
      on:change={onFileChange}
    />
  </label>
  <button class="secondary full" type="button" on:click={onImport} disabled={!hasPayload}>
    <Download size={16} />{t('common.import')}
  </button>
</div>
