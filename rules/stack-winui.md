---
description: WinUI 3 and Windows App SDK rules for XAML, bindings, MVVM, threading, windows, dialogs, theming, accessibility and packaging. Applies when you edit a WinUI desktop app.
paths:
  - "**/*.xaml"
  - "**/*.xaml.cs"
  - "**/*.cs"
  - "**/*.csproj"
  - "**/Package.appxmanifest"
  - "**/*.resw"
stacks: [winui-desktop]
---
# WinUI rules

## Platform
- Use WinUI 3 with the Windows App SDK. Use the `Microsoft.UI.Xaml` namespaces. `Windows.UI.Xaml` is UWP and does not apply.
- Set `UseWinUI` to `true`. Use a `net*-windows10.*` target framework. Set `TargetPlatformMinVersion` to the lowest Windows version you support.
- Choose packaged (MSIX) or unpackaged at the start. Do not use `Package.Current` or `ApplicationData.Current` in an unpackaged app.
- Declare only the capabilities the app uses in `Package.appxmanifest`.

## XAML and bindings
- Prefer `{x:Bind}` to `{Binding}`. Set `Mode=OneWay` or `Mode=TwoWay`, because the default is `OneTime`.
- Set `x:DataType` on each `DataTemplate` that uses `{x:Bind}`.
- Use `{ThemeResource}` for brushes and styles, such as `TextFillColorPrimaryBrush` and `CardBackgroundFillColorDefaultBrush`. Do not hard-code colours.
- Use the built-in text styles: `TitleTextBlockStyle`, `SubtitleTextBlockStyle`, `BodyTextBlockStyle`, `CaptionTextBlockStyle`.
- Use Fluent controls. Use `NavigationView` for top-level navigation.
- Space elements in multiples of 4 effective pixels. Use `StackPanel.Spacing`, not a margin on each child.
- Adapt the layout with `VisualStateManager` and `AdaptiveTrigger`.
- Put UI text in `Resources.resw` and bind it with `x:Uid`. Do not hard-code UI text.

## MVVM and threading
- Use MVVM with `CommunityToolkit.Mvvm`: `[ObservableProperty]` and `[RelayCommand]`. Keep code-behind for view-only logic.
- Keep view models and services free of WinUI types. Test them in a plain .NET test project.
- Do not block the UI thread. Use `async` and `await`.
- Update the UI from another thread with `DispatcherQueue.TryEnqueue`. Do not use `CoreDispatcher`.

## Windows and dialogs
- Do not use `Window.Current` or `GetForCurrentView()`. They fail in a desktop app. Pass in the `Window` or its `XamlRoot`.
- Set `XamlRoot` on each `ContentDialog` and `Popup` before you show it.
- Initialize each file or folder picker with the window handle: `WinRT.Interop.InitializeWithWindow.Initialize(picker, hwnd)`.
- Draw a custom title bar with `ExtendsContentIntoTitleBar` and `SetTitleBar`. Use `MicaBackdrop` on Windows 11.

## Accessibility
- Set `AutomationProperties.Name` on each icon-only control.
- Support the keyboard: set `TabIndex`, `AccessKey` and `KeyboardAccelerator` on primary actions.
- Check the light, dark and high-contrast themes. A hard-coded colour fails high contrast.

## Checks
- Before you finish, run `dotnet build` and `dotnet test`.
- Read more in the upstream source `winui` (skills `winui-design`, `winui-code-review`, `winui-dev-workflow`) when the host lists it in `upstream`.
