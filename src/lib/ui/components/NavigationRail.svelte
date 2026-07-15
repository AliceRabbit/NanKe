<script lang="ts">
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Bot from '@lucide/svelte/icons/bot';
  import ClipboardList from '@lucide/svelte/icons/clipboard-list';
  import House from '@lucide/svelte/icons/house';
  import Menu from '@lucide/svelte/icons/menu';
  import MessageCircle from '@lucide/svelte/icons/message-circle';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import Monitor from '@lucide/svelte/icons/monitor';
  import Moon from '@lucide/svelte/icons/moon';
  import Settings2 from '@lucide/svelte/icons/settings-2';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import Sun from '@lucide/svelte/icons/sun';
  import UserRound from '@lucide/svelte/icons/user-round';
  import Wrench from '@lucide/svelte/icons/wrench';
  import { t } from '$lib/i18n';
  import RailButton from './RailButton.svelte';

  type Props = {
    activeView: 'home' | 'chat';
    activeDrawer: string | null;
    theme: 'light' | 'dark' | 'system';
    mobileOpen?: boolean;
    onHome: () => void | Promise<void>;
    onChat: () => void | Promise<void>;
    onChats: () => void | Promise<void>;
    onCharacters: () => void | Promise<void>;
    onPersonas: () => void | Promise<void>;
    onWorldBooks: () => void | Promise<void>;
    onProfiles: () => void | Promise<void>;
    onToolbox: () => void | Promise<void>;
    onTheme: () => void;
    onSettings: () => void | Promise<void>;
    onInspector: () => void | Promise<void>;
  };

  let {
    activeView,
    activeDrawer,
    theme,
    mobileOpen = $bindable(false),
    onHome,
    onChat,
    onChats,
    onCharacters,
    onPersonas,
    onWorldBooks,
    onProfiles,
    onToolbox,
    onTheme,
    onSettings,
    onInspector
  }: Props = $props();

  const moreIsActive = $derived(Boolean(activeDrawer && !['chats', 'characters'].includes(activeDrawer)));

  function runAndClose(action: () => void | Promise<void>) {
    mobileOpen = false;
    void action();
  }
</script>

