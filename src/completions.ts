import * as vscode from 'vscode';

import { getDocs, getViews, getAppleDocs, appleDocsURL } from './documentation';
import * as markdown from './markdown';
import { modifiers, modifierSnippet, parameterSnippet } from './modifiers';
import { extractAbbreviation, expandAbbreviation, getExpandOptions } from 'vscode-emmet-helper';

export const markupCompletionItemProvider: vscode.CompletionItemProvider = {
    async provideCompletionItems(document, position, token, context) {
        const views = await getViews();
        const word = document.getText(document.getWordRangeAtPosition(position));
        const viewCompletions = await Promise.all(views
            .filter((view) => view.tag.includes(word))
            .map(async (view) => {
                const completion = new vscode.CompletionItem(
                    {
                        label: view.tag,
                        description: "View"
                    },
                    vscode.CompletionItemKind.Struct
                );
                try {
                    const docData = await getDocs(`${view.tag.toLowerCase()}.json`);
                    completion.documentation = new vscode.MarkdownString(
                        markdown.parseAbstract(docData) + "\n\n" + markdown.parseDocumentationData(docData)
                    );
                } catch {}
                if (view.selfClosing) {
                    completion.insertText = new vscode.SnippetString(`<${view.tag} />`);
                } else {
                    completion.insertText = new vscode.SnippetString(`<${view.tag}>$0</${view.tag}>`);
                }
                return completion;
            }));
        
        const attrExpr = /\s*<(\w+)\s*((\w|-)+=(\"[^\"]*\"|\'[^\']*\')\s*)*\w*/;
        const prefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(attrExpr);
        let attributeCompletions: vscode.CompletionItem[] = [];
        if (!!prefix && prefix.length > 1 && views.some(v => v.tag === prefix[1])) {
            try {
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
            } catch (error) {
                console.error(error);
            }
        }

        const emmetSyntax = extractAbbreviation(document as any, position, { lookAhead: true, type: 'markup' });
        const emmetCompletions: vscode.CompletionItem[] = [];
        if (views.some(v => emmetSyntax?.abbreviation.includes(v.tag))) {
            const emmetCompletion = new vscode.CompletionItem(emmetSyntax!.abbreviation, vscode.CompletionItemKind.Snippet);
            const options = getExpandOptions('html');
            emmetCompletion.insertText = new vscode.SnippetString(expandAbbreviation(emmetSyntax!.abbreviation, options));
            emmetCompletion.range = emmetSyntax?.abbreviationRange as vscode.Range;
            emmetCompletion.sortText = "_";
            emmetCompletions.push(emmetCompletion);
        }

        return [
            ...emmetCompletions,
            ...viewCompletions,
            ...attributeCompletions,
            ...((prefix && prefix[0].endsWith("style")) ? await getModifierCompletions(word) : [])
        ];
    },
};

const getModifierCompletions = async (word: string) => {
    return await Object.entries(modifiers.modifiers)
        .filter(([name, _]) => name.toLowerCase().includes(word.toLowerCase()))
        .reduce(async (prevPromise, [name, modifier]) => {
            const prev = await prevPromise;

            if (modifier.length > 0) {
                return [
                    ...prev,
                    ...(await Promise.all(modifier.map(async signature => {
                        const completeItem = new vscode.CompletionItem(
                            {
                                label: name,
                                detail: `(${signature.map(parameter => parameter.firstName).join(', ')})`,
                                description: "Modifier"
                            },
                            vscode.CompletionItemKind.Method
                        );
                        try {
                            const docData = await getAppleDocs(`view/${name}(${signature.map(parameter => (parameter.firstName + ':')).join('')}).json`);
                            completeItem.documentation = new vscode.MarkdownString(
                                markdown.parseAbstract(docData, appleDocsURL) + "\n\n" + markdown.parseDocumentationData(docData, appleDocsURL)
                            );
                        } catch {}
                        completeItem.insertText = modifierSnippet(name, signature);
                        return completeItem;
                    })))
                ];
            } else {
                return [];
            }
        }, Promise.resolve(new Array<vscode.CompletionItem>()));
}

export const stylesheetCompletionItemProvider: vscode.CompletionItemProvider = {
    async provideCompletionItems(document, position, token, context) {
        const staticSnippets = [
            new vscode.SnippetString(
                `\"\$\{1:class-name\}\" do
\t\$\{2:modifiers\}
end`
            ),
        ];

        const word = document.getText(document.getWordRangeAtPosition(position));
        const modifierCompletions = await getModifierCompletions(word);

        const modifierExpr = /(\w+)\((\w+\s*[^)]*?,?\s*)?(\w+)?$/;
        const modifierPrefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(modifierExpr);
        let modifierArgumentCompletions: vscode.CompletionItem[] = [];
        if (!!modifierPrefix && modifierPrefix.length > 1) {
            modifierArgumentCompletions = await Promise.all(modifiers.modifiers[modifierPrefix[1]]
                .map((signature) => signature
                    .filter((parameter) => (parameter.secondName?.includes(modifierPrefix[3] ?? "") || parameter.firstName.includes(modifierPrefix[3] ?? "")))
                    .map(async (parameter) => {
                        const item = new vscode.CompletionItem(
                            {
                                label: parameter.firstName === "_" ? parameter.secondName ?? parameter.firstName : parameter.firstName,
                                detail: `: ${parameter.type}`
                            },
                            vscode.CompletionItemKind.Field
                        );
                        item.insertText = new vscode.SnippetString(parameterSnippet(1, parameter));
                        return item;
                    })
                )
                .reduce((res, next) => res.concat(next))
            );
        }

        return [
            ...(staticSnippets.map((snippet) => {
                const item = new vscode.CompletionItem("LiveView Native Class", vscode.CompletionItemKind.Snippet);
                item.insertText = snippet;
                return item;
            })),
            ...modifierCompletions,
            ...modifierArgumentCompletions
        ];
    },
};