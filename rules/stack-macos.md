---
description: macOS desktop rules for SwiftUI scenes, menus, menu bar apps, sandbox, entitlements, windows, appearance, accessibility and distribution. Applies when you edit a macOS app.
paths:
  - "**/*.swift"
  - "**/*.entitlements"
  - "**/Info.plist"
  - "**/Package.swift"
stacks: [macos-desktop]
---
# macOS rules

## App structure
- Use the SwiftUI `App` lifecycle with `WindowGroup`, a `Settings` scene and `.commands`.
- Use AppKit through `NSViewRepresentable` or `NSApplicationDelegateAdaptor` only where SwiftUI has no equivalent.
- Build a menu bar app with `MenuBarExtra` (macOS 13 or later). Set `LSUIElement` to `YES` in `Info.plist` to hide the Dock icon.
- Give each window a minimum size. Restore state with `@SceneStorage` and `@AppStorage`.
- Use `NavigationSplitView` for sidebar and detail layouts.
- Launch at login with `SMAppService`. Do not use `SMLoginItemSetEnabled`.

## Menus and input
- Define menus in `.commands` with `CommandGroup` and `CommandMenu`. Keep the standard menus: App, File, Edit, View, Window, Help.
- Give each command a `.keyboardShortcut`. Do not remap a standard shortcut such as Cmd+, (Settings), Cmd+W or Cmd+Q.
- Add a `.contextMenu` to each object that the user can act on.
- Support full keyboard navigation and focus. Support drag and drop where it fits the task.

## Sandbox and files
- Enable App Sandbox (`com.apple.security.app-sandbox`) for an App Store build. Add only the entitlements that the app needs.
- Request file access through `.fileImporter`, `.fileExporter` or `NSOpenPanel`. Do not read arbitrary paths.
- Keep access to a user-chosen file with a security-scoped bookmark: `bookmarkData(options: .withSecurityScope)`.
- Call `startAccessingSecurityScopedResource()` before you read the file. Call `stopAccessingSecurityScopedResource()` after.
- Write app data under `URL.applicationSupportDirectory`. Do not write into the app bundle.

## Appearance
- Use semantic colours and system materials. Support Light, Dark and the accent colour. Do not hard-code colours.
- Let system chrome (toolbar, sidebar, window) draw its own material. Do not paint a custom background behind it.
- Give each icon-only control an accessibility label. Honor Reduce Motion.

## Distribution and checks
- For a build outside the App Store, sign with a Developer ID. Enable Hardened Runtime. Notarize with `xcrun notarytool`.
- Test with Swift Testing and XCUITest. Run `xcodebuild test -scheme <scheme> -destination 'platform=macOS'`.
- Read more in the upstream source `apple-macos` (skills `ui-review-tahoe`, `macos-capabilities`) when the host lists it in `upstream`.
