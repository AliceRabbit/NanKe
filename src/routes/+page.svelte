<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Bot,
    BookOpen,
    Download,
    GripHorizontal,
    MessageSquare,
    RefreshCw,
    Search,
    Send,
    Settings2,
    Upload,
    UserRound,
    X
  } from '@lucide/svelte';

  type Profile = { id: string; name: string; provider: { type: string; model: string } };
  type Character = { id: string; name: string; firstMessage?: string; avatarAssetId?: string };
  type UserPersona = {
    id: string;
    name: string;
    description: string;
    avatarAssetId?: string;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
  };
  type WorldBook = { id: string; name: string; entries: unknown[] };
  type Conversation = { id: string; title: string; characterId?: string; personaId?: string; profileId?: string; messages?: ChatMessage[] };
  type ChatMessage = { role: 'user' | 'assistant' | 'system'; name?: string; content: string };
  type ZoomedAvatar = { key: string; name: string; role: ChatMessage['role']; src: string; initials: string };
  type ImportKind = 'preset' | 'character-card-json' | 'character-card-png' | 'worldbook' | 'chat-jsonl';
  type View = 'chat' | 'characters' | 'personas' | 'worldbooks' | 'profiles';
  type Drawer = 'chats' | 'characters' | 'personas' | 'worldbooks' | 'profiles' | 'import' | 'inspector' | null;

  let profiles: Profile[] = [];
  let characters: Character[] = [];
  let personas: UserPersona[] = [];
  let worldBooks: WorldBook[] = [];
  let conversations: Conversation[] = [];
  let activeView: View = 'chat';
  let activeDrawer: Drawer = null;
  let activeProfileId = '';
  let activeCharacterId = '';
  let activePersonaId = '';
  let activeConversationId = '';
  let messages: ChatMessage[] = [];
  let input = '';
  let status = 'Ready';
  let importKind: ImportKind = 'preset';
  let importName = '';
  let importText = '';
  let importFileName = '';
  let importFileBase64 = '';
  let inspector = '';
  let newCharacterName = '';
  let newCharacterDescription = '';
  let newPersonaName = '';
  let newPersonaDescription = '';
  let newPersonaDefault = false;
  let personaDraftId = '';
  let personaDraftName = '';
  let personaDraftDescription = '';
  let personaDraftDefault = false;
  let newWorldBookName = '';
  let openingPreviewCharacterId = '';
  let zoomedAvatar: ZoomedAvatar | null = null;

  $: activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  $: activeCharacter = characters.find((character) => character.id === activeCharacterId);
  $: activePersona = personas.find((persona) => persona.id === activePersonaId);
  $: activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  $: drawerTitle =
    activeDrawer === 'chats'
      ? 'Chats'
      : activeDrawer === 'characters'
        ? 'Characters'
        : activeDrawer === 'personas'
          ? 'Personas'
          : activeDrawer === 'worldbooks'
            ? 'World Books'
            : activeDrawer === 'profiles'
              ? 'Profiles'
              : activeDrawer === 'import'
                ? 'Import'
                : activeDrawer === 'inspector'
                  ? 'Inspector'
                  : '';
  $: drawerIsRight = activeDrawer === 'import' || activeDrawer === 'inspector';
  $: if (activePersonaId !== personaDraftId) {
    personaDraftId = activePersonaId;
    personaDraftName = activePersona?.name ?? '';
    personaDraftDescription = activePersona?.description ?? '';
    personaDraftDefault = activePersona?.isDefault ?? false;
  }
  $: if (!activeConversationId) {
    const opening = activeCharacter?.firstMessage?.trim() ? renderCharacterTemplate(activeCharacter.firstMessage) : '';
    const canReplacePreview = Boolean(openingPreviewCharacterId) && messages.length === 1 && messages[0]?.role === 'assistant';
    const shouldShowOpening = Boolean(opening) && (messages.length === 0 || (canReplacePreview && (openingPreviewCharacterId !== activeCharacterId || messages[0].content !== opening)));
    if (shouldShowOpening) {
      messages = [{ role: 'assistant', name: activeCharacter?.name, content: opening }];
      openingPreviewCharacterId = activeCharacterId;
    } else if (!opening && canReplacePreview) {
      messages = [];
      openingPreviewCharacterId = '';
    }
  }

  onMount(() => {
    void refreshAll();
  });

  function openLibrary(view: Exclude<View, 'chat'>) {
    activeView = view;
    activeDrawer = activeDrawer === view ? null : view;
  }

  function openDrawer(drawer: Exclude<Drawer, null>) {
    activeDrawer = activeDrawer === drawer ? null : drawer;
  }

  function closeDrawer() {
    activeDrawer = null;
  }

  function startNewConversation() {
    activeConversationId = '';
    openingPreviewCharacterId = '';
    messages = [];
    activeView = 'chat';
    closeDrawer();
  }

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as T;
  }

  async function refreshAll() {
    status = 'Loading';
    profiles = await fetchJson<Profile[]>('/api/profiles');
    characters = await fetchJson<Character[]>('/api/characters');
    personas = await fetchJson<UserPersona[]>('/api/personas');
    worldBooks = await fetchJson<WorldBook[]>('/api/worldbooks');
    conversations = await fetchJson<Conversation[]>('/api/conversations');
    activeProfileId ||= profiles[0]?.id ?? '';
    activeCharacterId ||= characters[0]?.id ?? '';
    activePersonaId ||= personas.find((persona) => persona.isDefault)?.id ?? personas[0]?.id ?? '';
    status = 'Ready';
  }

  async function ensureConversation(): Promise<string> {
    if (activeConversationId) return activeConversationId;
    const conversation = await fetchJson<Conversation>('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.slice(0, 40) || 'New Chat',
        characterId: activeCharacterId || undefined,
        personaId: activePersonaId || undefined,
        profileId: activeProfileId || undefined
      })
    });
    activeConversationId = conversation.id;
    conversations = [conversation, ...conversations];
    if (activeCharacter?.firstMessage && messages.length === 0) {
      messages = [{ role: 'assistant', name: activeCharacter.name, content: renderCharacterTemplate(activeCharacter.firstMessage) }];
    }
    return activeConversationId;
  }

  async function loadConversation(id: string) {
    activeConversationId = id;
    openingPreviewCharacterId = '';
    activeView = 'chat';
    const conversation = await fetchJson<Conversation>(`/api/conversations?id=${encodeURIComponent(id)}`);
    messages = conversation.messages ?? [];
    activeCharacterId = conversation.characterId ?? activeCharacterId;
    activePersonaId = conversation.personaId ?? activePersonaId;
    activeProfileId = conversation.profileId ?? activeProfileId;
    closeDrawer();
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content) return;
    input = '';
    inspector = '';
    const conversationId = await ensureConversation();
    messages = [
      ...messages,
      { role: 'user', name: activePersona?.name, content },
      { role: 'assistant', name: activeCharacter?.name, content: '' }
    ];
    status = 'Generating';

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        profileId: activeProfileId || undefined,
        characterId: activeCharacterId || undefined,
        personaId: activePersonaId || undefined,
        message: content
      })
    });

    if (!response.body || !response.ok) {
      status = 'Error';
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const next = [...messages];
      next[next.length - 1] = { ...next[next.length - 1], role: 'assistant', content: `${next[next.length - 1].content}${chunk}` };
      messages = next;
    }
    status = 'Ready';
  }

  async function inspectCurrentPrompt() {
    const content = input.trim() || 'Inspect prompt';
    const conversationId = await ensureConversation();
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        profileId: activeProfileId || undefined,
        characterId: activeCharacterId || undefined,
        personaId: activePersonaId || undefined,
        message: content,
        dryRun: true
      })
    });
    inspector = await response.text();
  }

  async function openInspector() {
    await inspectCurrentPrompt();
    activeDrawer = 'inspector';
  }

  function renderCharacterTemplate(template: string): string {
    const charName = activeCharacter?.name ?? 'Assistant';
    const userName = activePersona?.name ?? 'User';
    return template.replaceAll('{{char}}', charName).replaceAll('{{charIfNotGroup}}', charName).replaceAll('{{user}}', userName);
  }

  function messageSpeaker(message: ChatMessage): string {
    if (message.name?.trim()) return message.name;
    if (message.role === 'assistant') return activeCharacter?.name ?? 'Assistant';
    if (message.role === 'user') return activePersona?.name ?? 'User';
    return 'System';
  }

  function messageAvatarUrl(message: ChatMessage): string {
    if (message.role === 'assistant' && activeCharacter?.avatarAssetId) return `/api/assets/${activeCharacter.avatarAssetId}`;
    if (message.role === 'user' && activePersona?.avatarAssetId) return `/api/assets/${activePersona.avatarAssetId}`;
    return '';
  }

  function messageInitials(message: ChatMessage): string {
    const speaker = messageSpeaker(message).trim();
    return Array.from(speaker)[0]?.toUpperCase() ?? '?';
  }

  function openZoomedAvatar(message: ChatMessage) {
    const src = messageAvatarUrl(message);
    const name = messageSpeaker(message);
    const key = `${message.role}:${name}:${src}`;

    if (zoomedAvatar?.key === key) {
      zoomedAvatar = null;
      return;
    }

    zoomedAvatar = {
      key,
      name,
      role: message.role,
      src,
      initials: messageInitials(message)
    };
  }

  async function readImportFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      importFileName = '';
      importFileBase64 = '';
      return;
    }

    importFileName = file.name;
    importName ||= file.name.replace(/\.[^.]+$/, '');
    importFileBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const value = String(reader.result ?? '');
        resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value);
      });
      reader.addEventListener('error', () => reject(reader.error ?? new Error('Could not read file.')));
      reader.readAsDataURL(file);
    });
    importText = '';
  }

  async function runImport() {
    status = 'Importing';
    const data =
      importKind === 'chat-jsonl'
        ? importText
        : importKind === 'character-card-png'
          ? importFileBase64 || importText.trim()
          : JSON.parse(importText);
    const result = await fetchJson<{ type: string; item?: { id: string } }>('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: importKind, name: importName || undefined, data })
    });
    importText = '';
    importFileName = '';
    importFileBase64 = '';
    importName = '';
    await refreshAll();
    if (result.type === 'character' && result.item?.id) {
      activeCharacterId = result.item.id;
    }
  }

  async function createCharacter() {
    const name = newCharacterName.trim();
    if (!name) return;
    status = 'Saving';
    const character = await fetchJson<Character>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: newCharacterDescription.trim() })
    });
    characters = [...characters, character];
    activeCharacterId = character.id;
    newCharacterName = '';
    newCharacterDescription = '';
    status = 'Ready';
  }

  async function createPersona() {
    const name = newPersonaName.trim();
    if (!name) return;
    status = 'Saving';
    const persona = await fetchJson<UserPersona>('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: newPersonaDescription.trim(), isDefault: newPersonaDefault })
    });
    personas = newPersonaDefault
      ? [persona, ...personas.filter((item) => item.id !== persona.id).map((item) => ({ ...item, isDefault: false }))]
      : [...personas, persona];
    activePersonaId = persona.id;
    newPersonaName = '';
    newPersonaDescription = '';
    newPersonaDefault = false;
    status = 'Ready';
  }

  async function saveActivePersona() {
    if (!activePersona) return;
    const name = personaDraftName.trim();
    if (!name) return;
    status = 'Saving';
    const persona = await fetchJson<UserPersona>('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...activePersona,
        name,
        description: personaDraftDescription.trim(),
        isDefault: personaDraftDefault
      })
    });
    personas = personas.map((item) => {
      if (item.id === persona.id) return persona;
      return persona.isDefault ? { ...item, isDefault: false } : item;
    });
    personaDraftId = persona.id;
    personaDraftName = persona.name;
    personaDraftDescription = persona.description;
    personaDraftDefault = persona.isDefault;
    status = 'Ready';
  }

  async function createWorldBook() {
    const name = newWorldBookName.trim();
    if (!name) return;
    status = 'Saving';
    const worldBook = await fetchJson<WorldBook>('/api/worldbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, entries: [] })
    });
    worldBooks = [...worldBooks, worldBook];
    newWorldBookName = '';
    status = 'Ready';
  }
