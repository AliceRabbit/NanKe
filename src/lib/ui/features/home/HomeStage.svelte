<script lang="ts">
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Bot from '@lucide/svelte/icons/bot';
  import FileInput from '@lucide/svelte/icons/file-input';
  import MessageCircle from '@lucide/svelte/icons/message-circle';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Settings2 from '@lucide/svelte/icons/settings-2';
  import SquarePen from '@lucide/svelte/icons/square-pen';
  import UserRound from '@lucide/svelte/icons/user-round';
  import { t } from '$lib/i18n';
  import Button from '$lib/ui/components/Button.svelte';
  import IconButton from '$lib/ui/components/IconButton.svelte';

  type HomeProfile = {
    name: string;
    provider: {
      type: string;
      model: string;
    };
  };

  type HomePersona = {
    name: string;
  };

  type HomeCharacter = {
    id: string;
    name: string;
  };

  type HomeConversation = {
    id: string;
    title: string;
  };

  export let status: string;
  export let activeProfile: HomeProfile | undefined;
  export let activeCharacter: HomeCharacter | undefined;
  export let activePersona: HomePersona | undefined;
  export let activeCharacterId: string;
  export let worldBookCount: number;
  export let charactersCount: number;
  export let recentConversations: HomeConversation[];
  export let characters: HomeCharacter[];

  export let onOpenProfiles: () => void;
  export let onRefresh: () => void | Promise<void>;
  export let onContinueConversation: (id: string) => void | Promise<void>;
  export let onStartNewConversation: () => void | Promise<void>;
  export let onOpenCharacters: () => void;
  export let onOpenPersonas: () => void;
  export let onOpenWorldBooks: () => void;
  export let onOpenChats: () => void;
  export let onOpenCharacterImport: () => void;
  export let onStartChatWithCharacter: (character: HomeCharacter) => void | Promise<void>;

  export let conversationAvatarUrl: (conversation: HomeConversation) => string;
  export let conversationCharacterName: (conversation: HomeConversation) => string;
  export let conversationPreview: (conversation: HomeConversation) => string;
  export let conversationUpdatedLabel: (conversation: HomeConversation) => string;
  export let characterAvatarUrl: (character: HomeCharacter) => string;
  export let characterInitials: (character: HomeCharacter) => string;
  export let characterListLine: (character: HomeCharacter) => string;
</script>

