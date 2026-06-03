# SillyTavern Compatibility

NanKe treats SillyTavern assets as import/export formats, not as internal architecture.

Supported v1 import targets:

- Character cards from PNG `chara` or `ccv3` metadata chunks.
- World Info JSON files with `entries`.
- Presets for `openai`, `context`, and `instruct` shapes.
- Chat JSONL files.

Every import returns a `CompatReport` that lists mapped, preserved, unsupported, and warning fields. Unknown legacy fields are preserved in `legacy.raw` when converted into NanKe profiles.
