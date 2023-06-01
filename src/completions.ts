import * as vscode from 'vscode';

import { getDocs, getViews } from './documentation';
import * as markdown from './markdown';
import { fieldSnippet, fieldTypeName, loadModifiers, modifierSnippet } from './modifiers';

const completionItemProvider: vscode.CompletionItemProvider = {
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
            modifierAttributeCompletion.insertText = new vscode.SnippetString("modifiers={@native |> $0}");
            attributeCompletions.push(modifierAttributeCompletion);
        }

        const modifierCompletions = await Object.entries(loadModifiers()).filter(([name, _]) => name.startsWith(word)).reduce(async (prevPromise, [name, modifier]) => {
            const prev = await prevPromise;

            let documentation: vscode.MarkdownString | undefined;
            try {
                const docData = await getDocs(`${name.split('_').join('')}modifier.json`);
                documentation = new vscode.MarkdownString(
                    markdown.parseAbstract(docData) + "\n\n" + markdown.parseDocumentationData(docData)
                );
            } catch {}

            const completeItem = new vscode.CompletionItem(
                {
                    label: name,
                    detail: `(${modifier.fields.map(f => f.source).join(', ')})`,
                    description: "Modifier"
                },
                vscode.CompletionItemKind.Method
            );
            completeItem.insertText = modifierSnippet(name, modifier.fields);
            completeItem.documentation = documentation;
            const partialFields = modifier.fields.filter((f) => !f.default);
            if (modifier.fields.length !== partialFields.length) {
                const partialItem = new vscode.CompletionItem(
                    {
                        label: name,
                        detail: `(${partialFields.map(f => f.source).join(', ')})`,
                        description: "Modifier"
                    },
                    vscode.CompletionItemKind.Method
                );
                partialItem.insertText = modifierSnippet(name, partialFields);
                partialItem.documentation = documentation;
                return [...prev, completeItem, partialItem];
            } else {
                return [...prev, completeItem];
            }
        }, Promise.resolve(new Array<vscode.CompletionItem>()));

        const modifierExpr = /(\w+)\((\w+\s*[^)]*?,?\s*)?(\w+)?$/;
        const modifierPrefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(modifierExpr);
        let modifierArgumentCompletions: vscode.CompletionItem[] = [];
        if (!!modifierPrefix && modifierPrefix.length > 1) {
            modifierArgumentCompletions = await Promise.all(loadModifiers()[modifierPrefix[1]].fields
                .filter((field) => field.source.includes(modifierPrefix[3] ?? ""))
                .map(async (field) => {
                    let documentation: vscode.MarkdownString | undefined;
                    try {
                        const docData = await getDocs(`${modifierPrefix[1].split('_').join('')}modifier/${field.source.split('_').join('')}.json`);
                        documentation = new vscode.MarkdownString(
                            markdown.parseAbstract(docData) + "\n\n" + markdown.parseDocumentationData(docData)
                        );
                    } catch {}
                    const item = new vscode.CompletionItem(
                        {
                            label: field.source,
                            detail: `: ${fieldTypeName(field)}`
                        },
                        vscode.CompletionItemKind.Field
                    );
                    item.insertText = new vscode.SnippetString(fieldSnippet(1, field));
                    item.documentation = documentation;
                    return item;
                }));
        }

        return [
            ...viewCompletions,
            ...attributeCompletions,
            ...modifierCompletions,
            ...modifierArgumentCompletions
        ];
    },
};

export default completionItemProvider;