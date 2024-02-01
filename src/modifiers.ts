import * as vscode from 'vscode';

type ModifierParameter = {
    firstName: string;
    secondName?: string | undefined;
    type: string;
};
type ModifierSignature = ModifierParameter[];
type StylesheetLanguageSchema = {
    format: string;
    framework: string;
    modifiers: { [name: string]: ModifierSignature[] };
    enums: { [name: string]: string[] };
    types: string[];
};

export const getStylesheetLanguageSchemas = async () => {
    const schemaURIs = await vscode.workspace.findFiles("deps/*/stylesheet-language.json");
    return await Promise.all(
        schemaURIs.map(async (uri) => JSON.parse(
            Buffer.from(
                await vscode.workspace.fs.readFile(uri)
            ).toString('utf-8')
        ) as StylesheetLanguageSchema)
    );
};

export const parameterSnippet = (schema: StylesheetLanguageSchema, i: number, parameter: ModifierParameter) => {
    if (parameter.firstName === "_") { // unlabelled parameter
        return typeCompletion(schema, parameter.secondName ?? "_", parameter.type, i + 1);
    } else {
        return `${parameter.firstName}: ${typeCompletion(schema, parameter.firstName, parameter.type, i + 1)}`;
    }
};

export const modifierSnippet = (schema: StylesheetLanguageSchema, name: string, signature: ModifierParameter[]) => {
    let snippet = `${name}(`;
    for (const [i, parameter] of signature.entries()) {
        if (i > 0) {
            snippet += ', ';
        }
        snippet += parameterSnippet(schema, i, parameter);
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

const primitiveCases = (type: string) => {
    switch (type) {
    case 'Bool':
        return ["true", "false"];
    default:
        return [];
    }
};

const typeCompletion = (schema: StylesheetLanguageSchema, name: string, type: string, index: number) => {
    const generic = type.match(/^(?<wrapper>\w+)<(?<inner>(\w|\.|\<|\>)+)(?<innerOptional>\??)>(?<wrapperOptional>\??)$/);
    const baseType = type.match(/^(?<type>(\w|\.|\<|\>)+)(?<optional>\??)$/);
    const baseTypeName = (generic?.groups?.inner ?? baseType?.groups?.type ?? type).split('.').at(-1)!;
    const enumCases = schema.enums?.[baseTypeName]?.map(c => `.${c}`) ?? [];
    const typeCases = primitiveCases(baseTypeName);
    let cases = [...enumCases, ...typeCases];
    if (generic?.groups?.innerOptional === "?" || generic?.groups?.wrapperOptional === "?" || baseType?.groups?.optional === "?") {
        cases.push("nil");
    }
    if (!!generic?.groups) {
        switch (generic.groups.wrapper) {
        case 'ChangeTracked':
            return `attr("\$\{${index}:${name}\}")`;
        case 'AttributeReference':
            return `\$\{${index}|attr("${name}"),${cases.length > 0 ? cases.join(',') : type}|\}`;
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
        case 'Swift.Bool':
            return `\$\{${index}|true,false|\}`;
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
    if (cases.length > 0) {
        return `\$\{${index}|${[...cases, type].join(',')}|\}`;
    } else {
        return `\$\{${index}:${type}\}`;
    }
};