<script lang="ts">
  import { BookOpen, Bot, FileInput, MessageCircle, MessageSquare, Settings2, SquarePen, UserRound } from '@lucide/svelte';
  import { t } from '$lib/i18n';

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

  export let activeProfile: HomeProfile | undefined;
  export let activeCharacter: HomeCharacter | undefined;
  export let activePersona: HomePersona | undefined;
  export let activeCharacterId: string;
  export let worldBookCount: number;
  export let charactersCount: number;
  export let recentConversations: HomeConversation[];
  export let characters: HomeCharacter[];

  export let onOpenProfiles: () => void;
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
  </header>

  <div class="home-workspace">
    <section class="home-overview" aria-label={t('home.overview')}>
      <div class="home-start">
        <span>{t('home.readyLabel')}</span>
        <h1>{activeCharacter ? t('home.readyWithCharacter', { name: activeCharacter.name }) : t('home.readyNoCharacter')}</h1>
        <p>{activePersona?.name ?? t('role.user')} · {activeProfile ? `${activeProfile.provider.type} · ${activeProfile.provider.model}` : t('chat.noProfileSelected')}</p>
        <div class="home-primary-actions">
          <button class="primary" type="button" disabled={!recentConversations.length} on:click={() => recentConversations[0] && onContinueConversation(recentConversations[0].id)}>
            <MessageCircle size={16} />{t('home.continueRecent')}
          </button>
          <button class="secondary" type="button" on:click={onStartNewConversation}>
            <SquarePen size={16} />{t('chat.newChat')}
          </button>
          <button class="secondary" type="button" on:click={onOpenCharacters}>
            <Bot size={16} />{activeCharacter ? t('home.changeCharacter') : t('home.pickCharacter')}
          </button>
        </div>
      </div>

      <div class="home-readiness" aria-label={t('home.currentSetup')}>
        <button type="button" on:click={onOpenCharacters}>
          <Bot size={17} />
          <span>
            <small>{t('common.character')}</small>
            <strong>{activeCharacter?.name ?? t('chat.noCharacter')}</strong>
          </span>
        </button>
        <button type="button" on:click={onOpenPersonas}>
          <UserRound size={17} />
          <span>
            <small>{t('nav.personas')}</small>
            <strong>{activePersona?.name ?? t('role.user')}</strong>
          </span>
        </button>
        <button type="button" on:click={onOpenProfiles}>
          <Settings2 size={17} />
          <span>
            <small>{t('nav.profiles')}</small>
            <strong>{activeProfile?.name ?? t('chat.noProfile')}</strong>
          </span>
        </button>
        <button type="button" on:click={onOpenWorldBooks}>
          <BookOpen size={17} />
          <span>
            <small>{t('nav.worldbooks')}</small>
            <strong>{t('home.worldBookCount', { count: worldBookCount })}</strong>
          </span>
        </button>
      </div>
    </section>

    <div class="home-grid">
      <section class="home-section" aria-label={t('home.recentChats')}>
        <header>
          <div>
            <strong>{t('home.recentChats')}</strong>
            <small>{t('home.recentChatsCount', { count: recentConversations.length })}</small>
          </div>
          <button class="secondary" type="button" on:click={onOpenChats}>
            <MessageSquare size={15} />{t('nav.chatHistory')}
          </button>
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
                <span>
                  <strong>{conversation.title}</strong>
                  <small>{conversationUpdatedLabel(conversation)}</small>
                </span>
                <small>{conversationCharacterName(conversation)} · {conversationPreview(conversation)}</small>
              </span>
            </button>
          {:else}
            <div class="home-empty">
              <MessageCircle size={20} />
              <span>{t('home.noRecentChats')}</span>
            </div>
          {/each}
        </div>
      </section>

      <section class="home-section" aria-label={t('home.characters')}>
        <header>
          <div>
            <strong>{t('home.characters')}</strong>
            <small>{t('home.characterCount', { count: charactersCount })}</small>
          </div>
          <button class="secondary" type="button" on:click={onOpenCharacterImport}>
            <FileInput size={15} />{t('common.import')}
          </button>
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
              <span>
                <strong>{character.name}</strong>
                <small>{characterListLine(character)}</small>
              </span>
            </button>
          {:else}
            <div class="home-empty">
              <Bot size={20} />
              <span>{t('home.noCharacters')}</span>
            </div>
          {/each}
        </div>
      </section>
    </div>
  </div>
</section>

