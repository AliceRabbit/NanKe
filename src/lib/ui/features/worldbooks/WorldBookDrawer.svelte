<script lang="ts">
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Copy from '@lucide/svelte/icons/copy';
  import FileInput from '@lucide/svelte/icons/file-input';
  import Link2 from '@lucide/svelte/icons/link-2';
  import Plus from '@lucide/svelte/icons/plus';
  import Power from '@lucide/svelte/icons/power';
  import PowerOff from '@lucide/svelte/icons/power-off';
  import Save from '@lucide/svelte/icons/save';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Unlink from '@lucide/svelte/icons/unlink';
  import { t } from '$lib/i18n';
  import type { Character } from '$lib/schemas/character';
  import type { PromptSlot } from '$lib/schemas/profile';
  import type { WorldBook, WorldBookEntry } from '$lib/schemas/worldbook';

  type PromptRole = PromptSlot['role'];
  type EntryStatus = 'normal' | 'constant' | 'disabled';
  type WorldBookStats = { total: number; enabled: number; constant: number; regex: number };
  type WorldBookBinding = NonNullable<Character['worldBookBindings']>[number];

  export let worldBooks: WorldBook[] = [];
  export let characters: Character[] = [];
  export let activeWorldBook: WorldBook | undefined = undefined;
  export let activeWorldBookId = '';
  export let worldBookDraftName = '';
  export let worldBookDraftEntries: WorldBookEntry[] = [];
  export let activeWorldBookEntry: WorldBookEntry | undefined = undefined;
  export let activeWorldBookEntryId = '';
  export let filteredWorldBookEntries: WorldBookEntry[] = [];
  export let newWorldBookName = '';
  export let worldBookBindingCharacterId = '';
  export let worldBookBindingCharacter: Character | undefined = undefined;
  export let worldBookBoundCharacters: Character[] = [];
  export let worldBookEnabledCharacters: Character[] = [];
  export let worldBookEntryQuery = '';
  export let worldBookSortMode = 'order-desc';
  export let deletingWorldBook = false;
  export let worldBookPositions: Array<{ value: WorldBookEntry['position']; label: string }> = [];
  export let worldBookSortModes: Array<{ value: string; label: string }> = [];
  export let promptRoles: PromptRole[] = [];

  export let createWorldBook: () => void | Promise<void>;
  export let openWorldBookImport: () => void;
  export let isWorldBookBoundToCharacter: (character: Character | undefined, worldBookId: string) => boolean;
  export let worldBookLine: (worldBook: WorldBook) => string;
  export let worldBookStats: (entries: WorldBookEntry[]) => WorldBookStats;
  export let addWorldBookEntry: () => void;
  export let saveActiveWorldBook: () => void | Promise<void>;
  export let deleteActiveWorldBook: () => void;
  export let metadataSourceLabel: (source?: string) => string;
  export let worldBookBindingForCharacter: (character: Character | undefined, worldBookId: string) => WorldBookBinding | undefined;
  export let characterAvatarUrl: (character?: Character) => string;
  export let characterInitials: (character?: Character) => string;
  export let setWorldBookBindingEnabled: (character: Character | undefined, worldBook: WorldBook | undefined, enabled: boolean) => void | Promise<void>;
  export let unbindWorldBookFromCharacter: (character: Character | undefined, worldBook: WorldBook | undefined) => void | Promise<void>;
  export let bindWorldBookToCharacter: (character: Character | undefined, worldBook: WorldBook | undefined) => void | Promise<void>;
  export let entryStatus: (entry: WorldBookEntry) => EntryStatus;
  export let entryTitle: (entry?: WorldBookEntry) => string;
  export let entryMetaLine: (entry: WorldBookEntry) => string;
  export let moveWorldBookEntryOrder: (entry: WorldBookEntry | undefined, delta: number) => void;
  export let duplicateWorldBookEntry: (entry?: WorldBookEntry) => void;
  export let removeWorldBookEntry: (entry?: WorldBookEntry) => void;
  export let entryTokenEstimate: (entry?: WorldBookEntry) => string;
  export let entryStatusLabel: (entry: WorldBookEntry) => string;
  export let updateWorldBookEntry: (id: string, patch: Partial<WorldBookEntry>) => void;
  export let setWorldBookEntryState: (entry: WorldBookEntry, state: EntryStatus) => void;
  export let optionalInteger: (value: string) => number | undefined;
  export let optionalNumber: (value: string) => number | undefined;
  export let roleLabel: (role: string) => string;
  export let keywordText: (values: string[]) => string;
  export let parseKeywordText: (value: string) => string[];
  export let updateWorldBookEntryExtension: (id: string, key: string, value: unknown) => void;
