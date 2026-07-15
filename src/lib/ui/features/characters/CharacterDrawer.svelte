<script lang="ts">
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Copy from '@lucide/svelte/icons/copy';
  import FileInput from '@lucide/svelte/icons/file-input';
  import Image from '@lucide/svelte/icons/image';
  import MessageCircle from '@lucide/svelte/icons/message-circle';
  import Plus from '@lucide/svelte/icons/plus';
  import Power from '@lucide/svelte/icons/power';
  import PowerOff from '@lucide/svelte/icons/power-off';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Save from '@lucide/svelte/icons/save';
  import Star from '@lucide/svelte/icons/star';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Unlink from '@lucide/svelte/icons/unlink';
  import { t } from '$lib/i18n';
  import type { Character, CharacterWorldBookBinding } from '$lib/schemas/character';
  import type { WorldBook } from '$lib/schemas/worldbook';

  type Drawer = 'chats' | 'characters' | 'personas' | 'worldbooks' | 'profiles' | 'toolbox' | 'settings' | 'import' | 'inspector' | null;
  type CharacterSortMode = 'favorite' | 'name-asc' | 'name-desc' | 'newest' | 'oldest' | 'tokens-desc';
  type CharacterEditorTab = 'core' | 'prompt' | 'lore' | 'metadata';
  type CharacterPanelMode = 'edit' | 'create';
  type CharacterStats = { tokens: number; worldBooks: number; tags: number; greetings: number; overrides: number };
  type CharacterCreateStats = Omit<CharacterStats, 'worldBooks'>;

  const characterSortModes: Array<{ value: CharacterSortMode; label: string }> = [
    { value: 'favorite', label: t('sort.favorites') },
    { value: 'name-asc', label: t('sort.nameAsc') },
    { value: 'name-desc', label: t('sort.nameDesc') },
    { value: 'newest', label: t('sort.newest') },
    { value: 'oldest', label: t('sort.oldest') },
    { value: 'tokens-desc', label: t('sort.mostTokens') }
  ];

  export let newCharacterName = '';
  export let newCharacterDescription = '';
  export let newCharacterPersonality = '';
  export let newCharacterScenario = '';
  export let newCharacterFirstMessage = '';
  export let newCharacterAlternateGreetings = '';
  export let newCharacterExampleMessages = '';
  export let newCharacterSystemPrompt = '';
  export let newCharacterPostHistoryInstructions = '';
  export let newCharacterCreatorNotes = '';
  export let newCharacterTags = '';
  export let newCharacterCreator = '';
  export let newCharacterCharacterVersion = '';
  export let newCharacterTalkativeness = '';
  export let newCharacterFavorite = false;
  export let characterQuery = '';
  export let characterSortMode: CharacterSortMode = 'favorite';
  export let characterPanelMode: CharacterPanelMode = 'edit';
  export let characterEditorTab: CharacterEditorTab = 'core';
  export let characterDraftName = '';
  export let characterDraftDescription = '';
  export let characterDraftPersonality = '';
  export let characterDraftScenario = '';
  export let characterDraftFirstMessage = '';
  export let characterDraftAlternateGreetings = '';
  export let characterDraftExampleMessages = '';
  export let characterDraftSystemPrompt = '';
  export let characterDraftPostHistoryInstructions = '';
  export let characterDraftCreatorNotes = '';
  export let characterDraftTags = '';
  export let characterDraftCreator = '';
  export let characterDraftCharacterVersion = '';
  export let characterDraftTalkativeness = '';
  export let characterDraftFavorite = false;
  export let activeCharacterId = '';
  export let activeWorldBookId = '';
  export let activeDrawer: Drawer = null;
  export let worldBookBindingCharacterId = '';

  export let filteredCharacters: Character[] = [];
  export let activeCharacter: Character | undefined = undefined;
  export let activeCharacterWorldBooks: WorldBook[] = [];
  export let activeCharacterStats: CharacterStats = { tokens: 0, worldBooks: 0, tags: 0, greetings: 0, overrides: 0 };
  export let createCharacterStats: CharacterCreateStats = { tokens: 0, tags: 0, greetings: 1, overrides: 0 };

  export let startCharacterCreate: () => void;
  export let openCharacterImport: () => void;
  export let characterAvatarUrl: (character?: Character) => string;
  export let characterInitials: (character?: Character) => string;
  export let characterListLine: (character: Character) => string;
  export let selectCharacter: (character: Character) => void;
  export let toggleCharacterFavorite: (character?: Character) => void | Promise<void>;
  export let createCharacter: () => void | Promise<void>;
  export let resetNewCharacterDraft: () => void;
  export let saveActiveCharacter: () => void | Promise<void>;
  export let openCharacterAvatar: (character?: Character) => void;
  export let characterOrigin: (character?: Character) => string;
  export let startChatWithCharacter: (character?: Character) => void | Promise<void>;
  export let duplicateActiveCharacter: () => void | Promise<void>;
  export let deleteActiveCharacter: () => void;
  export let openCharacterWorldBooks: (character?: Character) => void;
  export let worldBookBindingForCharacter: (character: Character | undefined, worldBookId: string) => CharacterWorldBookBinding | undefined;
  export let metadataSourceLabel: (source?: string) => string;
  export let setWorldBookBindingEnabled: (character: Character | undefined, worldBook: WorldBook | undefined, enabled: boolean) => void | Promise<void>;
  export let unbindWorldBookFromCharacter: (character: Character | undefined, worldBook: WorldBook | undefined) => void | Promise<void>;
