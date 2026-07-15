# NanKe Architecture

NanKe is a SvelteKit modular monolith. The project stays in one deployable app, but the code is split by responsibility so UI, provider protocols, compatibility import, and tavern domain logic do not leak into each other.

## Boundaries

- `routes` owns Svelte pages and HTTP endpoints. API routes should stay thin and delegate real work to server services.
- `server/services` owns application orchestration: generation, imports, persona resolution, and repository wiring.
- `core` owns pure tavern behavior: prompt compilation, world book activation, context budgeting, prompt inspection, and regex execution. It should not know about HTTP, SQLite, Svelte, or provider-specific protocols.
- `providers` owns model protocol adapters. OpenAI-compatible and Gemini/Vertex profiles are converted into a common `ProviderRequest`, then streamed back as normalized text, thinking, error, and done chunks. Gemini and Vertex transport and authentication use the official `@google/genai` SDK.
- `compat` owns legacy asset import. SillyTavern data is treated as an external format, converted into NanKe schemas, preserved in `legacy.raw`, and reported through `CompatReport`.
- `storage` owns SQLite persistence, repositories, native conversation snapshots, and filesystem assets.
- `schemas` owns runtime contracts shared across UI, server, storage, providers, and tests.
- `ui` owns reusable Svelte components, feature views, markdown rendering, i18n text, and design tokens.

## Runtime Data

Local user data is stored outside Git-tracked source by default:

- SQLite database and WAL files live under `.nanke/`.
- Avatars, imported PNGs, and other large binary assets live in the local asset store.
- API keys are stored inside local profile data and must not be committed.

## Generation Flow

```text
UI
  -> API route
  -> GenerationAppService
  -> PersonaResolver
  -> GenerationPipeline
  -> WorldBookEngine
  -> PromptCompiler
  -> provider adapter
  -> ConversationRepository
```

The UI never constructs the final model prompt. It submits user intent, selected profile, character, persona, and conversation IDs. Server-side code resolves the current state, applies regex rules, activates world books, compiles the prompt, calls the selected provider, normalizes streaming output, and persists the resulting message node.

## Import Flow

Legacy import is isolated behind `ImportAppService`:

```text
API route
  -> ImportAppService
  -> compat parser
  -> repository save
  -> CompatReport
```

Imported SillyTavern assets become native NanKe entities. Embedded character books are saved as world books and bound back to the character. Unsupported or unknown fields should be reported rather than silently discarded.

## Conversation History

Conversation history uses a native tree model instead of SillyTavern chat files. See [conversation-history.md](conversation-history.md) for the data invariants and operations.
