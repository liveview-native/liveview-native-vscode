import * as vscode from 'vscode';
import * as htmlparser2 from 'htmlparser2';

const containerTypes = [
    "HStack",
    "VStack",
    "ZStack",
    "List",
    "Group",
    undefined
];

const provider: vscode.CodeActionProvider = {
    async provideCodeActions(document, range, context, token) {
        const word = document.getWordRangeAtPosition(range.start, new RegExp("(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\$\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\s]+)"));
        if (!word) {
            return [];
        }
        const beforeStartPos = word.start.with({ character: word.start.character - 1 });
        const prefix = document.getText(new vscode.Range(
            beforeStartPos,
            word.start
        ));
        if (prefix !== "<") {
            return [];
        }
        
        const template = htmlparser2.parseDocument(
            document.getText(new vscode.Range(beforeStartPos, document.lineAt(document.lineCount - 1).range.end)),
            {
                withStartIndices: true,
                withEndIndices: true,
                lowerCaseTags: false,
                recognizeSelfClosing: true
            }
        );

        if (!template.firstChild) {
            return [];
        }
        
        const whitespace = document.lineAt(beforeStartPos.line).text.match(/\s*/)?.at(0) ?? "";

        const endOffset = document.offsetAt(range.end);
        let endPosition = document.positionAt(document.offsetAt(beforeStartPos) + template.firstChild!.endIndex! + 1);
        if (document.offsetAt(endPosition) < endOffset) { // extend the range to the end of the last selected child.
            endPosition = template.children
                .map((child) => document.positionAt(document.offsetAt(beforeStartPos) + child.endIndex! + 1))
                .find((pos) => document.offsetAt(pos) > endOffset)
                ?? range.end;
        }
        
        const embedInActions = containerTypes.map((container) => {
            const name = (() => {
                switch (container) {
                    case 'Group':
                        return 'Group';
                    case undefined:
                        return 'Embed...';
                    default:
                        return `Embed in ${container}`;
                }
            })();
            const action = new vscode.CodeAction(name, vscode.CodeActionKind.RefactorExtract);
            action.edit = new vscode.WorkspaceEdit();
    
            for (let line = beforeStartPos.line + 1; line <= endPosition.line; line++) {
                action.edit.insert(document.uri, new vscode.Position(line, 0), "\t");
            }

            const snippet = container ? `\$\{0:${container}\}` : "$1";
            action.edit.set(document.uri, [
                new vscode.SnippetTextEdit(
                    new vscode.Range(endPosition, endPosition),
                    new vscode.SnippetString(`\n${whitespace}</${snippet}>`)
                ),
                new vscode.SnippetTextEdit(
                    new vscode.Range(beforeStartPos, beforeStartPos),
                    new vscode.SnippetString(`<${snippet}$2>\n\t`)
                ),
            ]);
            return action;
        });

        const makeConditionalAction = new vscode.CodeAction("Make Conditional", vscode.CodeActionKind.RefactorRewrite);
        makeConditionalAction.edit = new vscode.WorkspaceEdit();
        if (range.start.isEqual(range.end)) {
            makeConditionalAction.edit.set(document.uri, [
                new vscode.SnippetTextEdit(
                    new vscode.Range(word.end, word.end),
                    new vscode.SnippetString(" :if={$0}")
                )
            ]);
        } else {
            makeConditionalAction.edit.set(document.uri, [
                new vscode.SnippetTextEdit(
                    new vscode.Range(endPosition, endPosition),
                    new vscode.SnippetString(`\n${whitespace}<% end %>`)
                ),
                new vscode.SnippetTextEdit(
                    new vscode.Range(beforeStartPos, beforeStartPos),
                    new vscode.SnippetString(`<%= if $0 do %>\n`)
                ),
            ]);
        }

        const repeatAction = new vscode.CodeAction("Repeat", vscode.CodeActionKind.RefactorRewrite);
        repeatAction.edit = new vscode.WorkspaceEdit();
        if (range.start.isEqual(range.end)) {
            repeatAction.edit.set(document.uri, [
                new vscode.SnippetTextEdit(
                    new vscode.Range(word.end, word.end),
                    new vscode.SnippetString(" :for={$1 <- $2}")
                )
            ]);
        } else {
            repeatAction.edit.set(document.uri, [
                new vscode.SnippetTextEdit(
                    new vscode.Range(endPosition, endPosition),
                    new vscode.SnippetString(`\n${whitespace}<% end %>`)
                ),
                new vscode.SnippetTextEdit(
                    new vscode.Range(beforeStartPos, beforeStartPos),
                    new vscode.SnippetString(`<%= for $1 <- $2 do %>\n`)
                ),
            ]);
        }

        return [
            ...embedInActions,
            makeConditionalAction,
            repeatAction,
        ];
    },
};

export default provider;