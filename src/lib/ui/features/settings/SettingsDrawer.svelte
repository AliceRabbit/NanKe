<script lang="ts">
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Type from '@lucide/svelte/icons/type';
  import { t } from '$lib/i18n';
  import RangeField from '$lib/ui/components/form/RangeField.svelte';
  import { appAvatarShapes, appFontFamilies, type AppSettings } from './app-settings';

  type Props = {
    settings: AppSettings;
    onUpdate: (patch: Partial<AppSettings>) => void;
    onReset: () => void;
  };

  let { settings, onUpdate, onReset }: Props = $props();
</script>

<div class="settings-panel">
  <section class="settings-section" aria-label={t('settings.interfaceTypography')}>
    <div class="settings-section-head">
      <div>
        <strong>{t('settings.typography')}</strong>
        <span>{t('settings.localOnly')}</span>
      </div>
      <Type size={18} />
    </div>

    <div class="font-field">
      <strong>{t('settings.interfaceFontFamily')}</strong>
      <div class="font-choice-grid" aria-label={t('settings.interfaceFontFamily')}>
        {#each appFontFamilies as font}
          <button class:active={settings.fontFamily === font.value} type="button" onclick={() => onUpdate({ fontFamily: font.value })}>
            <strong>{font.label}</strong>
            <span>{font.description}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="font-field">
      <strong>{t('settings.chatFontFamily')}</strong>
      <div class="font-choice-grid" aria-label={t('settings.chatFontFamily')}>
        {#each appFontFamilies as font}
          <button class:active={settings.chatFontFamily === font.value} type="button" onclick={() => onUpdate({ chatFontFamily: font.value })}>
            <strong>{font.label}</strong>
            <span>{font.description}</span>
          </button>
        {/each}
      </div>
    </div>

    <RangeField
      class="settings-range"
      label={t('settings.interfaceSize')}
      valueLabel={`${settings.uiFontSize}px`}
      min="12"
      max="18"
      step="1"
      value={settings.uiFontSize}
      oninput={(event) => onUpdate({ uiFontSize: event.currentTarget.valueAsNumber })}
    />

    <RangeField
      class="settings-range"
      label={t('settings.interfaceWeight')}
      valueLabel={`${settings.fontWeight}`}
      min="350"
      max="650"
      step="25"
      value={settings.fontWeight}
      oninput={(event) => onUpdate({ fontWeight: event.currentTarget.valueAsNumber })}
    />

    <RangeField
      class="settings-range"
      label={t('settings.chatTextSize')}
      valueLabel={`${settings.chatFontSize}px`}
      min="13"
      max="24"
      step="1"
      value={settings.chatFontSize}
      oninput={(event) => onUpdate({ chatFontSize: event.currentTarget.valueAsNumber })}
    />

    <RangeField
      class="settings-range"
      label={t('settings.chatBubbleWidth')}
      valueLabel={`${settings.chatBubbleWidth}px`}
      min="420"
      max="1000"
      step="20"
      value={settings.chatBubbleWidth}
      oninput={(event) => onUpdate({ chatBubbleWidth: event.currentTarget.valueAsNumber })}
    />

    <div class="font-field">
      <strong>{t('settings.avatarShape')}</strong>
      <div class="font-choice-grid" aria-label={t('settings.avatarShape')}>
        {#each appAvatarShapes as shape}
          <button class:active={settings.avatarShape === shape.value} type="button" onclick={() => onUpdate({ avatarShape: shape.value })}>
            <strong>{shape.label}</strong>
            <span>{shape.description}</span>
          </button>
        {/each}
      </div>
    </div>
  </section>

  <button class="secondary full" type="button" onclick={onReset}>
    <RotateCcw size={16} />{t('settings.resetInterface')}
  </button>
</div>
