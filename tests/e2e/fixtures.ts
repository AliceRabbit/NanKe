import { test as base, expect, type APIRequestContext, type APIResponse } from '@playwright/test';

const fixedTime = Date.parse('2026-06-18T09:30:00+08:00');

export type SeededApp = {
  characterId: string;
  conversationId: string;
  personaId: string;
  worldBookId: string;
};

async function requireOk(response: APIResponse, operation: string) {
  if (response.ok()) return response;
  throw new Error(`${operation} failed (${response.status()}): ${await response.text()}`);
}

async function readList<T extends { id: string }>(request: APIRequestContext, url: string): Promise<T[]> {
  const response = await requireOk(await request.get(url), `GET ${url}`);
  return response.json() as Promise<T[]>;
}

async function resetAppData(request: APIRequestContext) {
  const conversations = await readList(request, '/api/conversations?includeArchived=true&limit=200');
  for (const conversation of conversations) {
    await requireOk(
      await request.delete(`/api/conversations?id=${encodeURIComponent(conversation.id)}`),
      `delete conversation ${conversation.id}`
    );
  }

  const worldBooks = await readList(request, '/api/worldbooks');
  for (const worldBook of worldBooks) {
    await requireOk(
      await request.delete(`/api/worldbooks?id=${encodeURIComponent(worldBook.id)}`),
      `delete world book ${worldBook.id}`
    );
  }

  const personas = await readList(request, '/api/personas');
  for (const persona of personas) {
    await requireOk(
      await request.delete(`/api/personas?id=${encodeURIComponent(persona.id)}`),
      `delete persona ${persona.id}`
    );
  }

  const characters = await readList(request, '/api/characters');
  for (const character of characters) {
    await requireOk(
      await request.delete('/api/characters', { data: { id: character.id } }),
      `delete character ${character.id}`
    );
  }
}

async function seedAppData(request: APIRequestContext): Promise<SeededApp> {
  const characterId = 'e2e-character-lin';
  const personaId = 'e2e-persona-traveler';
  const worldBookId = 'e2e-worldbook-harbor';

  await requireOk(
    await request.post('/api/characters', {
      data: {
        id: characterId,
        name: '林雾',
        description: '在雨夜港口经营一间深夜书店的向导员。',
        personality: '克制、敏锐，善于用细节讲故事。',
        scenario: '潮声与电车铃声交错的南岸老城。',
        firstMessage: '门外的雨还没有停。要从哪一条街开始？',
        alternateGreetings: ['今晚的雾很适合迷路。'],
        tags: ['现代', '城市', '悬疑'],
        creator: 'NanKe E2E',
        characterVersion: '1.0',
        favorite: true,
        createdAt: fixedTime,
        updatedAt: fixedTime
      }
    }),
    'seed character'
  );

  await requireOk(
    await request.post('/api/personas', {
      data: {
        id: personaId,
        name: '漫游者',
        title: '城市记录员',
        description: '带着一本旧笔记本，寻找被忘记的地方。',
        isDefault: true,
        createdAt: fixedTime,
        updatedAt: fixedTime
      }
    }),
    'seed persona'
  );

  await requireOk(
    await request.post('/api/worldbooks', {
      data: {
        id: worldBookId,
        name: '南岸旧城档案',
        entries: [
          {
            id: 'e2e-worldbook-entry-tram',
            worldBookId,
            keys: ['有轨电车', '钟楼'],
            comment: '夜班电车',
            content: '末班有轨电车会在零点十七分经过钟楼。',
            enabled: true,
            constant: false,
            selective: false,
            order: 100,
            position: 'before',
            depth: 4,
            role: 'system',
            probability: 100,
            extensions: {}
          }
        ],
        metadata: {
          source: 'native',
          characterId,
          characterName: '林雾'
        },
        createdAt: fixedTime,
        updatedAt: fixedTime
      }
    }),
    'seed world book'
  );

  const sourceConversationId = 'e2e-source-conversation';
  const rootNodeId = 'e2e-node-root';
  const userNodeId = 'e2e-node-user-1';
  const assistantNodeId = 'e2e-node-assistant-1';
  const followupNodeId = 'e2e-node-user-2';
  const finalNodeId = 'e2e-node-assistant-2';
  const node = (
    id: string,
    parentId: string | null,
    depth: number,
    role: 'user' | 'assistant',
    speakerName: string,
    content: string,
    minute: number
  ) => ({
    id,
    conversationId: sourceConversationId,
    parentId,
    kind: 'message' as const,
    role,
    speakerName,
    content,
    siblingOrder: 0,
    depth,
    status: 'active' as const,
    lastActiveLeafId: finalNodeId,
    metadata: {},
    createdAt: fixedTime + minute * 60_000,
    updatedAt: fixedTime + minute * 60_000
  });

  const snapshot = {
    format: 'nanke.conversation.snapshot' as const,
    version: 1 as const,
    exportedAt: fixedTime + 10 * 60_000,
    conversation: {
      id: sourceConversationId,
      title: '雨夜的第七站',
      characterId,
      personaId,
      worldBookIds: [worldBookId],
      rootNodeId,
      activeLeafId: finalNodeId,
      nodeCount: 4,
      branchCount: 0,
      activeDepth: 4,
      lastPreview: '那就跟紧我，钟楼后面有一条地图上没有的小路。',
      revision: 0,
      metadata: { source: 'e2e-fixture' },
      createdAt: fixedTime,
      updatedAt: fixedTime + 10 * 60_000
    },
    nodes: [
      {
        id: rootNodeId,
        conversationId: sourceConversationId,
        parentId: null,
        kind: 'root' as const,
        content: '',
        siblingOrder: 0,
        depth: 0,
        status: 'active' as const,
        lastActiveLeafId: finalNodeId,
        metadata: {},
        createdAt: fixedTime,
        updatedAt: fixedTime
      },
      node(userNodeId, rootNodeId, 1, 'user', '漫游者', '我想找到那辆只在雨夜出现的电车。', 1),
      node(
        assistantNodeId,
        userNodeId,
        2,
        'assistant',
        '林雾',
        '你来得正是时候。\n\n先记住两件事：\n\n- 不要相信空站台的时刻表\n- 听见第三次铃声再上车',
        3
      ),
      node(followupNodeId, assistantNodeId, 3, 'user', '漫游者', '如果我错过第三次铃声呢？', 5),
      node(
        finalNodeId,
        followupNodeId,
        4,
        'assistant',
        '林雾',
        '那就跟紧我，钟楼后面有一条地图上没有的小路。',
        7
      )
    ],
    activePathNodeIds: [rootNodeId, userNodeId, assistantNodeId, followupNodeId, finalNodeId],
    assets: []
  };

  const importResponse = await requireOk(
    await request.post('/api/import', {
      data: { kind: 'conversation-snapshot', data: snapshot, name: snapshot.conversation.title }
    }),
    'seed conversation'
  );
  const imported = (await importResponse.json()) as { item: { id: string } };

  return {
    characterId,
    conversationId: imported.item.id,
    personaId,
    worldBookId
  };
}

export const test = base.extend<{ seededApp: SeededApp }>({
  seededApp: async ({ request }, use) => {
    await resetAppData(request);
    await use(await seedAppData(request));
  }
});

export { expect };
