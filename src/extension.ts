import * as vscode from 'vscode';

import { loadLocalDocumentation } from './documentation';

import hoverProvider from './hover';
import completionItemProvider from './completions';
import * as config from './config';

const selector = [
    { language: 'phoenix-heex', pattern: '**/*.swiftui.heex' },
    { language: 'elixir' }
];

export async function activate(context: vscode.ExtensionContext) {
    (global as any).extensionContext = context;

    if (config.swiftUI().documentationSource === 'local') {
        await loadLocalDocumentation();
    }

    const hover = vscode.languages.registerHoverProvider(selector, hoverProvider);
    const completions = vscode.languages.registerCompletionItemProvider(selector, completionItemProvider);

    const clearCache = vscode.commands.registerCommand("liveviewnative.clearCache", (args) => {
        context.workspaceState.update("hosted_view_list", undefined);
    });

    context.subscriptions.push(hover, completions, clearCache);
}

export function deactivate() { }
