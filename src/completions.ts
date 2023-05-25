import * as vscode from 'vscode';

import { getDocs, getViews } from './documentation';
import * as markdown from './markdown';
import { execSync } from 'child_process';

const modifierListScript = `
defmodule Info do
  def cast_type({:parameterized, _, %{ :mappings => mappings }}), do: Map.keys(Enum.into(mappings, %{}))
  def cast_type({:array, type}), do: "[#{type}]"
  def cast_type(type), do: type
end

LiveViewNativePlatform.context(%LiveViewNativeSwiftUi.Platform{}).platform_modifiers
  |> Enum.map(fn {name, mod} -> {
    name,
    %{
      fields: Enum.map(
        mod.__schema__(:fields),
        fn field -> %{
          source: mod.__schema__(:field_source, field),
          type: Info.cast_type(mod.__schema__(:type, field)),
          default: Map.get(struct(mod), field)
        } end
      ),
    }
  } end)
  |> Enum.into(%{})
  |> Jason.encode!()
  |> IO.puts
`;

type ModifierField = {
    source: string,
    type: string | string[],
    default: any
};

type ModifierSchema = {
    fields: ModifierField[]
};

const loadModifiers: () => { [name: string]: ModifierSchema } = () => JSON.parse(
    execSync(`mix run -e '${modifierListScript}'`, {
        cwd: vscode.workspace.getWorkspaceFolder(vscode.workspace.workspaceFolders![0].uri)?.uri.path
    })
        .toString()
);

const modifierSnippet = (name: string, fields: ModifierField[]) => {
    let snippet = `${name}(`;
    for (const [i, field] of fields.entries()) {
        if (i > 0) {
            snippet += ', ';
        }
        if (field.type instanceof Array) {
            snippet += `${field.source}: \$\{${i + 1}|${field.type.map((t) => ":" + t).join(",")}|\}`;
        } else {
            snippet += `${field.source}: \$\{${i + 1}:${field.type.split('.').at(-1)}\}`;
        }
    }
    snippet += ')';
    return new vscode.SnippetString(snippet);
};

var modifiers: { [name: string]: ModifierSchema } | undefined;

const completionItemProvider: vscode.CompletionItemProvider = {
    async provideCompletionItems(document, position, token, context) {
        const views = await getViews();
        const word = document.getText(document.getWordRangeAtPosition(position));
        const viewCompletions = views
            .filter((view) => view.includes(word))
            .map((view) => {
                const completion = new vscode.CompletionItem(view, vscode.CompletionItemKind.Struct);
                completion.insertText = new vscode.SnippetString(`${view}>$0</${view}>`);
                completion.sortText = `<${view}`;
                return completion;
            });
        
        const attrExpr = /\s*<(\w+)\s*((\w|-)+=\"[^\"]*\"\s*)*\w*/;
        const prefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(attrExpr);
        let attributeCompletions: vscode.CompletionItem[] = [];
        if (!!prefix && prefix.length > 1 && views.includes(prefix[1])) {
            const docData = await getDocs(`${prefix[1].toLowerCase()}.json`);
            attributeCompletions = markdown.findAttributes(docData).map((attribute) => {
                const completion = new vscode.CompletionItem(attribute, vscode.CompletionItemKind.Property);
                completion.insertText = new vscode.SnippetString(`${attribute}=\"$0\"`);
                completion.sortText = `_`;
                return completion;
            });
            const modifierAttributeCompletion = new vscode.CompletionItem("modifiers", vscode.CompletionItemKind.Property);
            modifierAttributeCompletion.insertText = new vscode.SnippetString("modifiers={@native |> $0}");
            attributeCompletions.push(modifierAttributeCompletion);
        }

        if (!modifiers) {
            try {
                modifiers = loadModifiers();
            } catch {
                modifiers = undefined;
            }
        }
        const modifierCompletions = Object.entries(modifiers ?? {}).reduce((prev, [name, modifier]) => {
            const completeItem = new vscode.CompletionItem(
                {
                    label: name,
                    detail: `(${modifier.fields.map(f => f.source).join(', ')})`
                },
                vscode.CompletionItemKind.Method
            );
            completeItem.insertText = modifierSnippet(name, modifier.fields);
            const partialFields = modifier.fields.filter((f) => !f.default);
            if (modifier.fields.length !== partialFields.length) {
                const partialItem = new vscode.CompletionItem(
                    {
                        label: name,
                        detail: `(${partialFields.map(f => f.source).join(', ')})`
                    },
                    vscode.CompletionItemKind.Method
                );
                partialItem.insertText = modifierSnippet(name, partialFields);
                return [...prev, completeItem, partialItem];
            } else {
                return [...prev, completeItem];
            }
        }, new Array<vscode.CompletionItem>());

        return [
            ...viewCompletions,
            ...attributeCompletions,
            ...modifierCompletions
        ];
    },
};

export default completionItemProvider;