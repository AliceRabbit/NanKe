<script lang="ts">
  import Copy from '@lucide/svelte/icons/copy';
  import Image from '@lucide/svelte/icons/image';
  import Link2 from '@lucide/svelte/icons/link-2';
  import Save from '@lucide/svelte/icons/save';
  import Search from '@lucide/svelte/icons/search';
  import Star from '@lucide/svelte/icons/star';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Unlink from '@lucide/svelte/icons/unlink';
  import UserRound from '@lucide/svelte/icons/user-round';
  import { t } from '$lib/i18n';
  import TextareaField from '$lib/ui/components/form/TextareaField.svelte';
  import TextField from '$lib/ui/components/form/TextField.svelte';
  import type { Character } from '$lib/schemas/character';
  import type { Conversation } from '$lib/schemas/conversation';
  import type { UserPersona } from '$lib/schemas/user-persona';

  export let newPersonaName = '';
  export let newPersonaTitle = '';
  export let newPersonaDescription = '';
  export let newPersonaDefault = false;
  export let personaQuery = '';
  export let activePersonaId = '';
  export let personaDraftName = '';
  export let personaDraftTitle = '';
  export let personaDraftDescription = '';
  export let personaDraftDefault = false;

  export let personas: UserPersona[] = [];
  export let filteredPersonas: UserPersona[] = [];
  export let activePersona: UserPersona | undefined = undefined;
  export let activeCharacter: Character | undefined = undefined;
  export let activeCharacterPersona: UserPersona | undefined = undefined;
  export let activeConversationRecord: Partial<Conversation> | null = null;
  export let activeConversationId = '';
  export let activePersonaBoundToActiveCharacter = false;
  export let activePersonaLockedToConversation = false;
  export let personaAvatarUploading = false;
  export let personaDeleting = false;

  export let createPersona: () => void | Promise<void>;
  export let saveActivePersona: () => void | Promise<void>;
  export let setActivePersonaDefault: () => void | Promise<void>;
  export let toggleActivePersonaCharacterBinding: () => void | Promise<void>;
  export let lockActivePersonaToCurrentChat: () => void | Promise<void>;
  export let duplicateActivePersona: () => void | Promise<void>;
  export let clearActivePersonaAvatar: () => void | Promise<void>;
  export let deleteActivePersona: () => void | Promise<void>;
  export let uploadActivePersonaAvatar: (event: Event) => void | Promise<void>;
  export let personaAvatarUrl: (persona?: UserPersona) => string;
  export let personaInitials: (persona?: UserPersona) => string;
  export let personaBindingLabel: (persona: UserPersona) => string;
  export let personaTokenEstimate: (persona?: UserPersona) => number;
</script>

