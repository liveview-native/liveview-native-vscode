import * as vscode from 'vscode';

import { getDocs, getViews } from './documentation';
import * as markdown from './markdown';
import { modifiers, modifierSnippet, parameterSnippet } from './modifiers';

export const markupCompletionItemProvider: vscode.CompletionItemProvider = {
    async provideCompletionItems(document, position, token, context) {
        const views = await getViews();
        const word = document.getText(document.getWordRangeAtPosition(position));
        const viewCompletions = await Promise.all(views
            .filter((view) => view.includes(word))
            .map(async (view) => {
                const completion = new vscode.CompletionItem(
                    {
                        label: view,
                        description: "View"
                    },
                    vscode.CompletionItemKind.Struct
                );
                try {
                    const docData = await getDocs(`${view.toLowerCase()}.json`);
                    completion.documentation = new vscode.MarkdownString(
                        markdown.parseAbstract(docData) + "\n\n" + markdown.parseDocumentationData(docData)
                    );
                } catch {}
                completion.insertText = new vscode.SnippetString(`${view}>$0</${view}>`);
                completion.sortText = `<${view}`;
                return completion;
            }));
        
        const attrExpr = /\s*<(\w+)\s*((\w|-)+=\"[^\"]*\"\s*)*\w*/;
        const prefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(attrExpr);
        let attributeCompletions: vscode.CompletionItem[] = [];
        if (!!prefix && prefix.length > 1 && views.includes(prefix[1])) {
            const docData = await getDocs(`${prefix[1].toLowerCase()}.json`);
            attributeCompletions = await Promise.all(markdown.findAttributes(docData).map(async (attribute) => {
                const completion = new vscode.CompletionItem(
                    {
                        label: attribute,
                        description: "Attribute"
                    },
                    vscode.CompletionItemKind.Property
                );
                try {
                    const docData = await getDocs(`${prefix[1].toLowerCase()}/${attribute.replace('-', '')}.json`);
                    completion.documentation = new vscode.MarkdownString(
                        markdown.parseAbstract(docData) + "\n\n" + markdown.parseDocumentationData(docData)
                    );
                } catch {}
                completion.insertText = new vscode.SnippetString(`${attribute}=\"$0\"`);
                completion.sortText = `_`;
                return completion;
            }));
            const modifierAttributeCompletion = new vscode.CompletionItem("modifiers", vscode.CompletionItemKind.Property);
            modifierAttributeCompletion.insertText = new vscode.SnippetString("modifiers={$0}");
            attributeCompletions.push(modifierAttributeCompletion);
        }

        return [
            ...viewCompletions,
            ...attributeCompletions
        ];
    },
};

export const stylesheetCompletionItemProvider: vscode.CompletionItemProvider = {
    async provideCompletionItems(document, position, token, context) {
        const word = document.getText(document.getWordRangeAtPosition(position));
        const modifierCompletions = await Object.entries(modifiers).filter(([name, _]) => name.startsWith(word)).reduce(async (prevPromise, [name, modifier]) => {
            const prev = await prevPromise;

            let documentation: vscode.MarkdownString | undefined;
            try {
                const docData = await getDocs(`${name.split('_').join('')}modifier.json`);
                documentation = new vscode.MarkdownString(
                    markdown.parseAbstract(docData) + "\n\n" + markdown.parseDocumentationData(docData)
                );
            } catch {}

            if (modifier.length > 0) {
                return [
                    ...prev,
                    ...modifier.map(signature => {
                        const completeItem = new vscode.CompletionItem(
                            {
                                label: name,
                                detail: `(${signature.map(parameter => parameter.firstName).join(', ')})`,
                                description: "Modifier"
                            },
                            vscode.CompletionItemKind.Method
                        );
                        completeItem.insertText = modifierSnippet(name, signature);
                        completeItem.documentation = documentation;
                        return completeItem;
                    })
                ];
            } else {
                return [];
            }
        }, Promise.resolve(new Array<vscode.CompletionItem>()));

        const modifierExpr = /(\w+)\((\w+\s*[^)]*?,?\s*)?(\w+)?$/;
        const modifierPrefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(modifierExpr);
        let modifierArgumentCompletions: vscode.CompletionItem[] = [];
        if (!!modifierPrefix && modifierPrefix.length > 1) {
            modifierArgumentCompletions = await Promise.all(modifiers[modifierPrefix[1]]
                .map((signature) => signature
                    .filter((parameter) => (parameter.secondName?.includes(modifierPrefix[3] ?? "") || parameter.firstName.includes(modifierPrefix[3] ?? "")))
                    .map(async (parameter) => {
                        let documentation: vscode.MarkdownString | undefined;
                        const item = new vscode.CompletionItem(
                            {
                                label: parameter.firstName === "_" ? parameter.secondName ?? parameter.firstName : parameter.firstName,
                                detail: `: ${parameter.type}`
                            },
                            vscode.CompletionItemKind.Field
                        );
                        item.insertText = new vscode.SnippetString(parameterSnippet(1, parameter));
                        item.documentation = documentation;
                        return item;
                    })
                )
                .reduce((res, next) => res.concat(next))
            );
        }

        return [
            ...modifierCompletions,
            ...modifierArgumentCompletions
        ];
    },
};