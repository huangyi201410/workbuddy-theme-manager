#!/usr/bin/env node

import {
  closeSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync,
  renameSync, rmSync, unlinkSync, writeFileSync
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as core from "./workbuddy-theme.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(homedir(), "Library", "Application Support", "WorkBuddy Theme Studio");
const statePath = join(studioRoot, "state.json");
const studioApp = join(homedir(), "Applications", "WorkBuddy Theme Studio.app");
const studioBundleId = "com.workbuddy.theme-studio";
const usage = `Usage:
  workbuddy-theme-studio.mjs inspect
  workbuddy-theme-studio.mjs install-studio [--open]
  workbuddy-theme-studio.mjs bootstrap
  workbuddy-theme-studio.mjs install-menu
  workbuddy-theme-studio.mjs apply-official --theme /absolute/path/theme.json
  workbuddy-theme-studio.mjs restore
  workbuddy-theme-studio.mjs uninstall`;

function fail(message) { console.error(`WorkBuddy Theme Studio: ${message}`); process.exit(1); }
function run(command, args, options = {}) { return execFileSync(command, args, { stdio: "inherit", ...options }); }
function quiet(command, args) { try { return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } }
function asJson(value) { console.log(JSON.stringify(value, null, 2)); }
function macOnly() { if (process.platform !== "darwin") fail("this Studio mode supports macOS only"); }
function registerStudioUrlScheme() {
  const lsregister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
  if (!existsSync(lsregister)) fail("macOS Launch Services registration tool is unavailable");
  run(lsregister, ["-f", studioApp]);
}
function unregisterStudioUrlScheme() {
  const lsregister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
  if (!existsSync(lsregister) || !existsSync(studioApp)) return;
  try { run(lsregister, ["-u", studioApp]); } catch { /* Removing the app still clears the usable handler. */ }
}
function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) fail(`unexpected argument: ${token}`);
    const key = token.slice(2);
    flags[key] = key === "open" ? true : rest[++i];
    if (flags[key] === undefined) fail(`missing value for --${key}`);
  }
  return { command, flags };
}
function versionOf(app = core.SOURCE_APP) {
  return quiet("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleShortVersionString", join(app, "Contents", "Info.plist")]);
}
function readState() { try { return JSON.parse(readFileSync(statePath, "utf8")); } catch { return null; } }
function writeState(state) { mkdirSync(studioRoot, { recursive: true }); writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`); }
function backupPath(version) { return join(studioRoot, "backups", `WorkBuddy-${version}.app`); }
function appIsPatched(app = core.SOURCE_APP) {
  const archive = core.readArchive(core.appArchive(app), false);
  try { return core.readEntry(archive, core.getEntry(archive.header, ["renderer", "index.html"])).includes("workbuddy-theme-manager"); }
  finally { closeSync(archive.fd); }
}
function quitWorkBuddy() {
  quiet("osascript", ["-e", 'tell application id "com.workbuddy.workbuddy" to quit']);
  run("/bin/sleep", ["1"]);
}
function replaceOfficialApp(fromApp) {
  const appsDir = dirname(core.SOURCE_APP);
  const staged = join(appsDir, `.WorkBuddy Theme Studio Stage ${process.pid}.app`);
  const displaced = join(appsDir, `.WorkBuddy Theme Studio Previous ${process.pid}.app`);
  rmSync(staged, { recursive: true, force: true }); rmSync(displaced, { recursive: true, force: true });
  run("ditto", [fromApp, staged]);
  if (!existsSync(core.appArchive(staged))) fail("staged application is incomplete");
  renameSync(core.SOURCE_APP, displaced);
  try {
    renameSync(staged, core.SOURCE_APP);
    rmSync(displaced, { recursive: true, force: true });
  } catch (error) {
    if (!existsSync(core.SOURCE_APP) && existsSync(displaced)) renameSync(displaced, core.SOURCE_APP);
    throw error;
  } finally { rmSync(staged, { recursive: true, force: true }); }
}
function createBackup(version) {
  const backup = backupPath(version);
  if (!existsSync(backup)) {
    mkdirSync(dirname(backup), { recursive: true });
    run("ditto", [core.SOURCE_APP, backup]);
  }
  return backup;
}
function prepareOriginal() {
  const version = versionOf();
  if (!version || !existsSync(core.appArchive(core.SOURCE_APP))) fail(`official WorkBuddy app not found: ${core.SOURCE_APP}`);
  const state = readState();
  if (state?.backupApp && state.version === version && existsSync(state.backupApp)) {
    quitWorkBuddy();
    replaceOfficialApp(state.backupApp);
    return { version, backupApp: state.backupApp };
  }
  if (appIsPatched()) fail("a prior theme patch was found without a matching Studio backup; restore or reinstall WorkBuddy before continuing");
  return { version, backupApp: createBackup(version) };
}
function removeStudioWallpaper() {
  const resources = join(core.SOURCE_APP, "Contents", "Resources");
  for (const name of readdirSync(resources)) {
    if (name.startsWith("workbuddy-theme-studio-wallpaper.")) unlinkSync(join(resources, name));
  }
}
function menuScript() {
  return `<script id="workbuddy-theme-studio-menu">(()=>{const u="workbuddy-theme-studio://open";function r(){if(document.getElementById("workbuddy-theme-studio-entry"))return;const l=[...document.querySelectorAll("span,div,p")].find(e=>e.children.length===0&&e.textContent?.trim()==="外观");if(!l)return;let r=l.closest("button")||l.parentElement;if(!r?.parentElement)return;const b=document.createElement("button");b.id="workbuddy-theme-studio-entry";b.type="button";b.className=r.className||"";b.style.cssText="box-sizing:border-box;border:0;background:transparent;color:inherit;width:100%;min-height:42px;padding:0 14px;display:flex;align-items:center;gap:10px;text-align:left;font:inherit;cursor:pointer;border-radius:8px";b.innerHTML='<span aria-hidden="true" style="font-size:18px">◌</span><span style="flex:1">主题</span><span aria-hidden="true" style="opacity:.55;font-size:18px">›</span>';b.onmouseenter=()=>b.style.background="rgba(0,0,0,.06)";b.onmouseleave=()=>b.style.background="transparent";b.onclick=e=>{e.preventDefault();const a=document.createElement("a");a.href=u;a.target="_blank";a.rel="noreferrer";document.body.append(a);a.click();setTimeout(()=>a.remove(),100)};r.insertAdjacentElement("afterend",b)}document.addEventListener("click",()=>setTimeout(r,0));setInterval(r,900)})();</script>`;
}
function patchOfficial(theme = null) {
  const archive = core.readArchive(core.appArchive(core.SOURCE_APP));
  try {
    const index = core.getEntry(archive.header, ["renderer", "index.html"]);
    const style = core.findPatchCss(archive);
    let wallpaperUrl = null;
    if (theme?.wallpaper && theme.wallpaperScope !== "none") {
      removeStudioWallpaper();
      const target = join(core.SOURCE_APP, "Contents", "Resources", `workbuddy-theme-studio-wallpaper${extname(theme.wallpaper) || ".jpg"}`);
      copyFileSync(theme.wallpaper, target);
      wallpaperUrl = pathToFileURL(target).href;
    } else { removeStudioWallpaper(); }
    const css = theme ? core.cssFor(theme, wallpaperUrl) : "";
    const indexHash = core.writePaddedEntry(archive, index, core.injectIndex(core.readEntry(archive, index), css, menuScript()), "index.html");
    const updates = [[index, indexHash]];
    if (theme) {
      const persist = core.persistentCss(theme, wallpaperUrl);
      let compiled = core.replaceSlot(style.text, "/**\n * WbMentionPanel", persist.base);
      compiled = core.replaceSlot(compiled, "/**\n * `mode` 模块二级面板样式", persist.pages);
      compiled = core.replaceSlot(compiled, "/**\n * 状态芯片群共享基础样式", persist.hover);
      compiled = core.replaceSlot(compiled, "/**\n * ChatSearchButton styles", persist.selected);
      updates.push([style.entry, core.writePaddedEntry(archive, style.entry, compiled, style.parts.join("/"))]);
    }
    core.updateIntegrity(archive, updates);
  } finally { closeSync(archive.fd); }
  run("xattr", ["-cr", core.SOURCE_APP]);
  run("codesign", ["--force", "--deep", "--sign", "-", core.SOURCE_APP]);
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", core.SOURCE_APP]);
}
function inspect() {
  macOnly();
  const version = versionOf();
  if (!version || !existsSync(core.appArchive(core.SOURCE_APP))) fail(`official WorkBuddy app not found: ${core.SOURCE_APP}`);
  const archive = core.readArchive(core.appArchive(core.SOURCE_APP), false);
  try {
    const index = core.getEntry(archive.header, ["renderer", "index.html"]);
    const style = core.findPatchCss(archive);
    const state = readState();
    asJson({ sourceApp: core.SOURCE_APP, version, supported: true, indexHtmlBytes: index.size, stylesheet: style.parts.join("/"), patched: appIsPatched(), studioApp, studioInstalled: existsSync(studioApp), backupAvailable: Boolean(state?.backupApp && existsSync(state.backupApp)), mode: "official-in-place-with-full-app-backup" });
  } finally { closeSync(archive.fd); }
}
function installStudio(openAfter = false) {
  macOnly();
  const swift = quiet("/usr/bin/which", ["swiftc"]);
  const node = quiet("/usr/bin/which", ["node"]);
  if (!swift) fail("Swift compiler is required to build WorkBuddy Theme Studio.app");
  if (!node) fail("Node.js is required for the local theme engine");
  const source = join(scriptDir, "..", "assets", "ThemeStudio.swift");
  if (!existsSync(source)) fail(`Studio source is missing: ${source}`);
  const contents = join(studioApp, "Contents");
  const macos = join(contents, "MacOS");
  const resources = join(contents, "Resources");
  const temporary = join(tmpdir(), `workbuddy-theme-studio-${process.pid}`);
  rmSync(studioApp, { recursive: true, force: true }); mkdirSync(macos, { recursive: true }); mkdirSync(resources, { recursive: true }); mkdirSync(temporary, { recursive: true });
  try {
    const plist = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleDisplayName</key><string>WorkBuddy Theme Studio</string><key>CFBundleExecutable</key><string>WorkBuddyThemeStudio</string><key>CFBundleIdentifier</key><string>${studioBundleId}</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>1.0</string><key>CFBundleVersion</key><string>1</string><key>LSMinimumSystemVersion</key><string>13.0</string><key>LSMultipleInstancesProhibited</key><true/><key>NSHighResolutionCapable</key><true/><key>WBThemeEnginePath</key><string>${xml(scriptDir + "/workbuddy-theme-studio.mjs")}</string><key>WBThemeNodePath</key><string>${xml(node)}</string><key>CFBundleURLTypes</key><array><dict><key>CFBundleURLName</key><string>${studioBundleId}</string><key>CFBundleURLSchemes</key><array><string>workbuddy-theme-studio</string></array></dict></array></dict></plist>`;
    writeFileSync(join(contents, "Info.plist"), plist);
    const presetResources = join(resources, "presets");
    cpSync(join(scriptDir, "..", "presets"), presetResources, { recursive: true });
    run(swift, [source, "-parse-as-library", "-o", join(macos, "WorkBuddyThemeStudio"), "-framework", "SwiftUI", "-framework", "AppKit"]);
    run("codesign", ["--force", "--deep", "--sign", "-", studioApp]);
    registerStudioUrlScheme();
    if (openAfter) run("open", [studioApp]);
    asJson({ installed: true, studioApp, urlScheme: "workbuddy-theme-studio://open", engine: join(scriptDir, "workbuddy-theme-studio.mjs") });
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
function xml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function installMenu() {
  macOnly();
  const baseline = prepareOriginal();
  try {
    patchOfficial();
    writeState({ version: baseline.version, backupApp: baseline.backupApp, mode: "menu-only", appliedAt: new Date().toISOString() });
    asJson({ installed: true, menu: "账号菜单 > 外观 > 主题", backupApp: baseline.backupApp, officialAppModified: true });
  } catch (error) {
    replaceOfficialApp(baseline.backupApp);
    throw error;
  }
}
function applyOfficial(themePath) {
  macOnly();
  const theme = core.loadTheme(themePath);
  const baseline = prepareOriginal();
  try {
    patchOfficial(theme);
    writeState({ version: baseline.version, backupApp: baseline.backupApp, theme, mode: "theme", appliedAt: new Date().toISOString() });
    run("open", [core.SOURCE_APP]);
    asJson({ applied: true, theme: theme.name, backupApp: baseline.backupApp, officialAppModified: true, restoredBy: "workbuddy-theme-studio.mjs restore" });
  } catch (error) {
    replaceOfficialApp(baseline.backupApp);
    throw error;
  }
}
function restore() {
  macOnly();
  const state = readState();
  if (!state?.backupApp || !existsSync(state.backupApp)) fail("no Studio backup is available to restore");
  quitWorkBuddy();
  replaceOfficialApp(state.backupApp);
  rmSync(statePath, { force: true });
  run("open", [core.SOURCE_APP]);
  asJson({ restored: true, sourceApp: core.SOURCE_APP, backupRetained: state.backupApp, officialAppModified: false });
}
function uninstall() {
  macOnly();
  const state = readState();
  const hasBackup = Boolean(state?.backupApp && existsSync(state.backupApp));
  const sourceArchive = core.appArchive(core.SOURCE_APP);
  const patched = existsSync(sourceArchive) && appIsPatched();
  if (patched && !hasBackup) {
    fail("cannot safely uninstall because WorkBuddy is patched but the Studio backup is unavailable; restore or reinstall WorkBuddy before uninstalling Studio");
  }
  if (hasBackup) {
    if (!existsSync(sourceArchive)) fail(`official WorkBuddy app not found: ${core.SOURCE_APP}`);
    quitWorkBuddy();
    replaceOfficialApp(state.backupApp);
    run("open", [core.SOURCE_APP]);
  }
  unregisterStudioUrlScheme();
  rmSync(studioApp, { recursive: true, force: true });
  rmSync(studioRoot, { recursive: true, force: true });
  asJson({
    uninstalled: true,
    officialAppRestored: hasBackup,
    removed: [studioApp, studioRoot],
    message: "WorkBuddy Theme Studio 已卸载；主题菜单入口已移除，WorkBuddy 已恢复官方版本。任务和项目数据未被修改。"
  });
}
function bootstrap() {
  installStudio(false);
  installMenu();
  run("open", [studioApp]);
  asJson({
    installed: true,
    studioApp,
    menu: "左下角头像 → 外观 → 主题",
    nextStep: "主题功能已安装。点击左下角头像，选择外观下的主题，即可打开 WorkBuddy Theme Studio；选择预设或壁纸后，点击“应用到官方 WorkBuddy”才会应用主题。"
  });
}

const { command, flags } = parseArgs(process.argv.slice(2));
if (command === "inspect") inspect();
else if (command === "install-studio") installStudio(flags.open);
else if (command === "bootstrap") bootstrap();
else if (command === "install-menu") installMenu();
else if (command === "apply-official") applyOfficial(flags.theme);
else if (command === "restore") restore();
else if (command === "uninstall") uninstall();
else { console.error(usage); process.exit(1); }
