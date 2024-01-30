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

const colors = [
    "Color(.sRGB, red: 1, green: 1, blue: 1, opacity: 1)",
    "Color(.sRGB, white: 1, opacity: 1)",
    ".red",
    ".orange",
    ".yellow",
    ".green",
    ".mint",
    ".teal",
    ".cyan",
    ".blue",
    ".indigo",
    ".purple",
    ".pink",
    ".brown",
    ".white",
    ".gray",
    ".black",
    ".clear",
    ".primary",
    ".secondary",
].map(c => c.split(',').join('\\,').split('|').join('\\|'));

const typeCompletion = (name: string, type: string, index: number) => {
    const generic = type.match(/^(?<wrapper>\w+)<(?<inner>.+)(?<innerOptional>\??)>(?<wrapperOptional>\??)$/);
    const baseTypeName = (generic?.groups?.inner ?? type).split('.').at(-1)!;
    const cases = modifiers.enums?.[baseTypeName]?.map(c => `.${c}`);
    if (!!generic?.groups) {
        switch (generic.groups.wrapper) {
        case 'ChangeTracked':
            return `attr("\$\{${index}:${name}\}")`;
        case 'AttributeReference':
            return `\$\{${index}|attr("${name}"),${cases && cases.length > 0 ? cases.join(',') : type}|\}`;
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
        case 'SwiftUI.Color':
            return `\$\{${index}|${colors.join(',')}|\}`;
        case 'AnyShapeStyle':
            const cases = colors.concat([
                `.angularGradient(colors: [.blue, .green], center: .center, startAngle: .zero, endAngle: .degrees(180))`,
                `.conicGradient(colors: [.blue, .green], center: .center)`,
                `.ellipticalGradient(colors: [.blue, .green])`,
                `.linearGradient(colors: [.blue, .green], startPoint: .leading, endPoint: .trailing)`,
                `.radialGradient(colors: [.blue, .green], center: .center, startRadius: 0, endRadius: 10)`,
                `.image(Image("name"))`,
                `.ultraThinMaterial`,
                `.thinMaterial`,
                `.regularMaterial`,
                `.thickMaterial`,
                `.ultraThickMaterial`,
                `.bar`,
            ].map(c => c.split(',').join('\\,').split('|').join('\\|')));
            return `\$\{${index}|${cases.join(',')}|\}`;
    }
    if (!!cases && cases.length > 0) {
        return `\$\{${index}|${cases.join(',')}|\}`;
    } else {
        return `\$\{${index}:${cases ?? type}\}`;
    }
};