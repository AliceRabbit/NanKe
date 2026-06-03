# NanKe

NanKe is a modern TypeScript tavern app focused on core chat workflows, compatibility with existing SillyTavern assets, and maintainable provider abstraction.

## Stack

- SvelteKit modular monolith
- TypeScript
- SQLite via Drizzle ORM and `better-sqlite3`
- Providers: OpenAI-compatible and Gemini/Vertex
- Compatibility: SillyTavern character cards, world books, presets, and JSONL chats

## Development

Use Corepack to activate pnpm:

```bash
corepack prepare pnpm@11.5.1 --activate
pnpm install
pnpm dev
```

Run checks:

```bash
pnpm check
pnpm test
```