</script>

<div class="character-workspace">
  <section class="character-library" aria-label={t('character.library')}>
    <div class="character-library-actions">
      <button class="primary" type="button" on:click={startCharacterCreate}>
        <Plus size={16} />{t('common.new')}
      </button>
      <button class="secondary" type="button" on:click={openCharacterImport}>
        <FileInput size={16} />{t('common.import')}
      </button>
    </div>

    <div class="character-toolbar">
      <input class="profile-search" bind:value={characterQuery} placeholder={t('character.search')} aria-label={t('character.search')} />
      <select bind:value={characterSortMode} aria-label={t('character.sort')}>
        {#each characterSortModes as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>

    <div class="character-list" aria-label={t('nav.characters')}>
      {#each filteredCharacters as character}
        <article class="character-row" class:active={character.id === activeCharacterId}>
          <button class="character-row-main" type="button" on:click={() => selectCharacter(character)}>
            <span class="character-avatar-small">
              {#if characterAvatarUrl(character)}
                <img src={characterAvatarUrl(character)} alt={t('chat.avatarAlt', { name: character.name })} />
              {:else}
                <span>{characterInitials(character)}</span>
              {/if}
            </span>
            <span class="character-row-copy">
              <strong>{character.name}</strong>
              <small>{characterListLine(character)}</small>
            </span>
          </button>
          <button
            class="favorite-button"
            class:active={character.favorite}
            type="button"
            on:click={() => toggleCharacterFavorite(character)}
            title={character.favorite ? t('character.unfavorite') : t('common.favorite')}
            aria-label={`${character.favorite ? t('character.unfavorite') : t('common.favorite')} ${character.name}`}
          >
            <Star size={15} fill={character.favorite ? 'currentColor' : 'none'} />
          </button>
        </article>
      {:else}
        <div class="drawer-empty compact">{t('character.noMatching')}</div>
      {/each}
    </div>
  </section>

  {#if characterPanelMode === 'create'}
    <form class="character-editor character-editor-create" on:submit|preventDefault={createCharacter}>
      <header class="character-editor-hero">
        <div class="character-avatar-large placeholder-avatar" aria-hidden="true">
          <Image size={28} />
        </div>

        <div class="character-hero-copy">
          <div class="character-hero-title">
            <div>
              <strong>{newCharacterName.trim() || t('character.newCharacter')}</strong>
              <span>{t('character.newDraft')}</span>
            </div>
            <button
              class="favorite-button hero-favorite"
              class:active={newCharacterFavorite}
              type="button"
              on:click={() => (newCharacterFavorite = !newCharacterFavorite)}
              title={newCharacterFavorite ? t('character.unfavorite') : t('common.favorite')}
              aria-label={t('character.toggleFavorite')}
            >
              <Star size={16} fill={newCharacterFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div class="character-chips" aria-label={t('character.statsNew')}>
            <span>{t('character.tokens', { count: createCharacterStats.tokens })}</span>
            <span>{t('character.greetings', { count: createCharacterStats.greetings })}</span>
            <span>{t('character.tagsCount', { count: createCharacterStats.tags })}</span>
            {#if createCharacterStats.overrides}
              <span>{t('character.overrides', { count: createCharacterStats.overrides })}</span>
            {/if}
          </div>
        </div>

        <div class="character-actions">
          <button class="tool-button" type="button" on:click={openCharacterImport} title={t('character.importCard')} aria-label={t('character.importCard')}>
            <FileInput size={16} />
          </button>
          <button class="tool-button" type="button" on:click={resetNewCharacterDraft} title={t('character.resetDraft')} aria-label={t('character.resetDraft')}>
            <RotateCcw size={16} />
          </button>
          <button class="tool-button" type="submit" title={t('character.create')} aria-label={t('character.create')} disabled={!newCharacterName.trim()}>
            <Save size={16} />
          </button>
        </div>
      </header>

      <nav class="character-tabs" aria-label={t('character.newSections')}>
        <button class:active={characterEditorTab === 'core'} type="button" on:click={() => (characterEditorTab = 'core')}>{t('character.tab.core')}</button>
        <button class:active={characterEditorTab === 'prompt'} type="button" on:click={() => (characterEditorTab = 'prompt')}>{t('character.tab.prompt')}</button>
        <button class:active={characterEditorTab === 'lore'} type="button" on:click={() => (characterEditorTab = 'lore')}>{t('character.tab.lore')}</button>
        <button class:active={characterEditorTab === 'metadata'} type="button" on:click={() => (characterEditorTab = 'metadata')}>{t('character.tab.metadata')}</button>
      </nav>

      {#if characterEditorTab === 'core'}
        <section class="character-editor-section">
          <div class="character-field-grid">
            <label>
              <span>{t('common.name')}</span>
              <input bind:value={newCharacterName} placeholder={t('character.placeholder.name')} />
            </label>
            <label>
              <span>{t('common.tags')}</span>
              <input bind:value={newCharacterTags} placeholder={t('character.placeholder.tags')} />
            </label>
            <label class="span-2">
              <span>{t('character.description')}</span>
              <textarea bind:value={newCharacterDescription} rows="8" placeholder={t('character.placeholder.description')}></textarea>
            </label>
            <label>
              <span>{t('character.personality')}</span>
              <textarea bind:value={newCharacterPersonality} rows="5" placeholder={t('character.placeholder.personality')}></textarea>
            </label>
            <label>
              <span>{t('character.scenario')}</span>
              <textarea bind:value={newCharacterScenario} rows="5" placeholder={t('character.placeholder.scenario')}></textarea>
            </label>
            <label class="span-2">
              <span>{t('character.firstMessage')}</span>
              <textarea bind:value={newCharacterFirstMessage} rows="6" placeholder={t('character.placeholder.firstMessage')}></textarea>
            </label>
            <label class="span-2">
              <span>{t('character.alternateGreetings')}</span>
              <textarea bind:value={newCharacterAlternateGreetings} rows="5" placeholder={t('character.placeholder.alternateGreetings')}></textarea>
            </label>
          </div>
        </section>
      {:else if characterEditorTab === 'prompt'}
        <section class="character-editor-section">
          <div class="character-field-grid">
            <label class="span-2">
              <span>{t('character.systemPromptOverride')}</span>
              <textarea bind:value={newCharacterSystemPrompt} rows="7" placeholder={t('character.placeholder.systemPrompt')}></textarea>
            </label>
            <label class="span-2">
              <span>{t('character.postHistoryInstructions')}</span>
              <textarea bind:value={newCharacterPostHistoryInstructions} rows="7" placeholder={t('character.placeholder.postHistory')}></textarea>
            </label>
            <label class="span-2">
              <span>{t('character.exampleMessages')}</span>
              <textarea bind:value={newCharacterExampleMessages} rows="9" placeholder={t('character.placeholder.exampleMessages')}></textarea>
            </label>
          </div>
        </section>
      {:else if characterEditorTab === 'lore'}
        <section class="character-editor-section">
          <div class="character-lore-header">
            <div>
              <strong>{t('character.lore')}</strong>
              <span>{t('character.boundWorldBooks', { count: 0 })}</span>
            </div>
            <button class="secondary" type="button" on:click={openCharacterImport}>
              <FileInput size={16} />{t('common.import')}
            </button>
          </div>

          <label class="character-textarea-label">
            <span>{t('character.creatorNotes')}</span>
            <textarea bind:value={newCharacterCreatorNotes} rows="8" placeholder={t('character.placeholder.creatorNotes')}></textarea>
          </label>
        </section>
      {:else}
        <section class="character-editor-section">
          <div class="character-field-grid">
            <label>
              <span>{t('character.creator')}</span>
              <input bind:value={newCharacterCreator} placeholder={t('character.creator')} />
            </label>
            <label>
              <span>{t('common.version')}</span>
              <input bind:value={newCharacterCharacterVersion} placeholder={t('character.characterVersion')} />
            </label>
            <label>
              <span>{t('character.talkativeness')}</span>
              <input bind:value={newCharacterTalkativeness} inputmode="decimal" placeholder={t('common.optional')} />
            </label>
            <div class="character-source-panel">
              <span>{t('character.cardSource')}</span>
              <strong>{t('character.nativeDraft')}</strong>
              <small>{t('character.newCharacter')}</small>
            </div>
          </div>
        </section>
      {/if}
    </form>
  {:else if activeCharacter}
    <form class="character-editor" on:submit|preventDefault={saveActiveCharacter}>
      <header class="character-editor-hero">
        <button class="character-avatar-large" type="button" on:click={() => openCharacterAvatar(activeCharacter)} title={t('character.openAvatarPreview')} aria-label={t('chat.openAvatar', { name: activeCharacter.name })}>
          {#if characterAvatarUrl(activeCharacter)}
            <img src={characterAvatarUrl(activeCharacter)} alt={t('chat.avatarAlt', { name: activeCharacter.name })} />
          {:else}
            <span>{characterInitials(activeCharacter)}</span>
          {/if}
        </button>

        <div class="character-hero-copy">
          <div class="character-hero-title">
            <div>
              <strong>{activeCharacter.name}</strong>
              <span>{characterOrigin(activeCharacter)}</span>
            </div>
            <button
              class="favorite-button hero-favorite"
              class:active={characterDraftFavorite}
              type="button"
              on:click={() => (characterDraftFavorite = !characterDraftFavorite)}
              title={characterDraftFavorite ? t('character.unfavoriteOnSave') : t('character.favoriteOnSave')}
              aria-label={t('character.toggleFavorite')}
            >
              <Star size={16} fill={characterDraftFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div class="character-chips" aria-label={t('character.stats')}>
            <span>{t('character.tokens', { count: activeCharacterStats.tokens })}</span>
            <span>{t('character.greetings', { count: activeCharacterStats.greetings })}</span>
            <span>{t('character.loreCount', { count: activeCharacterStats.worldBooks })}</span>
            <span>{t('character.tagsCount', { count: activeCharacterStats.tags })}</span>
            {#if activeCharacterStats.overrides}
              <span>{t('character.overrides', { count: activeCharacterStats.overrides })}</span>
            {/if}
          </div>
        </div>

        <div class="character-actions">
          <button class="tool-button" type="button" on:click={() => startChatWithCharacter(activeCharacter)} title={t('character.startChat')} aria-label={t('character.startChat')}>
            <MessageCircle size={16} />
          </button>
          <button class="tool-button" type="button" on:click={openCharacterImport} title={t('character.importCard')} aria-label={t('character.importCard')}>
            <FileInput size={16} />
          </button>
          <button class="tool-button" type="button" on:click={duplicateActiveCharacter} title={t('character.duplicate')} aria-label={t('character.duplicate')}>
            <Copy size={16} />
          </button>
          <button class="tool-button danger" type="button" on:click={deleteActiveCharacter} title={t('character.delete')} aria-label={t('character.delete')}>
            <Trash2 size={16} />
          </button>
          <button class="tool-button" type="submit" title={t('character.save')} aria-label={t('character.save')}>
            <Save size={16} />
          </button>
        </div>
      </header>

      <nav class="character-tabs" aria-label={t('character.editorSections')}>
        <button class:active={characterEditorTab === 'core'} type="button" on:click={() => (characterEditorTab = 'core')}>{t('character.tab.core')}</button>
        <button class:active={characterEditorTab === 'prompt'} type="button" on:click={() => (characterEditorTab = 'prompt')}>{t('character.tab.prompt')}</button>
        <button class:active={characterEditorTab === 'lore'} type="button" on:click={() => (characterEditorTab = 'lore')}>{t('character.tab.lore')}</button>
        <button class:active={characterEditorTab === 'metadata'} type="button" on:click={() => (characterEditorTab = 'metadata')}>{t('character.tab.metadata')}</button>
      </nav>

      {#if characterEditorTab === 'core'}
        <section class="character-editor-section">
          <div class="character-field-grid">
            <label>
              <span>{t('common.name')}</span>
              <input bind:value={characterDraftName} placeholder={t('character.placeholder.name')} />
            </label>
            <label>
              <span>{t('common.tags')}</span>
              <input bind:value={characterDraftTags} placeholder={t('character.placeholder.tags')} />
            </label>
            <label class="span-2">
              <span>{t('character.description')}</span>
              <textarea bind:value={characterDraftDescription} rows="8" placeholder={t('character.placeholder.description')}></textarea>
            </label>
            <label>
              <span>{t('character.personality')}</span>
              <textarea bind:value={characterDraftPersonality} rows="5" placeholder={t('character.placeholder.personality')}></textarea>
            </label>
            <label>
              <span>{t('character.scenario')}</span>
              <textarea bind:value={characterDraftScenario} rows="5" placeholder={t('character.placeholder.scenario')}></textarea>
            </label>
            <label class="span-2">
              <span>{t('character.firstMessage')}</span>
              <textarea bind:value={characterDraftFirstMessage} rows="6" placeholder={t('character.placeholder.firstMessage')}></textarea>
            </label>
            <label class="span-2">
              <span>{t('character.alternateGreetings')}</span>
              <textarea bind:value={characterDraftAlternateGreetings} rows="5" placeholder={t('character.placeholder.alternateGreetings')}></textarea>
            </label>
          </div>
        </section>
      {:else if characterEditorTab === 'prompt'}
        <section class="character-editor-section">
          <div class="character-field-grid">
            <label class="span-2">
              <span>{t('character.systemPromptOverride')}</span>
              <textarea bind:value={characterDraftSystemPrompt} rows="7" placeholder={t('character.placeholder.systemPrompt')}></textarea>
            </label>
            <label class="span-2">
              <span>{t('character.postHistoryInstructions')}</span>
              <textarea bind:value={characterDraftPostHistoryInstructions} rows="7" placeholder={t('character.placeholder.postHistory')}></textarea>
            </label>
            <label class="span-2">
              <span>{t('character.exampleMessages')}</span>
              <textarea bind:value={characterDraftExampleMessages} rows="9" placeholder={t('character.placeholder.exampleMessages')}></textarea>
            </label>
          </div>
        </section>
      {:else if characterEditorTab === 'lore'}
        <section class="character-editor-section">
          <div class="character-lore-header">
            <div>
              <strong>{t('character.lore')}</strong>
              <span>{t('character.boundWorldBooks', { count: activeCharacterWorldBooks.length })}</span>
            </div>
            <button class="secondary" type="button" on:click={() => openCharacterWorldBooks(activeCharacter)}>
              <BookOpen size={16} />{t('character.openWorldBook')}
            </button>
          </div>
          {#if activeCharacterWorldBooks.length}
            <div class="character-lore-list">
              {#each activeCharacterWorldBooks as worldBook}
                {@const binding = worldBookBindingForCharacter(activeCharacter, worldBook.id)}
                <article class:disabled={binding?.enabled === false}>
                  <button type="button" on:click={() => { activeWorldBookId = worldBook.id; activeDrawer = 'worldbooks'; worldBookBindingCharacterId = activeCharacter?.id ?? ''; }}>
                    <BookOpen size={16} />
                    <span>
                      <strong>{worldBook.name}</strong>
                      <small>
                        {t('worldbook.entries', { count: worldBook.entries.length })} · {metadataSourceLabel(worldBook.metadata?.source)} · {binding?.enabled === false ? t('worldbook.bindingDisabled') : t('worldbook.bindingEnabled')}
                      </small>
                    </span>
                  </button>
                  <div class="character-lore-actions">
                    <button
                      type="button"
                      title={binding?.enabled === false ? t('worldbook.enableForCharacter') : t('worldbook.disableForCharacter')}
                      aria-label={binding?.enabled === false ? t('worldbook.enableForCharacter') : t('worldbook.disableForCharacter')}
                      on:click={() => setWorldBookBindingEnabled(activeCharacter, worldBook, binding?.enabled === false)}
                    >
                      {#if binding?.enabled === false}
                        <PowerOff size={14} />
                      {:else}
                        <Power size={14} />
                      {/if}
                    </button>
                    <button type="button" title={t('worldbook.unbind')} aria-label={t('worldbook.unbind')} on:click={() => unbindWorldBookFromCharacter(activeCharacter, worldBook)}>
                      <Unlink size={14} />
                    </button>
                  </div>
                </article>
              {/each}
            </div>
          {:else}
            <div class="drawer-empty compact">{t('character.noBoundWorldBook')}</div>
          {/if}

          <label class="character-textarea-label">
            <span>{t('character.creatorNotes')}</span>
            <textarea bind:value={characterDraftCreatorNotes} rows="8" placeholder={t('character.placeholder.creatorNotes')}></textarea>
          </label>
        </section>
      {:else}
        <section class="character-editor-section">
          <div class="character-field-grid">
            <label>
              <span>{t('character.creator')}</span>
              <input bind:value={characterDraftCreator} placeholder={t('character.creator')} />
            </label>
            <label>
              <span>{t('common.version')}</span>
              <input bind:value={characterDraftCharacterVersion} placeholder={t('character.characterVersion')} />
            </label>
            <label>
              <span>{t('character.talkativeness')}</span>
              <input bind:value={characterDraftTalkativeness} inputmode="decimal" placeholder={t('common.optional')} />
            </label>
            <div class="character-source-panel">
              <span>{t('character.cardSource')}</span>
              <strong>{characterOrigin(activeCharacter)}</strong>
              <small>{activeCharacter.id}</small>
            </div>
          </div>
        </section>
      {/if}
    </form>
  {:else}
    <section class="character-editor empty">
      <Image size={28} />
      <strong>{t('character.selectOrCreate')}</strong>
    </section>
  {/if}
</div>
