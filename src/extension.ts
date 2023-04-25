import * as path from 'path';
import * as glob from 'glob';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';

const camelToSnake = (str: string): string => str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
const snakeToCamel = (str: string): string =>
str.toLowerCase().replace(/([-_][a-z])/g, group =>
    group
      .toUpperCase()
      .replace('-', '')
      .replace('_', '')
  );

function parseInline(inline: any): string {
	switch (inline.type) {
	case "text":
		return inline.text;
	case "codeVoice":
		return `\`${inline.code}\``;
	case "reference":
		return `\`${inline.identifier.split('/').at(-1)}\``;
	default:
		return `~~${inline.type}~~`;
	}
}

function parseContent(content: any): string {
	switch (content.type) {
	case "heading":
		return `${"#".repeat(content.level)} ${content.text}`;
	case "paragraph":
		return content.inlineContent.map(parseInline).join('');
	case "codeListing":
		return `\`\`\`${content.syntax}\n${content.code.join('\n')}\n\`\`\``;
	case "unorderedList":
		return content.items.map((item: any) => "* " + item.content.map(parseContent).join('')).join('\n');
	default:
		return `~~${content.type}~~`;
	}
}

function findAttributes(data: any): string[] {
	const id = data.identifier.url + '/';
	return data.topicSections.filter((section: any) => section.title === "Instance Properties")[0].identifiers.map((prop: string) => prop.replace(id, ''));
}

export async function activate(context: vscode.ExtensionContext) {
	// Find all View types.
	const mixFiles = await vscode.workspace.findFiles("**/mix.exs", "**/deps/**");
	let views: string[] = [];
	for (const mixFile of mixFiles) {
		const viewDir = path.join(path.dirname(mixFile.path), "deps", "live_view_native_swift_ui", "Sources", "LiveViewNative", "Views");
		const viewPaths: string[] = await new Promise((resolve, reject) => {
			glob.glob(viewDir + "/**/*.swift", (error, matches) => {
				if (!!error) {
					reject(error);
				} else {
					resolve(matches);
				}
			});
		});
		views = views.concat(viewPaths.map((v) => path.basename(v).replace('.swift', '')));
	}
	// Load documentation.
	const docsPath = path.join(path.dirname(mixFiles[0].path), "deps", "live_view_native_swift_ui", "docc_build", "Build", "Products", "Debug-iphoneos", "LiveViewNative.doccarchive", "data", "documentation", "liveviewnative");
	vscode.window.withProgress({
		location: vscode.ProgressLocation.Window,
		cancellable: false,
		title: "LiveView Native",
	}, async (progress) => {
		console.log('withProgress');
		await new Promise<void>((resolve, reject) => {
			const workingDirectory = path.join(path.dirname(mixFiles[0].path), "deps", "live_view_native_swift_ui");
			progress.report({ message: "Building BuiltinRegistryGenerator" });
			exec(
				`cd ${workingDirectory} && xcodebuild -scheme BuiltinRegistryGenerator -destination "platform=macOS" -derivedDataPath docc_build`,
				(error, stdout, stderr) => {
					console.error(error);
					console.log(stdout);
					console.error(stderr);
					progress.report({ message: "Building LiveViewNative" });
					exec(
						`cd ${workingDirectory} && xcodebuild docbuild -scheme LiveViewNative -destination generic/platform=iOS -derivedDataPath docc_build`,
						(error, stdout, stderr) => {
							console.error(error);
							console.log(stdout);
							console.error(stderr);
							resolve();
						}
					);
				}
			);
		});
		progress.report({ increment: 100 });
	});
	
	const selector = { language: 'phoenix-heex', pattern: '**/*.ios.heex' };
	const hover = vscode.languages.registerHoverProvider(selector, {
		provideHover(document, position, token) {


			const word = document.getWordRangeAtPosition(position, new RegExp("(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\$\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\s]+)"));
			if (!word) {
				return undefined;
			}
			const view = document.getText(word);
			console.log(view)
			switch (document.getText(new vscode.Range(
				word.start.with({ character: word.start.character - 1 }),
				word.start
			))) {
			case "<":
				const suffix = document.getText(new vscode.Range(
					word.end,
					word.end.with({ character: word.end.character + 1 })
				));
				if (suffix !== '>' && suffix !== ' ') {
					return undefined;
				}
				if (!views.includes(view)) {
					return undefined;
				}
				const docData = JSON.parse(fs.readFileSync(path.join(docsPath, `${view.toLowerCase()}.json`), "binary"));
				const content = docData.primaryContentSections.filter((section: any) => section.kind === "content")[0].content;
				return new vscode.Hover([
					new vscode.MarkdownString(`\`\`\`html
<${view}>
\`\`\``)
				].concat(content.map((content: any) => new vscode.MarkdownString(parseContent(content)))));
			case " ":
				const attrExpr = /\s*<(\w+)\s*((\w|-)+=\"[^\"]*\"\s*)*\w*/;
				const prefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(attrExpr);
				if (!!prefix && prefix.length > 1) {
					const attrData = JSON.parse(fs.readFileSync(path.join(docsPath, `${prefix[1].toLowerCase()}/${snakeToCamel(view).toLowerCase()}.json`), "binary"));
					const content = attrData.primaryContentSections.filter((section: any) => section.kind === "content")[0].content;
					return new vscode.Hover([
						new vscode.MarkdownString(`\`\`\`html
${view}
\`\`\``)
					].concat(content.map((content: any) => new vscode.MarkdownString(parseContent(content)))));
				}
				return undefined;
			default:
				return undefined;
			}
		},
	});
	const completions = vscode.languages.registerCompletionItemProvider(selector, {
		provideCompletionItems(document, position, token, context) {
			const word = document.getText(document.getWordRangeAtPosition(position));
			const viewCompletions = views
				.filter((view) => view.includes(word))
				.map((view) => {
					const completion = new vscode.CompletionItem(view);
					completion.insertText = new vscode.SnippetString(`${view}>$0</${view}>`);
					completion.sortText = `<${view}`;
					return completion;
				});
			const attrExpr = /\s*<(\w+)\s*((\w|-)+=\"[^\"]*\"\s*)*\w*/;
			const prefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(attrExpr);
			let attributeCompletions: vscode.CompletionItem[] = [];
			if (!!prefix && prefix.length > 1 && views.includes(prefix[1])) {
				const docData = JSON.parse(fs.readFileSync(path.join(docsPath, `${prefix[1].toLowerCase()}.json`), "binary"));
				attributeCompletions = findAttributes(docData).map((attribute) => {
					const completion = new vscode.CompletionItem(camelToSnake(attribute));
					completion.insertText = new vscode.SnippetString(`${camelToSnake(attribute)}=\"$0\"`);
					completion.sortText = `_`;
					return completion;
				});
				const modifierAttributeCompletion = new vscode.CompletionItem("modifiers");
				modifierAttributeCompletion.insertText = new vscode.SnippetString("modifiers={@native |> $0}");
				attributeCompletions.push(modifierAttributeCompletion);
			}
			return viewCompletions.concat(attributeCompletions);
		},
	});
	context.subscriptions.push(hover, completions);
}

// This method is called when your extension is deactivated
export function deactivate() {}
