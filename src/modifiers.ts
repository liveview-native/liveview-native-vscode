import * as vscode from 'vscode';
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

var modifiers: { [name: string]: ModifierSchema } | undefined;

export const loadModifiers: () => { [name: string]: ModifierSchema } = () => {
    if (modifiers) {
        return modifiers;
    }
    try {
        modifiers = JSON.parse(
            execSync(`mix run -e '${modifierListScript}'`, {
                cwd: vscode.workspace.getWorkspaceFolder(vscode.workspace.workspaceFolders![0].uri)?.uri.path
            })
                .toString()
        );
        return modifiers!;
    } catch (error) {
        return {};
    }
};

export const modifierSnippet = (name: string, fields: ModifierField[]) => {
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