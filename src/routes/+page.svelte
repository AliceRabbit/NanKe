<script lang="ts">
  import { onMount } from 'svelte';
  import { BookOpen, Download, MessageSquare, RefreshCw, Search, Send, Settings2, Upload, UserRound } from '@lucide/svelte';

  type Profile = { id: string; name: string; provider: { type: string; model: string } };
  type Character = { id: string; name: string };
  type WorldBook = { id: string; name: string; entries: unknown[] };
  type Conversation = { id: string; title: string; messages?: ChatMessage[] };
  type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
  type View = 'chat' | 'characters' | 'worldbooks' | 'profiles';

  let profiles: Profile[] = [];
  let characters: Character[] = [];
  let worldBooks: WorldBook[] = [];
  let conversations: Conversation[] = [];
  let activeView: View = 'chat';
  let activeProfileId = '';
  let activeCharacterId = '';
  let activeConversationId = '';
  let messages: ChatMessage[] = [];
  let input = '';
  let status = 'Ready';
  let importKind = 'preset';
  let importName = '';
  let importText = '';
  let inspector = '';
  let newCharacterName = '';
  let newCharacterDescription = '';
  let newWorldBookName = '';

  onMount(() => {
    void refreshAll();
  });

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as T;
  }

  async function refreshAll() {
    status = 'Loading';
    profiles = await fetchJson<Profile[]>('/api/profiles');
    characters = await fetchJson<Character[]>('/api/characters');
    worldBooks = await fetchJson<WorldBook[]>('/api/worldbooks');
    conversations = await fetchJson<Conversation[]>('/api/conversations');
    activeProfileId ||= profiles[0]?.id ?? '';
    activeCharacterId ||= characters[0]?.id ?? '';
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
        profileId: activeProfileId || undefined
      })
    });
    activeConversationId = conversation.id;
    conversations = [conversation, ...conversations];
    return activeConversationId;
  }

  async function loadConversation(id: string) {
    activeConversationId = id;
    const conversation = await fetchJson<Conversation>(`/api/conversations?id=${encodeURIComponent(id)}`);
    messages = conversation.messages ?? [];
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content) return;
    input = '';
    inspector = '';
    const conversationId = await ensureConversation();
    messages = [...messages, { role: 'user', content }, { role: 'assistant', content: '' }];
    status = 'Generating';

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        profileId: activeProfileId || undefined,
        characterId: activeCharacterId || undefined,
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
      next[next.length - 1] = { role: 'assistant', content: `${next[next.length - 1].content}${chunk}` };
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
        message: content,
        dryRun: true
      })
    });
    inspector = await response.text();
  }

  async function runImport() {
    status = 'Importing';
    const data = importKind === 'chat-jsonl' ? importText : JSON.parse(importText);
    await fetchJson('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: importKind, name: importName || undefined, data })
    });
    importText = '';
    importName = '';
    await refreshAll();
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
    <div class="brand">NanKe</div>
    <button class="icon-button" class:active={activeView === 'chat'} title="Chat" aria-label="Chat" aria-pressed={activeView === 'chat'} on:click={() => (activeView = 'chat')}><MessageSquare size={20} /></button>
    <button class="icon-button" class:active={activeView === 'characters'} title="Characters" aria-label="Characters" aria-pressed={activeView === 'characters'} on:click={() => (activeView = 'characters')}><UserRound size={20} /></button>
    <button class="icon-button" class:active={activeView === 'worldbooks'} title="World Books" aria-label="World Books" aria-pressed={activeView === 'worldbooks'} on:click={() => (activeView = 'worldbooks')}><BookOpen size={20} /></button>
    <button class="icon-button" class:active={activeView === 'profiles'} title="Profiles" aria-label="Profiles" aria-pressed={activeView === 'profiles'} on:click={() => (activeView = 'profiles')}><Settings2 size={20} /></button>
  </aside>

  <section class="sidebar">
    <div class="section-title">
      <span>{activeView === 'chat' ? 'Chats' : activeView === 'characters' ? 'Characters' : activeView === 'worldbooks' ? 'World Books' : 'Profiles'}</span>
      <button class="ghost" on:click={refreshAll} title="Refresh" aria-label="Refresh"><RefreshCw size={16} /></button>
    </div>

    <div class="item-list">
      {#if activeView === 'chat'}
        {#each conversations as conversation}
          <button class:active={conversation.id === activeConversationId} on:click={() => loadConversation(conversation.id)}>
            {conversation.title}
          </button>
        {/each}
      {:else if activeView === 'characters'}
        {#each characters as character}
          <button class:active={character.id === activeCharacterId} on:click={() => (activeCharacterId = character.id)}>
            {character.name}
          </button>
        {/each}
      {:else if activeView === 'worldbooks'}
        {#each worldBooks as worldBook}
          <button>{worldBook.name}</button>
        {/each}
      {:else}
        {#each profiles as profile}
          <button class:active={profile.id === activeProfileId} on:click={() => (activeProfileId = profile.id)}>
            {profile.name}
          </button>
        {/each}
      {/if}
    </div>

    {#if activeView === 'chat'}
      <div class="field">
        <label for="profile">Profile</label>
        <select id="profile" bind:value={activeProfileId}>
          {#each profiles as profile}
            <option value={profile.id}>{profile.name} · {profile.provider.type}</option>
          {/each}
        </select>
      </div>

      <div class="field">
        <label for="character">Character</label>
        <select id="character" bind:value={activeCharacterId}>
          <option value="">None</option>
          {#each characters as character}
            <option value={character.id}>{character.name}</option>
          {/each}
        </select>
      </div>
    {/if}
  </section>

  <section class="chat">
    {#if activeView === 'chat'}
      <header class="topbar">
        <div>
          <h1>Chat Workspace</h1>
          <span>{status}</span>
        </div>
        <button class="secondary" on:click={inspectCurrentPrompt}><Search size={16} />Prompt Inspector</button>
      </header>

      <div class="messages">
        {#if messages.length === 0}
          <div class="empty">Start a conversation.</div>
        {/if}
        {#each messages as message}
          <article class="message {message.role}">
            <strong>{message.role}</strong>
            <p>{message.content}</p>
          </article>
        {/each}
      </div>

      <form class="composer" on:submit|preventDefault={sendMessage}>
        <textarea bind:value={input} rows="3" placeholder="Message"></textarea>
        <button class="primary" type="submit"><Send size={18} />Send</button>
      </form>
    {:else if activeView === 'characters'}
      <header class="topbar">
        <div>
          <h1>Characters</h1>
          <span>{characters.length} total</span>
        </div>
      </header>

      <div class="panel">
        <form class="editor" on:submit|preventDefault={createCharacter}>
          <input bind:value={newCharacterName} placeholder="Name" />
          <textarea bind:value={newCharacterDescription} rows="6" placeholder="Description"></textarea>
          <button class="primary" type="submit"><UserRound size={18} />Create</button>
        </form>

        <div class="panel-list">
          {#each characters as character}
            <article class="panel-item">
              <strong>{character.name}</strong>
              <span>{character.id}</span>
            </article>
          {/each}
        </div>
      </div>
    {:else if activeView === 'worldbooks'}
      <header class="topbar">
        <div>
          <h1>World Books</h1>
          <span>{worldBooks.length} total</span>
        </div>
      </header>

      <div class="panel">
        <form class="editor" on:submit|preventDefault={createWorldBook}>
          <input bind:value={newWorldBookName} placeholder="Name" />
          <button class="primary" type="submit"><BookOpen size={18} />Create</button>
        </form>

        <div class="panel-list">
          {#each worldBooks as worldBook}
            <article class="panel-item">
              <strong>{worldBook.name}</strong>
              <span>{worldBook.entries.length} entries</span>
            </article>
          {/each}
        </div>
      </div>
    {:else}
      <header class="topbar">
        <div>
          <h1>Profiles</h1>
          <span>{profiles.length} total</span>
        </div>
      </header>

      <div class="panel">
        <div class="panel-list">
          {#each profiles as profile}
            <article class="panel-item">
              <strong>{profile.name}</strong>
              <span>{profile.provider.type} · {profile.provider.model}</span>
            </article>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <aside class="tools">
    <section>
      <div class="section-title">
        <span>Import</span>
        <Upload size={16} />
      </div>
      <select bind:value={importKind}>
        <option value="preset">Preset</option>
        <option value="character-card-json">Character JSON</option>
        <option value="worldbook">World Book</option>
        <option value="chat-jsonl">Chat JSONL</option>
      </select>
      <input bind:value={importName} placeholder="Name" />
      <textarea bind:value={importText} rows="8" placeholder="JSON or JSONL"></textarea>
      <button class="secondary full" on:click={runImport}><Download size={16} />Import</button>
    </section>

    <section>
      <div class="section-title">
        <span>Inspector</span>
        <Search size={16} />
      </div>
      <pre>{inspector}</pre>
    </section>
  </aside>
</main>

<style>
  .workspace {
    display: grid;
    grid-template-columns: 64px 280px minmax(0, 1fr) 340px;
    min-height: 100vh;
  }

  .rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px 10px;
    background: #26302a;
    color: #fff;
  }

  .brand {
    writing-mode: vertical-rl;
    letter-spacing: 0;
    font-weight: 700;
    margin-bottom: 12px;
  }

  .icon-button,
  .ghost {
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

  .icon-button.active,
  .icon-button:hover {
    background: #d8ece0;
    color: #183125;
  }

  .sidebar,
  .tools {
    border-right: 1px solid #dcddd7;
    background: #ffffff;
    padding: 18px;
    overflow: auto;
  }

  .tools {
    border-right: 0;
    border-left: 1px solid #dcddd7;
  }

  .section-title,
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .section-title {
    font-weight: 700;
    margin-bottom: 12px;
  }

  .item-list {
    display: grid;
    gap: 6px;
    margin-bottom: 20px;
  }

  .item-list button {
    border: 1px solid transparent;
    border-radius: 8px;
    background: #f3f4ef;
    padding: 10px;
    text-align: left;
    color: #27302b;
  }

  .item-list button.active,
  .item-list button:hover {
    border-color: #9dc7ad;
    background: #e8f3ec;
  }

  .field,
  .tools section {
    display: grid;
    gap: 8px;
    margin-bottom: 18px;
  }

  label {
    font-size: 13px;
    color: #59645d;
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

  textarea {
    resize: vertical;
  }

  .chat {
    min-width: 0;
    display: grid;
    grid-template-rows: auto 1fr auto;
    background: #f7f7f4;
  }

  .topbar {
    border-bottom: 1px solid #dcddd7;
    padding: 16px 20px;
    background: #ffffff;
  }

  h1 {
    margin: 0;
    font-size: 20px;
    letter-spacing: 0;
  }

  .topbar span {
    font-size: 13px;
    color: #59645d;
  }

  .messages {
    overflow: auto;
    padding: 20px;
  }

  .panel {
    overflow: auto;
    padding: 20px;
  }

  .editor {
    display: grid;
    gap: 10px;
    max-width: 720px;
    margin-bottom: 20px;
  }

  .panel-list {
    display: grid;
    gap: 10px;
    max-width: 920px;
  }

  .panel-item {
    display: grid;
    gap: 6px;
    border: 1px solid #dcddd7;
    border-radius: 8px;
    background: #fff;
    padding: 12px 14px;
  }

  .panel-item span {
    color: #59645d;
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .empty {
    color: #737b75;
  }

  .message {
    max-width: 760px;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 12px;
    border: 1px solid #dcddd7;
    background: #fff;
  }

  .message.user {
    margin-left: auto;
    background: #e8f3ec;
    border-color: #bed9c8;
  }

  .message strong {
    display: block;
    font-size: 12px;
    text-transform: uppercase;
    color: #59645d;
    margin-bottom: 6px;
  }

  .message p {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .composer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    border-top: 1px solid #dcddd7;
    padding: 14px;
    background: #ffffff;
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

  .full {
    width: 100%;
  }

  pre {
    margin: 0;
    max-height: 360px;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 12px;
    color: #303832;
  }

  @media (max-width: 1100px) {
    .workspace {
      grid-template-columns: 56px minmax(0, 1fr);
    }

    .sidebar,
    .tools {
      display: none;
    }
  }
</style>
