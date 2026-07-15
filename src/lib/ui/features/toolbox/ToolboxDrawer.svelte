<script lang="ts">
  import Save from '@lucide/svelte/icons/save';
  import { t } from '$lib/i18n';
  import RegexScriptsEditor from '$lib/ui/components/RegexScriptsEditor.svelte';
  import type { RegexScript } from '$lib/schemas/regex';

  export let enabled: boolean;
  export let scripts: RegexScript[];
  export let saving = false;
  export let status = '';
  export let stats: { active: number; total: number };
  export let regexScriptSurface: (script: RegexScript) => string;
  export let onSave: () => void | Promise<void>;
</script>

<div class="toolbox-panel">
  <section class="toolbox-section" aria-label={t('toolbox.globalRegex')}>
    <div class="toolbox-section-head">
      <div>
        <strong>{t('toolbox.globalRegex')}</strong>
        <span>{t('toolbox.globalRegexDescription')}</span>
      </div>
      <button class="secondary" type="button" on:click={onSave} disabled={saving}>
        <Save size={16} />{saving ? t('common.saving') : t('common.save')}
      </button>
    </div>
    {#if status}
      <span class="toolbox-status">{status}</span>
    {/if}
    <RegexScriptsEditor
      title={t('toolbox.globalRegex')}
      showTitle={false}
      statsLabel={t('toolbox.globalRegexStats', { active: stats.active, total: stats.total })}
      emptyLabel={t('toolbox.noGlobalRegexScripts')}
      bind:enabled
      bind:scripts
      {regexScriptSurface}
    />
  </section>
</div>