</script>

<svelte:head>
  <title>NanKe</title>
</svelte:head>

<main class="workspace">
  <aside class="rail" aria-label="Navigation">
    <div class="brand">NK</div>
    <button
      class="icon-button"
      class:active={activeView === 'chat' && activeDrawer !== 'chats'}
      title="Chat"
      aria-label="Chat"
      aria-pressed={activeView === 'chat' && activeDrawer !== 'chats'}
      on:click={() => {
        activeView = 'chat';
        closeDrawer();
      }}
    >
      <MessageSquare size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'characters'}
      title="Characters"
      aria-label="Characters"
      aria-pressed={activeDrawer === 'characters'}
      on:click={() => openLibrary('characters')}
    >
      <Bot size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'personas'}
      title="Personas"
      aria-label="Personas"
      aria-pressed={activeDrawer === 'personas'}
      on:click={() => openLibrary('personas')}
    >
      <UserRound size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'worldbooks'}
      title="World Books"
      aria-label="World Books"
      aria-pressed={activeDrawer === 'worldbooks'}
      on:click={() => openLibrary('worldbooks')}
    >
      <BookOpen size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'profiles'}
      title="Profiles"
      aria-label="Profiles"
      aria-pressed={activeDrawer === 'profiles'}
      on:click={() => openLibrary('profiles')}
    >
      <Settings2 size={20} />
    </button>
    <div class="rail-spacer"></div>
    <button
      class="icon-button"
      class:active={activeDrawer === 'import'}
      title="Import"
      aria-label="Import"
      aria-pressed={activeDrawer === 'import'}
      on:click={() => openDrawer('import')}
    >
      <Upload size={20} />
    </button>
    <button
      class="icon-button"
      class:active={activeDrawer === 'inspector'}
      title="Prompt Inspector"
      aria-label="Prompt Inspector"
      aria-pressed={activeDrawer === 'inspector'}
      on:click={openInspector}
    >
      <Search size={20} />
    </button>
  </aside>

  <section class="stage" aria-label="Chat workspace">
    <header class="chatbar">
      <div class="scene">
        <button class="conversation-button" type="button" on:click={() => openDrawer('chats')}>
          <MessageSquare size={16} />
          <span>{activeConversation?.title ?? 'New Chat'}</span>
        </button>
        <div class="scene-meta" aria-live="polite">
          <span>{activeCharacter?.name ?? 'No character'}</span>
          <span>{activePersona?.name ?? 'User'}</span>
          <span>{activeProfile?.name ?? 'No profile'}</span>
          <span>{status}</span>
        </div>
      </div>

      <div class="toolbar">
        <select aria-label="Profile" bind:value={activeProfileId}>
          {#each profiles as profile}
            <option value={profile.id}>{profile.name} · {profile.provider.type}</option>
          {/each}
        </select>

        <select aria-label="Character" bind:value={activeCharacterId}>
          <option value="">None</option>
          {#each characters as character}
            <option value={character.id}>{character.name}</option>
          {/each}
        </select>

        <select aria-label="Persona" bind:value={activePersonaId}>
          <option value="">User</option>
          {#each personas as persona}
            <option value={persona.id}>{persona.name}{persona.isDefault ? ' · Default' : ''}</option>
          {/each}
        </select>

        <button class="tool-button" type="button" on:click={refreshAll} title="Refresh" aria-label="Refresh">
          <RefreshCw size={17} />
        </button>
        <button class="tool-button" type="button" on:click={openInspector} title="Prompt Inspector" aria-label="Prompt Inspector">
          <Search size={17} />
        </button>
        <button class="tool-button" type="button" on:click={() => openDrawer('import')} title="Import" aria-label="Import">
          <Upload size={17} />
        </button>
      </div>
    </header>

    <div class="messages" aria-live="polite">
      <div class="message-stack">
        {#if messages.length === 0}
          <div class="empty-state">
            <MessageSquare size={28} />
            <h1>{activeCharacter?.name ?? 'NanKe'}</h1>
            <p>
              {activePersona?.name ?? 'User'} · {activeProfile ? `${activeProfile.provider.type} · ${activeProfile.provider.model}` : 'No profile selected'}
            </p>
          </div>
        {/if}
        {#each messages as message}
          <article class="message-row {message.role}">
            <button class="message-avatar" type="button" aria-label={`Open avatar for ${messageSpeaker(message)}`} on:click={() => openZoomedAvatar(message)}>
              {#if messageAvatarUrl(message)}
                <img src={messageAvatarUrl(message)} alt="" />
              {:else}
                <span>{messageInitials(message)}</span>
              {/if}
            </button>
            <div class="message {message.role}">
              <strong>{messageSpeaker(message)}</strong>
              <p>{message.content}</p>
            </div>
          </article>
        {/each}
      </div>
    </div>

    <form class="composer" on:submit|preventDefault={sendMessage}>
      <textarea bind:value={input} rows="3" placeholder="Message"></textarea>
      <button class="primary" type="submit"><Send size={18} /><span>Send</span></button>
    </form>
  </section>

  {#if zoomedAvatar}
    <section class="avatar-viewer" aria-label="Avatar preview" title={zoomedAvatar.name}>
      <div class="avatar-viewer-controls">
        <span aria-hidden="true"><GripHorizontal size={18} /></span>
        <button type="button" title="Close avatar preview" aria-label="Close avatar preview" on:click={() => (zoomedAvatar = null)}>
          <X size={18} />
        </button>
      </div>
      <div class="avatar-viewer-image" class:user={zoomedAvatar.role === 'user'}>
        {#if zoomedAvatar.src}
          <img src={zoomedAvatar.src} alt={`${zoomedAvatar.name} avatar`} />
        {:else}
          <span>{zoomedAvatar.initials}</span>
        {/if}
      </div>
    </section>
  {/if}

  {#if activeDrawer}
    <button class="scrim" type="button" aria-label="Close drawer" on:click={closeDrawer}></button>
    <aside class="drawer" class:right={drawerIsRight} aria-label={drawerTitle}>
      <header class="drawer-header">
        <h2>{drawerTitle}</h2>
        <button class="tool-button" type="button" title="Close" aria-label="Close" on:click={closeDrawer}>
          <X size={18} />
        </button>
      </header>

      {#if activeDrawer === 'chats'}
        <div class="drawer-actions">
          <button class="secondary full" type="button" on:click={startNewConversation}>
            <MessageSquare size={16} />New Chat
          </button>
        </div>
        <div class="item-list">
          {#each conversations as conversation}
            <button
              class="drawer-item"
              class:active={conversation.id === activeConversationId}
              type="button"
              on:click={() => loadConversation(conversation.id)}
            >
              <strong>{conversation.title}</strong>
              <span>{conversation.id}</span>
            </button>
          {/each}
        </div>
      {:else if activeDrawer === 'characters'}
        <form class="editor" on:submit|preventDefault={createCharacter}>
          <input bind:value={newCharacterName} placeholder="Name" />
          <textarea bind:value={newCharacterDescription} rows="5" placeholder="Description"></textarea>
          <button class="primary full" type="submit"><Bot size={16} />Create</button>
        </form>

        <div class="item-list">
          {#each characters as character}
            <button
              class="drawer-item"
              class:active={character.id === activeCharacterId}
              type="button"
              on:click={() => (activeCharacterId = character.id)}
            >
              <strong>{character.name}</strong>
              <span>{character.id}</span>
            </button>
          {/each}
        </div>
      {:else if activeDrawer === 'personas'}
        <form class="editor" on:submit|preventDefault={createPersona}>
          <input bind:value={newPersonaName} placeholder="Name" />
          <textarea bind:value={newPersonaDescription} rows="5" placeholder="Description"></textarea>
          <label class="checkbox-row">
            <input type="checkbox" bind:checked={newPersonaDefault} />
            <span>Default</span>
          </label>
          <button class="primary full" type="submit"><UserRound size={16} />Create</button>
        </form>

        {#if activePersona}
          <form class="editor compact-editor" on:submit|preventDefault={saveActivePersona}>
            <input bind:value={personaDraftName} placeholder="Name" />
            <textarea bind:value={personaDraftDescription} rows="6" placeholder="Description"></textarea>
            <label class="checkbox-row">
              <input type="checkbox" bind:checked={personaDraftDefault} />
              <span>Default</span>
            </label>
            <button class="secondary full" type="submit"><UserRound size={16} />Save</button>
          </form>
        {/if}

        <div class="item-list">
          {#each personas as persona}
            <button
              class="drawer-item"
              class:active={persona.id === activePersonaId}
              type="button"
              on:click={() => (activePersonaId = persona.id)}
            >
              <strong>{persona.name}</strong>
              <span>{persona.isDefault ? 'Default' : persona.id}</span>
            </button>
          {/each}
        </div>
      {:else if activeDrawer === 'worldbooks'}
        <form class="editor" on:submit|preventDefault={createWorldBook}>
          <input bind:value={newWorldBookName} placeholder="Name" />
          <button class="primary full" type="submit"><BookOpen size={16} />Create</button>
        </form>

        <div class="item-list">
          {#each worldBooks as worldBook}
            <article class="drawer-card">
              <strong>{worldBook.name}</strong>
              <span>{worldBook.entries.length} entries</span>
            </article>
          {/each}
        </div>
      {:else if activeDrawer === 'profiles'}
        <div class="item-list">
          {#each profiles as profile}
            <button
              class="drawer-item"
              class:active={profile.id === activeProfileId}
              type="button"
              on:click={() => (activeProfileId = profile.id)}
            >
              <strong>{profile.name}</strong>
              <span>{profile.provider.type} · {profile.provider.model}</span>
            </button>
          {/each}
        </div>
      {:else if activeDrawer === 'import'}
        <div class="import-panel">
          <select aria-label="Import kind" bind:value={importKind}>
            <option value="preset">Preset</option>
            <option value="character-card-json">Character JSON</option>
            <option value="character-card-png">Character PNG</option>
            <option value="worldbook">World Book</option>
            <option value="chat-jsonl">Chat JSONL</option>
          </select>
          <input bind:value={importName} placeholder="Name" />
          {#if importKind === 'character-card-png'}
            <label class="file-picker">
              <Upload size={16} />
              <span>{importFileName || 'Choose PNG character card'}</span>
              <input type="file" accept="image/png,.png" on:change={readImportFile} />
            </label>
          {/if}
          <textarea
            bind:value={importText}
            rows="10"
            placeholder={importKind === 'character-card-png' ? 'Optional base64 PNG data' : 'JSON or JSONL'}
          ></textarea>
          <button class="secondary full" type="button" on:click={runImport}><Download size={16} />Import</button>
        </div>
      {:else if activeDrawer === 'inspector'}
        <div class="inspector-panel">
          <button class="secondary full" type="button" on:click={inspectCurrentPrompt}><Search size={16} />Inspect</button>
          <pre>{inspector}</pre>
        </div>
      {/if}
    </aside>
  {/if}
</main>

<style>
  .workspace {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    min-height: 100vh;
    background: #f5f6f4;
    color: #1e2420;
  }

  .rail {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    height: 100vh;
    padding: 14px 10px;
    background: #203229;
    color: #fff;
  }

  .brand {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: 8px;
    color: #f5f3ee;
    font-weight: 800;
    letter-spacing: 0;
  }

  .rail-spacer {
    flex: 1;
  }

  .icon-button,
  .tool-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 8px;
    width: 40px;
    height: 40px;
    background: transparent;
    color: inherit;
  }

  .tool-button {
    border: 1px solid #d6d8d3;
    background: #fff;
    color: #26302a;
  }

  .icon-button.active,
  .icon-button:hover {
    background: #e0efe6;
    color: #183125;
  }

  .tool-button:hover {
    border-color: #a9c8b3;
    background: #edf6f0;
  }

  .stage {
    min-width: 0;
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
  }

  .chatbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 72px;
    border-bottom: 1px solid #dfe1dc;
    padding: 12px 20px;
    background: #ffffff;
  }

  .scene {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .conversation-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: min(520px, 48vw);
    border: 0;
    border-radius: 8px;
    padding: 7px 9px;
    background: transparent;
    color: #1f2924;
    font: inherit;
    font-weight: 700;
  }

  .conversation-button:hover {
    background: #f0f2ee;
  }

  .conversation-button span,
  .scene-meta span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .scene-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    color: #68716b;
    font-size: 13px;
  }

  .scene-meta span + span::before {
    content: '/';
    margin-right: 6px;
    color: #a0a8a2;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
  }

  select,
  input,
  textarea {
    width: 100%;
    border: 1px solid #cfd4cd;
    border-radius: 8px;
    background: #fff;
    color: #1f2421;
    padding: 10px 12px;
  }

  .toolbar select {
    width: auto;
    max-width: 320px;
    min-height: 40px;
  }

  textarea {
    resize: vertical;
  }

  .messages {
    min-height: 0;
    overflow: auto;
    padding: 24px;
  }

  .message-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(100%, 880px);
    min-height: 100%;
    margin: 0 auto;
  }

  .empty-state {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 8px;
    min-height: 52vh;
    color: #66706a;
    text-align: center;
  }

  .empty-state h1 {
    margin: 0;
    color: #1e2420;
    font-size: 24px;
    letter-spacing: 0;
  }

  .empty-state p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .message-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: min(100%, 760px);
    align-self: flex-start;
  }

  .message-row.user {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .message-row.system {
    align-self: center;
  }

  .message-avatar {
    flex: 0 0 40px;
    width: 40px;
    height: 40px;
    padding: 0;
    overflow: hidden;
    border: 1px solid #d9ddd7;
    border-radius: 8px;
    background: #f0f2ee;
    color: inherit;
    cursor: zoom-in;
  }

  .message-avatar:hover,
  .message-avatar:focus-visible {
    border-color: #92bfa4;
    box-shadow: 0 0 0 3px rgb(146 191 164 / 22%);
    outline: 0;
  }

  .message-avatar img,
  .message-avatar span {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
  }

  .message-avatar img {
    object-fit: cover;
  }

  .message-avatar span {
    background: #203229;
    color: #fff;
    font-weight: 800;
  }

  .message-row.user .message-avatar span {
    background: #1c6b43;
  }

  .message {
    min-width: 0;
    flex: 1 1 auto;
    border: 1px solid #dfe1dc;
    border-radius: 8px;
    background: #fff;
    padding: 12px 14px;
    box-shadow: 0 1px 0 rgb(31 36 33 / 4%);
  }

  .message.user {
    border-color: #b6d2bf;
    background: #eaf5ee;
  }

  .message.assistant {
    background: #fff;
  }

  .message strong {
    display: block;
    margin-bottom: 6px;
    color: #68716b;
    font-size: 12px;
    text-transform: none;
  }

  .message p {
    margin: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .composer {
    display: grid;
    grid-template-columns: minmax(0, 820px) auto;
    justify-content: center;
    gap: 12px;
    border-top: 1px solid #dfe1dc;
    padding: 14px 20px;
    background: #fff;
  }

  .avatar-viewer {
    position: fixed;
    --rail-width: 64px;
    --stage-width: calc(100vw - var(--rail-width));
    --chat-width: min(880px, var(--stage-width));
    --chat-left: calc(var(--rail-width) + (var(--stage-width) - var(--chat-width)) / 2);
    --left-gap-width: calc(var(--chat-left) - var(--rail-width));
    --viewer-margin: 12px;
    --max-avatar-viewer-width: min(430px, calc(90vh * 0.666));
    top: 78px;
    left: calc(var(--rail-width) + max(var(--viewer-margin), calc((var(--left-gap-width) - var(--max-avatar-viewer-width)) / 2)));
    z-index: 25;
    display: block;
    width: max(0px, calc(var(--left-gap-width) - var(--viewer-margin) * 2));
    max-width: var(--max-avatar-viewer-width);
    max-height: calc(100vh - 96px);
    background: transparent;
  }

  .avatar-viewer-image {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    min-height: 0;
    max-height: calc(100vh - 168px);
    background: transparent;
  }

  .avatar-viewer-image img {
    display: block;
    width: 100%;
    max-height: calc(100vh - 96px);
    object-fit: contain;
    border-radius: 10px;
    box-shadow: 0 18px 46px rgb(20 24 22 / 22%);
  }

  .avatar-viewer-image span {
    display: grid;
    place-items: center;
    width: min(72vw, 260px);
    aspect-ratio: 1;
    border-radius: 8px;
    background: #203229;
    box-shadow: 0 18px 46px rgb(20 24 22 / 22%);
    color: #fff;
    font-size: 96px;
    font-weight: 800;
  }

  .avatar-viewer-image.user span {
    background: #1c6b43;
  }

  .avatar-viewer-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    left: 8px;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease;
  }

  .avatar-viewer:hover .avatar-viewer-controls,
  .avatar-viewer:focus-within .avatar-viewer-controls {
    opacity: 1;
  }

  .avatar-viewer-controls span,
  .avatar-viewer-controls button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid rgb(255 255 255 / 28%);
    border-radius: 8px;
    background: rgb(31 36 33 / 72%);
    color: #fff;
    pointer-events: auto;
    backdrop-filter: blur(8px);
  }

  .avatar-viewer-controls button {
    cursor: pointer;
  }

  .avatar-viewer-controls button:hover,
  .avatar-viewer-controls button:focus-visible {
    background: rgb(28 107 67 / 88%);
    outline: 0;
  }

  .primary,
  .secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 8px;
    border: 1px solid #1c6b43;
    padding: 10px 14px;
    background: #1c6b43;
    color: #fff;
    min-height: 42px;
  }

  .secondary {
    border-color: #cfd4cd;
    background: #fff;
    color: #1f2421;
  }

  .secondary:hover,
  .primary:hover {
    filter: brightness(0.98);
  }

  .full {
    width: 100%;
  }

  .scrim {
    position: fixed;
    inset: 0 0 0 64px;
    z-index: 20;
    border: 0;
    background: rgb(20 24 22 / 28%);
  }

  .drawer {
    position: fixed;
    inset: 0 auto 0 64px;
    z-index: 30;
    display: flex;
    flex-direction: column;
    width: min(390px, calc(100vw - 64px));
    border-right: 1px solid #d7dad4;
    background: #ffffff;
    box-shadow: 16px 0 36px rgb(28 36 31 / 14%);
  }

  .drawer.right {
    inset: 0 0 0 auto;
    width: min(440px, calc(100vw - 64px));
    border-right: 0;
    border-left: 1px solid #d7dad4;
    box-shadow: -16px 0 36px rgb(28 36 31 / 14%);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 64px;
    border-bottom: 1px solid #e1e3de;
    padding: 12px 16px;
  }

  .drawer-header h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0;
  }

  .drawer-actions,
  .editor,
  .import-panel,
  .inspector-panel {
    display: grid;
    gap: 10px;
    padding: 16px;
  }

  .compact-editor {
    border-top: 1px solid #eef0ec;
    border-bottom: 1px solid #eef0ec;
    background: #fafbf9;
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #4f5a53;
    font-size: 13px;
  }

  .checkbox-row input {
    width: auto;
  }

  .file-picker {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    border: 1px dashed #a9b7ad;
    border-radius: 8px;
    background: #f8faf7;
    color: #2f3a34;
    padding: 10px 12px;
    overflow: hidden;
  }

  .file-picker span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-picker input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .item-list {
    display: grid;
    gap: 8px;
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 0 16px 16px;
  }

  .drawer-item,
  .drawer-card {
    display: grid;
    gap: 5px;
    border: 1px solid #dfe1dc;
    border-radius: 8px;
    background: #fff;
    padding: 11px 12px;
    color: #202823;
    text-align: left;
  }

  .drawer-item.active,
  .drawer-item:hover {
    border-color: #9dc7ad;
    background: #edf6f0;
  }

  .drawer-item span,
  .drawer-card span {
    color: #6c756f;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  pre {
    min-height: 260px;
    max-height: 62vh;
    margin: 0;
    border: 1px solid #dfe1dc;
    border-radius: 8px;
    background: #f6f7f5;
    color: #303832;
    overflow: auto;
    overflow-wrap: anywhere;
    padding: 12px;
    white-space: pre-wrap;
    font-size: 12px;
  }

  @media (max-width: 860px) {
    .workspace {
      grid-template-columns: 56px minmax(0, 1fr);
    }

    .rail {
      padding: 10px 8px;
    }

    .brand,
    .icon-button,
    .tool-button {
      width: 40px;
      height: 40px;
    }

    .chatbar {
      align-items: stretch;
      flex-direction: column;
    }

    .conversation-button {
      max-width: 100%;
    }

    .toolbar {
      flex-wrap: wrap;
      justify-content: flex-start;
    }

    .toolbar select {
      flex: 1 1 150px;
      max-width: none;
    }

    .messages {
      padding: 18px 12px;
    }

    .composer {
      grid-template-columns: minmax(0, 1fr);
      padding: 12px;
    }

    .scrim {
      left: 56px;
    }

    .drawer {
      left: 56px;
      width: calc(100vw - 56px);
    }

    .drawer.right {
      width: calc(100vw - 56px);
    }

    .avatar-viewer {
      --rail-width: 56px;
      --viewer-margin: 8px;
      top: 72px;
      max-height: calc(100vh - 92px);
    }

    .avatar-viewer-image img {
      max-height: calc(100vh - 92px);
    }
  }
</style>
