---
name: workbuddy-theme-manager
description: Install, operate, update, or recover WorkBuddy Theme Studio on macOS. Use when the user asks to change WorkBuddy's wallpaper, color palette, sidebar hover/selected states, presets, preview, account-menu theme entry, or to back up and restore a locally themed official WorkBuddy app.
---

# WorkBuddy Theme Manager

Use **WorkBuddy Theme Studio.app** as the primary interface. The Skill installs the Studio locally; users do not download a separate package. Studio owns the visual settings, preview, versioned backup, application, and recovery workflow.

## Safety model

- Support macOS and `/Applications/WorkBuddy.app` only.
- Before the first menu injection or theme application, create a complete app-bundle backup in `~/Library/Application Support/WorkBuddy Theme Studio/backups/`.
- Modify only visual assets and renderer CSS/JS: wallpaper, colors, sidebar states, and the account-menu entry. Never alter tasks, projects, login credentials, or user content.
- Restore the original backup before applying each new theme. This prevents repeated injection from accumulating in `app.asar`.
- Re-sign the patched application and verify its signature after each write.
- Keep `scripts/workbuddy-theme.mjs` as a separate themed-copy fallback. Do not use it unless the user asks to avoid modifying the official application.

## First-time setup

In WorkBuddy, install this Skill at `$HOME/.workbuddy/skills/workbuddy-theme-manager`. Use that directory for every command below; do not rely on a Codex-only installation variable.

Inspect compatibility before writing:

```bash
node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme-studio.mjs" inspect
```

If compatible, bootstrap Studio and the account-menu entry:

```bash
node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme-studio.mjs" bootstrap
```

This creates `~/Applications/WorkBuddy Theme Studio.app`, registers `workbuddy-theme-studio://open`, fully backs up the official app, and inserts **「主题」** immediately below **「外观」** in the account menu. Studio uses one process and one main window: clicking the menu entry again focuses that window. It does not apply a color theme during bootstrap.

## Normal user flow

1. Click the account avatar in WorkBuddy’s lower-left corner.
2. Click **主题** below **外观** to open Studio.
3. Choose Rose, Mint, Lavender, or Sky; optionally select a local wallpaper; then choose 首页 / 全右侧 / 无. **全右侧** puts the wallpaper on the complete right-side Main Content background layer; opaque cards and inputs remain readable above it.
4. Review the preview. Studio exposes separate `sidebar`, `Hover`, and `Selected` values. Every color row has a clickable native color swatch plus an editable HEX value for exact entry.
5. Click **应用到官方 WorkBuddy**. Studio closes/restarts WorkBuddy, restores its clean baseline, backs it up if needed, injects the selected theme, and verifies code signing.
6. Use **恢复官方版本** in Studio to restore the full pre-theme application bundle.

The default navigation palette is: transparent item over `sidebar`; `sidebarHover` on hover; `sidebarSelected` for active/selected.

## Direct engine commands

Use direct commands only for diagnosis or recovery, not as a replacement for Studio’s visual workflow:

```bash
# Create or repair only the menu entry, with a full backup first.
node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme-studio.mjs" install-menu

# Apply a saved JSON config.
node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme-studio.mjs" \
  apply-official --theme /absolute/path/theme.json

# Restore the exact official application backup; task/project data remains untouched.
node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme-studio.mjs" restore
```

## Compatibility and recovery

WorkBuddy updates can replace the injected renderer assets. On a version change, run `inspect`; if the patch slots differ, stop instead of forcing a write and update the Skill compatibility layer. If the app fails to start after an interrupted modification, run `restore` from Terminal or reinstall WorkBuddy, then run Studio bootstrap again.

## Resources

- [Theme configuration schema and presets](references/theme-config.md)
- `assets/ThemeStudio.swift` — the lightweight native Studio UI compiled during setup.
- `presets/*.json` — bundled color presets; wallpapers remain user-local.
- `scripts/workbuddy-theme-studio.mjs` — Studio installer, backup, injection, and restore engine.
- `scripts/workbuddy-theme.mjs` — safe separate-app fallback.
