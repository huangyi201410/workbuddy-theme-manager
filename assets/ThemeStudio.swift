import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct ThemeColors: Codable {
    var canvas: String = "#FFF1F6"
    var sidebar: String = "#FFEDF4"
    var sidebarHover: String = "#F9E9EF"
    var sidebarSelected: String = "#F3E5EA"
    var accent: String = "#F13D72"
    var accentHover: String = "#DF275F"
    var text: String = "#5B2035"
    var heading: String = "#AE1949"
    var border: String = "#F1CBD7"
}

struct ThemePreset: Codable, Identifiable {
    let name: String
    let wallpaperScope: String
    let colors: ThemeColors
    var id: String { name }
}

struct ThemeConfig: Codable {
    var name: String
    var wallpaper: String?
    var wallpaperScope: String
    var colors: ThemeColors
}

@MainActor
final class StudioModel: ObservableObject {
    @Published var presets: [ThemePreset] = []
    @Published var selectedPreset = "Rose"
    @Published var themeName = "Rose"
    @Published var wallpaperPath = ""
    @Published var wallpaperScope = "home"
    @Published var colors = ThemeColors()
    @Published var status = "就绪：选择主题并预览。"
    @Published var isWorking = false

    init() {
        loadPresets()
        choosePreset("Rose")
    }

    var previewImage: NSImage? {
        guard !wallpaperPath.isEmpty else { return nil }
        return NSImage(contentsOfFile: wallpaperPath)
    }

    func loadPresets() {
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("presets"),
              let files = try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) else { return }
        presets = files.compactMap { url in
            guard url.pathExtension == "json", let data = try? Data(contentsOf: url) else { return nil }
            return try? JSONDecoder().decode(ThemePreset.self, from: data)
        }.sorted { $0.name == "Rose" || $0.name < $1.name }
    }

    func choosePreset(_ name: String) {
        guard let preset = presets.first(where: { $0.name == name }) else { return }
        selectedPreset = preset.name
        themeName = preset.name
        wallpaperScope = preset.wallpaperScope
        colors = preset.colors
        status = "已选择 (preset.name) 预设。"
    }

    func chooseWallpaper() {
        let panel = NSOpenPanel()
        panel.title = "选择主题壁纸"
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [.image]
        if panel.runModal() == .OK, let url = panel.url {
            wallpaperPath = url.path
            status = "已选择壁纸：(url.lastPathComponent)"
        }
    }

    func clearWallpaper() {
        wallpaperPath = ""
        wallpaperScope = "none"
        status = "已移除壁纸。"
    }

    func apply() { runEngine("apply-official", includeTheme: true) }
    func restore() { runEngine("restore", includeTheme: false) }

    private func runEngine(_ command: String, includeTheme: Bool) {
        guard !isWorking else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            var arguments = [enginePath, command]
            if includeTheme {
                arguments += ["--theme", try writeThemeConfig().path]
            }
            let process = Process()
            process.executableURL = URL(fileURLWithPath: nodePath)
            process.arguments = arguments
            let output = Pipe()
            process.standardOutput = output
            process.standardError = output
            try process.run()
            process.waitUntilExit()
            let message = String(data: output.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            status = process.terminationStatus == 0 ? (message.isEmpty ? "操作完成。" : message) : "操作失败：\n(message)"
        } catch {
            status = "无法运行本机主题引擎：(error.localizedDescription)"
        }
    }

    private var enginePath: String {
        Bundle.main.object(forInfoDictionaryKey: "WBThemeEnginePath") as? String ?? ""
    }

    private var nodePath: String {
        Bundle.main.object(forInfoDictionaryKey: "WBThemeNodePath") as? String ?? "/usr/bin/env"
    }

    private func writeThemeConfig() throws -> URL {
        let root = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/WorkBuddy Theme Studio/themes", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let destination = root.appendingPathComponent("current-theme.json")
        let config = ThemeConfig(
            name: themeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? selectedPreset : themeName,
            wallpaper: wallpaperScope == "none" || wallpaperPath.isEmpty ? nil : wallpaperPath,
            wallpaperScope: wallpaperScope,
            colors: colors
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(config).write(to: destination, options: .atomic)
        return destination
    }
}

