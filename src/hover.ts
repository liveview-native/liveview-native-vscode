import * as vscode from 'vscode';

import * as markdown from './markdown';
import { getDocs, getViews } from './documentation';
import { loadModifiers } from './modifiers';

const snakeToCamel = (str: string): string =>
    str.toLowerCase().replace(/([-_][a-z])/g, group =>
        group
            .toUpperCase()
            .replace('-', '')
            .replace('_', '')
    );

const hoverProvider: vscode.HoverProvider = {
    async provideHover(document, position, token) {
        const allViews = await getViews();
        // Use HTML word boundaries.
        const word = document.getWordRangeAtPosition(position, new RegExp("(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\$\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\s]+)"));
        if (!word) {
            return undefined;
        }
        const wordContent = document.getText(word);
        const prefix = document.getText(new vscode.Range(
            word.start.with({ character: word.start.character - 1 }),
            word.start
        ));
        const suffix = document.getText(new vscode.Range(
            word.end,
            word.end.with({ character: word.end.character + 1 })
        ));

        let hovers: vscode.MarkdownString[] = [];
        
        try {
            const modifiers = loadModifiers();
            if (Object.keys(modifiers).includes(wordContent) && suffix === "(") {
                const docData = await getDocs(`${wordContent.toLowerCase().split('_').join('')}modifier.json`);
                hovers.push(...[
                    new vscode.MarkdownString(markdown.parseAbstract(docData)),
                    new vscode.MarkdownString(markdown.parseDocumentationData(docData))
                ]);
            }

            switch (prefix) {
                case "<":
                    if (suffix !== '>' && suffix !== ' ') {
                        return undefined;
                    }
                    if (!allViews.includes(wordContent)) {
                        return undefined;
                    }
                    const docData = await getDocs(`${wordContent.toLowerCase()}.json`);
                    hovers.push(...[
                        new vscode.MarkdownString(markdown.parseAbstract(docData)),
                        new vscode.MarkdownString(markdown.parseDocumentationData(docData))
                    ]);
                    break;
                case " ":
                    const attrExpr = /<(\w+).*?([\w-]+)$/;
                    const prefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(attrExpr);
                    if (!!prefix && prefix.length > 1) {
                        const docData = await getDocs(`${prefix[1].toLowerCase()}/${snakeToCamel(wordContent).toLowerCase()}.json`);
                        hovers.push(...[
                            new vscode.MarkdownString(markdown.parseAbstract(docData)),
                            new vscode.MarkdownString(markdown.parseDocumentationData(docData))
                        ]);
                    }
                    break;
                default:
                    const modifierExpr = /(\w+)\((\w+\s*[^)]*?,?\s*)?(\w+)$/;
                    const modifierPrefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(modifierExpr);
                    if (!!modifierPrefix && modifierPrefix.length > 1) {
                        const docData = await getDocs(`${snakeToCamel(modifierPrefix[1]).toLowerCase()}modifier/${snakeToCamel(wordContent).toLowerCase()}.json`);
                        hovers.push(...[
                            new vscode.MarkdownString(markdown.parseAbstract(docData)),
                            new vscode.MarkdownString(markdown.parseDocumentationData(docData))
                        ]);
                    }
                    break;
            }
        } catch (error) {
            console.error(error);
        }
        return new vscode.Hover(hovers);
    },
};

export default hoverProvider;