<section class="stage home-stage" aria-label={t('home.workspace')}>
  <header class="homebar">
    <div class="home-title">
      <span>{t('home.kicker')}</span>
      <strong>NanKe</strong>
      <small>{t('home.subtitle')}</small>
    </div>
    <div class="homebar-actions">
      <button class="context-chip profile" type="button" on:click={onOpenProfiles}>
        <Settings2 size={15} />
        <span>{activeProfile ? `${activeProfile.name} · ${activeProfile.provider.model}` : t('chat.noProfile')}</span>
      </button>
      <span class="status-pill"><i></i>{status}</span>
      <IconButton ariaLabel={t('common.refresh')} title={t('common.refresh')} on:click={onRefresh}>
        <RefreshCw size={17} />
      </IconButton>
    </div>
  </header>

  <div class="home-workspace">
    <section class="home-overview" aria-label={t('home.overview')}>
      <div class="home-hero">
        <div class="home-start">
          <span>{t('home.readyLabel')}</span>
          <h1>{activeCharacter ? t('home.readyWithCharacter', { name: activeCharacter.name }) : t('home.readyNoCharacter')}</h1>
          <p>{activePersona?.name ?? t('role.user')} · {activeProfile ? `${activeProfile.provider.type} · ${activeProfile.provider.model}` : t('chat.noProfileSelected')}</p>
          <div class="home-primary-actions">
            <Button variant="primary" size="lg" disabled={!recentConversations.length} on:click={() => recentConversations[0] && onContinueConversation(recentConversations[0].id)}>
              <MessageCircle size={17} />{t('home.continueRecent')}
            </Button>
            <Button variant="secondary" size="lg" on:click={onStartNewConversation}>
              <SquarePen size={17} />{t('chat.newChat')}
            </Button>
            <Button variant="ghost" size="lg" on:click={onOpenCharacters}>
              <Bot size={17} />{activeCharacter ? t('home.changeCharacter') : t('home.pickCharacter')}
            </Button>
          </div>
        </div>

        <div class="home-hero-visual" aria-hidden="true">
          <div class="home-hero-orbit orbit-one"></div>
          <div class="home-hero-orbit orbit-two"></div>
          <div class="home-hero-avatar">
            {#if activeCharacter && characterAvatarUrl(activeCharacter)}
              <img src={characterAvatarUrl(activeCharacter)} alt="" />
            {:else if activeCharacter}
              <span>{characterInitials(activeCharacter)}</span>
            {:else}
              <Bot size={42} />
            {/if}
          </div>
          <div class="home-hero-caption">
            <small>{t('common.character')}</small>
            <strong>{activeCharacter?.name ?? t('chat.noCharacter')}</strong>
          </div>
        </div>
      </div>

      <div class="home-readiness" aria-label={t('home.currentSetup')}>
        <button type="button" on:click={onOpenCharacters}>
          <Bot size={17} />
          <span><small>{t('common.character')}</small><strong>{activeCharacter?.name ?? t('chat.noCharacter')}</strong></span>
        </button>
        <button type="button" on:click={onOpenPersonas}>
          <UserRound size={17} />
          <span><small>{t('nav.personas')}</small><strong>{activePersona?.name ?? t('role.user')}</strong></span>
        </button>
        <button type="button" on:click={onOpenProfiles}>
          <Settings2 size={17} />
          <span><small>{t('nav.profiles')}</small><strong>{activeProfile?.name ?? t('chat.noProfile')}</strong></span>
        </button>
        <button type="button" on:click={onOpenWorldBooks}>
          <BookOpen size={17} />
          <span><small>{t('nav.worldbooks')}</small><strong>{t('home.worldBookCount', { count: worldBookCount })}</strong></span>
        </button>
      </div>
    </section>

    <div class="home-grid">
      <section class="home-section" aria-label={t('home.recentChats')}>
        <header>
          <div><strong>{t('home.recentChats')}</strong><small>{t('home.recentChatsCount', { count: recentConversations.length })}</small></div>
          <Button variant="ghost" size="sm" on:click={onOpenChats}><MessageSquare size={15} />{t('nav.chatHistory')}</Button>
        </header>

        <div class="home-recent-list">
          {#each recentConversations as conversation}
            <button class="home-recent-row" type="button" on:click={() => onContinueConversation(conversation.id)}>
              <span class="home-avatar">
                {#if conversationAvatarUrl(conversation)}
                  <img src={conversationAvatarUrl(conversation)} alt={t('chat.avatarAlt', { name: conversationCharacterName(conversation) })} />
                {:else}
                  <MessageCircle size={16} />
                {/if}
              </span>
              <span class="home-recent-copy">
                <span><strong>{conversation.title}</strong><small>{conversationUpdatedLabel(conversation)}</small></span>
                <small>{conversationCharacterName(conversation)} · {conversationPreview(conversation)}</small>
              </span>
              <span class="home-row-arrow">→</span>
            </button>
          {:else}
            <div class="home-empty"><MessageCircle size={20} /><span>{t('home.noRecentChats')}</span></div>
          {/each}
        </div>
      </section>

      <section class="home-section" aria-label={t('home.characters')}>
        <header>
          <div><strong>{t('home.characters')}</strong><small>{t('home.characterCount', { count: charactersCount })}</small></div>
          <Button variant="ghost" size="sm" on:click={onOpenCharacterImport}><FileInput size={15} />{t('common.import')}</Button>
        </header>

        <div class="home-character-list">
          {#each characters as character}
            <button class="home-character-row" class:active={character.id === activeCharacterId} type="button" on:click={() => onStartChatWithCharacter(character)}>
              <span class="home-avatar">
                {#if characterAvatarUrl(character)}
                  <img src={characterAvatarUrl(character)} alt={t('chat.avatarAlt', { name: character.name })} />
                {:else}
                  <span>{characterInitials(character)}</span>
                {/if}
              </span>
              <span><strong>{character.name}</strong><small>{characterListLine(character)}</small></span>
              <span class="home-row-arrow">→</span>
            </button>
          {:else}
            <div class="home-empty"><Bot size={20} /><span>{t('home.noCharacters')}</span></div>
          {/each}
        </div>
      </section>
    </div>
  </div>
</section>

<style>
  .stage {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 100vh;
    height: 100vh;
    overflow: hidden;
  }

  .home-stage {
    background: transparent;
  }

  .homebar {
    position: relative;
    z-index: 3;
    display: grid;
    grid-template-columns: minmax(220px, 1fr) auto;
    align-items: center;
    gap: var(--nanke-space-4);
    min-height: 76px;
    border-bottom: 1px solid var(--nanke-border-soft);
    padding: 12px 28px;
    background: var(--nanke-surface-acrylic);
    backdrop-filter: blur(24px) saturate(140%);
  }

  .home-title {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .home-title > span {
    color: var(--nanke-ink-muted);
    font-size: var(--app-text-2xs);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .home-title strong {
    font-family: var(--nanke-font-serif);
    font-size: var(--app-text-4xl);
    line-height: 1.08;
    letter-spacing: -0.02em;
  }

  .home-title small {
    color: var(--nanke-ink-muted);
    font-size: var(--app-text-xs);
  }

  .homebar-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--nanke-space-2);
    min-width: 0;
  }

  .context-chip,
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    min-height: 40px;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-sm);
    background: var(--nanke-surface-raised);
    color: var(--nanke-ink);
    box-shadow: var(--nanke-shadow-field);
    padding: 8px 11px;
    font-size: var(--app-text-sm);
    text-align: left;
  }

  .context-chip span,
  .status-pill {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .context-chip:hover,
  .context-chip:focus-visible {
    border-color: var(--nanke-border-strong);
    box-shadow: var(--nanke-shadow-card);
    outline: 0;
  }

  .status-pill {
    justify-content: center;
    min-width: 76px;
    background: var(--nanke-surface-muted);
    color: var(--nanke-ink-muted);
    box-shadow: none;
    font-weight: 700;
  }

  .status-pill i {
    width: 7px;
    height: 7px;
    border-radius: var(--nanke-radius-full);
    background: var(--nanke-success);
    box-shadow: 0 0 0 3px var(--nanke-success-soft);
  }

  .home-workspace {
    min-height: 0;
    overflow: auto;
    padding: 32px 32px 56px;
    scrollbar-gutter: stable;
  }

  .home-workspace > * {
    width: min(1180px, 100%);
    margin-inline: auto;
  }

  .home-overview {
    display: grid;
    gap: var(--nanke-space-4);
  }

  .home-hero {
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
    min-height: 360px;
    overflow: hidden;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-xl);
    background:
      linear-gradient(135deg, var(--nanke-surface-raised), var(--nanke-surface) 54%, var(--nanke-surface-muted));
    box-shadow: var(--nanke-shadow-card);
  }

  .home-hero::before {
    position: absolute;
    inset: 0;
    z-index: -1;
    background-image: radial-gradient(var(--nanke-border-strong) 0.7px, transparent 0.7px);
    background-size: 18px 18px;
    mask-image: linear-gradient(90deg, transparent 24%, #000 100%);
    opacity: 0.34;
    content: '';
  }

  .home-start {
    display: grid;
    align-content: center;
    gap: var(--nanke-space-3);
    min-width: 0;
    padding: clamp(32px, 6vw, 72px);
  }

  .home-start > span {
    color: var(--nanke-ink-muted);
    font-size: var(--app-text-xs);
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .home-start h1 {
    max-width: 760px;
    margin: 0;
    color: var(--nanke-ink);
    font-family: var(--nanke-font-serif);
    font-size: clamp(30px, 4.3vw, 54px);
    font-weight: 700;
    line-height: 1.18;
    letter-spacing: -0.035em;
    overflow-wrap: anywhere;
  }

  .home-start p {
    margin: 0;
    color: var(--nanke-ink-muted);
    font-size: var(--app-text-md);
    overflow-wrap: anywhere;
  }

  .home-primary-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nanke-space-2);
    margin-top: var(--nanke-space-2);
  }

  .home-hero-visual {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 320px;
    padding: 40px;
  }

  .home-hero-avatar {
    position: relative;
    z-index: 2;
    display: grid;
    place-items: center;
    width: clamp(150px, 16vw, 210px);
    aspect-ratio: 0.82;
    overflow: hidden;
    border: 8px solid color-mix(in srgb, var(--nanke-surface-raised) 86%, transparent);
    border-radius: 46% 46% 22% 22%;
    background: var(--nanke-surface-subtle);
    box-shadow: var(--nanke-shadow-overlay);
    color: var(--nanke-ink-muted);
  }

  .home-hero-avatar img,
  .home-hero-avatar span {
    width: 100%;
    height: 100%;
  }

  .home-hero-avatar img {
    object-fit: cover;
    object-position: center top;
    filter: saturate(0.9) contrast(1.02);
  }

  .home-hero-avatar span {
    display: grid;
    place-items: center;
    font-family: var(--nanke-font-serif);
    font-size: 42px;
    font-weight: 800;
  }

  .home-hero-orbit {
    position: absolute;
    border: 1px solid var(--nanke-border-strong);
    border-radius: 50%;
  }

  .orbit-one {
    width: 270px;
    height: 270px;
    transform: rotate(-18deg) scaleY(0.58);
  }

  .orbit-two {
    width: 340px;
    height: 340px;
    border-style: dashed;
    opacity: 0.48;
    transform: rotate(24deg) scaleY(0.52);
  }

  .home-hero-caption {
    position: absolute;
    right: 28px;
    bottom: 28px;
    z-index: 3;
    display: grid;
    max-width: 220px;
    gap: 2px;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-md);
    background: var(--nanke-surface-acrylic);
    box-shadow: var(--nanke-shadow-card);
    backdrop-filter: blur(14px);
    padding: 10px 13px;
  }

  .home-hero-caption small,
  .home-hero-caption strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .home-hero-caption small {
    color: var(--nanke-ink-muted);
    font-size: var(--app-text-2xs);
  }

  .home-hero-caption strong {
    font-size: var(--app-text-sm);
  }

  .home-readiness {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--nanke-space-2);
    padding: 0 var(--nanke-space-2);
  }

  .home-readiness button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 64px;
    border: 1px solid var(--nanke-border-soft);
    border-radius: var(--nanke-radius-md);
    background: color-mix(in srgb, var(--nanke-surface) 76%, transparent);
    color: var(--nanke-ink);
    padding: 10px 12px;
    text-align: left;
    transition:
      transform var(--nanke-duration-fast) var(--nanke-ease-standard),
      border-color var(--nanke-duration) var(--nanke-ease-standard),
      background-color var(--nanke-duration) var(--nanke-ease-standard);
  }

  .home-readiness button:hover,
  .home-readiness button:focus-visible {
    border-color: var(--nanke-border-strong);
    background: var(--nanke-surface-raised);
    transform: translateY(-1px);
    outline: 0;
  }

  .home-readiness button span {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .home-readiness small,
  .home-readiness strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .home-readiness small {
    color: var(--nanke-ink-muted);
    font-size: var(--app-text-2xs);
  }

  .home-readiness strong {
    font-size: var(--app-text-sm);
  }

  .home-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
    gap: var(--nanke-space-4);
    margin-top: var(--nanke-space-8);
  }

  .home-section {
    display: grid;
    align-content: start;
    gap: var(--nanke-space-3);
    min-width: 0;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-lg);
    background: var(--nanke-surface);
    box-shadow: var(--nanke-shadow-card);
    padding: var(--nanke-space-4);
  }

  .home-section > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nanke-space-3);
    min-width: 0;
    padding: 2px 2px 10px;
  }

  .home-section > header div {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .home-section > header strong {
    font-size: var(--app-text-lg);
  }

  .home-section > header small {
    color: var(--nanke-ink-muted);
    font-size: var(--app-text-xs);
  }

  .home-recent-list,
  .home-character-list {
    display: grid;
    gap: var(--nanke-space-2);
    min-width: 0;
  }

  .home-recent-row,
  .home-character-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 11px;
    min-width: 0;
    border: 1px solid transparent;
    border-radius: var(--nanke-radius-md);
    background: transparent;
    color: var(--nanke-ink);
    padding: 10px;
    text-align: left;
    transition:
      transform var(--nanke-duration-fast) var(--nanke-ease-standard),
      border-color var(--nanke-duration) var(--nanke-ease-standard),
      background-color var(--nanke-duration) var(--nanke-ease-standard),
      box-shadow var(--nanke-duration) var(--nanke-ease-standard);
  }

  .home-recent-row:hover,
  .home-recent-row:focus-visible,
  .home-character-row:hover,
  .home-character-row:focus-visible,
  .home-character-row.active {
    border-color: var(--nanke-border);
    background: var(--nanke-surface-raised);
    box-shadow: var(--nanke-shadow-card);
    transform: translateY(-1px);
    outline: 0;
  }

  .home-avatar {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    overflow: hidden;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-sm);
    background: var(--nanke-surface-subtle);
    color: var(--nanke-ink-muted);
    font-weight: 800;
  }

  .home-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .home-recent-copy,
  .home-character-row > span:nth-child(2) {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .home-recent-copy > span {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }

  .home-recent-copy strong,
  .home-recent-copy small,
  .home-character-row strong,
  .home-character-row small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .home-recent-copy strong,
  .home-character-row strong {
    font-size: var(--app-text-sm);
  }

  .home-recent-copy small,
  .home-character-row small {
    color: var(--nanke-ink-muted);
    font-size: var(--app-text-xs);
  }

  .home-row-arrow {
    color: var(--nanke-ink-subtle);
    font-size: 18px;
    opacity: 0;
    transform: translateX(-4px);
    transition:
      opacity var(--nanke-duration) var(--nanke-ease-standard),
      transform var(--nanke-duration) var(--nanke-ease-standard);
  }

  .home-recent-row:hover .home-row-arrow,
  .home-character-row:hover .home-row-arrow,
  .home-character-row.active .home-row-arrow {
    opacity: 1;
    transform: translateX(0);
  }

  .home-empty {
    display: grid;
    place-items: center;
    gap: var(--nanke-space-2);
    min-height: 128px;
    border: 1px dashed var(--nanke-border-strong);
    border-radius: var(--nanke-radius-md);
    background: var(--nanke-surface-muted);
    color: var(--nanke-ink-muted);
    font-size: var(--app-text-sm);
    text-align: center;
  }

  @media (max-width: 980px) {
    .home-hero {
      grid-template-columns: minmax(0, 1fr) minmax(220px, 0.58fr);
    }

    .home-start {
      padding: 40px;
    }

    .home-readiness {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 860px) {
    .stage {
      min-height: calc(100svh - 68px);
      height: calc(100svh - 68px);
    }

    .homebar {
      grid-template-columns: minmax(0, 1fr) auto;
      min-height: 68px;
      padding: 9px 14px;
    }

    .home-title small,
    .homebar-actions .context-chip,
    .homebar-actions .status-pill {
      display: none;
    }

    .home-workspace {
      padding: 14px 12px 32px;
    }

    .home-hero {
      grid-template-columns: 1fr;
      min-height: 0;
    }

    .home-start {
      padding: 32px 24px 20px;
    }

    .home-start h1 {
      font-size: clamp(28px, 8.5vw, 42px);
    }

    .home-hero-visual {
      min-height: 230px;
      padding: 18px 24px 32px;
    }

    .home-hero-avatar {
      width: 128px;
      border-width: 6px;
    }

    .orbit-one {
      width: 190px;
      height: 190px;
    }

    .orbit-two {
      width: 240px;
      height: 240px;
    }

    .home-hero-caption {
      right: 18px;
      bottom: 18px;
      max-width: 170px;
    }

    .home-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 560px) {
    .home-primary-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .home-primary-actions :global(.nk-button:first-child) {
      grid-column: 1 / -1;
    }

    .home-readiness {
      grid-template-columns: 1fr 1fr;
      padding-inline: 0;
    }

    .home-readiness button {
      min-height: 58px;
    }

    .home-section {
      border-radius: var(--nanke-radius-md);
      padding: var(--nanke-space-3);
    }
  }
</style>
