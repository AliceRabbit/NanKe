<script lang="ts">
  export let tone: 'default' | 'muted' | 'flat' = 'default';
  export let className = '';
</script>

<div class="nk-surface nk-surface--{tone} {className}">
  <slot />
</div>
