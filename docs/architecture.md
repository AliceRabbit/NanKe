# NanKe Architecture

NanKe v1 is a SvelteKit modular monolith. The app keeps one deployable unit while enforcing clear code boundaries:

- `core` owns tavern domain behavior such as prompt compilation, world book activation, and context budgeting.
- `providers` owns protocol adaptation for OpenAI-compatible APIs and Gemini/Vertex.
- `compat` owns SillyTavern import/export logic and produces compatibility reports.
- `storage` owns SQLite tables, repositories, and file assets.
- `server` wires routes, repositories, core, and providers together.

The UI never constructs the final model prompt. It submits user intent to API routes, and server-side services run the generation pipeline.

Conversation history uses a tree-shaped native model; see [conversation-history.md](conversation-history.md) for its data invariants and operations.
