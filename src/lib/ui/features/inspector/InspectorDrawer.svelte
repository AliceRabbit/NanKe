<script lang="ts">
  import ClipboardList from '@lucide/svelte/icons/clipboard-list';
  import { t } from '$lib/i18n';

  type Props = {
    content: string;
    onInspect: () => void | Promise<void>;
  };

  let { content, onInspect }: Props = $props();
</script>

<div class="inspector-panel">
  <button class="secondary full" type="button" onclick={onInspect}>
    <ClipboardList size={16} />{t('inspector.inspect')}
  </button>
  <pre>{content}</pre>
</div>
