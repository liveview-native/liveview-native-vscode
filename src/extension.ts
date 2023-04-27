import * as path from 'path';
import * as glob from 'glob';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as util from 'util';
import * as crypto from 'crypto';
import { exec as execCallback } from 'child_process';
import * as markdown from './markdown';

const snakeToCamel = (str: string): string =>
    str.toLowerCase().replace(/([-_][a-z])/g, group =>
        group
            .toUpperCase()
            .replace('-', '')
            .replace('_', '')
    );

export async function activate(context: vscode.ExtensionContext) {
    const channel = vscode.window.createOutputChannel("LiveView Native");
    const exec = async (command: string) => {
        const promise = util.promisify(execCallback)(command);
        promise.child.stdout?.on('data', (data) => channel.append(data));
        promise.child.stderr?.on('data', (data) => channel.append(data));
        await promise;
    };

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
        const workingDirectory = path.join(path.dirname(mixFiles[0].path), "deps", "live_view_native_swift_ui");

        const cachePath = path.join(workingDirectory, "docc_build", ".lvn_vscode_cache");
        let previousMixHash: string | undefined;
        try {
            previousMixHash = fs.readFileSync(cachePath, "binary");
        } catch {
            previousMixHash = undefined;
        }
        const mixContents = fs.readFileSync(mixFiles[0].path, "binary");
        const mixHash = crypto.createHash('md5').update(mixContents).digest('hex');

        if (previousMixHash === mixHash) {
            progress.report({ message: "Using cached documentation" });
            return;
        }

        progress.report({ message: "Building BuiltinRegistryGenerator" });
        await exec(`cd "${workingDirectory}" && xcodebuild -quiet -scheme BuiltinRegistryGenerator -destination "platform=macOS" -derivedDataPath docc_build`);

        progress.report({ message: "Building documentation" });
        await exec(`cd "${workingDirectory}" && xcodebuild docbuild -quiet -scheme LiveViewNative -destination generic/platform=iOS -derivedDataPath docc_build`);

        progress.report({ message: "Generating documentation extensions" });
        try {
            await exec(`cd "${workingDirectory}" && xcrun swift package plugin --allow-writing-to-package-directory generate-documentation-extensions`);
        } catch { }

        progress.report({ message: "Building documentation with extensions" });
        await exec(`cd "${workingDirectory}" && xcodebuild docbuild -quiet -scheme LiveViewNative -destination generic/platform=iOS -derivedDataPath docc_build`);

        fs.writeFileSync(cachePath, mixHash, "utf8");
    });

    const selector = { language: 'phoenix-heex', pattern: '**/*.ios.heex' };
    const hover = vscode.languages.registerHoverProvider(selector, {
        provideHover(document, position, token) {
            // Use HTML word boundaries.
            const word = document.getWordRangeAtPosition(position, new RegExp("(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\$\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\s]+)"));
            if (!word) {
                return undefined;
            }
            const wordContent = document.getText(word);
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
                    if (!views.includes(wordContent)) {
                        return undefined;
                    }
                    const docData = JSON.parse(fs.readFileSync(path.join(docsPath, `${wordContent.toLowerCase()}.json`), "binary"));
                    return new vscode.Hover([
                        new vscode.MarkdownString(markdown.parseAbstract(docData)),
                        new vscode.MarkdownString(markdown.parseDocumentationData(docData))
                    ]);
                case " ":
                    console.log("attr " + wordContent);
                    const attrExpr = /\s*<(\w+)\s*((\w|-)+=\"[^\"]*\"\s*)*\w*/;
                    const prefix = document.getText(new vscode.Range(position.with({ character: 0 }), position)).match(attrExpr);
                    if (!!prefix && prefix.length > 1) {
                        const docData = JSON.parse(fs.readFileSync(path.join(docsPath, `${prefix[1].toLowerCase()}/${snakeToCamel(wordContent).toLowerCase()}.json`), "binary"));
                        return new vscode.Hover([
                            new vscode.MarkdownString(markdown.parseAbstract(docData)),
                            new vscode.MarkdownString(markdown.parseDocumentationData(docData))
                        ]);
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
                attributeCompletions = markdown.findAttributes(docData).map((attribute) => {
                    const completion = new vscode.CompletionItem(attribute);
                    completion.insertText = new vscode.SnippetString(`${attribute}=\"$0\"`);
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
export function deactivate() { }
