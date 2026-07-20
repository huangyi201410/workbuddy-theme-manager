# WorkBuddy Theme Manager

为 macOS 上的官方 `WorkBuddy.app` 提供本机主题管理。它通过 Skill 安装并在本机编译 **WorkBuddy Theme Studio.app**，无需下载单独的应用安装包。

Studio 可管理主题色、侧栏 Hover / Selected 状态、首页或全右侧壁纸、主题预设、预览、应用和恢复。

## 能做什么

- 通过 **WorkBuddy Theme Studio** 可视化选择主题、颜色和壁纸。
- 在 WorkBuddy 左下角账号菜单的 **外观** 下添加 **主题** 入口。
- 支持首页、全右侧和无壁纸三种显示范围。
- 内置六套配色，四套附带预设壁纸。
- 在首次修改前完整备份官方应用包；随时可恢复。
- 只改视觉资源和渲染样式，不改任务、项目、账号或业务数据。

## 系统要求

- macOS
- 官方应用位于 `/Applications/WorkBuddy.app`
- 可用的 `node` 与 Xcode Command Line Tools（提供 `swiftc`）

## 安装

### 在 WorkBuddy 或 Codex 中安装（推荐）

通过产品内的 Skill 安装入口添加此仓库：

```text
https://github.com/yyyy004/workbuddy-theme-manager
```

安装后，在对话中说“安装并启用 WorkBuddy Theme Studio”。Skill 会先检查兼容性，再创建 Studio、备份官方应用并写入菜单入口。

### 终端安装

```bash
git clone https://github.com/yyyy004/workbuddy-theme-manager.git \
  "$HOME/.workbuddy/skills/workbuddy-theme-manager"

node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme-studio.mjs" inspect
node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme-studio.mjs" bootstrap
```

`bootstrap` 只安装 Studio 和菜单入口，不会自动应用任何主题。

## 开始使用

主题功能安装完成后：

1. 点击 WorkBuddy 左下角的头像。
2. 在 **外观** 下点击 **主题**。
3. Studio 会打开；选择预设或本地壁纸，并选择显示范围。
4. 查看实时预览后，点击 **应用到官方 WorkBuddy**。

再次点击 **主题** 会聚焦已打开的 Studio，不会创建多个窗口。

## 内置预设

| 预设 | 预设壁纸 | 色彩方向 |
| --- | --- | --- |
| 罗曼粉 | 有 | 柔雾粉 |
| 月光蓝 | 有 | 低饱和冷调蓝 |
| 冰川蓝 | 无 | 清透青蓝 |
| 蜜桃黄 | 无 | 温暖奶油黄 |
| 暮光紫 | 有 | 低饱和紫 |
| 青柠绿 | 有 | 清新绿色 |

选择带预设壁纸的主题时，Studio 会自动带出该壁纸；你仍可替换为任何本地图片。

## 壁纸显示范围

| 范围 | 效果 |
| --- | --- |
| 首页 | 壁纸只显示在新建任务首页，其他页面使用主题主背景色。 |
| 全右侧 | 壁纸显示在右侧 Main Content 背景层；卡片和输入框保持可读。 |
| 无 | 不使用壁纸，只使用主题颜色。 |

## 安全与恢复

首次 bootstrap 或应用主题前，会在以下位置保留官方应用包备份：

```text
~/Library/Application Support/WorkBuddy Theme Studio/backups/
```

从 Studio 点击 **恢复官方版本**，或在终端运行：

```bash
node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme-studio.mjs" restore
```

如果 WorkBuddy 更新后替换了界面资源，先重新检查兼容性：

```bash
node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme-studio.mjs" inspect
```

## 卸载 WorkBuddy Theme Studio

在 WorkBuddy / Codex 对话中明确提出“卸载 WorkBuddy Theme Studio”，Skill 会执行安全卸载。也可以在终端运行：

```bash
node "$HOME/.workbuddy/skills/workbuddy-theme-manager/scripts/workbuddy-theme-studio.mjs" uninstall
```

卸载会依次：

1. 恢复备份的官方 `WorkBuddy.app`，移除账号菜单中的 **主题** 入口。
2. 删除 `~/Applications/WorkBuddy Theme Studio.app`。
3. 删除 `~/Library/Application Support/WorkBuddy Theme Studio/` 中的主题设置和应用包备份。

任务、项目、账号和其他 WorkBuddy 用户数据不会删除。若检测到已注入主题但找不到匹配备份，卸载会停止而不删除 Studio，以避免无法恢复官方版本；此时应先恢复或重装 WorkBuddy。

## 项目结构

```text
SKILL.md              # 提供给 WorkBuddy / Codex 的执行流程
assets/               # 原生 Studio 源码
presets/              # 主题 JSON 与内置壁纸
scripts/              # 安装、备份、注入、恢复逻辑
references/           # 主题配置说明
```

> 这是本机私用的界面定制工具。使用前请确认你有权修改本机安装的 WorkBuddy 应用。