</script>

<div class="worldbook-workspace">
  <section class="worldbook-library" aria-label={t('worldbook.library')}>
    <div class="worldbook-library-actions">
      <form class="worldbook-create" on:submit|preventDefault={createWorldBook}>
        <input bind:value={newWorldBookName} placeholder={t('worldbook.namePlaceholder')} />
        <button class="primary" type="submit"><BookOpen size={16} />{t('common.create')}</button>
      </form>
      <button class="secondary full" type="button" on:click={openWorldBookImport}>
        <FileInput size={16} />{t('worldbook.import')}
      </button>
    </div>

    <div class="worldbook-list">
      {#each worldBooks as worldBook}
        {@const boundCount = characters.filter((character) => isWorldBookBoundToCharacter(character, worldBook.id)).length}
        <button
          class="worldbook-row"
          class:active={worldBook.id === activeWorldBookId}
          type="button"
          on:click={() => (activeWorldBookId = worldBook.id)}
        >
          <span>
            <strong>{worldBook.name}</strong>
            <small>{worldBookLine(worldBook)}</small>
          </span>
          {#if boundCount}
            <em>{t('worldbook.boundCount', { count: boundCount })}</em>
          {/if}
        </button>
      {:else}
        <div class="drawer-empty compact">{t('worldbook.noWorldBooks')}</div>
      {/each}
    </div>
  </section>

  {#if activeWorldBook}
    {@const worldStats = worldBookStats(worldBookDraftEntries)}
    <section class="worldbook-editor" aria-label={t('worldbook.editor')}>
      <header class="worldbook-editor-header">
        <div>
          <strong>{t('worldbook.editor')}</strong>
          <span>{t('worldbook.enabledStats', { enabled: worldStats.enabled, total: worldStats.total, constant: worldStats.constant, regex: worldStats.regex })}</span>
        </div>
        <div class="preset-actions">
          <button class="tool-button" type="button" on:click={addWorldBookEntry} title={t('worldbook.newEntry')} aria-label={t('worldbook.newEntry')}><Plus size={16} /></button>
          <button class="tool-button" type="button" on:click={saveActiveWorldBook} title={t('worldbook.save')} aria-label={t('worldbook.save')}><Save size={16} /></button>
          <button class="tool-button danger" type="button" on:click={deleteActiveWorldBook} disabled={deletingWorldBook} title={t('worldbook.delete')} aria-label={t('worldbook.delete')}><Trash2 size={16} /></button>
        </div>
      </header>

      <div class="worldbook-title-row">
        <label>
          <span>{t('common.name')}</span>
          <input bind:value={worldBookDraftName} placeholder={t('worldbook.name')} />
        </label>
        <div class="worldbook-source">
          <span>{t('common.source')}</span>
          <strong>{metadataSourceLabel(activeWorldBook.metadata?.source)}</strong>
          {#if activeWorldBook.metadata?.characterName}<small>{activeWorldBook.metadata.characterName}</small>{/if}
        </div>
      </div>

      <section class="worldbook-binding-panel" aria-label={t('worldbook.binding')}>
        <header>
          <div>
            <strong>{t('worldbook.binding')}</strong>
            <span>{t('worldbook.bindingStats', { enabled: worldBookEnabledCharacters.length, total: worldBookBoundCharacters.length })}</span>
          </div>
          <select bind:value={worldBookBindingCharacterId} aria-label={t('worldbook.selectCharacter')}>
            {#each characters as character}
              <option value={character.id}>{character.name}</option>
            {/each}
          </select>
        </header>
        {#if worldBookBindingCharacter}
          {@const selectedBinding = worldBookBindingForCharacter(worldBookBindingCharacter, activeWorldBook.id)}
          <div class="worldbook-binding-selected">
            <span class="character-avatar-small compact">
              {#if characterAvatarUrl(worldBookBindingCharacter)}
                <img src={characterAvatarUrl(worldBookBindingCharacter)} alt={t('chat.avatarAlt', { name: worldBookBindingCharacter.name })} />
              {:else}
                <span>{characterInitials(worldBookBindingCharacter)}</span>
              {/if}
            </span>
            <div>
              <strong>{worldBookBindingCharacter.name}</strong>
              <small>
                {selectedBinding
                  ? selectedBinding.enabled !== false
                    ? t('worldbook.bindingEnabled')
                    : t('worldbook.bindingDisabled')
                  : t('worldbook.notBound')}
              </small>
            </div>
            <div class="worldbook-binding-actions">
              {#if selectedBinding}
                <button
                  class="tool-button"
                  type="button"
                  on:click={() => setWorldBookBindingEnabled(worldBookBindingCharacter, activeWorldBook, selectedBinding.enabled === false)}
                  title={selectedBinding.enabled !== false ? t('worldbook.disableForCharacter') : t('worldbook.enableForCharacter')}
                  aria-label={selectedBinding.enabled !== false ? t('worldbook.disableForCharacter') : t('worldbook.enableForCharacter')}
                >
                  {#if selectedBinding.enabled !== false}<Power size={16} />{:else}<PowerOff size={16} />{/if}
                </button>
                <button class="tool-button danger" type="button" on:click={() => unbindWorldBookFromCharacter(worldBookBindingCharacter, activeWorldBook)} title={t('worldbook.unbind')} aria-label={t('worldbook.unbind')}>
                  <Unlink size={16} />
                </button>
              {:else}
                <button class="secondary" type="button" on:click={() => bindWorldBookToCharacter(worldBookBindingCharacter, activeWorldBook)}>
                  <Link2 size={16} />{t('worldbook.bindToCharacter')}
                </button>
              {/if}
            </div>
          </div>
          <div class="worldbook-binding-list" aria-label={t('worldbook.boundCharacters')}>
            {#each characters as character}
              {@const binding = worldBookBindingForCharacter(character, activeWorldBook.id)}
              <button
                type="button"
                class:active={character.id === worldBookBindingCharacterId}
                class:enabled={binding?.enabled !== false && Boolean(binding)}
                class:disabled={binding?.enabled === false}
                on:click={() => (worldBookBindingCharacterId = character.id)}
              >
                <span>{character.name}</span>
                <small>{binding ? (binding.enabled !== false ? t('common.on') : t('common.off')) : t('worldbook.notBound')}</small>
              </button>
            {/each}
          </div>
        {:else}
          <div class="drawer-empty compact">{t('worldbook.noCharacters')}</div>
        {/if}
      </section>

      <div class="worldbook-entry-toolbar">
        <input class="profile-search" bind:value={worldBookEntryQuery} placeholder={t('worldbook.searchEntries')} aria-label={t('worldbook.searchEntries')} />
        <select bind:value={worldBookSortMode} aria-label={t('worldbook.sortEntries')}>
          {#each worldBookSortModes as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <div class="worldbook-editor-grid">
        <div class="worldbook-entry-list" aria-label={t('worldbook.entriesLabel')}>
          {#each filteredWorldBookEntries as entry}
            <article class="worldbook-entry-row" class:active={entry.id === activeWorldBookEntryId}>
              <button class="worldbook-entry-main" type="button" on:click={() => (activeWorldBookEntryId = entry.id)}>
                <span class="entry-state" data-state={entryStatus(entry)}>{entryStatus(entry) === 'constant' ? 'C' : entryStatus(entry) === 'disabled' ? 'X' : 'N'}</span>
                <span>
                  <strong>{entryTitle(entry)}</strong>
                  <small>{entryMetaLine(entry)}</small>
                </span>
              </button>
              <div class="worldbook-entry-actions">
                <button type="button" on:click={() => moveWorldBookEntryOrder(entry, 1)} title={t('worldbook.raiseOrder', { title: entryTitle(entry) })} aria-label={t('worldbook.raiseOrder', { title: entryTitle(entry) })}><ArrowUp size={14} /></button>
                <button type="button" on:click={() => moveWorldBookEntryOrder(entry, -1)} title={t('worldbook.lowerOrder', { title: entryTitle(entry) })} aria-label={t('worldbook.lowerOrder', { title: entryTitle(entry) })}><ArrowDown size={14} /></button>
                <button type="button" on:click={() => duplicateWorldBookEntry(entry)} title={t('worldbook.duplicateEntry')} aria-label={`${t('worldbook.duplicateEntry')} ${entryTitle(entry)}`}><Copy size={14} /></button>
                <button type="button" on:click={() => removeWorldBookEntry(entry)} title={t('worldbook.deleteEntry')} aria-label={`${t('worldbook.deleteEntry')} ${entryTitle(entry)}`}><Trash2 size={14} /></button>
              </div>
            </article>
          {:else}
            <div class="drawer-empty compact">{t('worldbook.noMatchingEntries')}</div>
          {/each}
        </div>

        {#if activeWorldBookEntry}
          <section class="worldbook-entry-editor" aria-label={t('worldbook.entryEditor')}>
            <div class="worldbook-entry-editor-head">
              <div>
                <strong>{entryTitle(activeWorldBookEntry)}</strong>
                <span>{entryTokenEstimate(activeWorldBookEntry)} {t('common.tokenUnit')} · {entryStatusLabel(activeWorldBookEntry)}</span>
              </div>
              <div class="preset-actions">
                <button class="tool-button" type="button" on:click={() => duplicateWorldBookEntry(activeWorldBookEntry)} title={t('worldbook.duplicateEntry')} aria-label={t('worldbook.duplicateEntry')}><Copy size={16} /></button>
                <button class="tool-button" type="button" on:click={() => removeWorldBookEntry(activeWorldBookEntry)} title={t('worldbook.deleteEntry')} aria-label={t('worldbook.deleteEntry')}><Trash2 size={16} /></button>
              </div>
            </div>

            <div class="worldbook-entry-fields">
              <label class="span-2">
                <span>{t('worldbook.memoTitle')}</span>
                <input value={activeWorldBookEntry.comment} on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { comment: (event.currentTarget as HTMLInputElement).value })} />
              </label>

              <div class="segmented-field">
                <span>{t('common.status')}</span>
                <div class="mini-segment three" aria-label={t('worldbook.entryStatus')}>
                  <button class:active={entryStatus(activeWorldBookEntry) === 'normal'} type="button" on:click={() => setWorldBookEntryState(activeWorldBookEntry, 'normal')}>{t('worldbook.status.normal')}</button>
                  <button class:active={entryStatus(activeWorldBookEntry) === 'constant'} type="button" on:click={() => setWorldBookEntryState(activeWorldBookEntry, 'constant')}>{t('worldbook.status.constant')}</button>
                  <button class:active={entryStatus(activeWorldBookEntry) === 'disabled'} type="button" on:click={() => setWorldBookEntryState(activeWorldBookEntry, 'disabled')}>{t('common.off')}</button>
                </div>
              </div>

              <div class="segmented-field">
                <span>{t('worldbook.position')}</span>
                <div class="mini-segment three" aria-label={t('worldbook.position')}>
                  {#each worldBookPositions as position}
                    <button class:active={activeWorldBookEntry.position === position.value} type="button" on:click={() => updateWorldBookEntry(activeWorldBookEntry.id, { position: position.value })}>
                      {position.label}
                    </button>
                  {/each}
                </div>
              </div>

              <label>
                <span>{t('worldbook.depth')}</span>
                <input
                  value={activeWorldBookEntry.depth}
                  inputmode="numeric"
                  on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { depth: optionalInteger((event.currentTarget as HTMLInputElement).value) ?? 0 })}
                />
              </label>
              <label>
                <span>{t('worldbook.order')}</span>
                <input
                  value={activeWorldBookEntry.order}
                  inputmode="numeric"
                  on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { order: optionalNumber((event.currentTarget as HTMLInputElement).value) ?? 0 })}
                />
              </label>
              <label>
                <span>{t('worldbook.triggerPercent')}</span>
                <input
                  value={activeWorldBookEntry.probability}
                  inputmode="numeric"
                  on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { probability: Math.min(100, Math.max(0, optionalNumber((event.currentTarget as HTMLInputElement).value) ?? 100)) })}
                />
              </label>

              <div class="segmented-field">
                <span>{t('worldbook.roleAtDepth')}</span>
                <div class="mini-segment three" aria-label={t('worldbook.roleAtDepth')}>
                  {#each promptRoles as role}
                    <button class:active={activeWorldBookEntry.role === role} type="button" on:click={() => updateWorldBookEntry(activeWorldBookEntry.id, { role })}>{roleLabel(role)}</button>
                  {/each}
                </div>
              </div>

              <label class="span-2">
                <span>{t('worldbook.primaryKeywords')}</span>
                <textarea
                  rows="2"
                  value={keywordText(activeWorldBookEntry.keys)}
                  placeholder={t('character.placeholder.tags')}
                  on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { keys: parseKeywordText((event.currentTarget as HTMLTextAreaElement).value) })}
                ></textarea>
              </label>
              <label class="span-2">
                <span>{t('worldbook.optionalFilter')}</span>
                <textarea
                  rows="2"
                  value={keywordText(activeWorldBookEntry.secondaryKeys)}
                  placeholder={t('worldbook.placeholder.secondaryKeys')}
                  on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { secondaryKeys: parseKeywordText((event.currentTarget as HTMLTextAreaElement).value) })}
                ></textarea>
              </label>
              <label class="span-2 content-field">
                <span>{t('common.content')}</span>
                <textarea
                  rows="10"
                  value={activeWorldBookEntry.content}
                  placeholder={t('worldbook.placeholder.content')}
                  on:input={(event) => updateWorldBookEntry(activeWorldBookEntry.id, { content: (event.currentTarget as HTMLTextAreaElement).value })}
                ></textarea>
              </label>
            </div>

            <div class="worldbook-toggle-grid">
              <button class="toggle-pill" class:active={activeWorldBookEntry.selective} type="button" on:click={() => updateWorldBookEntry(activeWorldBookEntry.id, { selective: !activeWorldBookEntry.selective })}>{t('worldbook.selective')}</button>
              <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.useProbability !== false} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'useProbability', activeWorldBookEntry.extensions.useProbability === false)}>{t('worldbook.useProbability')}</button>
              <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.use_regex === true} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'use_regex', activeWorldBookEntry.extensions.use_regex !== true)}>{t('worldbook.regexKeys')}</button>
              <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.case_sensitive === true} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'case_sensitive', activeWorldBookEntry.extensions.case_sensitive !== true)}>{t('worldbook.caseSensitive')}</button>
              <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.match_whole_words === true} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'match_whole_words', activeWorldBookEntry.extensions.match_whole_words !== true)}>{t('worldbook.wholeWords')}</button>
              <button class="toggle-pill" class:active={activeWorldBookEntry.extensions.ignore_budget === true} type="button" on:click={() => updateWorldBookEntryExtension(activeWorldBookEntry.id, 'ignore_budget', activeWorldBookEntry.extensions.ignore_budget !== true)}>{t('worldbook.ignoreBudget')}</button>
            </div>
          </section>
        {:else}
          <section class="worldbook-entry-editor empty">
            <BookOpen size={28} />
            <strong>{t('worldbook.noEntry')}</strong>
            <button class="primary" type="button" on:click={addWorldBookEntry}><Plus size={16} />{t('worldbook.newEntry')}</button>
          </section>
        {/if}
      </div>
    </section>
  {:else}
    <section class="worldbook-editor empty">
      <BookOpen size={28} />
      <strong>{t('worldbook.selectOrCreate')}</strong>
    </section>
  {/if}
</div>
