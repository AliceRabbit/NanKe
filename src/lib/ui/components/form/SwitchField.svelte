<script lang="ts">
  import { cn } from '$lib/ui/cn';
  import { Switch } from 'bits-ui';

  type Props = {
    checked?: boolean;
    class?: string;
    description?: string;
    disabled?: boolean;
    label: string;
  };

  let { checked = $bindable(false), class: className = '', description, disabled = false, label }: Props = $props();
</script>

<div class={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--nanke-radius-md)] border border-[var(--nanke-border)] bg-[var(--nanke-surface)] p-3', className)}>
  <div class="min-w-0">
    <div class="text-[13px] font-semibold text-[var(--nanke-ink)]">{label}</div>
    {#if description}
      <p class="mt-1 text-[12px] leading-5 text-[var(--nanke-ink-muted)]">{description}</p>
    {/if}
  </div>
  <Switch.Root
    bind:checked
    {disabled}
    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-[var(--nanke-border-strong)] transition data-[state=checked]:bg-[var(--nanke-accent)] disabled:opacity-50"
  >
    <Switch.Thumb class="block size-5 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[22px]" />
  </Switch.Root>
</div>
