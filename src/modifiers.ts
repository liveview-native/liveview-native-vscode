import * as vscode from 'vscode';
import * as modifierData from './data/swiftui-modifiers.json';

type ModifierParameter = {
    firstName: string;
    secondName?: string | undefined;
    type: string;
};
type ModifierSignature = ModifierParameter[];
type ModifierSchema = { [name: string]: ModifierSignature[] };

export const modifiers = modifierData as ModifierSchema;

export const parameterSnippet = (i: number, parameter: ModifierParameter) => {
    if (parameter.firstName === "_") { // unlabelled parameter
        return `\$\{${i + 1}:${parameter.type}\}`;
    } else {
        return `${parameter.firstName}: \$\{${i + 1}:${parameter.type}\}`;
    }
};

export const modifierSnippet = (name: string, signature: ModifierParameter[]) => {
    let snippet = `${name}(`;
    for (const [i, parameter] of signature.entries()) {
        if (i > 0) {
            snippet += ', ';
        }
        snippet += parameterSnippet(i, parameter);
    }
    snippet += ')';
    return new vscode.SnippetString(snippet);
};