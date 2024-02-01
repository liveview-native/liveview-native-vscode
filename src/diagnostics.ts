import * as vscode from 'vscode';
import { getStylesheetLanguageSchemas } from './modifiers';

const stylesheetDeprecationDiagnostics = vscode.languages.createDiagnosticCollection("lvn-stylesheet-deprecations");
export const stylesheetDiagnosticProvider = async (document: vscode.TextDocument) => {
    const text = document.getText();
    const deprecations = (await getStylesheetLanguageSchemas())
        .reduce((result, schema) => result.concat(
            (Object.entries(schema.deprecations).reduce((result, pair) => {
                const [key, value] = pair;
                if (key in schema.modifiers) {
                    return result;
                }
                const expr = new RegExp(`(${key})\\s*\\(`, 'g');
                return result.concat(
                    [...text.matchAll(expr)].map(match => {
                        const diagnostic = new vscode.Diagnostic(
                            new vscode.Range(document.positionAt(match.index!), document.positionAt(match.index! + match[1].length)),
                            value,
                            vscode.DiagnosticSeverity.Information
                        );
                        diagnostic.tags = [vscode.DiagnosticTag.Deprecated];
                        return diagnostic;
                    })
                );
            }, new Array<vscode.Diagnostic>()))
        ), new Array<vscode.Diagnostic>());
    stylesheetDeprecationDiagnostics.set(
        document.uri,
        deprecations
    );
};