<style>
  .stage {
    min-width: 0;
    height: 100vh;
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
  }

  .home-stage {
    background: var(--nanke-surface);
  }

  .homebar {
    min-height: 72px;
    border-bottom: 1px solid var(--nanke-border);
    padding: 12px 24px;
    background: var(--nanke-surface);
  }

  .home-title {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .home-title span {
    color: inherit;
    font-size: var(--app-text-2xs);
    font-weight: 800;
  }

  .home-title strong {
    color: inherit;
    font-size: var(--app-text-4xl);
    line-height: 1.15;
  }

  .home-title small {
    color: inherit;
    font-size: var(--app-text-sm);
  }

  .home-workspace {
    min-height: 0;
    overflow: auto;
    padding: 24px;
  }

  .home-workspace > * {
    width: min(1120px, 100%);
    margin-inline: auto;
  }

  .home-overview {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
    gap: 24px;
    border-bottom: 1px solid var(--nanke-border);
    padding: 10px 0 24px;
  }

  .home-start {
    display: grid;
    align-content: center;
    gap: 12px;
    min-width: 0;
  }

  .home-start > span {
    color: inherit;
    font-size: var(--app-text-xs);
    font-weight: 900;
  }

  .home-start h1 {
    margin: 0;
    color: inherit;
    font-size: var(--app-text-6xl);
    line-height: 1.18;
    letter-spacing: 0;
    overflow-wrap: anywhere;
  }

  .home-start p {
    margin: 0;
    color: inherit;
    font-size: var(--app-text-md);
    overflow-wrap: anywhere;
  }

  .home-primary-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }

  .primary,
  .secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
    color: var(--nanke-ink);
    padding: 10px 14px;
  }

  .primary:disabled,
  .secondary:disabled {
    cursor: not-allowed;
    opacity: 0.52;
  }

  .secondary {
    border-color: var(--nanke-border);
    background: var(--nanke-surface);
    color: inherit;
  }

  .secondary:hover,
  .secondary:focus-visible {
    border-color: var(--nanke-border-strong);
    outline: 0;
  }

  .secondary:hover,
  .primary:hover {
    filter: brightness(0.98);
  }

  .home-readiness {
    display: grid;
    gap: 8px;
    align-content: start;
    min-width: 0;
  }

  .home-readiness button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 48px;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 8px 10px;
    text-align: left;
  }

  .home-readiness button:hover,
  .home-readiness button:focus-visible {
    border-color: var(--nanke-border-strong);
    background: var(--nanke-surface-muted);
    outline: 0;
  }

  .home-readiness button span {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .home-readiness small,
  .home-readiness strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .home-readiness small {
    color: inherit;
    font-size: var(--app-text-2xs);
  }

  .home-readiness strong {
    font-size: var(--app-text-sm);
  }

  .home-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
    gap: 24px;
    padding-top: 22px;
  }

  .home-section {
    display: grid;
    align-content: start;
    gap: 12px;
    min-width: 0;
  }

  .home-section > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
    border-bottom: 1px solid var(--nanke-border);
    padding-bottom: 10px;
  }

  .home-section > header div {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .home-section > header strong {
    color: inherit;
    font-size: var(--app-text-lg);
  }

  .home-section > header small {
    color: inherit;
    font-size: var(--app-text-xs);
  }

  .home-recent-list,
  .home-character-list {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .home-recent-row,
  .home-character-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-width: 0;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
    padding: 9px;
    text-align: left;
  }

  .home-recent-row:hover,
  .home-recent-row:focus-visible,
  .home-character-row:hover,
  .home-character-row:focus-visible,
  .home-character-row.active {
    border-color: var(--nanke-border-strong);
    background: var(--nanke-surface-muted);
    outline: 0;
  }

  .home-avatar {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    overflow: hidden;
    border: 1px solid var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-field);
    color: inherit;
    font-weight: 800;
  }

  .home-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .home-recent-copy,
  .home-character-row > span:last-child {
    display: grid;
    gap: 2px;
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
    color: inherit;
    font-size: var(--app-text-sm);
  }

  .home-recent-copy small,
  .home-character-row small {
    color: inherit;
    font-size: var(--app-text-xs);
  }

  .home-empty {
    display: grid;
    place-items: center;
    gap: 8px;
    min-height: 116px;
    border: 1px dashed var(--nanke-border);
    border-radius: 8px;
    background: var(--nanke-surface);
    color: inherit;
    font-size: var(--app-text-sm);
    text-align: center;
  }

  @media (max-width: 860px) {
    .homebar {
      padding: 12px;
    }

    .home-workspace {
      padding: 16px 12px;
    }

    .home-overview,
    .home-grid {
      grid-template-columns: 1fr;
      gap: 18px;
    }

    .home-start h1 {
      font-size: var(--app-text-5xl);
    }

    .home-section > header {
      align-items: stretch;
      flex-direction: column;
    }

    .home-section > header .secondary {
      width: 100%;
    }
  }
</style>
