import * as vscode from 'vscode';

import { loadLocalDocumentation } from './documentation';

import hoverProvider from './hover';
import { markupCompletionItemProvider, stylesheetCompletionItemProvider } from './completions';
import { stylesheetColorProvider } from './color';
import * as config from './config';

const neexSelector = [
    { language: 'neex', pattern: '**/*.swiftui.neex' },
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

    const neexHover = vscode.languages.registerHoverProvider(neexSelector, hoverProvider);
    const neexCompletions = vscode.languages.registerCompletionItemProvider(neexSelector, markupCompletionItemProvider);

    const sheetCompletions = vscode.languages.registerCompletionItemProvider(sheetSelector, stylesheetCompletionItemProvider);

    const colorProvider = vscode.languages.registerColorProvider(sheetSelector, stylesheetColorProvider);

    const clearCache = vscode.commands.registerCommand("liveviewnative.clearCache", (args) => {
        context.workspaceState.update("hosted_view_list", undefined);
    });

    context.subscriptions.push(neexHover, neexCompletions, sheetCompletions, colorProvider, clearCache);
}

export function deactivate() { }
