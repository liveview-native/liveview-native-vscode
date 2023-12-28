# LiveView Native Extension for Visual Studio Code

This is an *experimental* extension that provides documentation and Intellisense for LiveView Native projects.

When you first open a workspace with a `mix.exs` file that has a `live_view_native_swift_ui` dependency, the documentation will be built.
You can see the status in the bottom bar of VS Code.

Once this is complete, hovering over any element in an `*.ios.heex` file will display the documentation.
This will also enable autocomplete for elements and context-specific attributes.

## Installation

While this extension is pending release to the VSCode Store you will have to install it manually.

1. Clone or download this project: `git clone https://github.com/liveview-native/liveview-native-vscode.git`
2. Copy the project directory to `~/.vscode/extensions/`, or `C:\Users\USER_NAME\.vscode\extensions` (on Windows)
3. Restart VSCode
