import * as vscode from 'vscode';

export const swiftUI = () => {
    const config = vscode.workspace.getConfiguration("liveViewNative.swiftUI");
    return {
        documentationSource: config.get("documentationSource", "hosted") as "hosted" | "local",
    };
};