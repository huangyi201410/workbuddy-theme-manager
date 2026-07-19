---
name: workbuddy-theme-manager
description: Safely inspect, create, apply, verify, update, or remove a local visual theme for the macOS WorkBuddy desktop app. Use when the user asks to change WorkBuddy's wallpaper, color palette, sidebar states, icons, or page canvas while preserving its original layout and cloud data.
---

# WorkBuddy Theme Manager

Apply WorkBuddy desktop themes through conversation. This skill generates a local, signed themed copy of the installed macOS app; users do not download or manually install a separate Theme Studio application.

## Scope and guardrails

- Support macOS only. Confirm that `/Applications/WorkBuddy.app` is installed before changing anything.
- Default to a **separate themed copy** in `~/Applications`, with separate local cache/profile data. It can use the same WorkBuddy login, so cloud tasks, projects, and other synced data remain available.
- Never overwrite, delete, re-sign, or patch `/Applications/WorkBuddy.app` unless the user explicitly asks for **official in-place modification** in the same turn and accepts a full-backup plan. The bundled script deliberately has no in-place mode.
- Preserve the product prototype: theme work changes wallpaper, colors, icons, and visual surfaces only. Do not change layout, routes, interaction, or content without a separate request.
- Treat user-provided wallpapers as private local files. Copy them only into the themed app bundle; do not upload them.

## Conversation workflow

### 1. Inspect first

Run this before applying or diagnosing a theme:

```bash
node "$CODEX_HOME/skills/workbuddy-theme-manager/scripts/workbuddy-theme.mjs" inspect
```

If the script reports unsupported renderer slots, stop and explain that this WorkBuddy version needs a compatibility update. Do not guess at archive offsets or patch the official app.

### 2. Collect only the design inputs that are missing

Offer an installed preset before asking for colors. Current built-in choices are **Rose** (the current pink theme), Mint, Lavender, and Sky. Read [references/theme-config.md](references/theme-config.md) for their visual intent and map a user request such as “粉色主题” to Rose. If the user chooses a preset, use its JSON file from `presets/` as the starting config; copy it into the user theme folder with `apply_patch`, then add only the user's optional wallpaper or requested overrides.

Ask for the wallpaper and palette only when the user has not provided them and has not selected a sufficient preset. State the default sidebar states explicitly:

| State | Default color behavior |
| --- | --- |
| Default | Transparent item over `sidebar` |
| Hover | `sidebarHover` |
| Selected | `sidebarSelected` |

Use the schema in [references/theme-config.md](references/theme-config.md). Keep existing values if the user asks for a targeted adjustment such as “only replace the wallpaper.”

### 3. Make the intended change reviewable

Create or update a JSON configuration under:

```text
~/Library/Application Support/WorkBuddy Theme Manager/themes/<theme-name>.json
```

Do not use shell redirection to create it; use `apply_patch` when editing a config during this session. Summarize the exact target copy, wallpaper scope, and color values before applying. A normal request to “apply” authorizes rebuilding the **themed copy**, not the official app.

### 4. Apply to the safe themed copy

```bash
node "$CODEX_HOME/skills/workbuddy-theme-manager/scripts/workbuddy-theme.mjs" \
  apply --theme "$HOME/Library/Application Support/WorkBuddy Theme Manager/themes/<theme-name>.json"
```

The script creates:

- `~/Applications/WorkBuddy <Theme Name>.app` — a re-signed visual copy.
- `~/Applications/WorkBuddy <Theme Name> Launcher.app` — starts that copy with isolated local cache/profile folders.
- A copied wallpaper inside the themed copy, when one is configured.

It does not modify the official app or delete its data. Rebuilding a themed copy replaces only the previous copy with the same theme name.

### 5. Verify deliberately

Open the generated launcher. Inspect at least:

- Home page: wallpaper position, text contrast, composer readability.
- Sidebar: default, hover, and selected states.
- Assistant, Projects, Experts, Automation, More/Files, Inspiration, project detail, and project assets canvases.

Use application-window screenshots for visual comparison. Do not infer layout drift from a whole-screen screenshot with a different window/fullscreen state.

When a white page canvas remains, identify its page-root selector first and add a narrowly scoped canvas selector. Avoid broad card/input selectors, because white cards and fields are intentional content surfaces.

### 6. Update, switch, or remove

- To switch themes, edit/select another JSON config and run `apply`; this leaves the official application untouched.
- To remove a generated themed copy but retain its isolated data, use:

  ```bash
  node "$CODEX_HOME/skills/workbuddy-theme-manager/scripts/workbuddy-theme.mjs" remove --theme "<theme-name>"
  ```

- Include `--purge-data` only if the user explicitly asks to erase that theme copy's local cache/profile too.

## Known compatibility boundary

WorkBuddy is an Electron application and compiled renderer asset names or patch slots may change with app updates. The script detects the required slots before it writes. If detection fails, record the app version and update the skill's compatibility script; never force the patch.

Native WorkBuddy plugin manifests currently do not expose a supported renderer/sidebar menu contribution API. Therefore, this Skill is the maintainable no-extra-installer interface. A clickable “Theme” item inside WorkBuddy would require brittle renderer injection and should not be presented as an official plugin capability.

## Resources

- [Theme configuration schema and presets](references/theme-config.md)
- `presets/*.json` — ready-to-apply, color-only presets. Add a user wallpaper to a copied config when requested.
- `scripts/workbuddy-theme.mjs` — inspect, apply a safe local copy, and remove a generated copy.
