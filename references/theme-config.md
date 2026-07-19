# Theme configuration

The theme manager reads one JSON file per theme. Keep the file under:

```text
~/Library/Application Support/WorkBuddy Theme Manager/themes/
```

## Schema

```json
{
  "name": "Rose",
  "wallpaper": "/absolute/path/to/wallpaper.jpg",
  "wallpaperScope": "home",
  "colors": {
    "canvas": "#FFF1F6",
    "sidebar": "#FFEDF4",
    "sidebarHover": "#F9E9EF",
    "sidebarSelected": "#F3E5EA",
    "accent": "#F13D72",
    "accentHover": "#DF275F",
    "text": "#5B2035",
    "heading": "#AE1949",
    "border": "#F1CBD7"
  }
}
```

`name` becomes the generated app name. `wallpaper` is optional; omit it for a color-only theme. Every color accepts a six-digit hexadecimal value. Missing color fields use the Rose defaults.

## Built-in presets

The ready-to-apply JSON files live in the skill's `presets/` folder. They intentionally contain **no wallpaper file**: a wallpaper is personal content and should be supplied locally by each user. Use a preset directly for a color-only theme, or copy it to the user theme folder and add a local `wallpaper` path.

| Preset | File | Visual direction |
| --- | --- | --- |
| Rose | `presets/rose.json` | Current soft-pink WorkBuddy theme. |
| Mint | `presets/mint.json` | Fresh light green with emerald actions. |
| Lavender | `presets/lavender.json` | Soft violet, suited to low-contrast creative work. |
| Sky | `presets/sky.json` | Pale blue with calm cobalt actions. |

For example, the agent can apply the current pink color preset directly:

```bash
node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme.mjs" \
  apply --theme "$HOME/.workbuddy/skills/workbuddy-theme-manager/presets/rose.json"
```

## Wallpaper scopes

- `home` (recommended): place the wallpaper behind the new-task home page only; all other main pages use the theme canvas. This preserves legibility on data-dense pages.
- `main`: place the wallpaper as a low-opacity background layer across the full main-content area. Use only with a quiet image, because every page must remain legible.
- `none`: suppress the wallpaper even if a path is present.

## Rose preset schema

```json
{
  "name": "Rose",
  "wallpaperScope": "home",
  "colors": {
    "canvas": "#FFF1F6",
    "sidebar": "#FFEDF4",
    "sidebarHover": "#F9E9EF",
    "sidebarSelected": "#F3E5EA",
    "accent": "#F13D72",
    "accentHover": "#DF275F",
    "text": "#5B2035",
    "heading": "#AE1949",
    "border": "#F1CBD7"
  }
}
```

## Green example

```json
{
  "name": "Mint",
  "wallpaper": "/Users/you/Pictures/mint-wallpaper.jpg",
  "wallpaperScope": "home",
  "colors": {
    "canvas": "#F1FBF5",
    "sidebar": "#E5F6EC",
    "sidebarHover": "#DCEFE5",
    "sidebarSelected": "#D0E8DA",
    "accent": "#23A56B",
    "accentHover": "#168554",
    "text": "#1D4933",
    "heading": "#17613F",
    "border": "#B8DDC7"
  }
}
```

## What the manager replaces

| Theme input | Applied area |
| --- | --- |
| `wallpaper` | Copied into the themed app bundle; rendered at the selected scope. |
| `canvas` | Main content canvases, page roots, lists, project/asset panels. |
| `sidebar` | Sidebar surface. |
| `sidebarHover` | Navigation item hover state. |
| `sidebarSelected` | Active/selected navigation state. |
| `accent`, `accentHover` | Primary pills, buttons, focus and accent states. |
| `text`, `heading`, `border` | Theme tokens, home heading, and border/focus treatment. |

The manager does not recolor user content, change page geometry, or alter tasks/projects.
