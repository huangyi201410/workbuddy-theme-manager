#!/usr/bin/env node

import {
  closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync,
  readSync, rmSync, writeFileSync, writeSync
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SOURCE_APP = "/Applications/WorkBuddy.app";
const MANAGER_DIR = join(homedir(), "Library", "Application Support", "WorkBuddy Theme Manager");
const defaults = {
  canvas: "#FFF1F6", sidebar: "#FFEDF4", sidebarHover: "#F9E9EF",
  sidebarSelected: "#F3E5EA", accent: "#F13D72", accentHover: "#DF275F",
  text: "#5B2035", heading: "#AE1949", border: "#F1CBD7"
};
const usage = `Usage:
  workbuddy-theme.mjs inspect
  workbuddy-theme.mjs apply --theme /absolute/path/theme.json [--target /absolute/path.app]
  workbuddy-theme.mjs remove --theme ThemeName [--purge-data]`;

function fail(message) { console.error(`WorkBuddy Theme Manager: ${message}`); process.exit(1); }
function run(command, args, options = {}) { return execFileSync(command, args, { stdio: "inherit", ...options }); }
function appArchive(app) { return join(app, "Contents", "Resources", "app.asar"); }
function asJson(value) { console.log(JSON.stringify(value, null, 2)); }
function slug(value) {
  const ascii = value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 38) || "theme";
  return `${ascii}-${createHash("sha256").update(value).digest("hex").slice(0, 8)}`;
}
function cleanName(value) { return String(value).replace(/[/:\\]/g, "-").trim().slice(0, 48); }
function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) fail(`unexpected argument: ${token}`);
    const key = token.slice(2);
    flags[key] = key === "purge-data" ? true : rest[++i];
    if (flags[key] === undefined) fail(`missing value for --${key}`);
  }
  return { command, flags };
}
function macOnly() { if (process.platform !== "darwin") fail("this skill currently supports macOS only"); }
function validateColor(name, value) { if (!/^#[0-9a-f]{6}$/i.test(value)) fail(`colors.${name} must be a six-digit hex color`); return value.toUpperCase(); }
function loadTheme(themePath) {
  if (!themePath || !existsSync(themePath)) fail("provide an existing JSON file with --theme");
  let data;
  try { data = JSON.parse(readFileSync(themePath, "utf8")); } catch { fail(`could not parse theme JSON: ${themePath}`); }
  const name = cleanName(data.name);
  if (!name) fail("theme name is required");
  const colors = { ...defaults, ...(data.colors ?? {}) };
  for (const key of Object.keys(defaults)) colors[key] = validateColor(key, colors[key]);
  const wallpaperScope = data.wallpaperScope ?? "home";
  if (!new Set(["home", "main", "none"]).has(wallpaperScope)) fail("wallpaperScope must be home, main, or none");
  const wallpaper = data.wallpaper ? String(data.wallpaper) : null;
  if (wallpaperScope !== "none" && wallpaper && !existsSync(wallpaper)) fail(`wallpaper not found: ${wallpaper}`);
  return { name, colors, wallpaper, wallpaperScope };
}

function getEntry(header, parts) {
  let entry = header;
  for (const part of parts) entry = entry?.files?.[part];
  if (!entry || typeof entry.size !== "number") fail(`missing archive entry: ${parts.join("/")}`);
  return entry;
}
function readArchive(archivePath, writable = true) {
  const fd = openSync(archivePath, writable ? "r+" : "r");
  const prefix = Buffer.alloc(8);
  readSync(fd, prefix, 0, prefix.length, 0);
  const headerSize = prefix.readUInt32LE(4);
  const rawHeader = Buffer.alloc(headerSize);
  readSync(fd, rawHeader, 0, rawHeader.length, 8);
  const headerText = rawHeader.toString("utf8");
  const first = headerText.indexOf("{");
  const last = headerText.lastIndexOf("}");
  if (first < 0 || last < first) fail("could not parse app.asar header");
  return { fd, rawHeader, headerText, header: JSON.parse(headerText.slice(first, last + 1)), dataStart: 8 + headerSize };
}
function readEntry(archive, entry) {
  const value = Buffer.alloc(entry.size);
  readSync(archive.fd, value, 0, value.length, archive.dataStart + Number(entry.offset));
  return value.toString("utf8");
}
function writePaddedEntry(archive, entry, content, label) {
  const bytes = Buffer.from(content, "utf8");
  if (bytes.length > entry.size) fail(`${label} requires ${bytes.length} bytes but its archive slot has ${entry.size}`);
  const padded = Buffer.concat([bytes, Buffer.alloc(entry.size - bytes.length, 0x20)]);
  writeSync(archive.fd, padded, 0, padded.length, archive.dataStart + Number(entry.offset));
  return createHash("sha256").update(padded).digest("hex");
}
function listFiles(entry, prefix = []) {
  if (entry.files) return Object.entries(entry.files).flatMap(([name, child]) => listFiles(child, [...prefix, name]));
  return [{ parts: prefix, entry }];
}
function findPatchCss(archive) {
  const markers = ["WbMentionPanel", "mode` 模块二级面板样式", "状态芯片群共享基础样式", "ChatSearchButton styles"];
  const candidates = listFiles(archive.header).filter(({ parts }) => parts.join("/").startsWith("renderer/assets/") && parts.at(-1).endsWith(".css"));
  for (const candidate of candidates) {
    const text = readEntry(archive, candidate.entry);
    if (markers.every(marker => text.includes(marker))) return { ...candidate, text };
  }
  fail("this WorkBuddy version has no supported renderer stylesheet slots");
}
function replaceSlot(source, marker, replacement) {
  const start = source.indexOf(marker);
  const end = source.indexOf("*/", start) + 2;
  if (start < 0 || end < start) fail(`could not locate stylesheet slot: ${marker}`);
  const available = Buffer.byteLength(source.slice(start, end));
  const required = Buffer.byteLength(replacement);
  if (required > available) fail(`stylesheet slot ${marker} has ${available} bytes, needs ${required}`);
  return source.slice(0, start) + replacement + " ".repeat(available - required) + source.slice(end);
}

function cssFor(theme, wallpaperUrl) {
  const c = theme.colors;
  const wallpaper = !wallpaperUrl || theme.wallpaperScope === "none" ? "" : `,url("${wallpaperUrl}") 72% center/cover no-repeat`;
  const homeWallpaper = theme.wallpaperScope === "home" ? `.wb-home-page{position:relative!important;isolation:isolate!important;z-index:0!important;background:transparent!important}.wb-home-page:before{content:"";position:absolute;z-index:-1;inset:0 -16px -96px;pointer-events:none;background:linear-gradient(90deg,rgb(255 255 255/.70),rgb(255 255 255/.48) 44%,rgb(255 255 255/.22))${wallpaper}!important}` : "";
  const mainWallpaper = theme.wallpaperScope === "main" ? `#root>:first-child{background:linear-gradient(rgb(255 255 255/.40),rgb(255 255 255/.40))${wallpaper}!important;background-attachment:fixed!important}:is(.main-content,.main-content--chat,.main-content--projects,.main-content--automation,.automation-main-page,.workbuddy-collab,.landing-main,.project-grid,.project-grid__body,.project-detail-view,.project-detail-view__body,.project-detail-view__main,.project-detail-view__content,.my-files-panel,.my-files-panel-content,.my-files-body,.shared-files-list,.tencent-docs-panel,.tencent-docs-panel__content,.ima-panel,.ima-panel__body,.tencent-lexiang-panel,.tencent-lexiang-panel__scroll,.kb-onboarding-panel,.inspiration-panel,.discover-panel-page,.expert-center-page,.ec-main-content,.connector-panel,.workbuddy-topbar,.teams-top-bar,.ec-topbar){background:transparent!important}.expert-center-page{--ec-featured-scene-area-bg:transparent!important}` : "";
  const canvas = `#root>:first-child,main,[class*=main-content],[class*=MainContent],[class*=content-area],[class*=ContentArea],[class*=workbench],[class*=Workbench],.main-content.main-content--projects,.main-content.main-content--automation,.automation-main-page,.shared-files-list,.knowledge-base-panel,[class*=gridViewItem],.workbuddy-collab .landing,.landing-main,.project-grid,.project-grid__body,.my-files-panel,.my-files-panel-content,.my-files-body,.tencent-docs-panel,.tencent-docs-panel__content,.ima-panel,.ima-panel__body,.ima-auth-guide__content,.tencent-lexiang-panel,.tencent-lexiang-panel__scroll,.kb-onboarding-panel,.inspiration-panel,.claw-agent-chat-pane,.claw-agent-chat-topbar,.workbuddy-topbar,.project-detail-view,.project-detail-view__body,.project-detail-view__main,.project-detail-view__content,.project-detail-view__top-tabs,:is(.project-assets-panel,.my-files-panel) :is(.cfp,.cfp-body,.cfp-content-wrapper,.cfp-content,.cfp-list,.cfp-list__body){background-color:rgb(${hexToRgb(c.canvas)} /.80)!important}`;
  return `:root{--wb-bg-primary:${c.canvas}!important;--wb-bg-secondary:${c.sidebar}!important;--wb-bg-tertiary:${c.sidebarSelected}!important;--wb-bg-hover:${c.sidebarHover}!important;--wb-bg-active:${c.sidebarSelected}!important;--wb-bg-pill-active:${c.accent}!important;--wb-bg-pill-active-hover:${c.accentHover}!important;--wb-border-default:${c.border}!important;--wb-text-primary:${c.text}!important;--wb-text-secondary:${c.text}!important;--wb-text-medium:${c.text}!important;--wb-text-strong:${c.text}!important;--vscode-editor-background:rgb(${hexToRgb(c.canvas)} /.80)!important;--vscode-editor-foreground:${c.text}!important;--vscode-foreground:${c.text}!important;--vscode-button-background:${c.accent}!important;--vscode-button-hoverBackground:${c.accentHover}!important;--vscode-button-foreground:#fff!important;--vscode-input-background:#fff!important;--vscode-input-foreground:${c.text}!important;--vscode-input-border:${c.border}!important;--vscode-focusBorder:${c.accent}!important;--vscode-list-hoverBackground:${c.sidebarHover}!important;--vscode-list-activeSelectionBackground:${c.sidebarSelected}!important}html,body,#root{background:${c.canvas}!important}body{color:${c.text}!important}${canvas}.discover-panel-page{--dc-bg-primary:rgb(${hexToRgb(c.canvas)} /.80)!important;background:rgb(${hexToRgb(c.canvas)} /.80)!important}aside,[class*=sidebar],[class*=Sidebar],aside>div,[class*=sidebar]>div,[class*=Sidebar]>div{background-color:${c.sidebar}!important}:is(.conversation-list-nav-item,.conversation-list-tab-button-box,.conversation-list-tab-row,.conversation-agent-card,.conversation-team-member-button){background-color:transparent!important}:is(.conversation-list-nav-item:not(.conversation-list-nav-item-active),.conversation-list-tab-button-box:not(.active),.conversation-list-tab-row:not(.active),.conversation-agent-card:not([class*=selected]),.conversation-team-member-button:not(.conversation-team-member--selected)):hover{background-color:${c.sidebarHover}!important}:is(.conversation-list-nav-item.conversation-list-nav-item-active,.conversation-list-tab-button-box.active,.conversation-list-tab-row.active,.conversation-agent-card[class*=selected],.conversation-team-member-button.conversation-team-member--selected){background-color:${c.sidebarSelected}!important}.wb-home-header__title,.wb-home-header__subtitle{color:${c.heading}!important}.wb-scene-tabs{background:rgb(255 255 255/.72)!important}.wb-scene-tabs__pill--active{background:${c.accent}!important;color:#fff!important}.wb-home-composer{border-color:${c.border}!important;background:rgb(255 255 255/.78)!important}.wb-home-composer__chips .quick-actions__item{border-color:${c.border}!important;background:rgb(255 255 255/.77)!important;color:${c.text}!important}${homeWallpaper}${mainWallpaper}`;
}
function hexToRgb(hex) { return `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`; }
function persistentCss(theme, wallpaperUrl) {
  const c = theme.colors, rgb = hexToRgb(c.canvas);
  const wallpaper = theme.wallpaperScope === "home" && wallpaperUrl ? `.wb-home-page{position:relative!important;isolation:isolate!important;z-index:0!important;background:transparent!important}.wb-home-page:before{content:"";position:absolute;z-index:-1;inset:0 -16px -96px;pointer-events:none;background:linear-gradient(90deg,rgb(255 255 255/.7),rgb(255 255 255/.48) 44%,rgb(255 255 255/.22)),url("${wallpaperUrl}") 72% center/cover no-repeat!important}` : "";
  const base = `:root{--wb-bg-primary:${c.canvas}!important;--wb-bg-secondary:${c.sidebar}!important;--wb-bg-pill-active:${c.accent}!important;--wb-text-primary:${c.heading}!important;--vscode-editor-background:rgb(${rgb}/.8)!important}html,body,#root{background:${c.canvas}!important}#root>:first-child{background:${c.canvas}!important}main,[class*=main-content],[class*=MainContent],[class*=content-area],[class*=ContentArea],[class*=workbench],[class*=Workbench],.main-content.main-content--projects,.main-content.main-content--automation,.automation-main-page,.shared-files-list,.knowledge-base-panel{background:rgb(${rgb}/.8)!important}${wallpaper}[class*=gridViewItem]{background:rgb(${rgb}/.8)!important}.wb-home-header__title,.wb-home-header__subtitle{color:${c.heading}!important}.wb-scene-tabs{background:#fff!important}.wb-scene-tabs__pill--active{background:${c.accent}!important;color:#fff!important}.wb-home-composer{border-color:${c.border}!important;background:rgb(255 255 255/.78)!important}aside,[class*=sidebar],[class*=Sidebar],aside>div,[class*=sidebar]>div,[class*=Sidebar]>div{background:${c.sidebar}!important}`;
  const pages = `[class*=gridViewItem],.workbuddy-collab .landing,.landing-main,.project-grid,.project-grid__body,.my-files-panel,.my-files-panel-content,.my-files-body,.tencent-docs-panel,.tencent-docs-panel__content,.ima-panel,.ima-panel__body,.ima-auth-guide__content,.tencent-lexiang-panel,.tencent-lexiang-panel__scroll,.kb-onboarding-panel,.inspiration-panel,.claw-agent-chat-pane,.claw-agent-chat-topbar,.workbuddy-topbar,.project-detail-view,.project-detail-view__body,.project-detail-view__main,.project-detail-view__content,.project-detail-view__top-tabs,:is(.project-assets-panel,.my-files-panel) :is(.cfp,.cfp-body,.cfp-content-wrapper,.cfp-content,.cfp-list,.cfp-list__body){background:rgb(${rgb}/.8)!important}.discover-panel-page{--dc-bg-primary:rgb(${rgb}/.8)!important;background:rgb(${rgb}/.8)!important}`;
  const hover = `:is(.conversation-list-nav-item,.conversation-list-tab-button-box,.conversation-list-tab-row,.conversation-agent-card,.conversation-team-member-button){background:transparent!important}:is(.conversation-list-nav-item:not(.conversation-list-nav-item-active),.conversation-list-tab-button-box:not(.active),.conversation-list-tab-row:not(.active),.conversation-agent-card:not([class*=selected]),.conversation-team-member-button:not(.conversation-team-member--selected)):hover{background:${c.sidebarHover}!important}`;
  const selected = `:is(.conversation-list-nav-item.conversation-list-nav-item-active,.conversation-list-tab-button-box.active,.conversation-list-tab-row.active,.conversation-agent-card[class*=selected],.conversation-team-member-button.conversation-team-member--selected){background:${c.sidebarSelected}!important}`;
  return { base, pages, hover, selected };
}
function injectIndex(indexHtml, themeCss, trailingScript = "") {
  const stripped = indexHtml.replace(/^\s*<link rel="modulepreload"[^>]*>\s*$/gm, "");
  if (!stripped.includes("</head>")) fail("could not locate renderer document head");
  return stripped.replace("</head>", `<style id="workbuddy-theme-manager">${themeCss}</style><script>const n="workbuddy-theme-manager",c=document.getElementById(n).textContent;setInterval(()=>{let s=document.getElementById(n);if(!s){s=document.createElement("style");s.id=n;s.textContent=c}if(document.head.lastElementChild!==s)document.head.append(s)},400)</script>${trailingScript}</head>`);
}
function launcherPaths(theme) {
  const safe = slug(theme.name);
  return {
    target: join(homedir(), "Applications", `WorkBuddy ${theme.name}.app`),
    launcher: join(homedir(), "Applications", `WorkBuddy ${theme.name} Launcher.app`),
    data: join(MANAGER_DIR, "data", safe), home: join(MANAGER_DIR, "home", safe), safe
  };
}
function updateIntegrity(archive, values) {
  let header = archive.headerText;
  for (const [entry, hash] of values) {
    const prior = entry.integrity?.hash;
    if (!prior || prior.length !== hash.length) fail("could not update renderer integrity metadata");
    header = header.replace(prior, hash);
  }
  if (header.length !== archive.headerText.length) fail("app.asar header size changed unexpectedly");
  writeSync(archive.fd, Buffer.from(header, "utf8"), 0, archive.rawHeader.length, 8);
}
function inspect() {
  macOnly();
  const archivePath = appArchive(SOURCE_APP);
  if (!existsSync(archivePath)) fail(`official WorkBuddy app not found: ${SOURCE_APP}`);
  const version = execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleShortVersionString", join(SOURCE_APP, "Contents", "Info.plist")], { encoding: "utf8" }).trim();
  const archive = readArchive(archivePath, false);
  try {
    const index = getEntry(archive.header, ["renderer", "index.html"]);
    const css = findPatchCss(archive);
    asJson({ sourceApp: SOURCE_APP, version, supported: true, indexHtmlBytes: index.size, stylesheet: css.parts.join("/"), stylesheetBytes: css.entry.size, message: "Safe themed-copy mode is available. The official app will not be modified." });
  } finally { closeSync(archive.fd); }
}
function apply(themePath, targetOverride) {
  macOnly();
  const theme = loadTheme(themePath);
  const paths = launcherPaths(theme);
  const target = targetOverride ? String(targetOverride) : paths.target;
  if (!target.endsWith(".app")) fail("--target must end with .app");
  if (target === SOURCE_APP) fail("the safe theme manager refuses to overwrite the official WorkBuddy app");
  if (!existsSync(appArchive(SOURCE_APP))) fail(`official WorkBuddy app not found: ${SOURCE_APP}`);
  const temporary = join(tmpdir(), `workbuddy-theme-${process.pid}`);
  mkdirSync(dirname(target), { recursive: true }); mkdirSync(temporary, { recursive: true });
  try {
    console.log(`Creating ${basename(target)} without modifying the official WorkBuddy app…`);
    rmSync(target, { recursive: true, force: true }); run("ditto", [SOURCE_APP, target]);
    let wallpaperUrl = null;
    if (theme.wallpaper && theme.wallpaperScope !== "none") {
      const extension = extname(theme.wallpaper) || ".jpg";
      const destination = join(target, "Contents", "Resources", `workbuddy-theme-wallpaper${extension}`);
      copyFileSync(theme.wallpaper, destination); wallpaperUrl = pathToFileURL(destination).href;
    }
    const archive = readArchive(appArchive(target));
    try {
      const index = getEntry(archive.header, ["renderer", "index.html"]);
      const stylesheet = findPatchCss(archive);
      const indexHash = writePaddedEntry(archive, index, injectIndex(readEntry(archive, index), cssFor(theme, wallpaperUrl)), "index.html");
      const persist = persistentCss(theme, wallpaperUrl);
      let compiled = replaceSlot(stylesheet.text, "/**\n * WbMentionPanel", persist.base);
      compiled = replaceSlot(compiled, "/**\n * `mode` 模块二级面板样式", persist.pages);
      compiled = replaceSlot(compiled, "/**\n * 状态芯片群共享基础样式", persist.hover);
      compiled = replaceSlot(compiled, "/**\n * ChatSearchButton styles", persist.selected);
      const stylesheetHash = writePaddedEntry(archive, stylesheet.entry, compiled, stylesheet.parts.join("/"));
      updateIntegrity(archive, [[index, indexHash], [stylesheet.entry, stylesheetHash]]);
    } finally { closeSync(archive.fd); }
    const plist = join(target, "Contents", "Info.plist");
    run("/usr/libexec/PlistBuddy", ["-c", `Set :CFBundleDisplayName WorkBuddy ${theme.name}`, plist]);
    run("/usr/libexec/PlistBuddy", ["-c", `Set :CFBundleIdentifier com.workbuddy.workbuddy.theme.${paths.safe}`, plist]);
    run("xattr", ["-cr", target]); run("codesign", ["--force", "--deep", "--sign", "-", target]); run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", target]);
    mkdirSync(paths.data, { recursive: true }); mkdirSync(paths.home, { recursive: true });
    const launcherScript = join(temporary, "launch.applescript");
    const electron = join(target, "Contents", "MacOS", "Electron");
    writeFileSync(launcherScript, `do shell script "/usr/bin/env HOME=" & quoted form of ${JSON.stringify(paths.home)} & " " & quoted form of ${JSON.stringify(electron)} & " --user-data-dir=" & quoted form of ${JSON.stringify(paths.data)} & " >/dev/null 2>&1 &"\n`);
    rmSync(paths.launcher, { recursive: true, force: true }); run("osacompile", ["-o", paths.launcher, launcherScript]);
    asJson({ applied: true, theme: theme.name, app: target, launcher: paths.launcher, data: paths.data, officialAppModified: false });
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
function remove(themeName, purgeData) {
  macOnly();
  const theme = { name: cleanName(themeName) };
  if (!theme.name) fail("provide a theme name with --theme");
  const paths = launcherPaths(theme);
  rmSync(paths.target, { recursive: true, force: true }); rmSync(paths.launcher, { recursive: true, force: true });
  if (purgeData) { rmSync(paths.data, { recursive: true, force: true }); rmSync(paths.home, { recursive: true, force: true }); }
  asJson({ removed: true, theme: theme.name, localDataPurged: Boolean(purgeData), officialAppModified: false });
}

export {
  SOURCE_APP, MANAGER_DIR, appArchive, cssFor, defaults, findPatchCss, getEntry,
  injectIndex, loadTheme, persistentCss, readArchive, readEntry, replaceSlot,
  updateIntegrity, writePaddedEntry
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (command === "inspect") inspect();
  else if (command === "apply") apply(flags.theme, flags.target);
  else if (command === "remove") remove(flags.theme, flags["purge-data"]);
  else { console.error(usage); process.exit(1); }
}
