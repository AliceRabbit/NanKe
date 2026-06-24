# Compatibility

NanKe treats SillyTavern assets as import formats, not as internal architecture. The goal is to preserve useful community assets while keeping NanKe's native data model small and explicit.

## Current Import Targets

- Character cards from JSON and PNG metadata chunks such as `chara` and `ccv3`.
- Embedded character books. They are saved as native world books, marked as character-card sourced, and bound back to the imported character.
- World Info JSON files with `entries`.
- Presets in OpenAI, context, instruct, and prompt-manager shapes that can be mapped into `GenerationProfile`.
- SillyTavern regex scripts when they are present in imported preset data.
- Chat JSONL through the legacy `chat-jsonl` import path. This exists as a compatibility intake only; NanKe's native long-term format is the conversation snapshot.
- Native NanKe conversation snapshots through the `conversation-snapshot` import path.

## Preservation Rules

Every SillyTavern import should return a `CompatReport` with mapped, preserved, unsupported, and warning fields. Unknown legacy fields should be kept in `legacy.raw` on the converted NanKe entity whenever practical.

Compatibility code should prefer explicit lossy mapping over silent behavior. If NanKe cannot reproduce a legacy field, the report should say so.

## Out Of Scope For Current Compatibility

These are not part of the current compatibility target:

- SillyTavern extension runtime compatibility.
- TTS, image generation, or slash command systems.
- Full recreation of every historical provider preset behavior.
- Using SillyTavern chat files as NanKe's native storage model.

## Private Test Assets

Public, sanitized fixtures may live under `fixtures/`. Private role cards, world books, presets, chats, API profiles, and endpoint keys should stay in ignored local paths such as `fixtures/local/` or `local-fixtures/`.