<aside class="rail" aria-label={t('nav.navigation')}>
  <div class="brand" aria-label="NanKe"><img src="/brand/nanke-icon-256.png" alt="" /></div>

  <RailButton label={t('nav.home')} active={activeView === 'home' && !activeDrawer} onActivate={onHome}>
    <House size={20} />
  </RailButton>
  <RailButton label={t('nav.chat')} active={activeView === 'chat' && activeDrawer !== 'chats'} onActivate={onChat}>
    <MessageCircle size={20} />
  </RailButton>
  <RailButton label={t('nav.chatHistory')} active={activeDrawer === 'chats'} onActivate={onChats}>
    <MessageSquare size={20} />
  </RailButton>
  <RailButton label={t('nav.characters')} active={activeDrawer === 'characters'} onActivate={onCharacters}>
    <Bot size={20} />
  </RailButton>

  <div class="rail-divider"></div>

  <RailButton kind="secondary" label={t('nav.personas')} active={activeDrawer === 'personas'} onActivate={onPersonas}>
    <UserRound size={20} />
  </RailButton>
  <RailButton kind="secondary" label={t('nav.worldbooks')} active={activeDrawer === 'worldbooks'} onActivate={onWorldBooks}>
    <BookOpen size={20} />
  </RailButton>
  <RailButton kind="secondary" label={t('nav.profiles')} active={activeDrawer === 'profiles'} onActivate={onProfiles}>
    <Settings2 size={20} />
  </RailButton>
  <RailButton kind="secondary" label={t('nav.toolbox')} active={activeDrawer === 'toolbox'} onActivate={onToolbox}>
    <Wrench size={20} />
  </RailButton>

  <div class="rail-spacer"></div>

  <RailButton kind="secondary" label={t('nav.theme')} onActivate={onTheme}>
    {#if theme === 'light'}<Sun size={20} />{:else if theme === 'dark'}<Moon size={20} />{:else}<Monitor size={20} />{/if}
  </RailButton>
  <RailButton kind="secondary" label={t('nav.settings')} active={activeDrawer === 'settings'} onActivate={onSettings}>
    <SlidersHorizontal size={20} />
  </RailButton>
  <RailButton kind="secondary" label={t('nav.inspector')} active={activeDrawer === 'inspector'} onActivate={onInspector}>
    <ClipboardList size={20} />
  </RailButton>
  <RailButton kind="more" label={t('nav.more')} active={mobileOpen || moreIsActive} expanded={mobileOpen} onActivate={() => { mobileOpen = !mobileOpen; }}>
    <Menu size={20} />
  </RailButton>
</aside>

{#if mobileOpen}
  <button class="mobile-nav-scrim" type="button" aria-label={t('common.close')} onclick={() => (mobileOpen = false)}></button>
  <nav class="mobile-nav-sheet" aria-label={t('nav.more')}>
    <button type="button" class:active={activeDrawer === 'personas'} onclick={() => runAndClose(onPersonas)}><UserRound size={18} /><span>{t('nav.personas')}</span></button>
    <button type="button" class:active={activeDrawer === 'worldbooks'} onclick={() => runAndClose(onWorldBooks)}><BookOpen size={18} /><span>{t('nav.worldbooks')}</span></button>
    <button type="button" class:active={activeDrawer === 'profiles'} onclick={() => runAndClose(onProfiles)}><Settings2 size={18} /><span>{t('nav.profiles')}</span></button>
    <button type="button" class:active={activeDrawer === 'toolbox'} onclick={() => runAndClose(onToolbox)}><Wrench size={18} /><span>{t('nav.toolbox')}</span></button>
    <button type="button" class:active={activeDrawer === 'settings'} onclick={() => runAndClose(onSettings)}><SlidersHorizontal size={18} /><span>{t('nav.settings')}</span></button>
    <button type="button" class:active={activeDrawer === 'inspector'} onclick={() => runAndClose(onInspector)}><ClipboardList size={18} /><span>{t('nav.inspector')}</span></button>
    <button type="button" onclick={() => runAndClose(onTheme)}>
      {#if theme === 'light'}<Sun size={18} />{:else if theme === 'dark'}<Moon size={18} />{:else}<Monitor size={18} />{/if}
      <span>{t('nav.theme')}</span>
    </button>
  </nav>
{/if}

<style>
  .rail {
    position: sticky;
    top: 0;
    z-index: 60;
    display: flex;
    height: 100vh;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    border-right: 1px solid var(--nanke-border-soft);
    background: var(--nanke-surface-acrylic);
    box-shadow: 1px 0 0 rgb(255 255 255 / 28%);
    backdrop-filter: blur(26px) saturate(140%);
    color: var(--nanke-ink);
    padding: 12px 10px;
  }

  .brand {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    overflow: hidden;
    margin-bottom: 6px;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-md);
    background: var(--nanke-surface-raised);
    box-shadow: var(--nanke-shadow-card);
    padding: 3px;
  }

  .brand img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 10px;
    object-fit: cover;
    filter: grayscale(1) contrast(1.04);
  }

  .rail-divider {
    width: 28px;
    height: 1px;
    margin: 2px 0;
    background: var(--nanke-border);
  }

  .rail-spacer {
    flex: 1;
  }

  .mobile-nav-sheet,
  .mobile-nav-scrim {
    display: none;
  }

  @media (max-width: 860px) {
    .rail {
      position: fixed;
      inset: auto 0 0;
      z-index: 80;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      width: 100%;
      height: 68px;
      gap: 2px;
      border-top: 1px solid var(--nanke-border);
      border-right: 0;
      background: var(--nanke-surface-acrylic);
      box-shadow: 0 -14px 34px rgb(24 25 24 / 7%);
      padding: 5px max(8px, env(safe-area-inset-right)) max(5px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
    }

    .brand,
    .rail-divider,
    .rail-spacer {
      display: none;
    }

    .mobile-nav-scrim {
      position: fixed;
      inset: 0 0 68px;
      z-index: 68;
      display: block;
      border: 0;
      background: var(--nanke-overlay);
      backdrop-filter: blur(3px);
    }

    .mobile-nav-sheet {
      position: fixed;
      right: 10px;
      bottom: 76px;
      left: 10px;
      z-index: 75;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
      border: 1px solid var(--nanke-border);
      border-radius: var(--nanke-radius-lg);
      background: var(--nanke-surface-acrylic);
      box-shadow: var(--nanke-shadow-overlay);
      backdrop-filter: blur(26px) saturate(140%);
      padding: 10px;
    }

    .mobile-nav-sheet button {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 46px;
      border: 1px solid transparent;
      border-radius: var(--nanke-radius-sm);
      background: transparent;
      color: var(--nanke-ink-muted);
      padding: 9px 11px;
      text-align: left;
    }

    .mobile-nav-sheet button:hover,
    .mobile-nav-sheet button.active {
      border-color: var(--nanke-border);
      background: var(--nanke-surface-raised);
      color: var(--nanke-ink);
    }
  }
</style>