struct StudioView: View {
    @StateObject private var model = StudioModel()

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("WorkBuddy Theme Studio").font(.title2.weight(.bold))
                    Text("预览、备份并应用本机主题；任务和项目数据不会被改动。")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                Button("恢复官方版本", role: .destructive) { model.restore() }
                    .disabled(model.isWorking)
            }
            .padding(24)

            Divider()

            HStack(alignment: .top, spacing: 20) {
                Form {
                    Section("主题预设") {
                        Picker("选择预设", selection: $model.selectedPreset) {
                            ForEach(model.presets) { Text(modelLabel($0.name)).tag($0.name) }
                        }
                        .onChange(of: model.selectedPreset) { _, name in model.choosePreset(name) }
                        TextField("主题名称", text: $model.themeName)
                    }
                    Section("壁纸") {
                        HStack {
                            Text(model.wallpaperPath.isEmpty ? "未选择壁纸" : URL(fileURLWithPath: model.wallpaperPath).lastPathComponent)
                                .lineLimit(1).foregroundStyle(model.wallpaperPath.isEmpty ? .secondary : .primary)
                            Spacer()
                            Button("选择…") { model.chooseWallpaper() }
                        }
                        Picker("显示范围", selection: $model.wallpaperScope) {
                            Text("首页").tag("home")
                            Text("全右侧").tag("main")
                            Text("无").tag("none")
                        }.pickerStyle(.segmented)
                        Button("移除壁纸") { model.clearWallpaper() }.disabled(model.wallpaperPath.isEmpty)
                    }
                    Section("颜色") {
                        colorField("主背景", \.canvas)
                        colorField("侧栏", \.sidebar)
                        colorField("Hover", \.sidebarHover)
                        colorField("Selected", \.sidebarSelected)
                        colorField("主操作", \.accent)
                        colorField("主操作 Hover", \.accentHover)
                        colorField("正文", \.text)
                        colorField("标题", \.heading)
                        colorField("边框", \.border)
                    }
                }
                .formStyle(.grouped)
                .frame(width: 360)

                VStack(alignment: .leading, spacing: 12) {
                    Text("实时预览").font(.headline)
                    preview
                    Text("“应用到官方 WorkBuddy”会先完整备份官方应用包，再注入主题和账号菜单中的「主题」入口。")
                        .font(.caption).foregroundStyle(.secondary)
                    Button(model.isWorking ? "正在应用…" : "应用到官方 WorkBuddy") { model.apply() }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(hex: model.colors.accent))
                        .disabled(model.isWorking)
                    Text(model.status)
                        .font(.caption.monospaced()).foregroundStyle(.secondary)
                        .textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(24)
        }
        .frame(minWidth: 940, minHeight: 650)
        .onOpenURL { _ in
            NSApp.activate(ignoringOtherApps: true)
            DispatchQueue.main.async {
                NSApp.windows.first(where: { $0.isVisible && $0.canBecomeKey })?.makeKeyAndOrderFront(nil)
            }
        }
    }

    private func colorField(_ title: String, _ keyPath: WritableKeyPath<ThemeColors, String>) -> some View {
        TextField(title, text: Binding(get: { model.colors[keyPath: keyPath] }, set: { model.colors[keyPath: keyPath] = $0.uppercased() }))
            .textFieldStyle(.roundedBorder)
    }

    private var preview: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18).fill(Color(hex: model.colors.canvas))
            if let image = model.previewImage, model.wallpaperScope != "none" {
                Image(nsImage: image).resizable().scaledToFill().opacity(0.34).clipShape(RoundedRectangle(cornerRadius: 18))
            }
            HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("WorkBuddy").font(.headline).foregroundStyle(Color(hex: model.colors.heading))
                    previewRow("新建任务", selected: true)
                    previewRow("助理")
                    previewRow("项目")
                    previewRow("自动化")
                    Spacer()
                }
                .padding(16).frame(width: 170, alignment: .leading)
                .background(Color(hex: model.colors.sidebar).opacity(0.92))
                VStack(alignment: .leading, spacing: 16) {
                    Text("你的职场超能力").font(.title3.weight(.bold)).foregroundStyle(Color(hex: model.colors.heading))
                    Text("壁纸、颜色和导航状态的效果预览").foregroundStyle(Color(hex: model.colors.text))
                    HStack {
                        Text("日常办公").padding(.horizontal, 14).padding(.vertical, 8).background(Color(hex: model.colors.accent)).foregroundStyle(.white).clipShape(Capsule())
                        Text("代码开发").padding(.horizontal, 14).padding(.vertical, 8).background(.white.opacity(0.70)).clipShape(Capsule())
                    }
                    RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.82)).frame(height: 120).overlay(alignment: .topLeading) {
                        Text("今天帮你做些什么？").foregroundStyle(.secondary).padding(16)
                    }
                    Spacer()
                }
                .padding(28).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            .clipShape(RoundedRectangle(cornerRadius: 18))
        }
        .frame(height: 330).overlay(RoundedRectangle(cornerRadius: 18).stroke(Color(hex: model.colors.border), lineWidth: 1))
    }

    private func previewRow(_ title: String, selected: Bool = false) -> some View {
        Text(title).foregroundStyle(Color(hex: model.colors.text)).padding(.horizontal, 10).padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? Color(hex: model.colors.sidebarSelected) : .clear).clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func modelLabel(_ name: String) -> String {
        ["Rose": "Rose（当前粉色）", "Mint": "Mint（薄荷绿）", "Lavender": "Lavender（淡紫）", "Sky": "Sky（浅蓝）"][name] ?? name
    }
}

extension Color {
    init(hex: String) {
        let value = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        let number = UInt64(value, radix: 16) ?? 0
        self.init(.sRGB, red: Double((number >> 16) & 255) / 255, green: Double((number >> 8) & 255) / 255, blue: Double(number & 255) / 255, opacity: 1)
    }
}

@main
struct WorkBuddyThemeStudioApp: App {
    var body: some Scene {
        WindowGroup {
            StudioView()
        }
        .handlesExternalEvents(matching: Set(["workbuddy-theme-studio"]))
    }
}
