import * as vscode from 'vscode';

import * as markdown from './markdown';
import { getDocs, getViews, getAppleDocs, appleDocsURL } from './documentation';
import { modifiers } from './modifiers';

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
            // hover on SwiftUI modifier
            if (Object.keys(modifiers.modifiers).includes(wordContent) && suffix === "(") {
                for (const signature of modifiers.modifiers[wordContent]) {
                    const docData = await getAppleDocs(`view/${wordContent}(${signature.map(parameter => (parameter.firstName + ':')).join('')}).json`);
                    hovers.push(...[
                        new vscode.MarkdownString(`\`\`\`swift\n${wordContent}(${signature.map((parameter) =>
                            parameter.firstName === "_"
                                ? (parameter.firstName + ' ' + (parameter.secondName ?? "") + ': ' + parameter.type)
                                : (parameter.firstName + ': ' + parameter.type)
                        ).join(', ')})\n\`\`\``),
                        new vscode.MarkdownString(markdown.parseAbstract(docData, appleDocsURL)),
                        new vscode.MarkdownString(markdown.parseDocumentationData(docData, appleDocsURL))
                    ]);
                }
            }

            // hover on SwiftUI type
            const allTypes = [...Object.keys(modifiers.enums), ...modifiers.types]
                .map(key => (key.startsWith('SwiftUI.')) ? key.split('.').slice(1) : key.split('.'));
            const hoverType = allTypes.find(t => t.at(-1) === wordContent);
            if (hoverType && (suffix === "." || suffix === "(")) {
                const allPaths = hoverType.at(-1)!.startsWith("Any")
                    ? [hoverType, [...hoverType.slice(0, -1), hoverType.at(-1)!.split('Any').join('')]]
                    : [hoverType];
                for (const path of allPaths) {
                    const docData = await getAppleDocs(`${path.join('/')}.json`);
                    hovers.push(...[
                        new vscode.MarkdownString(`\`\`\`swift\n${path.join('.')}\n\`\`\``),
                        new vscode.MarkdownString(markdown.parseAbstract(docData, appleDocsURL)),
                        new vscode.MarkdownString(markdown.parseDocumentationData(docData, appleDocsURL))
                    ]);
                }
            }
            // hover on SwiftUI type static member
            if (prefix === ".") {
                for (const [key, value] of Object.entries(modifiers.enums)) {
                    if (value.includes(wordContent)) {
                        const basePath = (key.startsWith('SwiftUI.')) ? key.split('.').slice(1) : key.split('.');
                        const allPaths = basePath.at(-1)!.startsWith("Any")
                            ? [basePath, [...basePath.slice(0, -1), basePath.at(-1)!.split('Any').join('')]]
                            : [basePath];
                        for (const path of allPaths) {
                            try {
                                const docData = await getAppleDocs(`${path.join('/')}/${wordContent}.json`);
                                hovers.push(...[
                                    new vscode.MarkdownString(`\`\`\`swift\n${path.join('.')}.${wordContent}\n\`\`\``),
                                    new vscode.MarkdownString(markdown.parseAbstract(docData, appleDocsURL)),
                                    new vscode.MarkdownString(markdown.parseDocumentationData(docData, appleDocsURL))
                                ]);
                            } catch {}
                        }
                    }
                }
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
                    break;
            }
        } catch (error) {
            console.error(error);
        }
        return new vscode.Hover(hovers);
    },
};

export default hoverProvider;