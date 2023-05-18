import * as vscode from 'vscode';

import * as markdown from './markdown';
import { getDocs, getViews } from './documentation';

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
                return new vscode.Hover([
                    new vscode.MarkdownString(markdown.parseAbstract(docData)),
                    new vscode.MarkdownString(markdown.parseDocumentationData(docData))
                ]);
            case " ":
                const attrExpr = /\s*<(\w+)\s*((\w|-)+=\"[^\"]*\"\s*)*\w*/;
                const prefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(attrExpr);
                if (!!prefix && prefix.length > 1) {
                    const docData = await getDocs(`${prefix[1].toLowerCase()}/${snakeToCamel(wordContent).toLowerCase()}.json`);
                    return new vscode.Hover([
                        new vscode.MarkdownString(markdown.parseAbstract(docData)),
                        new vscode.MarkdownString(markdown.parseDocumentationData(docData))
                    ]);
                }
                return undefined;
            default:
                return undefined;
        }
    },
};

export default hoverProvider;