import * as vscode from 'vscode';
import { execSync } from 'child_process';

const modifierListScript = `
defmodule Info do
  def cast_type({:parameterized, _, %{ :mappings => mappings }}), do: Map.keys(Enum.into(mappings, %{}))
  def cast_type({:array, type}), do: "[#{type}]"
  def cast_type(type), do: type

  def cast_arguments(arguments), do: Enum.map(arguments, &Info.cast_argument/1)
  def cast_argument({name, _, default}), do: %{ name: name, default: default }
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
      constructors: mod.__info__(:functions)
        |> Enum.reject(fn {name, _} -> name != :params end)
        |> Enum.map(fn {_, arity} ->
          mod.__info__(:compile)[:source]
            |> to_string()
            |> File.read!()
            |> Code.string_to_quoted!()
            |> Macro.prewalk([], fn
              result = {:def, _, [{:params, _, [_ | _] = arguments} | _]}, acc ->
                if length(arguments) == arity, do: {result, Info.cast_arguments(arguments)}, else: {result, acc}
              other, acc -> {other, acc}
            end)
            |> elem(1)
        end)
    }
  } end)
  |> Enum.into(%{})
  |> Jason.encode!([pretty: true])
  |> IO.puts
`;

type ModifierField = {
    source: string,
    type: string | string[],
    default: any
};

type ModifierConstructorArgument = {
    name: string,
    default: any
};
type ModifierConstructor = ModifierConstructorArgument[];

type ModifierSchema = {
    fields: ModifierField[],
    constructors: ModifierConstructor[],
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
                .replace(/[^{]*/, '')
        );
        return modifiers!;
    } catch (error) {
        return {};
    }
};

export const fieldTypeName = (field: ModifierField) => {
    if (field.type instanceof Array) {
        return field.type.map((t) => ":" + t).join(",");
    } else {
        return field.type.split('.').at(-1);
    }
};

export const fieldSnippet = (i: number, field: ModifierField) => {
    if (field.type instanceof Array) {
        return `${field.source}: \$\{${i + 1}|${field.type.map((t) => ":" + t).join(",")}|\}`;
    } else {
        return `${field.source}: \$\{${i + 1}:${field.type.split('.').at(-1)}\}`;
    }
};

export const modifierSnippet = (name: string, fields: ModifierField[]) => {
    let snippet = `${name}(`;
    for (const [i, field] of fields.entries()) {
        if (i > 0) {
            snippet += ', ';
        }
        snippet += fieldSnippet(i, field);
    }
    snippet += ')';
    return new vscode.SnippetString(snippet);
};