<div class="persona-workspace">
  <section class="persona-library" aria-label={t('persona.library')}>
    <form class="persona-create" on:submit|preventDefault={createPersona}>
      <div class="persona-section-head">
        <strong>{t('persona.create')}</strong>
        <small>{t('persona.createHint')}</small>
      </div>
      <TextField bind:value={newPersonaName} label={t('common.name')} placeholder={t('persona.namePlaceholder')} />
      <TextField bind:value={newPersonaTitle} label={t('persona.title')} placeholder={t('persona.titlePlaceholder')} />
      <TextareaField bind:value={newPersonaDescription} label={t('persona.description')} rows={4} placeholder={t('persona.descriptionPlaceholder')} />
      <label class="checkbox-row compact">
        <input type="checkbox" bind:checked={newPersonaDefault} />
        <span>{t('persona.default')}</span>
      </label>
      <button class="primary full" type="submit"><UserRound size={16} />{t('common.create')}</button>
    </form>

    <label class="search-field persona-search">
      <Search size={15} />
      <input bind:value={personaQuery} placeholder={t('persona.search')} aria-label={t('persona.search')} />
    </label>

    <div class="persona-list">
      {#each filteredPersonas as persona}
        <button class="persona-row" class:active={persona.id === activePersonaId} type="button" on:click={() => (activePersonaId = persona.id)}>
          <span class="persona-row-avatar">
            {#if personaAvatarUrl(persona)}
              <img src={personaAvatarUrl(persona)} alt="" />
            {:else}
              <span>{personaInitials(persona)}</span>
            {/if}
          </span>
          <span class="persona-row-copy">
            <strong>{persona.name}</strong>
            <small>{personaBindingLabel(persona)}</small>
          </span>
        </button>
      {/each}
    </div>
  </section>

  <section class="persona-detail" aria-label={t('persona.current')}>
    {#if activePersona}
      <div class="persona-identity">
        <label class="persona-avatar-uploader" title={t('persona.changeAvatar')}>
          {#if personaAvatarUrl(activePersona)}
            <img src={personaAvatarUrl(activePersona)} alt="" />
          {:else}
            <span>{personaInitials(activePersona)}</span>
          {/if}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={personaAvatarUploading} on:change={uploadActivePersonaAvatar} />
        </label>
        <div>
          <span>{t('persona.current')}</span>
          <h3>{activePersona.name}</h3>
          <p>{activePersona.title || personaBindingLabel(activePersona)}</p>
        </div>
      </div>

      <div class="persona-action-grid">
        <button class:active={activePersona.isDefault} type="button" on:click={setActivePersonaDefault}>
          <Star size={15} />{t('persona.setDefault')}
        </button>
        <button class:active={activePersonaBoundToActiveCharacter} type="button" disabled={!activeCharacter} on:click={toggleActivePersonaCharacterBinding}>
          {#if activePersonaBoundToActiveCharacter}
            <Unlink size={15} />{t('persona.unbindCharacter')}
          {:else}
            <Link2 size={15} />{t('persona.bindCharacter')}
          {/if}
        </button>
        <button class:active={activePersonaLockedToConversation} type="button" disabled={!activeConversationId} on:click={lockActivePersonaToCurrentChat}>
          <Link2 size={15} />{t('persona.lockChat')}
        </button>
        <button type="button" on:click={duplicateActivePersona}>
          <Copy size={15} />{t('persona.duplicate')}
        </button>
        <button type="button" disabled={!activePersona.avatarAssetId || personaAvatarUploading} on:click={clearActivePersonaAvatar}>
          <Image size={15} />{t('persona.clearAvatar')}
        </button>
        <button class="danger" type="button" disabled={personaDeleting} on:click={deleteActivePersona}>
          <Trash2 size={15} />{t('common.delete')}
        </button>
      </div>

      <form class="persona-editor" on:submit|preventDefault={saveActivePersona}>
        <TextField bind:value={personaDraftName} label={t('common.name')} placeholder={t('persona.namePlaceholder')} />
        <TextField bind:value={personaDraftTitle} label={t('persona.title')} placeholder={t('persona.titlePlaceholder')} />
        <TextareaField bind:value={personaDraftDescription} label={t('persona.description')} rows={9} placeholder={t('persona.descriptionPlaceholder')} />
        <div class="persona-editor-meta">
          <span>{t('persona.tokenEstimate', { count: personaTokenEstimate(activePersona) })}</span>
          <label class="checkbox-row compact">
            <input type="checkbox" bind:checked={personaDraftDefault} />
            <span>{t('persona.default')}</span>
          </label>
        </div>
        <button class="primary full" type="submit"><Save size={16} />{t('common.save')}</button>
      </form>

      <section class="persona-connections">
        <div class="persona-section-head">
          <strong>{t('persona.connections')}</strong>
          <small>{activeCharacter ? t('persona.currentCharacter', { name: activeCharacter.name }) : t('character.noCharacter')}</small>
        </div>
        <div class="persona-connection-row">
          <span>{t('persona.characterBinding')}</span>
          <strong>{activeCharacterPersona?.name ?? t('persona.noCharacterBinding')}</strong>
        </div>
        <div class="persona-connection-row">
          <span>{t('persona.chatLock')}</span>
          <strong>{activeConversationRecord?.personaId ? personas.find((persona) => persona.id === activeConversationRecord?.personaId)?.name ?? t('persona.missingPersona') : t('persona.noChatLock')}</strong>
        </div>
      </section>
    {:else}
      <div class="persona-empty">
        <UserRound size={30} />
        <strong>{t('persona.selectOrCreate')}</strong>
      </div>
    {/if}
  </section>
</div>
