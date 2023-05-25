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

        let hovers: vscode.MarkdownString[] = [];
        
        const modifiers = loadModifiers();
        if (Object.keys(modifiers).includes(wordContent)) {
            const docData = await getDocs(`${wordContent.toLowerCase().replace('_', '')}modifier.json`);
            hovers.push(...[
                new vscode.MarkdownString(markdown.parseAbstract(docData)),
                new vscode.MarkdownString(markdown.parseDocumentationData(docData))
            ]);
        }

        switch (document.getText(new vscode.Range(
            word.start.with({ character: word.start.character - 1 }),
            word.start
        ))) {
            case "<":
                const suffix = document.getText(new vscode.Range(
                    word.end,
                    word.end.with({ character: word.end.character + 1 })
                ));
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
                const attrExpr = /\s*<(\w+)\s*((\w|-)+=\"[^\"]*\"\s*)*\w*/;
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
                break;
        }
        return new vscode.Hover(hovers);
    },
};

export default hoverProvider;