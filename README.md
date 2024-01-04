# LiveView Native Extension for Visual Studio Code

This is an *experimental* extension that provides documentation and Intellisense for LiveView Native projects.

When you first open a workspace with a `mix.exs` file that has a `live_view_native_swift_ui` dependency, the documentation will be built.
You can see the status in the bottom bar of VS Code.

Once this is complete, hovering over any element in an `*.ios.heex` file will display the documentation.
This will also enable autocomplete for elements and context-specific attributes.

## Installation

While this extension is pending release to the Visual Studio Marketplace you will have to install it manually.

1. Download the [latest VSIX package](https://github.com/liveview-native/liveview-native-vscode/releases)
2. In Visual Studio Code, select *Extensions* (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>X</kbd>) → *More Actions...* (`⋯`) → *Install from VSIX...*
![Screenshot of the `Install from VSIX...` menu item](docs/install-vsix.png)
3. Choose the downloaded `.vsix` file
    * Alternatively, you can drag and drop the `.vsix` file onto the *Extensions* panel
4. When prompted, reload the window
