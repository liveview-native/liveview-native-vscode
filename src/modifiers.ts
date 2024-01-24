import * as vscode from 'vscode';
import * as modifierData from './data/swiftui-modifiers.json';

type ModifierParameter = {
    firstName: string;
    secondName?: string | undefined;
    type: string;
};
type ModifierSignature = ModifierParameter[];
type ModifierSchema = {
    modifiers: { [name: string]: ModifierSignature[] };
    enums: { [name: string]: string[] };
};

export const modifiers = modifierData as ModifierSchema;

export const parameterSnippet = (i: number, parameter: ModifierParameter) => {
    if (parameter.firstName === "_") { // unlabelled parameter
        return typeCompletion(parameter.secondName ?? "_", parameter.type, i + 1);
    } else {
        return `${parameter.firstName}: ${typeCompletion(parameter.firstName, parameter.type, i + 1)}`;
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

const typeCompletion = (name: string, type: string, index: number) => {
    const generic = type.match(/^(?<wrapper>\w+)<(?<inner>.+)>$/);
    const baseTypeName = (generic?.groups?.inner ?? type).split('.').at(-1)!;
    const cases = modifiers.enums?.[baseTypeName]?.map(c => `.${c}`);
    if (!!generic?.groups) {
        switch (generic.groups.wrapper) {
        case 'ChangeTracked':
            return `attr("\$\{${index}:${name}\}")`;
        case 'AttributeReference':
            return `\$\{${index}|attr("${name}"),${cases?.join(',') ?? type}|\}`;
        }
    }
    switch (type) {
    case 'ViewReference':
    case 'InlineViewReference':
    case 'TextReference':
    case 'ToolbarContentReference':
    case 'CustomizableToolbarContentReference':
        return `:\$\{${index}:${name}\}`;
    case 'Event':
        return `event("\$\{${index}:${name}\}")`;
    case 'SwiftUI.LocalizedStringKey':
    case 'Swift.String':
        return `"\$\{${index}:${name}\}"`;
    }
    if (!!cases && cases.length > 0) {
        return `\$\{${index}|${cases.join(',')}|\}`;
    } else {
        return `\$\{${index}:${cases ?? type}\}`;
    }
};