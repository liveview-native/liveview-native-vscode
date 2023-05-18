import * as vscode from 'vscode';

import * as path from 'path';
import * as fs from 'fs';

import { getDocs, getViews } from './documentation';
import * as markdown from './markdown';

const completionItemProvider: vscode.CompletionItemProvider = {
    async provideCompletionItems(document, position, token, context) {
        const views = await getViews();
        const word = document.getText(document.getWordRangeAtPosition(position));
        const viewCompletions = views
            .filter((view) => view.includes(word))
            .map((view) => {
                const completion = new vscode.CompletionItem(view, vscode.CompletionItemKind.Struct);
                completion.insertText = new vscode.SnippetString(`${view}>$0</${view}>`);
                completion.sortText = `<${view}`;
                return completion;
            });
        const attrExpr = /\s*<(\w+)\s*((\w|-)+=\"[^\"]*\"\s*)*\w*/;
        const prefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(attrExpr);
        let attributeCompletions: vscode.CompletionItem[] = [];
        if (!!prefix && prefix.length > 1 && views.includes(prefix[1])) {
            const docData = await getDocs(`${prefix[1].toLowerCase()}.json`);
            attributeCompletions = markdown.findAttributes(docData).map((attribute) => {
                const completion = new vscode.CompletionItem(attribute, vscode.CompletionItemKind.Property);
                completion.insertText = new vscode.SnippetString(`${attribute}=\"$0\"`);
                completion.sortText = `_`;
                return completion;
            });
            const modifierAttributeCompletion = new vscode.CompletionItem("modifiers", vscode.CompletionItemKind.Property);
            modifierAttributeCompletion.insertText = new vscode.SnippetString("modifiers={@native |> $0}");
            attributeCompletions.push(modifierAttributeCompletion);
        }
        return viewCompletions.concat(attributeCompletions);
    },
};

export default completionItemProvider;