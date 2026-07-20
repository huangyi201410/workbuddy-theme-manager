---
name: workbuddy-theme-manager
description: Install, operate, update, uninstall, or recover WorkBuddy Theme Studio on macOS. Use when the user asks to change WorkBuddy's wallpaper, color palette, sidebar hover/selected states, presets, preview, account-menu theme entry, or to back up, restore, or uninstall a locally themed official WorkBuddy app.
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

## Required installation handoff

After a first-time `bootstrap` succeeds, always tell the user in Chinese that the theme feature is installed and give this exact route: **左下角头像 → 外观 → 主题**. Explain that this opens WorkBuddy Theme Studio, where they can choose a preset or wallpaper, preview it, and click **应用到官方 WorkBuddy**; no theme is applied merely by installing the Skill.

## Normal user flow

1. Click the account avatar in WorkBuddy’s lower-left corner.
2. Click **主题** below **外观** to open Studio.
3. Choose 罗曼粉、月光蓝、冰川蓝、蜜桃黄、暮光紫 or 青柠绿. 罗曼粉、月光蓝、暮光紫和青柠绿会自动带出内置壁纸；也可改选本地壁纸，再选择 首页 / 全右侧 / 无. **全右侧** puts the wallpaper on the complete right-side Main Content background layer; opaque cards and inputs remain readable above it.
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

# Run only after the user clearly asks to uninstall. This restores WorkBuddy, removes
# the menu entry, then deletes Theme Studio, its local settings, and its app backup.
node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme-studio.mjs" uninstall
```

## Uninstall workflow

Run `uninstall` only after the user explicitly asks to remove WorkBuddy Theme Studio. It restores the backed-up official WorkBuddy app first, which removes the **主题** account-menu entry, then deletes `~/Applications/WorkBuddy Theme Studio.app` and `~/Library/Application Support/WorkBuddy Theme Studio/` (including theme settings and the app-bundle backup). Never delete the Studio if WorkBuddy is patched but its matching backup is unavailable; report that recovery is required instead. Tasks, projects, accounts, and user content are not touched.

## Compatibility and recovery

WorkBuddy updates can replace the injected renderer assets. On a version change, run `inspect`; if the patch slots differ, stop instead of forcing a write and update the Skill compatibility layer. If the app fails to start after an interrupted modification, run `restore` from Terminal or reinstall WorkBuddy, then run Studio bootstrap again.

## Resources

- [Theme configuration schema and presets](references/theme-config.md)
- `assets/ThemeStudio.swift` — the lightweight native Studio UI compiled during setup.
- `presets/*.json` — bundled color presets, including the wallpapers supplied for selected presets.
- `scripts/workbuddy-theme-studio.mjs` — Studio installer, backup, injection, restore, and uninstall engine.
- `scripts/workbuddy-theme.mjs` — safe separate-app fallback.
