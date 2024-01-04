import * as vscode from 'vscode';

import { loadLocalDocumentation } from './documentation';

import hoverProvider from './hover';
import { markupCompletionItemProvider, stylesheetCompletionItemProvider } from './completions';
import * as config from './config';

const heexSelector = [
    { language: 'phoenix-heex', pattern: '**/*.swiftui.heex' },
    { language: 'elixir' }
];

const sheetSelector = [
    { language: 'elixir' }
];

export async function activate(context: vscode.ExtensionContext) {
    (global as any).extensionContext = context;

    if (config.swiftUI().documentationSource === 'local') {
        await loadLocalDocumentation();
    }

    const heexHover = vscode.languages.registerHoverProvider(heexSelector, hoverProvider);
    const heexCompletions = vscode.languages.registerCompletionItemProvider(heexSelector, markupCompletionItemProvider);

    const sheetCompletions = vscode.languages.registerCompletionItemProvider(sheetSelector, stylesheetCompletionItemProvider);

    const clearCache = vscode.commands.registerCommand("liveviewnative.clearCache", (args) => {
        context.workspaceState.update("hosted_view_list", undefined);
    });

    context.subscriptions.push(heexHover, heexCompletions, sheetCompletions, clearCache);
}

export function deactivate() { }
