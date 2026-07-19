# Theme configuration

The theme manager reads one JSON file per theme. Keep the file under:

```text
~/Library/Application Support/WorkBuddy Theme Manager/themes/
```

## Schema

```json
{
  "name": "罗曼粉",
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

`name` becomes the generated app name. `wallpaper` is optional; omit it for a color-only theme. Every color accepts a six-digit hexadecimal value. Missing color fields use the 罗曼粉 defaults.

## Built-in presets

The ready-to-apply JSON files live in the skill's `presets/` folder. Four presets include a bundled wallpaper under `presets/wallpapers/`; Studio resolves it automatically and the direct engine resolves its path relative to the JSON file. 冰川蓝和蜜桃黄保持纯色，用户可自行选择本地壁纸。

| Preset | File | Visual direction |
| --- | --- | --- |
| 罗曼粉 | `presets/rose.json` | 柔雾粉主题，含预设壁纸。 |
| 月光蓝 | `presets/moonlight-blue.json` | 柔和月光蓝，含预设壁纸。 |
| 冰川蓝 | `presets/glacier-blue.json` | 清透冰川蓝，偏青色调。 |
| 蜜桃黄 | `presets/peach-yellow.json` | 温暖蜜桃黄，偏奶油色调。 |
| 暮光紫 | `presets/twilight-purple.json` | 低饱和暮光紫，含预设壁纸。 |
| 青柠绿 | `presets/lime-green.json` | 清新青柠绿，含预设壁纸。 |

For example, the agent can apply the 罗曼粉 preset and its bundled wallpaper directly:

```bash
node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme.mjs" \
  apply --theme "$HOME/.workbuddy/skills/workbuddy-theme-manager/presets/rose.json"
```

## Wallpaper scopes

- `home` (recommended): place the wallpaper behind the new-task home page only; all other main pages use the theme canvas. This preserves legibility on data-dense pages.
- `main`: place the wallpaper as a low-opacity background layer across the full main-content area. Use only with a quiet image, because every page must remain legible.
- `none`: suppress the wallpaper even if a path is present.

## 罗曼粉 preset schema

```json
{
  "name": "罗曼粉",
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

## 青柠绿 preset example

```json
{
  "name": "青柠绿",
  "wallpaper": "wallpapers/lime-green.jpg",
  "wallpaperScope": "home",
  "colors": {
    "canvas": "#F4FBE8",
    "sidebar": "#EAF6D9",
    "sidebarHover": "#E0F0C8",
    "sidebarSelected": "#D3E8B4",
    "accent": "#75AF39",
    "accentHover": "#5F942B",
    "text": "#314E1C",
    "heading": "#527F28",
    "border": "#C7E1A5"
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
